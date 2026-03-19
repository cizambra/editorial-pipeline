from __future__ import annotations

import asyncio
import importlib
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from typing import Optional
from unittest import mock
from tests import clear_test_modules


class _FakeRequest:
    def __init__(self, user_id: Optional[int] = None):
        session = {}
        if user_id is not None:
            session["user_id"] = user_id
        self.scope = {"session": session}
        self.session = self.scope["session"]


class AuthFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_env = os.environ.copy()
        self._tmpdir = tempfile.TemporaryDirectory()
        base = Path(self._tmpdir.name)

        os.environ["APP_ENV"] = "development"
        os.environ["AUTH_MODE"] = "local"
        os.environ["SESSION_SECRET"] = "test-session-secret"
        os.environ["DATABASE_URL"] = "sqlite:///" + str(base / "core.db")
        os.environ["STATIC_GENERATED_DIR"] = str(base / "generated")
        os.environ["COMPANION_TEMPLATE_PATH"] = str(base / "template.md")

        clear_test_modules()

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
        self.superadmin_id = self.storage.create_user(
            "owner@example.com",
            self.auth.hash_password("pw"),
            role="superadmin",
            display_name="Owner",
        )
        self.admin_id = self.storage.create_user(
            "admin@example.com",
            self.auth.hash_password("pw"),
            role="admin",
            display_name="Admin",
        )

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._old_env)
        sys.modules.pop("starlette.middleware.sessions", None)
        self._tmpdir.cleanup()

    def test_create_invite_route_returns_pending_invite_and_accept_path(self) -> None:
        async def run() -> None:
            response = await self.main.auth_create_invite(
                self.main.CreateInviteRequest(
                    email="invitee@example.com",
                    display_name="Invitee",
                    role="operator",
                ),
                request=_FakeRequest(self.superadmin_id),
            )
            self.assertEqual(response["invite"]["email"], "invitee@example.com")
            self.assertTrue(response["invite"]["token"])
            self.assertEqual(response["accept_path"], f"/invite?token={response['invite']['token']}")
            pending = self.storage.list_pending_invites()
            self.assertEqual(len(pending), 1)
            self.assertEqual(pending[0]["email"], "invitee@example.com")

        asyncio.run(run())

    def test_resend_and_revoke_invite_routes_manage_pending_invites(self) -> None:
        async def run() -> None:
            created = await self.main.auth_create_invite(
                self.main.CreateInviteRequest(
                    email="invitee@example.com",
                    display_name="Invitee",
                    role="operator",
                ),
                request=_FakeRequest(self.superadmin_id),
            )
            invite_id = int(created["invite"]["id"])
            original_token = created["invite"]["token"]

            resent = await self.main.auth_resend_invite(invite_id, request=_FakeRequest(self.superadmin_id))
            self.assertEqual(resent["invite"]["id"], invite_id)
            self.assertNotEqual(resent["invite"]["token"], original_token)

            await self.main.auth_revoke_invite(invite_id, request=_FakeRequest(self.superadmin_id))
            self.assertEqual(self.storage.list_pending_invites(), [])

        asyncio.run(run())

    def test_supabase_password_reset_route_returns_recovery_link(self) -> None:
        os.environ["AUTH_MODE"] = "supabase"
        os.environ["SUPABASE_URL"] = "https://example.supabase.co"
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "service-role"
        os.environ["SUPABASE_JWT_SECRET"] = "jwt-secret"

        clear_test_modules()

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
        admin = self.storage.get_user_by_email("admin@example.com")

        async def run() -> None:
            with mock.patch.object(self.auth, "generate_supabase_recovery_link", return_value="https://reset.example/link") as reset_fn:
                response = await self.main.auth_password_reset(
                    self.main.PasswordResetRequest(email="admin@example.com"),
                    request=_FakeRequest(int(admin["id"])),
                )
            self.assertEqual(response["mode"], "supabase")
            self.assertEqual(response["recovery_link"], "https://reset.example/link")
            reset_fn.assert_called_once_with("admin@example.com")

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
