from __future__ import annotations

import json
from datetime import datetime
from functools import lru_cache
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    and_,
    case,
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    func,
    inspect,
    insert,
    select,
    text,
    update,
    delete,
    or_,
)
from sqlalchemy.engine import Engine, RowMapping

from app.core.settings import get_settings


_settings = get_settings()
metadata = MetaData()

app_users = Table(
    "app_users",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("email", String(255), nullable=False, unique=True),
    Column("display_name", String(255), nullable=False, server_default=""),
    Column("password_hash", Text, nullable=False),
    Column("auth_provider", String(32), nullable=False, server_default="local"),
    Column("auth_subject", Text, nullable=False, server_default=""),
    Column("role", String(32), nullable=False, server_default="operator"),
    Column("status", String(32), nullable=False, server_default="active"),
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
    Column("last_login_at", DateTime, nullable=True),
)

user_invites = Table(
    "user_invites",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("email", String(255), nullable=False),
    Column("display_name", String(255), nullable=False, server_default=""),
    Column("role", String(32), nullable=False, server_default="operator"),
    Column("token_hash", Text, nullable=False),
    Column("invited_by_user_id", Integer, nullable=False),
    Column("status", String(32), nullable=False, server_default="pending"),
    Column("expires_at", DateTime, nullable=False),
    Column("accepted_at", DateTime, nullable=True),
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
)

scheduled_posts = Table(
    "scheduled_posts",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("platform", String(64), nullable=False),
    Column("text", Text, nullable=False),
    Column("image_url", Text, nullable=False, server_default=""),
    Column("scheduled_at", DateTime, nullable=False),
    Column("status", String(32), nullable=False, server_default="pending"),
    Column("source_label", Text, nullable=False, server_default=""),
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
    Column("published_at", DateTime, nullable=True),
    Column("post_id", Text, nullable=False, server_default=""),
    Column("error", Text, nullable=False, server_default=""),
    Column("timezone", String(128), nullable=False, server_default=""),
    Column("note_id", Integer, nullable=True),
)

app_config = Table(
    "app_config",
    metadata,
    Column("key", String(128), primary_key=True),
    Column("value_json", Text, nullable=False, server_default="{}"),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
)

pipeline_state = Table(
    "pipeline_state",
    metadata,
    Column("key", String(128), primary_key=True),
    Column("value_json", Text, nullable=False, server_default="{}"),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
)

runs = Table(
    "runs",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("timestamp", DateTime, nullable=False, server_default=func.now()),
    Column("title", Text, nullable=False),
    Column("article_url", Text, nullable=False, server_default=""),
    Column("data_json", Text, nullable=False),
    Column("tokens_in", Integer, nullable=False, server_default="0"),
    Column("tokens_out", Integer, nullable=False, server_default="0"),
    Column("cost_usd", Float, nullable=False, server_default="0"),
    Column("tags", Text, nullable=False, server_default=""),
    Column("status", String(32), nullable=False, server_default="done"),
)

image_costs = Table(
    "image_costs",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("timestamp", DateTime, nullable=False, server_default=func.now()),
    Column("source", String(128), nullable=False),
    Column("count", Integer, nullable=False, server_default="1"),
    Column("cost_usd", Float, nullable=False, server_default="0"),
)

thumbnails = Table(
    "thumbnails",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("timestamp", DateTime, nullable=False, server_default=func.now()),
    Column("article_title", Text, nullable=False),
    Column("article_url", Text, nullable=False, server_default=""),
    Column("concept_name", Text, nullable=False, server_default=""),
    Column("image_hash", Text, nullable=False, server_default=""),
    Column("image_b64", Text, nullable=False),
)

post_feedback = Table(
    "post_feedback",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("timestamp", DateTime, nullable=False, server_default=func.now()),
    Column("run_title", Text, nullable=False, server_default=""),
    Column("platform", String(64), nullable=False),
    Column("source", String(64), nullable=False),
    Column("language", String(32), nullable=False),
    Column("post_index", Integer, nullable=False, server_default="0"),
    Column("rating", Integer, nullable=False),
    Column("preview", Text, nullable=False, server_default=""),
)

ideas = Table(
    "ideas",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("theme", Text, nullable=False),
    Column("category", Text, nullable=False, server_default=""),
    Column("emoji", Text, nullable=False, server_default=""),
    Column("frequency", Integer, nullable=False, server_default="1"),
    Column("article_angle", Text, nullable=False, server_default=""),
    Column("example", Text, nullable=False, server_default=""),
    Column("source", String(64), nullable=False, server_default="reddit"),
    Column("status", String(32), nullable=False, server_default="new"),
    Column("main_struggle", Text, nullable=True),
    Column("sample_urls", Text, nullable=True),
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
)

article_quotes = Table(
    "article_quotes",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("run_id", Integer, nullable=False, server_default="0"),
    Column("timestamp", Text, nullable=False, server_default=""),
    Column("article_title", Text, nullable=False, server_default=""),
    Column("article_url", Text, nullable=False, server_default=""),
    Column("quote_text", Text, nullable=False),
    Column("context", Text, nullable=False, server_default=""),
    Column("quote_type", String(64), nullable=False, server_default="insight"),
    Column("shared", Integer, nullable=False, server_default="0"),
    Column("signal", String(32), nullable=False, server_default="none"),
    Column("linkedin_post", Text, nullable=False, server_default=""),
    Column("threads_post", Text, nullable=False, server_default=""),
    Column("instagram_post", Text, nullable=False, server_default=""),
)

substack_subscribers = Table(
    "substack_subscribers",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("email", Text, nullable=False, unique=True),
    Column("name", Text, nullable=False, server_default=""),
    Column("photo_url", Text, nullable=False, server_default=""),
    Column("subscription_interval", String(32), nullable=False, server_default="free"),
    Column("is_subscribed", Integer, nullable=False, server_default="0"),
    Column("is_comp", Integer, nullable=False, server_default="0"),
    Column("activity_rating", Integer, nullable=False, server_default="0"),
    Column("subscription_created_at", Text, nullable=False, server_default=""),
    Column("total_revenue_generated", Integer, nullable=False, server_default="0"),
    Column("subscription_country", Text, nullable=False, server_default=""),
    Column("detail_json", Text, nullable=False, server_default=""),
    Column("synced_at", Text, nullable=False, server_default=""),
    Column("detail_synced_at", Text, nullable=False, server_default=""),
    Column("unsubscribed_at", Text, nullable=True),
)

substack_batches = Table(
    "substack_batches",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("timestamp", Text, nullable=False, server_default=""),
    Column("note_count", Integer, nullable=False, server_default="0"),
)

substack_notes = Table(
    "substack_notes",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("batch_id", Integer, nullable=False),
    Column("timestamp", Text, nullable=False, server_default=""),
    Column("issue", Text, nullable=False),
    Column("intent", Text, nullable=False),
    Column("note_text", Text, nullable=False),
    Column("shared", Integer, nullable=False, server_default="0"),
    Column("signal", String(32), nullable=False, server_default="none"),
    Column("linkedin_post", Text, nullable=False, server_default=""),
    Column("threads_post", Text, nullable=False, server_default=""),
    Column("instagram_post", Text, nullable=False, server_default=""),
)

audit_log = Table(
    "audit_log",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("timestamp", DateTime, nullable=False, server_default=func.now()),
    Column("actor_user_id", Integer, nullable=True),
    Column("actor_email", Text, nullable=False, server_default=""),
    Column("actor_role", String(32), nullable=False, server_default=""),
    Column("action", String(128), nullable=False),
    Column("target_type", String(64), nullable=False, server_default=""),
    Column("target_id", String(255), nullable=False, server_default=""),
    Column("details_json", Text, nullable=False, server_default="{}"),
)


def has_database_url() -> bool:
    return bool(_settings.database_url)


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    if not _settings.database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return create_engine(_settings.database_url, future=True)


def dispose_engine() -> None:
    try:
        engine = get_engine()
    except RuntimeError:
        return
    engine.dispose()
    get_engine.cache_clear()


def _add_missing_columns(engine, table_name: str, columns: list) -> None:
    """Add columns that don't exist yet. Each ALTER runs in its own transaction."""
    is_pg = engine.dialect.name == "postgresql"
    existing_columns = {
        column["name"]
        for column in inspect(engine).get_columns(table_name)
    }
    for col_name, col_def in columns:
        if col_name in existing_columns:
            continue
        try:
            with engine.begin() as conn:
                if is_pg:
                    # Avoid hanging startup indefinitely if a stale session is holding a table lock.
                    conn.execute(text("SET LOCAL lock_timeout = '1s'"))
                    # Postgres 9.6+ supports IF NOT EXISTS natively
                    conn.execute(text(
                        f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                    ))
                else:
                    conn.execute(text(
                        f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"
                    ))
            existing_columns.add(col_name)
        except Exception:
            pass  # SQLite: column already exists — safe to ignore


def ensure_schema() -> bool:
    engine = get_engine()
    metadata.create_all(
        engine,
        tables=[
            app_users,
            user_invites,
            scheduled_posts,
            app_config,
            pipeline_state,
            runs,
            image_costs,
            thumbnails,
            post_feedback,
            ideas,
            article_quotes,
            substack_subscribers,
            substack_batches,
            substack_notes,
            audit_log,
        ],
    )
    # Incrementally add columns that may be missing on existing databases
    _add_missing_columns(engine, "ideas", [
        ("main_struggle", "TEXT"),
        ("sample_urls",   "TEXT"),
    ])
    _add_missing_columns(engine, "substack_subscribers", [
        ("unsubscribed_at", "TEXT"),
    ])
    _add_missing_columns(engine, "runs", [
        ("status", "TEXT NOT NULL DEFAULT 'done'"),
    ])
    return True


def init_core_tables() -> None:
    if not has_database_url():
        return
    ensure_schema()


def ping() -> bool:
    ensure_schema()
    with get_engine().connect() as conn:
        conn.execute(text("SELECT 1"))
    return True


def reset_identity_sequence(table: Table, column_name: str = "id") -> None:
    ensure_schema()
    engine = get_engine()
    if engine.dialect.name != "postgresql":
        return
    table_name = table.name
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                SELECT setval(
                    pg_get_serial_sequence(:table_name, :column_name),
                    COALESCE((SELECT MAX(id) FROM """ + table_name + """), 1),
                    true
                )
                """
            ),
            {"table_name": table_name, "column_name": column_name},
        )


def _row_to_dict(row: RowMapping | None) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    data = dict(row)
    for key, value in list(data.items()):
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data


def _upsert_row(table: Table, key_column: str, key_value: Any, values: Dict[str, Any]) -> None:
    with get_engine().begin() as conn:
        existing = conn.execute(
            select(getattr(table.c, key_column)).where(getattr(table.c, key_column) == key_value)
        ).scalar_one_or_none()
        if existing is None:
            conn.execute(insert(table).values(**values))
        else:
            conn.execute(
                update(table).where(getattr(table.c, key_column) == key_value).values(**values)
            )
