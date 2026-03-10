from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, func, insert, select, update

from .db_schema import (
    app_config,
    ensure_schema,
    get_engine,
    image_costs,
    pipeline_state,
    runs,
    scheduled_posts,
    _row_to_dict,
)


def create_scheduled_post(
    platform: str,
    text: str,
    scheduled_at: datetime,
    image_url: str = "",
    source_label: str = "",
    timezone: str = "",
    note_id: Optional[int] = None,
) -> int:
    ensure_schema()
    stmt = insert(scheduled_posts).values(
        platform=platform,
        text=text,
        image_url=image_url,
        scheduled_at=scheduled_at,
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
        "post_id": post_id_result,
        "error": error,
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


def delete_run(run_id: int) -> None:
    ensure_schema()
    stmt = delete(runs).where(runs.c.id == run_id)
    with get_engine().begin() as conn:
        conn.execute(stmt)


def record_image_cost(source: str, count: int, cost_usd: float) -> None:
    ensure_schema()
    stmt = insert(image_costs).values(
        timestamp=datetime.utcnow(),
        source=source,
        count=count,
        cost_usd=cost_usd,
    )
    with get_engine().begin() as conn:
        conn.execute(stmt)


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
