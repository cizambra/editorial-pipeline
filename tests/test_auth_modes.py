from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import importlib
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock


class _FakeRequest:
    def __init__(self) -> None:
        self.scope = {"session": {}}
        self.session = self.scope["session"]


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _make_hs256_jwt(secret: str, payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url(signature)}"


class AuthModeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_env = os.environ.copy()
        self._tmpdir = tempfile.TemporaryDirectory()
        base = Path(self._tmpdir.name)
        os.environ["APP_ENV"] = "development"
        os.environ["AUTH_MODE"] = "supabase"
        os.environ["SESSION_SECRET"] = "test-session-secret"
        os.environ["SUPABASE_JWT_SECRET"] = "super-secret-jwt-key"
        os.environ["SQLITE_DB_PATH"] = str(base / "test.db")
        os.environ["DATABASE_URL"] = "sqlite:///" + str(base / "core.db")
        os.environ["CONFIG_PATH"] = str(base / "config.json")
        os.environ["CHECKPOINT_PATH"] = str(base / "checkpoint.json")
        os.environ["STATIC_GENERATED_DIR"] = str(base / "generated")
        os.environ["COMPANION_TEMPLATE_PATH"] = str(base / "template.md")

        for name in ["main", "storage", "settings", "auth", "db"]:
            sys.modules.pop(name, None)

        fake_sessions = types.ModuleType("starlette.middleware.sessions")

        class DummySessionMiddleware:
            def __init__(self, app, secret_key: str, **kwargs):
                self.app = app
                self.secret_key = secret_key
                self.kwargs = kwargs

        fake_sessions.SessionMiddleware = DummySessionMiddleware
        sys.modules["starlette.middleware.sessions"] = fake_sessions

        self.auth = importlib.import_module("auth")
        self.storage = importlib.import_module("storage")
        self.main = importlib.import_module("main")
        self.storage.init_db()

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._old_env)
        sys.modules.pop("starlette.middleware.sessions", None)
        self._tmpdir.cleanup()

    def test_supabase_login_maps_existing_user(self) -> None:
        user_id = self.storage.create_user(
            "supabase-user@example.com",
            self.auth.hash_password("unused"),
            role="admin",
            display_name="Supabase User",
        )
        token = _make_hs256_jwt(
            os.environ["SUPABASE_JWT_SECRET"],
            {
                "sub": "supabase-user-123",
                "email": "supabase-user@example.com",
                "exp": 4102444800,
                "user_metadata": {"name": "Supabase User"},
            },
        )

        async def run() -> None:
            resp = await self.main.auth_login_supabase(
                self.main.SupabaseLoginRequest(access_token=token),
                _FakeRequest(),
            )
            self.assertTrue(resp["authenticated"])
            user = self.storage.get_user_by_id(user_id)
            self.assertEqual(user["auth_provider"], "supabase")
            self.assertEqual(user["auth_subject"], "supabase-user-123")

        asyncio.run(run())

    def test_auth_login_route_uses_supabase_password_flow(self) -> None:
        async def run() -> None:
            fake_user = self.auth.AuthUser(
                id=1,
                email="route@example.com",
                display_name="Route User",
                role="admin",
                status="active",
            )
            with mock.patch.object(self.auth, "login_supabase_password", return_value=fake_user) as login_fn:
                resp = await self.main.auth_login(
                    self.main.LoginRequest(email="route@example.com", password="pw"),
                    _FakeRequest(),
                )
            self.assertTrue(resp["authenticated"])
            login_fn.assert_called_once()

        asyncio.run(run())

    def test_local_invite_acceptance_creates_user(self) -> None:
        os.environ["AUTH_MODE"] = "local"
        for name in ["main", "storage", "settings", "auth", "db"]:
            sys.modules.pop(name, None)
        fake_sessions = types.ModuleType("starlette.middleware.sessions")

        class DummySessionMiddleware:
            def __init__(self, app, secret_key: str, **kwargs):
                self.app = app
                self.secret_key = secret_key
                self.kwargs = kwargs

        fake_sessions.SessionMiddleware = DummySessionMiddleware
        sys.modules["starlette.middleware.sessions"] = fake_sessions
        self.auth = importlib.import_module("auth")
        self.storage = importlib.import_module("storage")
        self.main = importlib.import_module("main")
        self.storage.init_db()
        inviter_id = self.storage.create_user(
            "owner@example.com",
            self.auth.hash_password("pw"),
            role="superadmin",
            display_name="Owner",
        )

        async def run() -> None:
            invite_resp = await self.main.auth_create_invite(
                self.main.CreateInviteRequest(
                    email="invitee@example.com",
                    display_name="Invitee",
                    role="operator",
                ),
                request=type("Req", (), {"scope": {"session": {"user_id": inviter_id}}, "session": {"user_id": inviter_id}})(),
            )
            accept_req = _FakeRequest()
            accepted = await self.main.auth_accept_invite(
                self.main.AcceptInviteRequest(
                    token=invite_resp["invite"]["token"],
                    password="strong-password",
                    display_name="Invitee",
                ),
                accept_req,
            )
            self.assertTrue(accepted["authenticated"])
            user = self.storage.get_user_by_email("invitee@example.com")
            self.assertEqual(user["role"], "operator")
            invites = self.storage.list_pending_invites()
            self.assertEqual(invites, [])

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
