from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, case, delete, func, insert, or_, select, update

from .db_schema import (
    article_quotes,
    ensure_schema,
    get_engine,
    ideas,
    post_feedback,
    substack_batches,
    substack_notes,
    substack_subscribers,
    thumbnails,
    _row_to_dict,
    _upsert_row,
)


def save_thumbnail(
    article_title: str,
    article_url: str,
    concept_name: str,
    image_hash: str,
    image_b64: str,
) -> Dict[str, Any]:
    ensure_schema()
    stmt = select(thumbnails.c.id).where(
        and_(
            thumbnails.c.article_title == article_title,
            thumbnails.c.article_url == article_url,
            thumbnails.c.concept_name == concept_name,
            thumbnails.c.image_hash == image_hash,
        )
    )
    with get_engine().begin() as conn:
        existing = conn.execute(stmt).scalar_one_or_none()
        if existing is not None:
            return {"id": int(existing), "created": False}
        result = conn.execute(
            insert(thumbnails).values(
                timestamp=datetime.utcnow(),
                article_title=article_title,
                article_url=article_url,
                concept_name=concept_name,
                image_hash=image_hash,
                image_b64=image_b64,
            )
        )
        return {"id": int(result.inserted_primary_key[0]), "created": True}


def list_thumbnails(query: str = "", limit: int = 100) -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = select(
        thumbnails.c.id,
        thumbnails.c.timestamp,
        thumbnails.c.article_title,
        thumbnails.c.article_url,
        thumbnails.c.concept_name,
    )
    if query:
        needle = f"%{query.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(thumbnails.c.article_title).like(needle),
                func.lower(thumbnails.c.article_url).like(needle),
                func.lower(thumbnails.c.concept_name).like(needle),
            )
        )
    stmt = stmt.order_by(thumbnails.c.id.desc()).limit(max(1, min(limit, 250)))
    with get_engine().begin() as conn:
        return [_row_to_dict(row) for row in conn.execute(stmt).mappings().all()]


def get_thumbnail(thumb_id: int) -> Optional[Dict[str, Any]]:
    ensure_schema()
    stmt = select(
        thumbnails.c.id,
        thumbnails.c.timestamp,
        thumbnails.c.article_title,
        thumbnails.c.article_url,
        thumbnails.c.concept_name,
        thumbnails.c.image_b64,
    ).where(thumbnails.c.id == thumb_id)
    with get_engine().begin() as conn:
        return _row_to_dict(conn.execute(stmt).mappings().first())


def delete_thumbnail(thumb_id: int) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(delete(thumbnails).where(thumbnails.c.id == thumb_id))


def save_feedback(
    run_title: str,
    platform: str,
    source: str,
    language: str,
    post_index: int,
    rating: int,
    preview: str,
) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(
            insert(post_feedback).values(
                timestamp=datetime.utcnow(),
                run_title=run_title,
                platform=platform,
                source=source,
                language=language,
                post_index=post_index,
                rating=rating,
                preview=preview[:200],
            )
        )


def get_feedback_summary() -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = (
        select(
            post_feedback.c.platform,
            func.sum(case((post_feedback.c.rating == 1, 1), else_=0)).label("up"),
            func.sum(case((post_feedback.c.rating == -1, 1), else_=0)).label("down"),
        )
        .group_by(post_feedback.c.platform)
        .order_by(post_feedback.c.platform.asc())
    )
    with get_engine().begin() as conn:
        rows = conn.execute(stmt).mappings().all()
    return [
        {
            "platform": row["platform"],
            "thumbs_up": int(row["up"] or 0),
            "thumbs_down": int(row["down"] or 0),
        }
        for row in rows
    ]


def list_ideas(status: Optional[str] = None, source: Optional[str] = None) -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = select(ideas).order_by(ideas.c.status.asc(), ideas.c.frequency.desc(), ideas.c.created_at.desc())
    if status:
        stmt = stmt.where(ideas.c.status == status)
    if source:
        stmt = stmt.where(ideas.c.source == source)
    with get_engine().begin() as conn:
        return [_row_to_dict(row) for row in conn.execute(stmt).mappings().all()]


def create_idea(theme: str, category: str, emoji: str, article_angle: str, source: str) -> int:
    ensure_schema()
    now = datetime.utcnow()
    with get_engine().begin() as conn:
        result = conn.execute(
            insert(ideas).values(
                theme=theme,
                category=category,
                emoji=emoji,
                article_angle=article_angle,
                source=source,
                status="new",
                created_at=now,
                updated_at=now,
            )
        )
        return int(result.inserted_primary_key[0])


def update_idea_status(idea_id: int, status: str) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(
            update(ideas)
            .where(ideas.c.id == idea_id)
            .values(status=status, updated_at=datetime.utcnow())
        )


def delete_idea(idea_id: int) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(delete(ideas).where(ideas.c.id == idea_id))


def list_idea_themes() -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = select(ideas.c.id, ideas.c.theme)
    with get_engine().begin() as conn:
        return [dict(row) for row in conn.execute(stmt).mappings().all()]


def increment_idea_frequency(idea_id: int, amount: int, updated_at: datetime) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        current = conn.execute(
            select(ideas.c.frequency).where(ideas.c.id == idea_id)
        ).scalar_one_or_none()
        if current is None:
            return
        conn.execute(
            update(ideas)
            .where(ideas.c.id == idea_id)
            .values(frequency=int(current or 0) + amount, updated_at=updated_at)
        )


def update_idea_metadata(
    idea_id: int,
    *,
    category: str,
    emoji: str,
    article_angle: str,
    example: str,
    main_struggle: str,
    sample_urls: str,
    updated_at: datetime,
) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(
            update(ideas)
            .where(ideas.c.id == idea_id)
            .values(
                category=category,
                emoji=emoji,
                article_angle=article_angle,
                example=example,
                main_struggle=main_struggle,
                sample_urls=sample_urls,
                updated_at=updated_at,
            )
        )


def create_idea_row(values: Dict[str, Any]) -> int:
    ensure_schema()
    with get_engine().begin() as conn:
        result = conn.execute(insert(ideas).values(**values))
        return int(result.inserted_primary_key[0])


def save_quotes(run_id: int, article_title: str, article_url: str, quotes: List[Dict[str, Any]]) -> List[int]:
    ensure_schema()
    now = datetime.utcnow().isoformat()
    ids: List[int] = []
    with get_engine().begin() as conn:
        for quote in quotes:
            result = conn.execute(
                insert(article_quotes).values(
                    run_id=run_id,
                    timestamp=now,
                    article_title=article_title,
                    article_url=article_url,
                    quote_text=quote.get("quote_text") or quote.get("quote", ""),
                    context=quote.get("context", ""),
                    quote_type=quote.get("quote_type") or quote.get("type", "insight"),
                )
            )
            ids.append(int(result.inserted_primary_key[0]))
    return ids


def list_quote_runs(limit: int = 50) -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = (
        select(
            article_quotes.c.run_id,
            article_quotes.c.article_title,
            article_quotes.c.article_url,
            func.min(article_quotes.c.timestamp).label("timestamp"),
            func.count(article_quotes.c.id).label("quote_count"),
        )
        .group_by(article_quotes.c.run_id, article_quotes.c.article_title, article_quotes.c.article_url)
        .order_by(func.min(article_quotes.c.timestamp).desc())
        .limit(limit)
    )
    with get_engine().begin() as conn:
        return [dict(row) for row in conn.execute(stmt).mappings().all()]


def get_quotes_for_run(run_id: int) -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = select(article_quotes).where(article_quotes.c.run_id == run_id).order_by(article_quotes.c.id.asc())
    with get_engine().begin() as conn:
        return [_row_to_dict(row) for row in conn.execute(stmt).mappings().all()]


def update_quote(
    quote_id: int,
    *,
    shared: Optional[bool] = None,
    signal: Optional[str] = None,
    linkedin: Optional[str] = None,
    threads: Optional[str] = None,
    instagram: Optional[str] = None,
) -> None:
    ensure_schema()
    values: Dict[str, Any] = {}
    if shared is not None:
        values["shared"] = 1 if shared else 0
    if signal is not None:
        values["signal"] = signal
    if linkedin is not None:
        values["linkedin_post"] = linkedin
    if threads is not None:
        values["threads_post"] = threads
    if instagram is not None:
        values["instagram_post"] = instagram
    if not values:
        return
    with get_engine().begin() as conn:
        conn.execute(update(article_quotes).where(article_quotes.c.id == quote_id).values(**values))


def delete_quote(quote_id: int) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(delete(article_quotes).where(article_quotes.c.id == quote_id))


def get_quote_by_id(quote_id: int) -> Optional[Dict[str, Any]]:
    ensure_schema()
    stmt = select(article_quotes).where(article_quotes.c.id == quote_id)
    with get_engine().begin() as conn:
        return _row_to_dict(conn.execute(stmt).mappings().first())


def upsert_subscribers(subscribers: List[Dict[str, Any]]) -> int:
    ensure_schema()
    now = datetime.utcnow().isoformat()
    synced_emails: set = set()
    for sub in subscribers:
        email = sub.get("user_email_address", "")
        if not email:
            continue
        synced_emails.add(email)
        country_from_api = sub.get("subscription_country") or ""
        values = {
            "id": sub.get("user_id"),
            "email": email,
            "name": sub.get("user_name") or "",
            "photo_url": sub.get("user_photo_url") or "",
            "subscription_interval": sub.get("subscription_interval") or "free",
            "is_subscribed": 1 if sub.get("is_subscribed") else 0,
            "is_comp": 1 if sub.get("is_comp") else 0,
            "activity_rating": int(sub.get("activity_rating") or 0),
            "subscription_created_at": sub.get("subscription_created_at") or "",
            "total_revenue_generated": int(sub.get("total_revenue_generated") or 0),
            "subscription_country": country_from_api,
            "synced_at": now,
            "unsubscribed_at": None,  # clear if they re-subscribed
        }
        with get_engine().begin() as conn:
            existing = conn.execute(
                select(substack_subscribers.c.email, substack_subscribers.c.subscription_country)
                .where(substack_subscribers.c.email == email)
            ).mappings().first()
            if existing is None:
                conn.execute(insert(substack_subscribers).values(**values))
            else:
                update_values = dict(values)
                # Preserve richer country data already in DB if sync doesn't provide one
                if not country_from_api and existing.get("subscription_country"):
                    del update_values["subscription_country"]
                conn.execute(
                    update(substack_subscribers)
                    .where(substack_subscribers.c.email == email)
                    .values(**update_values)
                )
    # Mark subscribers absent from this sync as unsubscribed (only stamp first time)
    if synced_emails:
        with get_engine().begin() as conn:
            to_mark = conn.execute(
                select(substack_subscribers.c.email).where(
                    and_(
                        substack_subscribers.c.email.not_in(list(synced_emails)),
                        or_(
                            substack_subscribers.c.unsubscribed_at.is_(None),
                            substack_subscribers.c.unsubscribed_at == "",
                        ),
                    )
                )
            ).scalars().all()
            if to_mark:
                conn.execute(
                    update(substack_subscribers)
                    .where(substack_subscribers.c.email.in_(to_mark))
                    .values(is_subscribed=0, unsubscribed_at=now)
                )
    return len(subscribers)


def get_subscribers(
    search: str = "",
    activity: Optional[int] = None,
    interval: str = "",
    offset: int = 0,
    limit: int = 50,
) -> Dict[str, Any]:
    ensure_schema()
    conditions = []
    if search:
        needle = f"%{search.lower()}%"
        conditions.append(
            or_(
                func.lower(substack_subscribers.c.name).like(needle),
                func.lower(substack_subscribers.c.email).like(needle),
            )
        )
    if activity is not None:
        conditions.append(substack_subscribers.c.activity_rating == activity)
    if interval:
        conditions.append(substack_subscribers.c.subscription_interval == interval)

    stmt = select(substack_subscribers)
    count_stmt = select(func.count()).select_from(substack_subscribers)
    if conditions:
        stmt = stmt.where(and_(*conditions))
        count_stmt = count_stmt.where(and_(*conditions))
    stmt = stmt.order_by(
        substack_subscribers.c.activity_rating.desc(),
        substack_subscribers.c.subscription_created_at.desc(),
    ).offset(offset).limit(limit)
    with get_engine().begin() as conn:
        total = int(conn.execute(count_stmt).scalar_one() or 0)
        rows = conn.execute(stmt).mappings().all()
    return {"total": total, "subscribers": [_row_to_dict(row) for row in rows]}


def get_subscriber(email: str) -> Optional[Dict[str, Any]]:
    ensure_schema()
    stmt = select(substack_subscribers).where(substack_subscribers.c.email == email)
    with get_engine().begin() as conn:
        return _row_to_dict(conn.execute(stmt).mappings().first())


def save_subscriber_detail(email: str, detail: Dict[str, Any]) -> None:
    ensure_schema()
    crm = detail.get("crmData") or {}
    country = (
        crm.get("subscription_country")
        or crm.get("country")
        or detail.get("subscription_country")
        or detail.get("country")
        or ""
    )
    with get_engine().begin() as conn:
        conn.execute(
            update(substack_subscribers)
            .where(substack_subscribers.c.email == email)
            .values(
                detail_json=json.dumps(detail, ensure_ascii=False),
                detail_synced_at=datetime.utcnow().isoformat(),
                subscription_country=country or substack_subscribers.c.subscription_country,
            )
        )


def backfill_subscriber_countries() -> int:
    """For rows where subscription_country is empty, try to extract it from detail_json."""
    ensure_schema()
    updated = 0
    with get_engine().begin() as conn:
        rows = conn.execute(
            select(substack_subscribers.c.email, substack_subscribers.c.detail_json)
            .where(
                and_(
                    or_(
                        substack_subscribers.c.subscription_country == "",
                        substack_subscribers.c.subscription_country.is_(None),
                    ),
                    substack_subscribers.c.detail_json.is_not(None),
                    substack_subscribers.c.detail_json != "",
                )
            )
        ).mappings().all()
        for row in rows:
            try:
                detail = json.loads(row["detail_json"]) or {}
                crm = detail.get("crmData") or {}
                country = (
                    crm.get("subscription_country")
                    or crm.get("country")
                    or detail.get("subscription_country")
                    or detail.get("country")
                    or ""
                )
                if country:
                    conn.execute(
                        update(substack_subscribers)
                        .where(substack_subscribers.c.email == row["email"])
                        .values(subscription_country=country)
                    )
                    updated += 1
            except Exception:
                pass
    return updated


def get_audience_stats() -> Dict[str, Any]:
    ensure_schema()
    with get_engine().begin() as conn:
        total = int(conn.execute(select(func.count()).select_from(substack_subscribers)).scalar_one() or 0)
        if total == 0:
            return {"total": 0, "paid": 0, "comp": 0, "synced_at": None}
        paid = int(
            conn.execute(
                select(func.count()).select_from(substack_subscribers).where(
                    and_(
                        substack_subscribers.c.is_comp == 0,
                        substack_subscribers.c.subscription_interval.not_in(["free", ""]),
                    )
                )
            ).scalar_one()
            or 0
        )
        comp = int(
            conn.execute(
                select(func.count()).select_from(substack_subscribers).where(substack_subscribers.c.is_comp == 1)
            ).scalar_one()
            or 0
        )
        activity_rows = conn.execute(
            select(
                substack_subscribers.c.activity_rating,
                func.count().label("count"),
            ).group_by(substack_subscribers.c.activity_rating)
        ).mappings().all()
        country_rows = conn.execute(
            select(
                substack_subscribers.c.subscription_country,
                func.count().label("count"),
            )
            .where(substack_subscribers.c.subscription_country != "")
            .group_by(substack_subscribers.c.subscription_country)
            .order_by(func.count().desc())
        ).mappings().all()
        country_coverage = int(
            conn.execute(
                select(func.count()).select_from(substack_subscribers).where(substack_subscribers.c.subscription_country != "")
            ).scalar_one()
            or 0
        )
        growth_rows = conn.execute(
            select(
                func.substr(substack_subscribers.c.subscription_created_at, 1, 7).label("month"),
                func.count().label("count"),
            )
            .where(substack_subscribers.c.subscription_created_at != "")
            .group_by(func.substr(substack_subscribers.c.subscription_created_at, 1, 7))
            .order_by(func.substr(substack_subscribers.c.subscription_created_at, 1, 7).desc())
            .limit(12)
        ).mappings().all()
        synced_at = conn.execute(select(func.max(substack_subscribers.c.synced_at))).scalar_one_or_none()

    activity_dist = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for row in activity_rows:
        activity_dist[int(row["activity_rating"] or 0)] = int(row["count"] or 0)
    monthly_growth = dict(reversed([(row["month"], row["count"]) for row in growth_rows if row["month"]]))
    return {
        "total": total,
        "paid": paid,
        "comp": comp,
        "activity_distribution": activity_dist,
        "country_distribution": [(row["subscription_country"], row["count"]) for row in country_rows],
        "top_countries": [(row["subscription_country"], row["count"]) for row in country_rows],
        "country_coverage": country_coverage,
        "monthly_growth": monthly_growth,
        "synced_at": synced_at,
    }


def get_insights_data() -> Dict[str, Any]:
    ensure_schema()
    with get_engine().begin() as conn:
        total = int(conn.execute(select(func.count()).select_from(substack_subscribers)).scalar_one() or 0)
        rows = conn.execute(
            select(substack_subscribers).where(
                and_(substack_subscribers.c.detail_json != "", substack_subscribers.c.detail_json.is_not(None))
            )
        ).mappings().all()
    enriched: List[Dict[str, Any]] = []
    for row in rows:
        item = _row_to_dict(row)
        try:
            crm = (json.loads(item["detail_json"]) or {}).get("crmData") or {}
            if crm:
                item["crm"] = crm
                enriched.append(item)
        except Exception:
            pass
    return {"total_count": total, "enriched_rows": enriched}


def get_next_subscriber_for_enrichment() -> Optional[Dict[str, Any]]:
    ensure_schema()
    cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
    stmt = (
        select(substack_subscribers)
        .where(
            or_(
                substack_subscribers.c.detail_synced_at.is_(None),
                substack_subscribers.c.detail_synced_at == "",
                substack_subscribers.c.detail_synced_at < cutoff,
            )
        )
        .order_by(
            case(
                (
                    or_(
                        substack_subscribers.c.detail_synced_at.is_(None),
                        substack_subscribers.c.detail_synced_at == "",
                    ),
                    1,
                ),
                else_=0,
            ).desc(),
            substack_subscribers.c.activity_rating.desc(),
        )
        .limit(1)
    )
    with get_engine().begin() as conn:
        return _row_to_dict(conn.execute(stmt).mappings().first())


def save_substack_batch(notes: List[Dict[str, Any]]) -> int:
    ensure_schema()
    now = datetime.utcnow().isoformat()
    with get_engine().begin() as conn:
        result = conn.execute(insert(substack_batches).values(timestamp=now, note_count=len(notes)))
        batch_id = int(result.inserted_primary_key[0])
        for note in notes:
            conn.execute(
                insert(substack_notes).values(
                    batch_id=batch_id,
                    timestamp=now,
                    issue=note.get("issue", ""),
                    intent=note.get("intent", ""),
                    note_text=note.get("note_text", ""),
                )
            )
    return batch_id


def list_substack_batches() -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = (
        select(
            substack_batches.c.id,
            substack_batches.c.timestamp,
            substack_batches.c.note_count,
            func.sum(case((substack_notes.c.shared == 1, 1), else_=0)).label("shared_count"),
            func.sum(case((substack_notes.c.signal == "positive", 1), else_=0)).label("positive_count"),
        )
        .select_from(substack_batches.outerjoin(substack_notes, substack_notes.c.batch_id == substack_batches.c.id))
        .group_by(substack_batches.c.id, substack_batches.c.timestamp, substack_batches.c.note_count)
        .order_by(substack_batches.c.id.desc())
    )
    with get_engine().begin() as conn:
        return [dict(row) for row in conn.execute(stmt).mappings().all()]


def get_substack_notes(batch_id: int) -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = select(substack_notes).where(substack_notes.c.batch_id == batch_id).order_by(substack_notes.c.id.asc())
    with get_engine().begin() as conn:
        return [_row_to_dict(row) for row in conn.execute(stmt).mappings().all()]


def get_substack_note_by_id(note_id: int) -> Optional[Dict[str, Any]]:
    ensure_schema()
    stmt = select(substack_notes).where(substack_notes.c.id == note_id)
    with get_engine().begin() as conn:
        return _row_to_dict(conn.execute(stmt).mappings().first())


def search_substack_notes(
    q: str = "",
    shared: bool = False,
    repurposed: bool = False,
    signal: Optional[str] = None,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    ensure_schema()
    conditions = []
    if q:
        needle = f"%{q}%"
        conditions.append(or_(substack_notes.c.note_text.like(needle), substack_notes.c.issue.like(needle)))
    if shared:
        conditions.append(substack_notes.c.shared == 1)
    if repurposed:
        conditions.append(
            or_(
                substack_notes.c.linkedin_post != "",
                substack_notes.c.threads_post != "",
                substack_notes.c.instagram_post != "",
            )
        )
    if signal:
        conditions.append(substack_notes.c.signal == signal)
    stmt = select(substack_notes)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(substack_notes.c.id.desc()).limit(limit)
    with get_engine().begin() as conn:
        return [_row_to_dict(row) for row in conn.execute(stmt).mappings().all()]


def update_substack_note(
    note_id: int,
    *,
    shared: Optional[bool] = None,
    signal: Optional[str] = None,
    note_text: Optional[str] = None,
) -> None:
    ensure_schema()
    values: Dict[str, Any] = {}
    if shared is not None:
        values["shared"] = 1 if shared else 0
    if signal is not None:
        values["signal"] = signal
    if note_text is not None:
        values["note_text"] = note_text
    if not values:
        return
    with get_engine().begin() as conn:
        conn.execute(update(substack_notes).where(substack_notes.c.id == note_id).values(**values))


def save_substack_repurpose(note_id: int, linkedin: str, threads: str, instagram: str) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(
            update(substack_notes)
            .where(substack_notes.c.id == note_id)
            .values(linkedin_post=linkedin, threads_post=threads, instagram_post=instagram)
        )


def delete_substack_note(note_id: int) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(delete(substack_notes).where(substack_notes.c.id == note_id))


def delete_substack_batch(batch_id: int) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(delete(substack_notes).where(substack_notes.c.batch_id == batch_id))
        conn.execute(delete(substack_batches).where(substack_batches.c.id == batch_id))
