"""
generator.py — All Claude API calls for the editorial pipeline.
Handles: related articles, companion generation, translation, repurposed content.

Parallelism strategy
────────────────────
Wave 1 (start immediately — only need reflection text):
  • find_related_articles
  • translate_to_spanish(reflection)      [if spanish enabled]
  • generate_repurposed_content(refl, EN) [each platform call in its own thread]

Orchestrated via FIRST_COMPLETED wait loop — each task submits its
downstream work the instant it finishes, regardless of what else is running:

  related done     → submit companion
  refl_es done     → submit refl_social_es
  companion done   → submit companion_es + comp_social_en  (both in parallel)
  companion_es done→ submit comp_social_es

Each generate_repurposed_content call also parallelises its 4 platform API calls.

Effective concurrency: related / refl_es / refl_social_en / companion all
overlap as much as possible. Companion derivatives start the moment companion
finishes — no waiting for unrelated tasks like refl_es to complete first.

Estimated wall time: ~60-80s vs ~200s sequential.
"""

from __future__ import annotations

import re
import json
import queue
from concurrent.futures import ThreadPoolExecutor, as_completed, wait, FIRST_COMPLETED
from typing import Any, Dict, List, Optional, Tuple

from app.core.ai_clients import get_claude_client
from app.services import generator_helpers as helper_lib
from app.services import generator_prompts as prompt_lib
from app.services.generator_transport import call_claude as _call_claude, call_platform as _call_platform_raw, get_token_summary, reset_token_log, set_tone_level, tone_instruction as _tone_instruction


# ─── 1. Related Articles ─────────────────────────────────────────────────────

def find_related_articles(reflection: str, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    system, user = prompt_lib.build_related_prompt(reflection, articles)
    response = _call_claude(system, user)
    start = response.find("[")
    end = response.rfind("]") + 1
    return json.loads(response[start:end])


# ─── 2. Paid Companion ────────────────────────────────────────────────────────

def localize_article_url(article_url: str, localized_title: str) -> str:
    """Swap the article slug for a localized one while preserving host/query/fragment."""
    return helper_lib.localize_article_url(article_url, localized_title)


def generate_companion(
    reflection: str,
    reflection_title: str,
    reflection_url: str,
    template: str,
    related_articles: List[Dict[str, Any]],
) -> str:
    system, user = prompt_lib.build_companion_prompt(
        reflection,
        reflection_title,
        reflection_url,
        template,
        related_articles,
    )
    static_block, dynamic_block = user
    result = _call_claude(system, user, max_tokens=8000)

    issues = prompt_lib.validate_companion(result, template)
    if issues:
        issue_list = "\n".join(f"- {i}" for i in issues)
        # On retry the static block is already cached — only pay for dynamic + fix note
        retry_dynamic = {
            "type": "text",
            "text": (
                dynamic_block["text"]
                + f"\n\n───\nYour previous output had the following issues that MUST be fixed:\n{issue_list}\n\n"
                "Return the complete corrected companion fixing ONLY these issues. Do not change anything else."
            ),
        }
        result = _call_claude(system, [static_block, retry_dynamic], max_tokens=8000)

    return result


# ─── 3. Translation ──────────────────────────────────────────────────────────

def translate_to_spanish(text: str, content_type: str = "article") -> str:
    system, user = prompt_lib.build_translation_prompt(text, content_type)
    return _call_claude(system, user, max_tokens=8000)


def build_spanish_reflection_context(
    reflection_title: str,
    article_url: str,
    translated_reflection: str = "",
) -> Dict[str, Any]:
    """Derive the Spanish title from the translated reflection when possible."""
    translated_title = helper_lib.extract_title(translated_reflection).strip()
    if not translated_title:
        translated_title = translate_to_spanish(reflection_title, "newsletter article title").strip()
    return {
        "title": translated_title,
        "url": localize_article_url(article_url, translated_title),
    }


def _initial_pipeline_values(checkpoint: Dict[str, Any]) -> Dict[str, Any]:
    """Build the mutable pipeline state from a checkpoint payload."""
    return helper_lib.initial_pipeline_values(checkpoint)


def _ensure_spanish_reflection_context(vals: Dict[str, Any], reflection_title: str, article_url: str) -> None:
    """Populate Spanish title/URL once and reuse them across derivative tasks."""
    if vals["reflection_es_title"]:
        return
    ctx = build_spanish_reflection_context(reflection_title, article_url, vals["reflection_es"])
    vals["reflection_es_title"] = ctx["title"]
    vals["reflection_es_url"] = ctx["url"]


# ─── 4. Repurposed Content (with internal parallelism) ───────────────────────

def _extract_hooks(raw_text: str) -> list[str]:
    """Extract first meaningful sentence from each post section (skip titles and links)."""
    hooks = []
    for section in re.split(r'\n---\n', raw_text):
        lines = [
            l.strip() for l in section.splitlines()
            if l.strip()
            and not l.strip().startswith('#')
            and not l.strip().startswith('👉')
            and not l.strip().startswith('http')
        ]
        if lines:
            words = lines[0].split()[:8]
            hooks.append(' '.join(words).lower())
    return hooks


def check_hook_diversity(results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check if any platform has posts with too-similar opening hooks.
    Returns {platform: True/False} where True = diversity issue detected.
    """
    issues = {}
    for platform, content in results.items():
        hooks = _extract_hooks(content)
        flagged = False
        if len(hooks) >= 2:
            for i in range(len(hooks)):
                for j in range(i + 1, len(hooks)):
                    words_i = set(hooks[i].split())
                    words_j = set(hooks[j].split())
                    if len(words_i & words_j) >= 5:
                        flagged = True
                        break
                if flagged:
                    break
        issues[platform] = flagged
    return issues


# ─── Repurposed Content ───────────────────────────────────────────────────────

def generate_repurposed_content(
    text: str,
    title: str,
    article_url: str = "",
    language: str = "english",
    repurpose_note: str = "",
) -> Dict[str, Any]:
    """
    Generates repurposed content for all 4 platforms IN PARALLEL.
    All 4 Claude API calls run simultaneously in a thread pool.
    Returns a dict with keys: linkedin, instagram, threads, substack_note.
    """
    tone = _tone_instruction()

    def call_platform(platform: str, config: Dict[str, Any]) -> Tuple[str, str]:
        user = prompt_lib.build_platform_user(
            text, title, article_url, config, language, tone,
            platform=platform, repurpose_note=repurpose_note,
        )
        return platform, _call_platform_raw(config, user)

    results = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            pool.submit(call_platform, p, c): p
            for p, c in prompt_lib.PLATFORM_PROMPTS.items()
        }
        for future in as_completed(futures):
            platform, content = future.result()
            results[platform] = content

    return results


def generate_single_platform(
    text: str,
    title: str,
    article_url: str,
    platform: str,
    language: str = "english",
    repurpose_note: str = "",
) -> str:
    """Regenerate social posts for a single platform (used by the regenerate endpoint)."""
    if platform not in prompt_lib.PLATFORM_PROMPTS:
        raise ValueError(f"Unknown platform: {platform}")
    config = prompt_lib.PLATFORM_PROMPTS[platform]
    tone = _tone_instruction()
    user = prompt_lib.build_platform_user(
        text, title, article_url, config, language, tone,
        platform=platform, repurpose_note=repurpose_note,
    )
    return _call_platform_raw(config, user)


def tag_reflection(reflection: str, title: str) -> List[str]:
    """Return the 2 most relevant Adaptable Discipline pillars, in priority order."""
    response = get_claude_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=60,
        messages=[{"role": "user", "content": prompt_lib.build_tagging_message(reflection, title)}],
    )
    return prompt_lib.parse_tag_response(response.content[0].text.strip())


def extract_quotes(reflection: str, title: str) -> List[Dict[str, Any]]:
    """Extract 5–8 shareable quotes/insights from an article using Claude Haiku."""
    response = get_claude_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt_lib.build_quote_extraction_message(reflection, title)}],
    )
    return prompt_lib.parse_quote_response(response.content[0].text.strip())


def generate_repurposed_from_archive(
    text: str,
    title: str,
    article_url: str = "",
    original_date: str = "",
    angle_note: str = "",
    language: str = "english",
) -> Dict[str, Any]:
    """
    Generate fresh social posts from an archived / previously published article.
    Adds a repurpose framing note so Claude understands the context:
    this is evergreen content being resurfaced, not a new piece.
    Optionally focuses on a specific angle.
    """
    framing_parts = ["This content is from a previously published article being resurfaced."]
    if original_date:
        framing_parts.append(f"Originally published: {original_date}.")
    framing_parts.append(
        "Generate posts that feel fresh and current — do NOT use 'throwback', 'flashback', or 'originally published' framing. "
        "The insight is timeless. Write as if discovering it today."
    )
    if angle_note:
        framing_parts.append(f"Focus specifically on this angle: {angle_note}")

    repurpose_note = " ".join(framing_parts)
    return generate_repurposed_content(
        text=text,
        title=title,
        article_url=article_url,
        language=language,
        repurpose_note=repurpose_note,
    )


def generate_companion_only(
    reflection: str,
    reflection_title: str,
    template: str,
    article_url: str = "",
    include_spanish: bool = True,
) -> Dict[str, Any]:
    """
    Generate only the paid companion flow:
    companion EN, and optionally companion ES.
    """
    companion_en = generate_companion(
        reflection,
        reflection_title,
        article_url,
        template,
        [],
    )
    companion_title = helper_lib.extract_title(companion_en) or f"{reflection_title} — Companion"

    companion_es = ""
    companion_es_title = ""
    if include_spanish:
        companion_es = translate_to_spanish(companion_en, "newsletter companion piece")
        companion_es_title = helper_lib.extract_title(companion_es)

    return {
        "companion": {
            "title": companion_title,
            "title_es": companion_es_title,
            "en": companion_en,
            "es": companion_es,
        },
    }


# ─── 5. Config overrides ─────────────────────────────────────────────────────

def apply_config_overrides(config: Dict[str, Any]) -> None:
    """Update editable prompt state from a config dict."""
    prompt_lib.apply_config_overrides(config)


def get_current_prompts() -> Dict[str, Any]:
    """Return current effective values of the editable prompt constants."""
    return prompt_lib.get_current_prompts()


def get_voice_brief() -> str:
    return prompt_lib.get_voice_brief()


# ─── 6. Full Pipeline (streaming with parallelism) ───────────────────────────

def _submit_companion_derivatives(
    pool, add, emit, prog, vals: Dict[str, Any], cp: Dict[str, Any],
    include_spanish: bool, article_url: str,
) -> None:
    """
    Submit companion_es (if spanish) and comp_social_en immediately after
    companion text is available. Called from the FIRST_COMPLETED loop both
    when companion finishes live and when it's restored from checkpoint.
    """
    comp = vals["companion"]
    ctitle = vals["companion_title"]

    if vals["comp_social_en"]:
        emit("companion_social_en", vals["comp_social_en"])
    else:
        prog("Generating social content — Companion (EN)…")
        def _do_comp_social_en(c=comp, ct=ctitle):
            r = generate_repurposed_content(c, ct, article_url, "english")
            prog("Companion social (EN) done", done=True)
            emit("companion_social_en", r)
            return r
        add(pool.submit(_do_comp_social_en), "comp_social_en")

    if include_spanish:
        if vals["companion_es"]:
            emit("companion_es", cp["companion_es"])
        else:
            prog("Translating companion to Spanish…")
            def _do_companion_es(c=comp):
                t = translate_to_spanish(c, "newsletter companion piece")
                prog("Companion translated", done=True)
                emit("companion_es", {"content": t})
                return t
            add(pool.submit(_do_companion_es), "companion_es")


def _enqueue_wave_one(
    pool,
    add,
    push,
    prog,
    emit,
    vals: Dict[str, Any],
    cp: Dict[str, Any],
    reflection: str,
    reflection_title: str,
    article_url: str,
    template: str,
    articles: List[Dict[str, Any]],
    include_spanish: bool,
) -> None:
    if vals["related"] is not None:
        push("related_articles", vals["related"])
    else:
        prog("Finding related articles…")

        def _do_related():
            r = find_related_articles(reflection, articles)
            prog("Found 3 related articles", done=True)
            emit("related_articles", r)
            return r

        add(pool.submit(_do_related), "related")

    if include_spanish:
        if vals["reflection_es"]:
            push("reflection_es", cp["reflection_es"])
            _ensure_spanish_reflection_context(vals, reflection_title, article_url)
        else:
            prog("Translating reflection to Spanish…")

            def _do_refl_es():
                t = translate_to_spanish(reflection, "newsletter article")
                prog("Reflection translated", done=True)
                emit("reflection_es", {"content": t})
                return t

            add(pool.submit(_do_refl_es), "refl_es")

    if vals["refl_social_en"]:
        push("reflection_social_en", vals["refl_social_en"])
    else:
        prog("Generating social content — Reflection (EN)…")

        def _do_refl_social_en():
            r = generate_repurposed_content(reflection, reflection_title, article_url, "english")
            prog("Reflection social (EN) done", done=True)
            emit("reflection_social_en", r)
            return r

        add(pool.submit(_do_refl_social_en), "refl_social_en")

    if vals["companion"]:
        push("companion_en", cp["companion_en"])
        _submit_companion_derivatives(
            pool, add, emit, prog, vals, cp, include_spanish, article_url
        )
    else:
        prog("Generating paid companion…")
        related_snap = vals["related"] or []

        def _do_companion(r=related_snap):
            text = generate_companion(reflection, reflection_title, article_url, template, r)
            title = helper_lib.extract_title(text) or f"{reflection_title} — Companion"
            prog("Paid companion generated", done=True)
            emit("companion_en", {"content": text, "title": title})
            return text, title

        add(pool.submit(_do_companion), "companion")

    if vals["tags"]:
        push("tags", vals["tags"])
    else:
        prog("Tagging reflection…")

        def _do_tagging():
            tags = tag_reflection(reflection, reflection_title)
            prog("Reflection tagged", done=True)
            emit("tags", tags)
            return tags

        add(pool.submit(_do_tagging), "tagging")

    if vals["quotes"]:
        push("quotes", vals["quotes"])
    else:
        prog("Extracting shareable quotes…")

        def _do_quotes():
            quotes = extract_quotes(reflection, reflection_title)
            prog("Quotes extracted", done=True)
            emit("quotes", quotes)
            return quotes

        add(pool.submit(_do_quotes), "quotes")


def _handle_completed_task(
    name: str,
    result: Any,
    pool,
    add,
    push,
    prog,
    emit,
    vals: Dict[str, Any],
    cp: Dict[str, Any],
    reflection_title: str,
    article_url: str,
    include_spanish: bool,
) -> None:
    if name == "related":
        vals["related"] = result
        return

    if name == "refl_es":
        vals["reflection_es"] = result
        _ensure_spanish_reflection_context(vals, reflection_title, article_url)
        if vals["refl_social_es"]:
            push("reflection_social_es", vals["refl_social_es"])
        else:
            prog("Generating social content — Reflection (ES)…")
            refl_es_snap = result

            def _do_refl_social_es(t=refl_es_snap):
                r = generate_repurposed_content(
                    t,
                    vals["reflection_es_title"],
                    vals["reflection_es_url"],
                    "Spanish",
                )
                prog("Reflection social (ES) done", done=True)
                emit("reflection_social_es", r)
                return r

            add(pool.submit(_do_refl_social_es), "refl_social_es")
        return

    if name == "companion":
        comp_text, comp_title = result
        vals["companion"] = comp_text
        vals["companion_title"] = comp_title
        _submit_companion_derivatives(
            pool, add, emit, prog, vals, cp, include_spanish, article_url
        )
        return

    if name == "companion_es":
        vals["companion_es"] = result
        vals["companion_es_title"] = (
            helper_lib.extract_title(result)
            or translate_to_spanish(vals["companion_title"], "newsletter companion title")
        )
        ctitle_snap = vals["companion_es_title"]
        comp_es_snap = result
        if vals["comp_social_es"]:
            push("companion_social_es", vals["comp_social_es"])
        else:
            prog("Generating social content — Companion (ES)…")

            def _do_comp_social_es(t=comp_es_snap, ct=ctitle_snap):
                r = generate_repurposed_content(
                    t,
                    ct,
                    vals["reflection_es_url"],
                    "Spanish",
                )
                prog("Companion social (ES) done", done=True)
                emit("companion_social_es", r)
                return r

            add(pool.submit(_do_comp_social_es), "comp_social_es")
        return

    if name == "tagging":
        vals["tags"] = result
    elif name == "quotes":
        vals["quotes"] = result
    elif name == "refl_social_en":
        vals["refl_social_en"] = result
    elif name == "refl_social_es":
        vals["refl_social_es"] = result
    elif name == "comp_social_en":
        vals["comp_social_en"] = result
    elif name == "comp_social_es":
        vals["comp_social_es"] = result


def _build_pipeline_result(
    reflection: str,
    vals: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "related_articles": vals["related"],
        "tags": vals["tags"],
        "quotes": vals["quotes"],
        "reflection": {
            "en": reflection,
            "es": vals["reflection_es"],
            "repurposed_en": vals["refl_social_en"],
            "repurposed_es": vals["refl_social_es"],
        },
        "companion": {
            "title": vals["companion_title"],
            "en": vals["companion"],
            "es": vals["companion_es"],
            "repurposed_en": vals["comp_social_en"],
            "repurposed_es": vals["comp_social_es"],
        },
    }


def run_full_pipeline_stream(
    reflection: str,
    reflection_title: str,
    template: str,
    articles: List[Dict[str, Any]],
    article_url: str = "",
    include_spanish: bool = True,
    checkpoint: Optional[Dict[str, Any]] = None,
    on_step_complete=None,
    cancel_event: threading.Event = None,
):
    """
    Runs the full editorial pipeline with maximum parallelism.

    Uses a background thread + ThreadPoolExecutor for parallel API calls,
    pushing SSE events to a queue as each task completes.
    The generator yields from the queue so the HTTP response streams live.

    Dependency graph:
      [related] ──────────────────────────────→ [companion_en]
      [reflection] ──→ [refl_es] ─────────────→ [refl_social_es]
      [reflection] ──→ [refl_social_en]
      [companion_en] → [companion_es] ─────────→ [comp_social_es]
      [companion_en] → [comp_social_en]

    Orchestration uses FIRST_COMPLETED wait so each downstream task is
    submitted the instant its dependency finishes — companion derivatives
    start as soon as companion is ready, without waiting for refl_es.
    """
    DONE = object()
    q: queue.Queue = queue.Queue()
    cp = checkpoint or {}
    lock = threading.Lock()

    def is_cancelled() -> bool:
        return cancel_event is not None and cancel_event.is_set()

    def push(event: str, data) -> None:
        q.put(f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n")

    def prog(msg: str, done: bool = False) -> None:
        push("progress", {"message": msg, "done": done})

    def emit(key: str, data) -> None:
        """Push content event and save checkpoint (thread-safe)."""
        if on_step_complete:
            with lock:
                on_step_complete(key, data)
        push(key, data)

    def pipeline() -> None:
        try:
            with ThreadPoolExecutor(max_workers=12) as pool:

                if is_cancelled():
                    push("error", {"message": "Cancelled."})
                    return

                # ── Accumulated results ───────────────────────────────────
                vals = _initial_pipeline_values(cp)

                # pending maps Future → task-name string
                pending: Dict[str, Any] = {}

                def add(fut, name: str) -> None:
                    pending[fut] = name

                _enqueue_wave_one(
                    pool,
                    add,
                    push,
                    prog,
                    emit,
                    vals,
                    cp,
                    reflection,
                    reflection_title,
                    article_url,
                    template,
                    articles,
                    include_spanish,
                )

                # ── FIRST_COMPLETED event loop ────────────────────────────
                while pending:
                    if is_cancelled():
                        push("error", {"message": "Cancelled."})
                        return

                    done_futs, _ = wait(pending.keys(), return_when=FIRST_COMPLETED)

                    for fut in done_futs:
                        name = pending.pop(fut)
                        result = fut.result()   # re-raises worker exceptions
                        _handle_completed_task(
                            name,
                            result,
                            pool,
                            add,
                            push,
                            prog,
                            emit,
                            vals,
                            cp,
                            reflection_title,
                            article_url,
                            include_spanish,
                        )

                if is_cancelled():
                    push("error", {"message": "Cancelled."})
                    return

                # ── Final result event ─────────────────────────────────────
                result = _build_pipeline_result(reflection, vals)
                push("result", result)

        except Exception as e:
            push("error", {"message": str(e)})
        finally:
            q.put(DONE)

    # Run pipeline in background thread, yield from queue in the generator
    t = threading.Thread(target=pipeline, daemon=True)
    t.start()

    while True:
        item = q.get()
        if item is DONE:
            break
        yield item
