from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from sqlalchemy import insert, select, update

from app.persistence import db


def _coerce_datetime(value: Any) -> Any:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return value
    return value


def _upsert_row(table, key_column: str, key_value: Any, values: Dict[str, Any]) -> None:
    with db.get_engine().begin() as conn:
        existing = conn.execute(
            select(getattr(table.c, key_column)).where(getattr(table.c, key_column) == key_value)
        ).scalar_one_or_none()
        if existing is None:
            conn.execute(insert(table).values(**values))
        else:
            conn.execute(
                update(table).where(getattr(table.c, key_column) == key_value).values(**values)
            )


def import_user(row: Dict[str, Any]) -> None:
    db.ensure_schema()
    values = {
        "id": row["id"],
        "email": row["email"],
        "display_name": row.get("display_name", ""),
        "password_hash": row["password_hash"],
        "role": row.get("role", "operator"),
        "status": row.get("status", "active"),
        "created_at": _coerce_datetime(row.get("created_at")),
        "updated_at": _coerce_datetime(row.get("updated_at")),
        "last_login_at": _coerce_datetime(row.get("last_login_at")),
    }
    _upsert_row(db.app_users, "id", row["id"], values)


def import_scheduled_post(row: Dict[str, Any]) -> None:
    db.ensure_schema()
    values = {
        "id": row["id"],
        "platform": row["platform"],
        "text": row["text"],
        "image_url": row.get("image_url", ""),
        "scheduled_at": _coerce_datetime(row["scheduled_at"]),
        "status": row.get("status", "pending"),
        "source_label": row.get("source_label", ""),
        "created_at": _coerce_datetime(row.get("created_at")),
        "published_at": _coerce_datetime(row.get("published_at")),
        "post_id": row.get("post_id") or "",
        "error": row.get("error") or "",
        "timezone": row.get("timezone") or "",
        "note_id": row.get("note_id"),
    }
    _upsert_row(db.scheduled_posts, "id", row["id"], values)


def import_config(data: Dict[str, Any]) -> None:
    db.save_config(data)


def import_checkpoint(data: Dict[str, Any]) -> None:
    db.save_checkpoint(data)


def import_run(row: Dict[str, Any]) -> None:
    db.ensure_schema()
    values = {
        "id": row["id"],
        "timestamp": _coerce_datetime(row.get("timestamp")),
        "title": row["title"],
        "article_url": row.get("article_url", ""),
        "data_json": row["data_json"],
        "tokens_in": int(row.get("tokens_in") or 0),
        "tokens_out": int(row.get("tokens_out") or 0),
        "cost_usd": float(row.get("cost_usd") or 0),
        "tags": row.get("tags", ""),
    }
    _upsert_row(db.runs, "id", row["id"], values)


def import_image_cost(row: Dict[str, Any]) -> None:
    db.ensure_schema()
    values = {
        "id": row["id"],
        "timestamp": _coerce_datetime(row.get("timestamp")),
        "source": row["source"],
        "count": int(row.get("count") or 0),
        "cost_usd": float(row.get("cost_usd") or 0),
    }
    _upsert_row(db.image_costs, "id", row["id"], values)


def import_thumbnail(row: Dict[str, Any]) -> None:
    db.ensure_schema()
    values = {
        "id": row["id"],
        "timestamp": _coerce_datetime(row.get("timestamp")),
        "article_title": row["article_title"],
        "article_url": row.get("article_url", ""),
        "concept_name": row.get("concept_name", ""),
        "image_hash": row.get("image_hash", ""),
        "image_b64": row["image_b64"],
    }
    _upsert_row(db.thumbnails, "id", row["id"], values)


def import_feedback(row: Dict[str, Any]) -> None:
    db.ensure_schema()
    values = {
        "id": row["id"],
        "timestamp": _coerce_datetime(row.get("timestamp")),
        "run_title": row.get("run_title", ""),
        "platform": row["platform"],
        "source": row.get("source", ""),
        "language": row.get("language", ""),
        "post_index": int(row.get("post_index") or 0),
        "rating": int(row.get("rating") or 0),
        "preview": row.get("preview", ""),
    }
    _upsert_row(db.post_feedback, "id", row["id"], values)


def import_idea(row: Dict[str, Any]) -> None:
    db.ensure_schema()
    values = {
        "id": row["id"],
        "theme": row["theme"],
        "category": row.get("category", ""),
        "emoji": row.get("emoji", ""),
        "frequency": int(row.get("frequency") or 1),
        "article_angle": row.get("article_angle", ""),
        "example": row.get("example", ""),
        "source": row.get("source", "reddit"),
        "status": row.get("status", "new"),
        "created_at": _coerce_datetime(row.get("created_at")),
        "updated_at": _coerce_datetime(row.get("updated_at")),
    }
    _upsert_row(db.ideas, "id", row["id"], values)


def import_quote(row: Dict[str, Any]) -> None:
    db.ensure_schema()
    _upsert_row(
        db.article_quotes,
        "id",
        row["id"],
        {
            "id": row["id"],
            "run_id": int(row.get("run_id") or 0),
            "timestamp": row.get("timestamp", ""),
            "article_title": row.get("article_title", ""),
            "article_url": row.get("article_url", ""),
            "quote_text": row.get("quote_text", ""),
            "context": row.get("context", ""),
            "quote_type": row.get("quote_type", "insight"),
            "shared": int(row.get("shared") or 0),
            "signal": row.get("signal", "none"),
            "linkedin_post": row.get("linkedin_post", ""),
            "threads_post": row.get("threads_post", ""),
            "instagram_post": row.get("instagram_post", ""),
        },
    )


def import_subscriber(row: Dict[str, Any]) -> None:
    db.ensure_schema()
    _upsert_row(
        db.substack_subscribers,
        "email",
        row["email"],
        {
            "id": row["id"],
            "email": row["email"],
            "name": row.get("name", ""),
            "photo_url": row.get("photo_url", ""),
            "subscription_interval": row.get("subscription_interval", "free"),
            "is_subscribed": int(row.get("is_subscribed") or 0),
            "is_comp": int(row.get("is_comp") or 0),
            "activity_rating": int(row.get("activity_rating") or 0),
            "subscription_created_at": row.get("subscription_created_at", ""),
            "total_revenue_generated": int(row.get("total_revenue_generated") or 0),
            "subscription_country": row.get("subscription_country", ""),
            "detail_json": row.get("detail_json", ""),
            "synced_at": row.get("synced_at", ""),
            "detail_synced_at": row.get("detail_synced_at", ""),
        },
    )


def import_substack_batch(row: Dict[str, Any]) -> None:
    db.ensure_schema()
    _upsert_row(
        db.substack_batches,
        "id",
        row["id"],
        {
            "id": row["id"],
            "timestamp": row.get("timestamp", ""),
            "note_count": int(row.get("note_count") or 0),
        },
    )


def import_substack_note(row: Dict[str, Any]) -> None:
    db.ensure_schema()
    _upsert_row(
        db.substack_notes,
        "id",
        row["id"],
        {
            "id": row["id"],
            "batch_id": int(row.get("batch_id") or 0),
            "timestamp": row.get("timestamp", ""),
            "issue": row.get("issue", ""),
            "intent": row.get("intent", ""),
            "note_text": row.get("note_text", ""),
            "shared": int(row.get("shared") or 0),
            "signal": row.get("signal", "none"),
            "linkedin_post": row.get("linkedin_post", ""),
            "threads_post": row.get("threads_post", ""),
            "instagram_post": row.get("instagram_post", ""),
        },
    )
