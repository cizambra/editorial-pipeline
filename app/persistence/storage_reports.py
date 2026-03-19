from __future__ import annotations

import json
import time
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Tuple

from app.persistence import db


def _fmt_ts(ts: str) -> str:
    """Truncate microseconds to ms, normalise to ISO 8601+Z so JS Date() parses as UTC."""
    if not ts:
        return ts
    s = str(ts).replace(" ", "T")   # "2026-03-18 18:42:12…" → "2026-03-18T18:42:12…"
    if "." not in s:
        s = s + ".000"               # ensure millisecond field exists
    return s[:23] + "Z"             # keep only ms precision and mark as UTC


_DASHBOARD_CACHE_TTL_SECONDS = 30
_dashboard_cache: Dict[str, Any] = {
    "key": None,
    "value": None,
    "expires_at": 0.0,
}


def invalidate_dashboard_cache() -> None:
    _dashboard_cache["key"] = None
    _dashboard_cache["value"] = None
    _dashboard_cache["expires_at"] = 0.0


def _parse_article_date(value: str):
    try:
        return parsedate_to_datetime(value)
    except Exception:
        return datetime.min


def _dashboard_cache_key(articles: List[Dict[str, Any]]) -> Tuple[Any, ...]:
    article_fingerprint = tuple((a.get("url", ""), a.get("published", "")) for a in articles[:50])
    return ("postgres", len(articles), article_fingerprint)


def get_dashboard_data(articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    cache_key = _dashboard_cache_key(articles)
    now = time.time()
    if (
        _dashboard_cache["value"] is not None
        and _dashboard_cache["key"] == cache_key
        and now < _dashboard_cache["expires_at"]
    ):
        return _dashboard_cache["value"]

    runs = db.list_runs(limit=10000, include_data=True)
    img_rows = db.get_image_cost_summary()
    all_img_costs = db.get_all_image_costs()

    img_by_source = {
        row["source"]: {"count": row["cnt"], "cost_usd": round(row["total"], 4)}
        for row in img_rows
    }
    total_image_cost = round(sum(row["total"] for row in img_rows), 4) if img_rows else 0.0
    total_image_count = sum(row["cnt"] for row in img_rows) if img_rows else 0

    processed_urls = {row["article_url"] for row in runs if row["article_url"]}
    covered = [article for article in articles if article["url"] in processed_urls]
    not_covered = [article for article in articles if article["url"] not in processed_urls]
    repurpose_queue = sorted(not_covered, key=lambda article: _parse_article_date(article["published"]))

    total_tokens_in = sum(row["tokens_in"] or 0 for row in runs)
    total_tokens_out = sum(row["tokens_out"] or 0 for row in runs)
    total_cost = sum(row["cost_usd"] or 0 for row in runs)

    # Count actually-published posts from scheduled_posts (status='published')
    platforms = {"linkedin": 0, "instagram": 0, "threads": 0, "substack_note": 0}
    published_posts = db.list_scheduled_posts(status="published", limit=10000)
    for post in published_posts:
        plat = post.get("platform", "")
        if plat in platforms:
            platforms[plat] += 1

    this_month = datetime.now().strftime("%Y-%m")
    monthly_runs = [row for row in runs if row["timestamp"].startswith(this_month)]

    tag_primary: Dict[str, int] = {}
    tag_total: Dict[str, int] = {}
    for run in runs:
        tags_str = run.get("tags", "") or ""
        if not tags_str:
            try:
                payload = json.loads(run.get("data_json") or "{}")
                tags_list = payload.get("tags", [])
                if isinstance(tags_list, list):
                    tags_str = ",".join(str(tag) for tag in tags_list)
            except Exception:
                pass
        if tags_str:
            parts = [tag.strip() for tag in tags_str.split(",") if tag.strip()]
            for index, tag in enumerate(parts[:2]):
                tag_total[tag] = tag_total.get(tag, 0) + 1
                if index == 0:
                    tag_primary[tag] = tag_primary.get(tag, 0) + 1

    # Build per-month breakdown for time-filtered dashboard
    monthly: Dict[str, Dict] = {}
    for run in runs:
        month = (str(run["timestamp"] or ""))[:7]
        if not month:
            continue
        m = monthly.setdefault(month, {"runs": 0, "cost_usd": 0.0, "image_cost_usd": 0.0, "tokens_in": 0, "tokens_out": 0})
        m["runs"] += 1
        m["cost_usd"] = round(m["cost_usd"] + (run["cost_usd"] or 0), 4)
        m["tokens_in"] += run["tokens_in"] or 0
        m["tokens_out"] += run["tokens_out"] or 0
    for img in all_img_costs:
        month = (str(img["timestamp"] or ""))[:7]
        if not month:
            continue
        m = monthly.setdefault(month, {"runs": 0, "cost_usd": 0.0, "image_cost_usd": 0.0, "tokens_in": 0, "tokens_out": 0})
        m["image_cost_usd"] = round(m["image_cost_usd"] + (img["cost_usd"] or 0), 4)

    daily_spend: Dict[str, Dict[str, float]] = {}
    for row in runs:
        day = str(row["timestamp"] or "")[:10]
        if not day:
            continue
        entry = daily_spend.setdefault(day, {"run_cost_usd": 0.0, "image_cost_usd": 0.0, "total_cost_usd": 0.0})
        entry["run_cost_usd"] = round(entry["run_cost_usd"] + (row["cost_usd"] or 0), 4)
        entry["total_cost_usd"] = round(entry["run_cost_usd"] + entry["image_cost_usd"], 4)
    for img in all_img_costs:
        day = str(img["timestamp"] or "")[:10]
        if not day:
            continue
        entry = daily_spend.setdefault(day, {"run_cost_usd": 0.0, "image_cost_usd": 0.0, "total_cost_usd": 0.0})
        entry["image_cost_usd"] = round(entry["image_cost_usd"] + (img["cost_usd"] or 0), 4)
        entry["total_cost_usd"] = round(entry["run_cost_usd"] + entry["image_cost_usd"], 4)

    result = {
        "articles_total": len(articles),
        "articles_covered": len(covered),
        "articles_remaining": len(not_covered),
        "total_runs": len(runs),
        "monthly_runs": len(monthly_runs),
        "total_tokens_in": total_tokens_in,
        "total_tokens_out": total_tokens_out,
        "total_cost_usd": round(total_cost, 4),
        "total_image_cost_usd": total_image_cost,
        "total_image_count": total_image_count,
        "image_cost_by_source": img_by_source,
        "platform_counts": platforms,
        "tag_primary_counts": tag_primary,
        "tag_total_counts": tag_total,
        "repurpose_queue": repurpose_queue[:20],
        "monthly_breakdown": dict(sorted(monthly.items())),
        "daily_spend": dict(sorted(daily_spend.items())),
        "run_costs": [
            {"timestamp": _fmt_ts(row["timestamp"]), "cost_usd": row["cost_usd"] or 0,
             "tokens_in": row["tokens_in"] or 0, "tokens_out": row["tokens_out"] or 0}
            for row in runs
        ],
        "image_cost_records": [
            {"timestamp": _fmt_ts(img["timestamp"]), "cost_usd": img["cost_usd"] or 0}
            for img in all_img_costs
        ],
        "recent_runs": [
            {
                "id": row["id"],
                "title": row["title"],
                "timestamp": _fmt_ts(row["timestamp"]),
                "article_url": row["article_url"],
                "cost_usd": row["cost_usd"],
                "tags": row.get("tags", "") or "",
                "status": row.get("status", "") or "done",
            }
            for row in runs[:5]
        ],
    }
    _dashboard_cache["key"] = cache_key
    _dashboard_cache["value"] = result
    _dashboard_cache["expires_at"] = now + _DASHBOARD_CACHE_TTL_SECONDS
    return result
