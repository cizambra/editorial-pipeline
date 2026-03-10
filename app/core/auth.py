from __future__ import annotations

import base64
import hashlib
import hashlib
import hmac
import json
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from fastapi import HTTPException, Request

import storage
from settings import get_settings


PBKDF2_ITERATIONS = 200_000
ROLE_LEVELS = {
    "operator": 0,
    "admin": 1,
    "superadmin": 2,
}


@dataclass(frozen=True)
class AuthUser:
    id: int
    email: str
    display_name: str
    role: str
    status: str

    @property
    def is_superadmin(self) -> bool:
        return self.role == "superadmin"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algo, iterations, salt_hex, digest_hex = encoded.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except Exception:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def verify_supabase_access_token(access_token: str) -> dict[str, Any]:
    settings = get_settings()
    if settings.auth_mode != "supabase":
        raise HTTPException(status_code=501, detail="Supabase auth is disabled")
    if not settings.supabase_jwt_secret:
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET is not configured")
    try:
        header_b64, payload_b64, sig_b64 = access_token.split(".")
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(
            settings.supabase_jwt_secret.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()
        actual_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            raise HTTPException(status_code=401, detail="Invalid token signature")
        header = json.loads(_b64url_decode(header_b64).decode("utf-8"))
        if header.get("alg") != "HS256":
            raise HTTPException(status_code=401, detail="Unsupported token algorithm")
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid access token")
    exp = payload.get("exp")
    if exp and datetime.now(timezone.utc).timestamp() >= float(exp):
        raise HTTPException(status_code=401, detail="Access token expired")
    return payload


def current_user_from_request(request: Request) -> Optional[AuthUser]:
    session = request.scope.get("session")
    if not isinstance(session, dict):
        return None
    user_id = session.get("user_id")
    if not user_id:
        return None
    row = storage.get_user_by_id(int(user_id))
    if not row or row.get("status") != "active":
        session.clear()
        return None
    return AuthUser(
        id=int(row["id"]),
        email=row["email"],
        display_name=row.get("display_name", ""),
        role=row.get("role", "operator"),
        status=row.get("status", "disabled"),
    )


def require_user(request: Request) -> AuthUser:
    user = current_user_from_request(request)
    if user:
        return user
    raise HTTPException(status_code=401, detail="Authentication required")


def require_superadmin(request: Request) -> AuthUser:
    user = require_user(request)
    if user.is_superadmin:
        return user
    raise HTTPException(status_code=403, detail="Superadmin access required")


def require_role(request: Request, minimum_role: str = "operator") -> AuthUser:
    user = require_user(request)
    current = ROLE_LEVELS.get(user.role, -1)
    required = ROLE_LEVELS.get(minimum_role, 0)
    if current >= required:
        return user
    raise HTTPException(status_code=403, detail=f"{minimum_role.title()} access required")


def require_admin(request: Request) -> AuthUser:
    return require_role(request, "admin")


def login_local_user(request: Request, email: str, password: str) -> AuthUser:
    settings = get_settings()
    if settings.auth_mode != "local":
        raise HTTPException(status_code=501, detail="Local auth is disabled")

    user = storage.get_user_by_email(email.strip().lower())
    if not user or user.get("status") != "active":
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    storage.touch_user_login(int(user["id"]))
    request.session["user_id"] = int(user["id"])
    return AuthUser(
        id=int(user["id"]),
        email=user["email"],
        display_name=user.get("display_name", ""),
        role=user.get("role", "operator"),
        status=user.get("status", "active"),
    )


def login_supabase_user(request: Request, access_token: str) -> AuthUser:
    claims = verify_supabase_access_token(access_token)
    subject = str(claims.get("sub") or "").strip()
    email = str(claims.get("email") or "").strip().lower()
    if not subject or not email:
        raise HTTPException(status_code=401, detail="Access token is missing subject or email")
    user = storage.get_user_by_auth_subject("supabase", subject)
    if not user:
        user = storage.get_user_by_email(email)
        if user and user.get("auth_provider") in {"", "local", "supabase"}:
            storage.update_user(
                int(user["id"]),
                auth_provider="supabase",
                auth_subject=subject,
                display_name=(
                    claims.get("user_metadata", {}) or {}
                ).get("name")
                or claims.get("email", ""),
            )
            user = storage.get_user_by_id(int(user["id"]))
    if not user or user.get("status") != "active":
        raise HTTPException(status_code=403, detail="No active app user is mapped to this Supabase account")
    storage.touch_user_login(int(user["id"]))
    request.session["user_id"] = int(user["id"])
    return AuthUser(
        id=int(user["id"]),
        email=user["email"],
        display_name=user.get("display_name", ""),
        role=user.get("role", "operator"),
        status=user.get("status", "active"),
    )


def login_supabase_password(request: Request, email: str, password: str) -> AuthUser:
    settings = get_settings()
    if settings.auth_mode != "supabase":
        raise HTTPException(status_code=501, detail="Supabase auth is disabled")
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=500, detail="Supabase password login is not configured")
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(
                f"{settings.supabase_url}/auth/v1/token?grant_type=password",
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Content-Type": "application/json",
                },
                json={"email": email.strip().lower(), "password": password},
            )
        response.raise_for_status()
        data = response.json()
        access_token = data.get("access_token", "")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=401, detail=f"Supabase login failed: {exc.response.text[:200]}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Supabase login request failed: {exc}")
    if not access_token:
        raise HTTPException(status_code=401, detail="Supabase login did not return an access token")
    return login_supabase_user(request, access_token)


def require_pending_invite(token: str) -> dict[str, Any]:
    invite = storage.get_invite_by_token_hash(hash_token(token))
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Invite is no longer pending")
    expires_at = invite.get("expires_at")
    if expires_at:
        exp_dt = datetime.fromisoformat(str(expires_at))
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp_dt.astimezone(timezone.utc):
            raise HTTPException(status_code=400, detail="Invite has expired")
    return invite


def issue_invite(*, email: str, display_name: str, role: str, invited_by_user_id: int) -> dict[str, Any]:
    settings = get_settings()
    token = generate_invite_token()
    invite_id = storage.create_invite(
        email=email,
        display_name=display_name,
        role=role,
        token_hash=hash_token(token),
        invited_by_user_id=invited_by_user_id,
        expires_at=datetime.utcnow() + timedelta(hours=settings.invite_expiry_hours),
    )
    invite = storage.get_invite_by_token_hash(hash_token(token)) or {"id": invite_id}
    return {
        "id": invite["id"],
        "token": token,
        "email": email.strip().lower(),
        "display_name": display_name.strip(),
        "role": role,
        "expires_at": invite.get("expires_at"),
    }


def accept_local_invite(request: Request, token: str, password: str, display_name: str = "") -> AuthUser:
    invite = require_pending_invite(token)
    email = invite["email"]
    existing = storage.get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="User already exists for this invite")
    user_id = storage.create_user(
        email=email,
        password_hash=hash_password(password),
        role=invite.get("role", "operator"),
        display_name=display_name.strip() or invite.get("display_name", ""),
    )
    storage.mark_invite_accepted(int(invite["id"]))
    user = storage.get_user_by_id(user_id)
    request.session["user_id"] = user_id
    return AuthUser(
        id=int(user["id"]),
        email=user["email"],
        display_name=user.get("display_name", ""),
        role=user.get("role", "operator"),
        status=user.get("status", "active"),
    )


def accept_supabase_invite(request: Request, token: str, access_token: str) -> AuthUser:
    invite = require_pending_invite(token)
    claims = verify_supabase_access_token(access_token)
    subject = str(claims.get("sub") or "").strip()
    email = str(claims.get("email") or "").strip().lower()
    if email != invite["email"]:
        raise HTTPException(status_code=400, detail="Invite email does not match authenticated Supabase user")
    existing = storage.get_user_by_auth_subject("supabase", subject) or storage.get_user_by_email(email)
    if existing:
        storage.update_user(
            int(existing["id"]),
            role=invite.get("role", existing.get("role", "operator")),
            display_name=invite.get("display_name") or existing.get("display_name", ""),
            auth_provider="supabase",
            auth_subject=subject,
            status="active",
        )
        user = storage.get_user_by_id(int(existing["id"]))
    else:
        user_id = storage.create_user(
            email=email,
            password_hash="supabase",
            role=invite.get("role", "operator"),
            display_name=invite.get("display_name", ""),
            status="active",
        )
        storage.update_user(user_id, auth_provider="supabase", auth_subject=subject)
        user = storage.get_user_by_id(user_id)
    storage.mark_invite_accepted(int(invite["id"]))
    request.session["user_id"] = int(user["id"])
    return AuthUser(
        id=int(user["id"]),
        email=user["email"],
        display_name=user.get("display_name", ""),
        role=user.get("role", "operator"),
        status=user.get("status", "active"),
    )


def generate_supabase_recovery_link(email: str) -> str:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=500, detail="Supabase recovery link generation is not configured")
    payload: dict[str, Any] = {"type": "recovery", "email": email.strip().lower()}
    if settings.supabase_site_url:
        payload["options"] = {"redirect_to": settings.supabase_site_url}
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(
                f"{settings.supabase_url}/auth/v1/admin/generate_link",
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        response.raise_for_status()
        data = response.json()
        return data.get("properties", {}).get("action_link") or data.get("action_link") or ""
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Supabase recovery link generation failed: {exc}")


def serialize_user(user: AuthUser | dict[str, Any]) -> dict[str, Any]:
    if isinstance(user, AuthUser):
        return {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
            "status": user.status,
        }
    return {
        "id": int(user["id"]),
        "email": user["email"],
        "display_name": user.get("display_name", ""),
        "role": user.get("role", "operator"),
        "status": user.get("status", "active"),
        "created_at": user.get("created_at", ""),
        "updated_at": user.get("updated_at", ""),
        "last_login_at": user.get("last_login_at", ""),
    }
