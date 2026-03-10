from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

import db
from settings import get_settings


_settings = get_settings()


def init_db() -> None:
    db.init_core_tables()


def database_ready() -> bool:
    return db.ping()


def load_config() -> Dict[str, Any]:
    return db.load_config()


def save_config(config: Dict[str, Any]) -> None:
    db.save_config(config)


def load_checkpoint() -> Optional[Dict[str, Any]]:
    return db.load_checkpoint()


def save_checkpoint(data: Dict[str, Any]) -> None:
    db.save_checkpoint(data)


def create_user(
    email: str,
    password_hash: str,
    role: str = "operator",
    display_name: str = "",
    status: str = "active",
) -> int:
    return db.create_user(email, password_hash, role, display_name, status)


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    return db.get_user_by_email(email)


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    return db.get_user_by_id(user_id)


def list_users() -> List[Dict[str, Any]]:
    return db.list_users()


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
    return db.update_user(
        user_id,
        role=role,
        display_name=display_name,
        status=status,
        password_hash=password_hash,
        auth_provider=auth_provider,
        auth_subject=auth_subject,
    )


def touch_user_login(user_id: int) -> None:
    db.touch_user_login(user_id)


def get_user_by_auth_subject(auth_provider: str, auth_subject: str) -> Optional[Dict[str, Any]]:
    return db.get_user_by_auth_subject(auth_provider, auth_subject)


def create_invite(
    *,
    email: str,
    display_name: str,
    role: str,
    token_hash: str,
    invited_by_user_id: int,
    expires_at: datetime,
) -> int:
    return db.create_invite(
        email=email,
        display_name=display_name,
        role=role,
        token_hash=token_hash,
        invited_by_user_id=invited_by_user_id,
        expires_at=expires_at,
    )


def get_invite_by_token_hash(token_hash: str) -> Optional[Dict[str, Any]]:
    return db.get_invite_by_token_hash(token_hash)


def list_pending_invites() -> List[Dict[str, Any]]:
    return db.list_pending_invites()


def mark_invite_accepted(invite_id: int) -> None:
    db.mark_invite_accepted(invite_id)


def ensure_bootstrap_user(password_hash: str) -> Optional[int]:
    email = _settings.bootstrap_admin_email
    if not email or not password_hash:
        return None
    existing = get_user_by_email(email)
    if existing:
        return int(existing["id"])
    return create_user(
        email=email,
        password_hash=password_hash,
        role="superadmin",
        display_name=_settings.bootstrap_admin_name,
    )


def clear_checkpoint() -> None:
    db.clear_checkpoint()
