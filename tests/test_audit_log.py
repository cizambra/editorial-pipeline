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

from fastapi import HTTPException
from tests import clear_test_modules


class _FakeRequest:
    def __init__(self, user_id: Optional[int] = None):
        session = {}
        if user_id is not None:
            session["user_id"] = user_id
        self.scope = {"session": session}
        self.session = self.scope["session"]


class AuditLogTests(unittest.TestCase):
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

    def test_auth_queue_and_config_mutations_are_audited(self) -> None:
        async def run() -> None:
            await self.main.auth_create_invite(
                self.main.CreateInviteRequest(
                    email="invitee@example.com",
                    display_name="Invitee",
                    role="operator",
                ),
                request=_FakeRequest(self.superadmin_id),
            )
            await self.main.schedule_social_post(
                {
                    "platform": "linkedin",
                    "text": "Queued post",
                    "scheduled_at": "2030-01-02T15:00:00",
                    "source_label": "Audit test",
                },
                request=_FakeRequest(self.admin_id),
            )
            await self.main.post_config(
                {"tone_level": 5, "thumbnail_prompt": "Sharper editorial imagery"},
                request=_FakeRequest(self.superadmin_id),
            )

            events = self.storage.list_audit_events(10)
            actions = [event["action"] for event in events]
            self.assertIn("auth.invite_created", actions)
            self.assertIn("queue.scheduled", actions)
            self.assertIn("config.updated", actions)

        asyncio.run(run())

    def test_audit_endpoint_is_superadmin_only(self) -> None:
        async def run() -> None:
            with self.assertRaises(HTTPException) as ctx:
                await self.main.auth_list_audit_events(request=_FakeRequest(self.admin_id))
            self.assertEqual(ctx.exception.status_code, 403)

            response = await self.main.auth_list_audit_events(request=_FakeRequest(self.superadmin_id))
            self.assertIn("events", response)

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
