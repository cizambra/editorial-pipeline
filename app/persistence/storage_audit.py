from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.persistence import db


def append_audit_event(
    *,
    action: str,
    actor_user_id: Optional[int] = None,
    actor_email: str = "",
    actor_role: str = "",
    target_type: str = "",
    target_id: str = "",
    details: Optional[Dict[str, Any]] = None,
) -> int:
    return db.append_audit_event(
        action=action,
        actor_user_id=actor_user_id,
        actor_email=actor_email,
        actor_role=actor_role,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )


def list_audit_events(limit: int = 100) -> List[Dict[str, Any]]:
    return db.list_audit_events(limit)
