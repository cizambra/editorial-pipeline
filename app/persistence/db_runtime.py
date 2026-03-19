from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.exc import IntegrityError

from .db_schema import (
    app_config,
    ensure_schema,
    get_engine,
    image_costs,
    pipeline_state,
    reset_identity_sequence,
    runs,
    scheduled_posts,
    _row_to_dict,
)


def _to_utc_datetime(scheduled_at: "datetime | str", timezone_name: str = "") -> datetime:
    """Parse scheduled_at (string or datetime) and return a naive UTC datetime.

    Bug fix: the client sends an ISO string like "2026-03-19T15:00:00".  SQLite
    stores it as-is (with 'T').  SQLAlchemy formats datetime.utcnow() with a
    space separator, so the string comparison 'T...' <= ' ...' is always False,
    meaning no post ever becomes due.  Storing a proper Python datetime avoids
    this by letting SQLAlchemy render both sides with the same format.
    """
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    from datetime import timezone as _tz

    if isinstance(scheduled_at, str):
        dt = datetime.fromisoformat(scheduled_at)
    else:
        dt = scheduled_at

    # Already tz-aware → convert to UTC and strip tzinfo for naive storage
    if dt.tzinfo is not None:
        return dt.astimezone(_tz.utc).replace(tzinfo=None)

    # Apply the user's named timezone before converting to UTC
    if timezone_name:
        try:
            tz = ZoneInfo(timezone_name)
            dt = dt.replace(tzinfo=tz)
            return dt.astimezone(_tz.utc).replace(tzinfo=None)
        except (ZoneInfoNotFoundError, Exception):
            pass

    # No timezone info available — treat as UTC
    return dt


def create_scheduled_post(
    platform: str,
    text: str,
    scheduled_at: "datetime | str",
    image_url: str = "",
    source_label: str = "",
    timezone: str = "",
    note_id: Optional[int] = None,
) -> int:
    ensure_schema()
    utc_dt = _to_utc_datetime(scheduled_at, timezone)
    stmt = insert(scheduled_posts).values(
        platform=platform,
        text=text,
        image_url=image_url,
        scheduled_at=utc_dt,
        source_label=source_label,
        timezone=timezone,
        note_id=note_id,
        created_at=datetime.utcnow(),
        status="pending",
    )
    with get_engine().begin() as conn:
        result = conn.execute(stmt)
        return int(result.inserted_primary_key[0])


def list_scheduled_posts(status: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = select(scheduled_posts)
    if status:
        stmt = stmt.where(scheduled_posts.c.status == status)
    stmt = stmt.order_by(scheduled_posts.c.scheduled_at.asc()).limit(limit)
    with get_engine().begin() as conn:
        rows = conn.execute(stmt).mappings().all()
        return [_row_to_dict(row) for row in rows]


def record_published_post(platform: str, text: str, image_url: str = "", source_label: str = "") -> None:
    ensure_schema()
    now = datetime.utcnow()
    stmt = insert(scheduled_posts).values(
        platform=platform,
        text=text,
        image_url=image_url,
        scheduled_at=now,
        status="published",
        source_label=source_label,
        timezone="",
        created_at=now,
        published_at=now,
    )
    with get_engine().begin() as conn:
        conn.execute(stmt)


def get_due_scheduled_posts() -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = (
        select(scheduled_posts)
        .where(scheduled_posts.c.status == "pending")
        .where(scheduled_posts.c.scheduled_at <= datetime.utcnow())
        .order_by(scheduled_posts.c.scheduled_at.asc())
    )
    with get_engine().begin() as conn:
        return [_row_to_dict(row) for row in conn.execute(stmt).mappings().all()]


def update_scheduled_post_status(
    post_id: int,
    status: str,
    post_id_result: str = "",
    error: str = "",
) -> None:
    ensure_schema()
    values: Dict[str, Any] = {
        "status": status,
        "post_id": post_id_result or "",  # guard against None — Postgres NOT NULL constraint
        "error": error or "",
    }
    values["published_at"] = datetime.utcnow() if status == "published" else None
    stmt = update(scheduled_posts).where(scheduled_posts.c.id == post_id).values(**values)
    with get_engine().begin() as conn:
        conn.execute(stmt)


def cancel_scheduled_post(post_id: int) -> None:
    ensure_schema()
    stmt = (
        update(scheduled_posts)
        .where(scheduled_posts.c.id == post_id)
        .where(scheduled_posts.c.status == "pending")
        .values(status="cancelled")
    )
    with get_engine().begin() as conn:
        conn.execute(stmt)


def delete_scheduled_post(post_id: int) -> None:
    ensure_schema()
    stmt = delete(scheduled_posts).where(scheduled_posts.c.id == post_id)
    with get_engine().begin() as conn:
        conn.execute(stmt)


def load_config() -> Dict[str, Any]:
    ensure_schema()
    stmt = select(app_config.c.value_json).where(app_config.c.key == "global")
    with get_engine().begin() as conn:
        raw = conn.execute(stmt).scalar_one_or_none()
    if not raw:
        return {}
    return json.loads(raw)


def save_config(data: Dict[str, Any]) -> None:
    ensure_schema()
    payload = json.dumps(data, ensure_ascii=False)
    now = datetime.utcnow()
    with get_engine().begin() as conn:
        existing = conn.execute(
            select(app_config.c.key).where(app_config.c.key == "global")
        ).scalar_one_or_none()
        if existing:
            conn.execute(
                update(app_config)
                .where(app_config.c.key == "global")
                .values(value_json=payload, updated_at=now)
            )
        else:
            conn.execute(
                insert(app_config).values(key="global", value_json=payload, updated_at=now)
            )


def load_app_config_value(key: str) -> Optional[Dict[str, Any]]:
    ensure_schema()
    stmt = select(app_config.c.value_json).where(app_config.c.key == key)
    with get_engine().begin() as conn:
        raw = conn.execute(stmt).scalar_one_or_none()
    if not raw:
        return None
    return json.loads(raw)


def save_app_config_value(key: str, data: Dict[str, Any]) -> None:
    ensure_schema()
    payload = json.dumps(data, ensure_ascii=False)
    now = datetime.utcnow()
    with get_engine().begin() as conn:
        existing = conn.execute(
            select(app_config.c.key).where(app_config.c.key == key)
        ).scalar_one_or_none()
        if existing:
            conn.execute(
                update(app_config)
                .where(app_config.c.key == key)
                .values(value_json=payload, updated_at=now)
            )
        else:
            conn.execute(
                insert(app_config).values(key=key, value_json=payload, updated_at=now)
            )


def load_checkpoint() -> Optional[Dict[str, Any]]:
    ensure_schema()
    stmt = select(pipeline_state.c.value_json).where(pipeline_state.c.key == "checkpoint")
    with get_engine().begin() as conn:
        raw = conn.execute(stmt).scalar_one_or_none()
    if not raw:
        return None
    return json.loads(raw)


def save_checkpoint(data: Dict[str, Any]) -> None:
    ensure_schema()
    payload = json.dumps(data, ensure_ascii=False)
    now = datetime.utcnow()
    with get_engine().begin() as conn:
        existing = conn.execute(
            select(pipeline_state.c.key).where(pipeline_state.c.key == "checkpoint")
        ).scalar_one_or_none()
        if existing:
            conn.execute(
                update(pipeline_state)
                .where(pipeline_state.c.key == "checkpoint")
                .values(value_json=payload, updated_at=now)
            )
        else:
            conn.execute(
                insert(pipeline_state).values(
                    key="checkpoint", value_json=payload, updated_at=now
                )
            )


def clear_checkpoint() -> None:
    ensure_schema()
    stmt = delete(pipeline_state).where(pipeline_state.c.key == "checkpoint")
    with get_engine().begin() as conn:
        conn.execute(stmt)


# ── Pipeline run queue ────────────────────────────────────────────────────────

def load_pipeline_queue() -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = select(pipeline_state.c.value_json).where(pipeline_state.c.key == "pipeline_queue")
    with get_engine().begin() as conn:
        raw = conn.execute(stmt).scalar_one_or_none()
    if not raw:
        return []
    return json.loads(raw)


def save_pipeline_queue(items: List[Dict[str, Any]]) -> None:
    ensure_schema()
    payload = json.dumps(items, ensure_ascii=False)
    now = datetime.utcnow()
    with get_engine().begin() as conn:
        existing = conn.execute(
            select(pipeline_state.c.key).where(pipeline_state.c.key == "pipeline_queue")
        ).scalar_one_or_none()
        if existing:
            conn.execute(
                update(pipeline_state)
                .where(pipeline_state.c.key == "pipeline_queue")
                .values(value_json=payload, updated_at=now)
            )
        else:
            conn.execute(
                insert(pipeline_state).values(
                    key="pipeline_queue", value_json=payload, updated_at=now
                )
            )


def clear_pipeline_queue() -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(delete(pipeline_state).where(pipeline_state.c.key == "pipeline_queue"))


def create_pending_run(title: str, article_url: str) -> int:
    """Insert a run with status='running' at pipeline start; returns the new run id."""
    ensure_schema()
    stmt = insert(runs).values(
        timestamp=datetime.utcnow(),
        title=title,
        article_url=article_url,
        data_json="{}",
        tokens_in=0,
        tokens_out=0,
        cost_usd=0,
        tags="",
        status="running",
    )
    with get_engine().begin() as conn:
        result = conn.execute(stmt)
        return int(result.inserted_primary_key[0])


def complete_run(
    run_id: int,
    data_json: str,
    *,
    tokens_in: int,
    tokens_out: int,
    cost_usd: float,
    tags: str,
) -> None:
    """Update a pending run with final data and mark it done."""
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(
            update(runs).where(runs.c.id == run_id).values(
                data_json=data_json,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost_usd=cost_usd,
                tags=tags,
                status="done",
            )
        )


def fail_run(run_id: int) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(update(runs).where(runs.c.id == run_id).values(status="error"))


def cancel_run(run_id: int) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(update(runs).where(runs.c.id == run_id).values(status="cancelled"))


def fail_all_running_runs() -> int:
    ensure_schema()
    with get_engine().begin() as conn:
        result = conn.execute(
            update(runs)
            .where(runs.c.status == "running")
            .values(status="error")
        )
        return int(result.rowcount or 0)


def create_run(
    title: str,
    article_url: str,
    data_json: str,
    *,
    tokens_in: int,
    tokens_out: int,
    cost_usd: float,
    tags: str,
) -> int:
    ensure_schema()
    stmt = insert(runs).values(
        timestamp=datetime.utcnow(),
        title=title,
        article_url=article_url,
        data_json=data_json,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost_usd=cost_usd,
        tags=tags,
        status="done",
    )
    with get_engine().begin() as conn:
        result = conn.execute(stmt)
        return int(result.inserted_primary_key[0])


def list_runs(limit: int = 50, include_data: bool = False) -> List[Dict[str, Any]]:
    ensure_schema()
    columns = [
        runs.c.id,
        runs.c.timestamp,
        runs.c.title,
        runs.c.article_url,
        runs.c.tokens_in,
        runs.c.tokens_out,
        runs.c.cost_usd,
        runs.c.tags,
        runs.c.status,
    ]
    if include_data:
        columns.append(runs.c.data_json)
    stmt = select(*columns).order_by(runs.c.id.desc()).limit(limit)
    with get_engine().begin() as conn:
        return [_row_to_dict(row) for row in conn.execute(stmt).mappings().all()]


def get_run(run_id: int) -> Optional[Dict[str, Any]]:
    ensure_schema()
    stmt = select(runs).where(runs.c.id == run_id)
    with get_engine().begin() as conn:
        return _row_to_dict(conn.execute(stmt).mappings().first())


def patch_run_data(run_id: int, patch: dict) -> None:
    """Merge `patch` keys into the stored data_json for a run."""
    ensure_schema()
    with get_engine().begin() as conn:
        row = conn.execute(select(runs.c.data_json).where(runs.c.id == run_id)).scalar()
        if row is None:
            return
        try:
            data = json.loads(row)
        except Exception:
            data = {}
        data.update(patch)
        conn.execute(update(runs).where(runs.c.id == run_id).values(data_json=json.dumps(data, ensure_ascii=False)))


def patch_run_content(
    run_id: int,
    section: str,
    lang: str,
    platform: str,
    sample_index: int,
    text: str,
) -> None:
    """Update one sample for a section/lang/platform and archive the old value in _edit_history."""
    ensure_schema()
    with get_engine().begin() as conn:
        row = conn.execute(select(runs.c.data_json).where(runs.c.id == run_id)).scalar()
        if row is None:
            return
        try:
            data = json.loads(row)
        except Exception:
            data = {}

        repurposed_key = f"repurposed_{lang}"
        current_raw: str = (
            (data.get(section) or {}).get(repurposed_key, {}) or {}
        ).get(platform, "") or ""

        samples = [s.strip() for s in current_raw.split("\n---\n") if s.strip()] if current_raw else []

        # Archive the old sample text before overwriting
        content_key = f"{section}-{lang}::{platform}::{sample_index}"
        old_text = samples[sample_index] if sample_index < len(samples) else ""
        if old_text and old_text.strip() != text.strip():
            history_map = data.setdefault("_edit_history", {})
            entries = history_map.setdefault(content_key, [])
            entries.append({"timestamp": datetime.utcnow().isoformat(), "text": old_text})
            if len(entries) > 20:
                history_map[content_key] = entries[-20:]

        # Write updated sample
        while len(samples) <= sample_index:
            samples.append("")
        samples[sample_index] = text

        section_data = data.setdefault(section, {})
        repurposed_data = section_data.setdefault(repurposed_key, {})
        repurposed_data[platform] = "\n---\n".join(s for s in samples if s)

        conn.execute(
            update(runs).where(runs.c.id == run_id).values(
                data_json=json.dumps(data, ensure_ascii=False)
            )
        )


def delete_run(run_id: int) -> None:
    ensure_schema()
    stmt = delete(runs).where(runs.c.id == run_id)
    with get_engine().begin() as conn:
        conn.execute(stmt)


def _is_postgres_duplicate_primary_key(exc: IntegrityError, table_name: str) -> bool:
    engine = get_engine()
    if engine.dialect.name != "postgresql":
        return False
    message = str(getattr(exc, "orig", exc)).lower()
    return (
        "duplicate key value violates unique constraint" in message
        and f'"{table_name}_pkey"' in message
    )


def record_image_cost(source: str, count: int, cost_usd: float) -> None:
    ensure_schema()
    values = dict(
        timestamp=datetime.utcnow(),
        source=source,
        count=count,
        cost_usd=cost_usd,
    )
    stmt = insert(image_costs).values(**values)
    engine = get_engine()
    try:
        with engine.begin() as conn:
            conn.execute(stmt)
    except IntegrityError as exc:
        if not _is_postgres_duplicate_primary_key(exc, image_costs.name):
            raise
        reset_identity_sequence(image_costs)
        with engine.begin() as conn:
            conn.execute(insert(image_costs).values(**values))


def get_all_image_costs() -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = select(image_costs.c.timestamp, image_costs.c.count, image_costs.c.cost_usd)
    with get_engine().begin() as conn:
        return [_row_to_dict(row) for row in conn.execute(stmt).mappings().all()]


def get_image_cost_summary() -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = (
        select(
            image_costs.c.source,
            func.sum(image_costs.c.count).label("cnt"),
            func.sum(image_costs.c.cost_usd).label("total"),
        )
        .group_by(image_costs.c.source)
        .order_by(image_costs.c.source.asc())
    )
    with get_engine().begin() as conn:
        rows = conn.execute(stmt).mappings().all()
    return [dict(row) for row in rows]
