from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.persistence import db


def save_thumbnail(article_title: str, article_url: str, concept_name: str, image_b64: str) -> Dict[str, Any]:
    image_hash = hashlib.sha1((image_b64 or "").encode("utf-8")).hexdigest()
    return db.save_thumbnail(article_title, article_url, concept_name, image_hash, image_b64)


def list_thumbnails(query: str = "", limit: int = 100) -> List[Dict[str, Any]]:
    return db.list_thumbnails(query=query, limit=limit)


def get_thumbnail(thumb_id: int) -> Optional[Dict[str, Any]]:
    return db.get_thumbnail(thumb_id)


def delete_thumbnail(thumb_id: int) -> None:
    db.delete_thumbnail(thumb_id)


def save_feedback(
    run_title: str,
    platform: str,
    source: str,
    language: str,
    post_index: int,
    rating: int,
    preview: str,
) -> None:
    db.save_feedback(run_title, platform, source, language, post_index, rating, preview)


def get_feedback_summary() -> List[Dict[str, Any]]:
    return db.get_feedback_summary()


def list_ideas(status: Optional[str] = None, source: Optional[str] = None) -> List[Dict[str, Any]]:
    return db.list_ideas(status=status, source=source)


def create_idea(theme: str, category: str, emoji: str, article_angle: str, source: str) -> int:
    return db.create_idea(theme, category, emoji, article_angle, source)


def update_idea_status(idea_id: int, status: str) -> None:
    db.update_idea_status(idea_id, status)


def delete_idea(idea_id: int) -> None:
    db.delete_idea(idea_id)


def _find_duplicate_idea_id(existing_themes: Dict[str, int], theme: str) -> Optional[int]:
    key = theme.lower()[:60]
    for existing_key, idea_id in existing_themes.items():
        if existing_key[:50] == key[:50]:
            return idea_id
    return None


def _normalize_sample_urls(raw_urls: Any) -> List[str]:
    if isinstance(raw_urls, list):
        return [str(url).strip() for url in raw_urls if str(url).strip()]
    if isinstance(raw_urls, str) and raw_urls.strip():
        return [raw_urls.strip()]
    return []


def save_ideas_batch(categories: List[Dict[str, Any]], source: str = "reddit") -> Dict[str, Any]:
    now = datetime.utcnow()
    saved = updated = skipped = 0
    existing = db.list_idea_themes()
    existing_themes = {row["theme"].lower()[:60]: row["id"] for row in existing}

    for category in categories:
        cat_label = category.get("category", "")
        cat_emoji = category.get("emoji", "")
        for struggle in category.get("struggles", []):
            theme = struggle.get("theme", "").strip()
            if not theme:
                continue
            sample_urls = _normalize_sample_urls(struggle.get("sample_urls", []))
            if source == "reddit" and not sample_urls:
                skipped += 1
                continue
            match_id = _find_duplicate_idea_id(existing_themes, theme)
            if match_id is not None:
                db.increment_idea_frequency(match_id, int(struggle.get("frequency", 1)), now)
                db.update_idea_metadata(
                    match_id,
                    category=cat_label,
                    emoji=cat_emoji,
                    article_angle=struggle.get("article_angle", ""),
                    example=struggle.get("example", ""),
                    main_struggle=struggle.get("main_struggle", ""),
                    sample_urls=json.dumps(sample_urls),
                    updated_at=now,
                )
                updated += 1
                continue

            idea_id = db.create_idea_row(
                {
                    "theme": theme,
                    "category": cat_label,
                    "emoji": cat_emoji,
                    "frequency": int(struggle.get("frequency", 1)),
                    "article_angle": struggle.get("article_angle", ""),
                    "example": struggle.get("example", ""),
                    "main_struggle": struggle.get("main_struggle", ""),
                    "sample_urls": json.dumps(sample_urls),
                    "source": source,
                    "status": "new",
                    "created_at": now,
                    "updated_at": now,
                }
            )
            existing_themes[theme.lower()[:60]] = idea_id
            saved += 1

    return {"saved": saved, "updated": updated, "skipped_without_sample_urls": skipped}


def save_quotes(run_id: int, article_title: str, article_url: str, quotes: List[Dict[str, Any]]) -> List[int]:
    return db.save_quotes(run_id, article_title, article_url, quotes)


def list_quote_runs(limit: int = 50) -> List[Dict[str, Any]]:
    return db.list_quote_runs(limit=limit)


def get_quotes_for_run(run_id: int) -> List[Dict[str, Any]]:
    return db.get_quotes_for_run(run_id)


def update_quote(
    quote_id: int,
    shared: Optional[bool] = None,
    signal: Optional[str] = None,
    linkedin: Optional[str] = None,
    threads: Optional[str] = None,
    instagram: Optional[str] = None,
) -> None:
    db.update_quote(
        quote_id,
        shared=shared,
        signal=signal,
        linkedin=linkedin,
        threads=threads,
        instagram=instagram,
    )


def get_quote(quote_id: int) -> Optional[Dict[str, Any]]:
    return db.get_quote_by_id(quote_id)


def delete_quote(quote_id: int) -> None:
    db.delete_quote(quote_id)


def upsert_subscribers(subscribers: List[Dict[str, Any]]) -> int:
    return db.upsert_subscribers(subscribers)


def backfill_subscriber_countries() -> int:
    return db.backfill_subscriber_countries()


def get_subscribers(
    search: str = "",
    activity: Optional[int] = None,
    interval: str = "",
    offset: int = 0,
    limit: int = 50,
) -> Dict[str, Any]:
    return db.get_subscribers(
        search=search,
        activity=activity,
        interval=interval,
        offset=offset,
        limit=limit,
    )


def get_subscriber(email: str) -> Optional[Dict[str, Any]]:
    return db.get_subscriber(email)


def save_subscriber_detail(email: str, detail: Dict[str, Any]) -> None:
    db.save_subscriber_detail(email, detail)


def get_audience_stats() -> Dict[str, Any]:
    return db.get_audience_stats()


def get_insights_data() -> Dict[str, Any]:
    snapshot = db.get_insights_data()
    total = snapshot["total_count"]
    rows = snapshot["enriched_rows"]

    enriched = []
    for row in rows:
        item = dict(row)
        try:
            crm = (json.loads(item["detail_json"]) or {}).get("crmData") or {}
            if crm:
                item["crm"] = crm
                enriched.append(item)
        except Exception:
            pass

    if not enriched:
        return {"enriched_count": 0, "total_count": total}

    open_rates, click_rates, reopen_rates = [], [], []
    for item in enriched:
        crm = item["crm"]
        sent = crm.get("num_emails_received") or 0
        opened = crm.get("num_emails_opened") or 0
        opens = crm.get("num_email_opens") or 0
        clicks = crm.get("links_clicked") or 0
        if sent > 0:
            open_rates.append(opened / sent)
            click_rates.append(clicks / sent)
        if opened > 0:
            reopen_rates.append(opens / opened)

    def avg(values: List[float]) -> float:
        return sum(values) / len(values) if values else 0

    buckets = [0, 0, 0, 0, 0]
    for value in open_rates:
        buckets[min(4, int(value * 5))] += 1

    top = [item for item in enriched if int(item.get("activity_rating") or 0) >= 4]

    def _country(item: Dict[str, Any]) -> str:
        return item["crm"].get("subscription_country") or item["crm"].get("country") or ""

    top_countries = Counter(_country(item) for item in top if _country(item))
    creator_count = sum(1 for item in top if item["crm"].get("user_has_publication"))
    paid_count = sum(1 for item in top if item.get("subscription_interval") not in ("free", "", None))
    top_attribution = Counter((item["crm"].get("free_attribution") or "unknown") for item in top)

    cutoff_45 = (datetime.utcnow() - timedelta(days=45)).strftime("%Y-%m-%d")
    at_risk = [
        item
        for item in enriched
        if int(item.get("activity_rating") or 0) >= 3
        and (item["crm"].get("last_opened_at") or "")[:10] < cutoff_45
        and (item["crm"].get("last_opened_at") or "") != ""
    ]

    web_readers = sum(1 for item in enriched if (item["crm"].get("num_web_post_views") or 0) > 0)
    commenters = sum(1 for item in enriched if (item["crm"].get("num_comments") or 0) > 0)
    sharers = sum(1 for item in enriched if (item["crm"].get("num_shares") or 0) > 0)

    cohort: Dict[str, List[int]] = {}
    for item in enriched:
        month = (item.get("subscription_created_at") or "")[:7]
        if month:
            cohort.setdefault(month, []).append(int(item.get("activity_rating") or 0))
    cohort_quality = {month: round(sum(values) / len(values), 2) for month, values in sorted(cohort.items())[-12:]}
    best_cohort = max(cohort_quality, key=cohort_quality.get) if cohort_quality else None

    return {
        "enriched_count": len(enriched),
        "total_count": total,
        "avg_open_rate": round(avg(open_rates) * 100, 1),
        "avg_click_rate": round(avg(click_rates) * 100, 1),
        "avg_reopen_rate": round(avg(reopen_rates), 2),
        "open_rate_buckets": buckets,
        "top_segment": {
            "count": len(top),
            "pct": round(len(top) / len(enriched) * 100) if enriched else 0,
            "creator_pct": round(creator_count / len(top) * 100) if top else 0,
            "paid_pct": round(paid_count / len(top) * 100) if top else 0,
            "top_countries": top_countries.most_common(5),
            "top_attribution": top_attribution.most_common(5),
        },
        "at_risk_count": len(at_risk),
        "at_risk_emails": [item["email"] for item in at_risk[:5]],
        "web_reader_pct": round(web_readers / len(enriched) * 100) if enriched else 0,
        "commenters_count": commenters,
        "sharers_count": sharers,
        "cohort_quality": cohort_quality,
        "best_cohort": best_cohort,
    }


def get_next_subscriber_for_enrichment() -> Optional[Dict[str, Any]]:
    return db.get_next_subscriber_for_enrichment()


def save_substack_batch(notes: List[Dict[str, Any]]) -> int:
    return db.save_substack_batch(notes)


def list_substack_batches() -> List[Dict[str, Any]]:
    return db.list_substack_batches()


def get_substack_notes(batch_id: int) -> List[Dict[str, Any]]:
    return db.get_substack_notes(batch_id)


def get_substack_note(note_id: int) -> Optional[Dict[str, Any]]:
    return db.get_substack_note_by_id(note_id)


def search_substack_notes(
    q: str = "",
    shared: bool = False,
    repurposed: bool = False,
    signal: Optional[str] = None,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    return db.search_substack_notes(
        q=q,
        shared=shared,
        repurposed=repurposed,
        signal=signal,
        limit=limit,
    )


def update_substack_note(
    note_id: int,
    shared: Optional[bool] = None,
    signal: Optional[str] = None,
    note_text: Optional[str] = None,
) -> None:
    db.update_substack_note(note_id, shared=shared, signal=signal, note_text=note_text)


def save_substack_repurpose(note_id: int, linkedin: str, threads: str, instagram: str) -> None:
    db.save_substack_repurpose(note_id, linkedin, threads, instagram)


def delete_substack_note(note_id: int) -> None:
    db.delete_substack_note(note_id)


def delete_substack_batch(batch_id: int) -> None:
    db.delete_substack_batch(batch_id)


def create_scheduled_post(
    platform: str,
    text: str,
    scheduled_at: str,
    image_url: str = "",
    source_label: str = "",
    timezone: str = "",
    note_id: Optional[int] = None,
) -> int:
    return db.create_scheduled_post(
        platform=platform,
        text=text,
        scheduled_at=datetime.fromisoformat(scheduled_at),
        image_url=image_url,
        source_label=source_label,
        timezone=timezone,
        note_id=note_id,
    )


def list_scheduled_posts(status: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    posts = db.list_scheduled_posts(status=status, limit=limit)
    for post in posts:
        post.setdefault("note_signal", None)
    return posts


def record_published_post(platform: str, text: str, image_url: str = "", source_label: str = "") -> None:
    db.record_published_post(platform, text, image_url, source_label)


def get_due_scheduled_posts() -> List[Dict[str, Any]]:
    return db.get_due_scheduled_posts()


def update_scheduled_post_status(
    post_id: int,
    status: str,
    post_id_result: str = "",
    error: str = "",
) -> None:
    db.update_scheduled_post_status(post_id, status, post_id_result, error)


def cancel_scheduled_post(post_id: int) -> None:
    db.cancel_scheduled_post(post_id)


def delete_scheduled_post(post_id: int) -> None:
    db.delete_scheduled_post(post_id)
