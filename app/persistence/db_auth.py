from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, insert, select, update

from .db_schema import app_users, user_invites, ensure_schema, get_engine, _row_to_dict


def create_user(
    email: str,
    password_hash: str,
    role: str,
    display_name: str,
    status: str,
) -> int:
    ensure_schema()
    now = datetime.utcnow()
    stmt = insert(app_users).values(
        email=email.strip().lower(),
        display_name=display_name.strip(),
        password_hash=password_hash,
        auth_provider="local",
        auth_subject="",
        role=role,
        status=status,
        created_at=now,
        updated_at=now,
    )
    with get_engine().begin() as conn:
        result = conn.execute(stmt)
        return int(result.inserted_primary_key[0])


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    ensure_schema()
    stmt = select(app_users).where(app_users.c.email == email.strip().lower())
    with get_engine().begin() as conn:
        return _row_to_dict(conn.execute(stmt).mappings().first())


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    ensure_schema()
    stmt = select(app_users).where(app_users.c.id == user_id)
    with get_engine().begin() as conn:
        return _row_to_dict(conn.execute(stmt).mappings().first())


def list_users() -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = select(app_users).order_by(app_users.c.email.asc())
    with get_engine().begin() as conn:
        return [_row_to_dict(row) for row in conn.execute(stmt).mappings().all()]


def update_user(
    user_id: int,
    *,
    role: Optional[str] = None,
    display_name: Optional[str] = None,
    status: Optional[str] = None,
    password_hash: Optional[str] = None,
    auth_provider: Optional[str] = None,
    auth_subject: Optional[str] = None,
) -> bool:
    ensure_schema()
    values: Dict[str, Any] = {"updated_at": datetime.utcnow()}
    if role is not None:
        values["role"] = role
    if display_name is not None:
        values["display_name"] = display_name.strip()
    if status is not None:
        values["status"] = status
    if password_hash is not None:
        values["password_hash"] = password_hash
    if auth_provider is not None:
        values["auth_provider"] = auth_provider
    if auth_subject is not None:
        values["auth_subject"] = auth_subject
    stmt = update(app_users).where(app_users.c.id == user_id).values(**values)
    with get_engine().begin() as conn:
        result = conn.execute(stmt)
        return result.rowcount > 0


def touch_user_login(user_id: int) -> None:
    ensure_schema()
    now = datetime.utcnow()
    stmt = (
        update(app_users)
        .where(app_users.c.id == user_id)
        .values(last_login_at=now, updated_at=now)
    )
    with get_engine().begin() as conn:
        conn.execute(stmt)


def get_user_by_auth_subject(auth_provider: str, auth_subject: str) -> Optional[Dict[str, Any]]:
    ensure_schema()
    stmt = select(app_users).where(
        and_(app_users.c.auth_provider == auth_provider, app_users.c.auth_subject == auth_subject)
    )
    with get_engine().begin() as conn:
        return _row_to_dict(conn.execute(stmt).mappings().first())


def create_invite(
    *,
    email: str,
    display_name: str,
    role: str,
    token_hash: str,
    invited_by_user_id: int,
    expires_at: datetime,
) -> int:
    ensure_schema()
    with get_engine().begin() as conn:
        result = conn.execute(
            insert(user_invites).values(
                email=email.strip().lower(),
                display_name=display_name.strip(),
                role=role,
                token_hash=token_hash,
                invited_by_user_id=invited_by_user_id,
                expires_at=expires_at,
                created_at=datetime.utcnow(),
                status="pending",
            )
        )
        return int(result.inserted_primary_key[0])


def get_invite_by_token_hash(token_hash: str) -> Optional[Dict[str, Any]]:
    ensure_schema()
    stmt = select(user_invites).where(user_invites.c.token_hash == token_hash)
    with get_engine().begin() as conn:
        return _row_to_dict(conn.execute(stmt).mappings().first())


def list_pending_invites() -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = (
        select(user_invites)
        .where(user_invites.c.status == "pending")
        .order_by(user_invites.c.created_at.desc())
    )
    with get_engine().begin() as conn:
        return [_row_to_dict(row) for row in conn.execute(stmt).mappings().all()]


def mark_invite_accepted(invite_id: int) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(
            update(user_invites)
            .where(user_invites.c.id == invite_id)
            .values(status="accepted", accepted_at=datetime.utcnow())
        )
