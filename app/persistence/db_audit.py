from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import insert, select

from .db_schema import audit_log, ensure_schema, get_engine, _row_to_dict


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
    ensure_schema()
    payload = details or {}
    with get_engine().begin() as conn:
        result = conn.execute(
            insert(audit_log).values(
                timestamp=datetime.utcnow(),
                actor_user_id=actor_user_id,
                actor_email=actor_email.strip().lower(),
                actor_role=actor_role.strip().lower(),
                action=action.strip(),
                target_type=target_type.strip(),
                target_id=str(target_id or "").strip(),
                details_json=json.dumps(payload, ensure_ascii=True),
            )
        )
        return int(result.inserted_primary_key[0])


def list_audit_events(limit: int = 100) -> List[Dict[str, Any]]:
    ensure_schema()
    stmt = select(audit_log).order_by(audit_log.c.timestamp.desc(), audit_log.c.id.desc()).limit(limit)
    with get_engine().begin() as conn:
        rows = [_row_to_dict(row) for row in conn.execute(stmt).mappings().all()]
    for row in rows:
        try:
            row["details"] = json.loads(row.pop("details_json", "{}") or "{}")
        except Exception:
            row["details"] = {}
        row["actor_user_id"] = int(row["actor_user_id"]) if row.get("actor_user_id") is not None else None
    return rows
