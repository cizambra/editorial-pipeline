from __future__ import annotations

from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.core import auth
from app.core.settings import get_settings
from app.core.logging import get_logger
from app.persistence import storage


router = APIRouter()
_logger = get_logger("editorial.routes.auth")


async def _append_audit_event(
    *,
    action: str,
    actor=None,
    target_type: str = "",
    target_id: str = "",
    details: Optional[Dict[str, Any]] = None,
) -> None:
    await run_in_threadpool(
        storage.append_audit_event,
        action=action,
        actor_user_id=getattr(actor, "id", None),
        actor_email=getattr(actor, "email", ""),
        actor_role=getattr(actor, "role", ""),
        target_type=target_type,
        target_id=target_id,
        details=details or {},
    )


class LoginRequest(BaseModel):
    email: str
    password: str


class SupabaseLoginRequest(BaseModel):
    access_token: str


class CreateUserRequest(BaseModel):
    email: str
    password: str
    display_name: str = ""
    role: str = "operator"


class UpdateUserRequest(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None


class CreateInviteRequest(BaseModel):
    email: str
    display_name: str = ""
    role: str = "operator"


class AcceptInviteRequest(BaseModel):
    token: str
    password: str = ""
    display_name: str = ""
    access_token: str = ""


class PasswordResetRequest(BaseModel):
    email: str


class ResendInviteRequest(BaseModel):
    invite_id: int


@router.get("/api/auth/me")
async def auth_me(request: Request):
    settings = get_settings()
    user = auth.current_user_from_request(request)
    if not user:
        return {"authenticated": False, "auth_mode": settings.auth_mode}
    return {
        "authenticated": True,
        "auth_mode": settings.auth_mode,
        "user": auth.serialize_user(user),
    }


@router.post("/api/auth/login")
async def auth_login(body: LoginRequest, request: Request):
    settings = get_settings()
    if settings.auth_mode == "supabase":
        user = await run_in_threadpool(auth.login_supabase_password, request, body.email, body.password)
    else:
        user = await run_in_threadpool(auth.login_local_user, request, body.email, body.password)
    await _append_audit_event(
        action="auth.login",
        actor=user,
        target_type="user",
        target_id=str(user.id),
        details={"auth_mode": settings.auth_mode},
    )
    return {
        "authenticated": True,
        "auth_mode": settings.auth_mode,
        "user": auth.serialize_user(user),
    }


@router.post("/api/auth/login/supabase")
async def auth_login_supabase(body: SupabaseLoginRequest, request: Request):
    settings = get_settings()
    user = await run_in_threadpool(auth.login_supabase_user, request, body.access_token)
    await _append_audit_event(
        action="auth.login",
        actor=user,
        target_type="user",
        target_id=str(user.id),
        details={"auth_mode": settings.auth_mode, "provider": "supabase_token"},
    )
    return {
        "authenticated": True,
        "auth_mode": settings.auth_mode,
        "user": auth.serialize_user(user),
    }


@router.post("/api/auth/logout")
async def auth_logout(request: Request):
    user = auth.current_user_from_request(request)
    session = request.scope.get("session")
    if isinstance(session, dict):
        session.clear()
    if user:
        await _append_audit_event(
            action="auth.logout",
            actor=user,
            target_type="user",
            target_id=str(user.id),
        )
    return {"ok": True}


@router.get("/api/auth/users")
async def auth_list_users(request: Request):
    auth.require_superadmin(request)
    return {
        "users": await run_in_threadpool(storage.list_users),
        "invites": await run_in_threadpool(storage.list_pending_invites),
    }


@router.get("/api/audit")
async def auth_list_audit_events(request: Request, limit: int = 100):
    auth.require_superadmin(request)
    limit = max(1, min(int(limit), 500))
    return {"events": await run_in_threadpool(storage.list_audit_events, limit)}


@router.post("/api/auth/users")
async def auth_create_user(body: CreateUserRequest, request: Request):
    settings = get_settings()
    auth.require_superadmin(request)
    if settings.auth_mode != "local":
        raise HTTPException(status_code=400, detail="Direct user creation is only available in AUTH_MODE=local. Use invites instead.")
    role = (body.role or "operator").strip().lower()
    if role not in {"superadmin", "admin", "operator"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    email = body.email.strip().lower()
    if not email or not body.password.strip():
        raise HTTPException(status_code=400, detail="email and password are required")
    if await run_in_threadpool(storage.get_user_by_email, email):
        raise HTTPException(status_code=409, detail="User already exists")
    user_id = await run_in_threadpool(
        storage.create_user,
        email=email,
        password_hash=auth.hash_password(body.password),
        display_name=body.display_name,
        role=role,
    )
    created = await run_in_threadpool(storage.get_user_by_id, user_id)
    await _append_audit_event(
        action="auth.user_created",
        actor=auth.current_user_from_request(request),
        target_type="user",
        target_id=str(user_id),
        details={"email": email, "role": role},
    )
    return {"user": created}


@router.patch("/api/auth/users/{user_id}")
async def auth_update_user(user_id: int, body: UpdateUserRequest, request: Request):
    current = auth.require_superadmin(request)
    existing = await run_in_threadpool(storage.get_user_by_id, user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    role = body.role.strip().lower() if body.role else None
    if role is not None and role not in {"superadmin", "admin", "operator"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    status = body.status.strip().lower() if body.status else None
    if status is not None and status not in {"active", "disabled"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    if existing["id"] == current.id and status == "disabled":
        raise HTTPException(status_code=400, detail="You cannot disable your own account")
    await run_in_threadpool(
        storage.update_user,
        user_id,
        role=role,
        display_name=body.display_name,
        status=status,
        password_hash=auth.hash_password(body.password) if body.password else None,
    )
    await _append_audit_event(
        action="auth.user_updated",
        actor=current,
        target_type="user",
        target_id=str(user_id),
        details={
            "role": role,
            "status": status,
            "display_name": body.display_name,
            "password_reset": bool(body.password),
        },
    )
    return {"user": await run_in_threadpool(storage.get_user_by_id, user_id)}


@router.post("/api/auth/invites")
async def auth_create_invite(body: CreateInviteRequest, request: Request):
    current = auth.require_superadmin(request)
    role = (body.role or "operator").strip().lower()
    if role not in {"superadmin", "admin", "operator"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    if await run_in_threadpool(storage.get_user_by_email, body.email.strip().lower()):
        raise HTTPException(status_code=409, detail="User already exists")
    invite = await run_in_threadpool(
        auth.issue_invite,
        email=body.email,
        display_name=body.display_name,
        role=role,
        invited_by_user_id=current.id,
    )
    await _append_audit_event(
        action="auth.invite_created",
        actor=current,
        target_type="invite",
        target_id=str(invite["id"]),
        details={"email": invite["email"], "role": invite["role"]},
    )
    return {
        "invite": invite,
        "accept_path": f"/invite?token={invite['token']}",
    }


@router.post("/api/auth/invites/{invite_id}/resend")
async def auth_resend_invite(invite_id: int, request: Request):
    current = auth.require_superadmin(request)
    invite = await run_in_threadpool(auth.resend_invite, invite_id)
    await _append_audit_event(
        action="auth.invite_resent",
        actor=current,
        target_type="invite",
        target_id=str(invite_id),
        details={"email": invite["email"], "role": invite["role"]},
    )
    return {
        "invite": invite,
        "accept_path": f"/invite?token={invite['token']}",
    }


@router.delete("/api/auth/invites/{invite_id}")
async def auth_revoke_invite(invite_id: int, request: Request):
    current = auth.require_superadmin(request)
    invite = await run_in_threadpool(storage.get_invite_by_id, invite_id)
    await run_in_threadpool(auth.revoke_invite, invite_id)
    await _append_audit_event(
        action="auth.invite_revoked",
        actor=current,
        target_type="invite",
        target_id=str(invite_id),
        details={"email": invite.get("email", "") if invite else ""},
    )
    return {"ok": True}


@router.post("/api/auth/invites/accept")
async def auth_accept_invite(body: AcceptInviteRequest, request: Request):
    settings = get_settings()
    if settings.auth_mode == "local":
        if not body.password.strip():
            raise HTTPException(status_code=400, detail="password is required")
        user = await run_in_threadpool(auth.accept_local_invite, request, body.token, body.password, body.display_name)
    else:
        if not body.access_token.strip():
            raise HTTPException(status_code=400, detail="access_token is required")
        user = await run_in_threadpool(auth.accept_supabase_invite, request, body.token, body.access_token)
    await _append_audit_event(
        action="auth.invite_accepted",
        actor=user,
        target_type="user",
        target_id=str(user.id),
        details={"auth_mode": settings.auth_mode},
    )
    return {
        "authenticated": True,
        "auth_mode": settings.auth_mode,
        "user": auth.serialize_user(user),
    }


@router.post("/api/auth/password-reset")
async def auth_password_reset(body: PasswordResetRequest, request: Request):
    settings = get_settings()
    current = auth.require_admin(request)
    email = body.email.strip().lower()
    if not await run_in_threadpool(storage.get_user_by_email, email):
        raise HTTPException(status_code=404, detail="User not found")
    if settings.auth_mode == "local":
        await _append_audit_event(
            action="auth.password_reset_requested",
            actor=current,
            target_type="user",
            target_id=email,
            details={"mode": "local"},
        )
        return {
            "mode": "local",
            "message": "Use the user edit endpoint to set a new local password.",
        }
    try:
        recovery_link = await run_in_threadpool(auth.generate_supabase_recovery_link, email)
    except Exception:
        _logger.exception("Password reset link generation failed", extra={"fields": {"email": email}})
        raise HTTPException(status_code=500, detail="Failed to generate recovery link")
    await _append_audit_event(
        action="auth.password_reset_requested",
        actor=current,
        target_type="user",
        target_id=email,
        details={"mode": "supabase"},
    )
    return {
        "mode": "supabase",
        "recovery_link": recovery_link,
    }
