from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import db


def save_run(
    title: str,
    article_url: str,
    data: Dict[str, Any],
    token_summary: Optional[Dict[str, Any]] = None,
) -> int:
    ts = token_summary or {}
    tags_list = data.get("tags", [])
    tags_str = ",".join(str(t) for t in tags_list) if isinstance(tags_list, list) else ""
    return db.create_run(
        title,
        article_url,
        json.dumps(data, ensure_ascii=False),
        tokens_in=ts.get("input_tokens", 0),
        tokens_out=ts.get("output_tokens", 0),
        cost_usd=ts.get("estimated_cost_usd", 0),
        tags=tags_str,
    )


def _get_social_payload(source_data: Dict[str, Any], lang: str) -> Dict[str, Any]:
    if not isinstance(source_data, dict):
        return {}
    value = source_data.get(f"repurposed_{lang}")
    if isinstance(value, dict) and any(value.values()):
        return value
    legacy = source_data.get(f"social_{lang}")
    if isinstance(legacy, dict) and any(legacy.values()):
        return legacy
    return {}


def _count_social_posts(payload: Dict[str, Any]) -> int:
    return sum(1 for v in payload.values() if v and isinstance(v, str) and v.strip())


def _marketing_summary(data: Dict[str, Any]) -> Dict[str, Any]:
    assets = []
    total_posts = 0
    for source, source_label in (("reflection", "Reflection"), ("companion", "Companion")):
        source_data = data.get(source, {})
        for lang, lang_label in (("en", "EN"), ("es", "ES")):
            payload = _get_social_payload(source_data, lang)
            if not payload:
                continue
            posts = _count_social_posts(payload)
            platforms = [name for name, content in payload.items() if content]
            assets.append(
                {
                    "key": f"{source}_{lang}",
                    "label": f"{source_label} {lang_label}",
                    "posts": posts,
                    "platforms": platforms,
                }
            )
            total_posts += posts
    return {
        "asset_count": len(assets),
        "post_count": total_posts,
        "assets": assets,
    }


def record_image_cost(source: str, count: int, price_per_image: float) -> float:
    total = round(count * price_per_image, 6)
    db.record_image_cost(source, count, total)
    return total


def list_history_runs(limit: int = 50) -> List[Dict[str, Any]]:
    rows = db.list_runs(limit=limit, include_data=False)
    return [
        {
            "id": row["id"],
            "timestamp": row["timestamp"],
            "title": row["title"],
            "article_url": row["article_url"],
            "tokens_in": row["tokens_in"] or 0,
            "tokens_out": row["tokens_out"] or 0,
            "cost_usd": row["cost_usd"] or 0,
            "tags": row["tags"] or "",
        }
        for row in rows
    ]


def list_marketing_runs(limit: int = 100) -> List[Dict[str, Any]]:
    rows = db.list_runs(limit=limit, include_data=True)
    results = []
    for row in rows:
        try:
            data = json.loads(row["data_json"])
        except Exception:
            continue
        summary = _marketing_summary(data)
        if not summary["asset_count"]:
            continue
        results.append(
            {
                "id": row["id"],
                "timestamp": row["timestamp"],
                "title": row["title"],
                "article_url": row["article_url"],
                "cost_usd": row["cost_usd"] or 0,
                **summary,
            }
        )
    return results


def get_history_run(run_id: int) -> Optional[Dict[str, Any]]:
    row = db.get_run(run_id)
    if not row:
        return None
    return {
        "id": row["id"],
        "timestamp": row["timestamp"],
        "title": row["title"],
        "article_url": row["article_url"],
        "data": json.loads(row["data_json"]),
        "tokens_in": row["tokens_in"] or 0,
        "tokens_out": row["tokens_out"] or 0,
        "cost_usd": row["cost_usd"] or 0,
    }


def delete_history_run(run_id: int) -> None:
    db.delete_run(run_id)
