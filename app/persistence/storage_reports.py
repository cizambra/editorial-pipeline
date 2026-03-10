from __future__ import annotations

import json
import time
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Tuple

import db


_DASHBOARD_CACHE_TTL_SECONDS = 30
_dashboard_cache: Dict[str, Any] = {
    "key": None,
    "value": None,
    "expires_at": 0.0,
}


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

    platforms = {"linkedin": 0, "instagram": 0, "threads": 0, "substack_note": 0}
    for run in runs:
        try:
            data = json.loads(run["data_json"])
        except Exception:
            continue
        social = data.get("social", {})
        if isinstance(social, dict):
            for platform in platforms:
                if social.get(platform):
                    platforms[platform] += 1
        for source in ("reflection", "companion"):
            source_data = data.get(source, {})
            if not isinstance(source_data, dict):
                continue
            for lang_key in ("repurposed_en", "repurposed_es", "social_en", "social_es"):
                social_data = source_data.get(lang_key, {})
                if not isinstance(social_data, dict):
                    continue
                for platform in platforms:
                    if social_data.get(platform):
                        platforms[platform] += 1

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
        "recent_runs": [
            {
                "id": row["id"],
                "title": row["title"],
                "timestamp": row["timestamp"],
                "article_url": row["article_url"],
                "cost_usd": row["cost_usd"],
                "tags": row.get("tags", "") or "",
            }
            for row in runs[:5]
        ],
    }
    _dashboard_cache["key"] = cache_key
    _dashboard_cache["value"] = result
    _dashboard_cache["expires_at"] = now + _DASHBOARD_CACHE_TTL_SECONDS
    return result
