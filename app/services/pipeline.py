from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from app.core.logging import get_logger, log_context
from app.core import prompt_state
from app.core.settings import get_settings
from app.persistence import storage
from app.services import generator, scraper, social_client


_SOCIAL_QUEUE_PLATFORMS = ("linkedin", "threads", "substack_note", "instagram")
_CHECKPOINT_PERSIST_KEYS = {
    "related_articles",
    "reflection_es",
    "companion_en",
    "companion_es",
    "tags",
}

_cancel_event: Optional[threading.Event] = None
_cancel_lock = threading.Lock()
_logger = get_logger("editorial.pipeline")


def cancel_current_run() -> bool:
    global _cancel_event
    with _cancel_lock:
        if _cancel_event is None:
            return False
        _cancel_event.set()
        return True


def _utc_iso_string(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.astimezone()
    return value.astimezone(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def _queue_repurposed_bundle(
    repurposed_en: Dict[str, Any],
    repurposed_es: Dict[str, Any],
    base_date: datetime,
    source_label: str,
) -> Dict[str, Any]:
    results: Dict[str, Any] = {}
    local_tz = datetime.now().astimezone().tzinfo
    english_date = base_date if base_date.tzinfo else base_date.replace(tzinfo=local_tz)
    spanish_date = english_date + timedelta(days=1)
    scheduled_dates = {"en": english_date, "es": spanish_date}
    timezone_name = getattr(local_tz, "key", None) or str(local_tz or "")

    for lang, payload in (("en", repurposed_en), ("es", repurposed_es)):
        scheduled_at = _utc_iso_string(scheduled_dates[lang])
        for platform in _SOCIAL_QUEUE_PLATFORMS:
            text = payload.get(platform, "") if isinstance(payload, dict) else ""
            key = f"{platform}_{lang}"
            if not text:
                results[key] = {"skipped": True, "reason": "No content"}
                continue
            if platform == "instagram":
                results[key] = {"skipped": True, "reason": "Instagram requires an image URL"}
                continue
            post_id = storage.create_scheduled_post(
                platform=platform,
                text=text,
                scheduled_at=scheduled_at,
                source_label=source_label,
                timezone=timezone_name,
            )
            results[key] = {"queued": True, "id": post_id, "scheduled_at": scheduled_at}

    return results


def build_pipeline_stream(
    reflection_text: str,
    reflection_title: str,
    article_url: str,
    include_spanish: bool,
    queue_social: bool,
    checkpoint_data: Optional[Dict[str, Any]] = None,
    tone_level: int = None,
):
    global _cancel_event

    template_path = prompt_state.get_template_path()
    if not template_path.exists():
        def error_stream():
            yield f"event: error\ndata: {json.dumps({'message': 'Companion template not found. Upload it in Settings first.'})}\n\n"
        return error_stream()

    template = template_path.read_text(encoding="utf-8")

    try:
        articles = scraper.fetch_articles()
    except Exception as exc:
        def error_stream():
            yield f"event: error\ndata: {json.dumps({'message': f'Failed to load article index: {str(exc)}'})}\n\n"
        return error_stream()

    if tone_level is not None:
        generator.set_tone_level(tone_level)

    generator.reset_token_log()

    with _cancel_lock:
        _cancel_event = threading.Event()
    cancel_ev = _cancel_event

    checkpoint_meta = {
        "timestamp": datetime.now().isoformat(),
        "reflection_title": reflection_title,
        "article_url": article_url,
        "include_spanish": include_spanish,
        "reflection": reflection_text,
        "data": dict(checkpoint_data) if checkpoint_data else {},
    }

    def on_step_complete(key: str, data):
        checkpoint_meta["data"][key] = data
        if key in _CHECKPOINT_PERSIST_KEYS:
            storage.save_checkpoint(checkpoint_meta)

    def stream():
        try:
            final_result = None
            with log_context(reflection_title=reflection_title, article_url=article_url):
                for chunk in generator.run_full_pipeline_stream(
                    reflection=reflection_text,
                    reflection_title=reflection_title,
                    article_url=article_url,
                    template=template,
                    articles=articles,
                    include_spanish=include_spanish,
                    checkpoint=checkpoint_data,
                    on_step_complete=on_step_complete,
                    cancel_event=cancel_ev,
                ):
                    yield chunk
                    if chunk.startswith("event: result"):
                        data_line = chunk.split("\ndata: ", 1)[1].strip()
                        final_result = json.loads(data_line)

            if cancel_ev.is_set():
                yield "event: cancelled\ndata: {}\n\n"
                return

            storage.clear_checkpoint()
            token_summary = generator.get_token_summary()

            if final_result:
                try:
                    run_id = storage.save_run(reflection_title, article_url, final_result, token_summary)
                    quotes = final_result.get("quotes") or []
                    if quotes:
                        storage.save_quotes(run_id, reflection_title, article_url, quotes)
                    _logger.info(
                        "Persisted completed pipeline run",
                        extra={"fields": {"run_id": run_id, "quote_count": len(quotes)}},
                    )
                except Exception:
                    _logger.exception(
                        "Failed to persist completed pipeline run",
                        extra={"fields": {"title": reflection_title, "article_url": article_url}},
                    )

            yield f"event: tokens\ndata: {json.dumps(token_summary)}\n\n"

            if queue_social and final_result:
                yield f"event: progress\ndata: {json.dumps({'message': 'Queueing social posts...', 'done': False})}\n\n"
                try:
                    settings = get_settings()
                    reflection_date = social_client.get_next_weekday(
                        settings.reflection_day, *map(int, settings.reflection_time.split(":"))
                    )
                    companion_date = social_client.get_next_weekday(
                        settings.companion_day, *map(int, settings.companion_time.split(":"))
                    )
                    queue_results = {
                        "reflection": _queue_repurposed_bundle(
                            repurposed_en=final_result["reflection"]["repurposed_en"],
                            repurposed_es=final_result["reflection"]["repurposed_es"],
                            base_date=reflection_date,
                            source_label="Pipeline / Reflection",
                        ),
                        "companion": _queue_repurposed_bundle(
                            repurposed_en=final_result["companion"]["repurposed_en"],
                            repurposed_es=final_result["companion"]["repurposed_es"],
                            base_date=companion_date,
                            source_label="Pipeline / Companion",
                        ),
                    }
                    yield f"event: progress\ndata: {json.dumps({'message': 'Queued social posts for publishing', 'done': True})}\n\n"
                    yield f"event: queue_results\ndata: {json.dumps(queue_results)}\n\n"
                except Exception as exc:
                    yield f"event: progress\ndata: {json.dumps({'message': f'Queue error: {str(exc)}', 'done': True})}\n\n"

            yield "event: done\ndata: {}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'message': str(exc)})}\n\n"

    return stream()
