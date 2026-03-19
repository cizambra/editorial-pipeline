from __future__ import annotations

import asyncio
import importlib
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path

from fastapi import HTTPException
from tests import clear_test_modules


class _FakeRequest:
    def __init__(self, user_id: int):
        self.scope = {"session": {"user_id": user_id}}
        self.session = self.scope["session"]


class RouteRoleTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_env = os.environ.copy()
        self._tmpdir = tempfile.TemporaryDirectory()
        base = Path(self._tmpdir.name)

        os.environ["APP_ENV"] = "development"
        os.environ["AUTH_MODE"] = "local"
        os.environ["SESSION_SECRET"] = "test-session-secret"
        os.environ["SQLITE_DB_PATH"] = str(base / "test.db")
        os.environ["DATABASE_URL"] = "sqlite:///" + str(base / "core.db")
        os.environ["CONFIG_PATH"] = str(base / "config.json")
        os.environ["CHECKPOINT_PATH"] = str(base / "checkpoint.json")
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
        self.operator_id = self.storage.create_user(
            "operator@example.com", self.auth.hash_password("pw"), role="operator"
        )
        self.admin_id = self.storage.create_user(
            "admin@example.com", self.auth.hash_password("pw"), role="admin"
        )
        self.superadmin_id = self.storage.create_user(
            "superadmin@example.com", self.auth.hash_password("pw"), role="superadmin"
        )

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._old_env)
        sys.modules.pop("starlette.middleware.sessions", None)
        self._tmpdir.cleanup()

    def test_operator_cannot_schedule_social_post(self) -> None:
        async def run() -> None:
            with self.assertRaises(HTTPException) as ctx:
                await self.main.schedule_social_post(
                    {
                        "platform": "linkedin",
                        "text": "Queued post",
                        "scheduled_at": "2030-01-02T15:00:00",
                    },
                    request=_FakeRequest(self.operator_id),
                )
            self.assertEqual(ctx.exception.status_code, 403)

        asyncio.run(run())

    def test_admin_can_schedule_social_post(self) -> None:
        async def run() -> None:
            resp = await self.main.schedule_social_post(
                {
                    "platform": "linkedin",
                    "text": "Queued post",
                    "scheduled_at": "2030-01-02T15:00:00",
                },
                request=_FakeRequest(self.admin_id),
            )
            self.assertEqual(resp["platform"], "linkedin")

        asyncio.run(run())

    def test_admin_cannot_delete_history_but_superadmin_can(self) -> None:
        run_id = self.storage.save_run("Role Test", "", {"summary": "x"})

        async def run() -> None:
            with self.assertRaises(HTTPException) as ctx:
                await self.main.delete_history_run(run_id, request=_FakeRequest(self.admin_id))
            self.assertEqual(ctx.exception.status_code, 403)

            resp = await self.main.delete_history_run(run_id, request=_FakeRequest(self.superadmin_id))
            self.assertEqual(resp["message"], "Run deleted")
            self.assertIsNone(self.storage.get_history_run(run_id))

        asyncio.run(run())

    def test_operator_cannot_update_quote(self) -> None:
        run_id = self.storage.save_run("Quote Role Test", "", {"summary": "x"})
        quote_id = self.storage.save_quotes(
            run_id,
            "Quote Role Test",
            "",
            [{"quote_text": "A quote", "context": "", "quote_type": "insight"}],
        )[0]

        async def run() -> None:
            body = self.main.QuoteUpdate(shared=True, signal="positive")
            with self.assertRaises(HTTPException) as ctx:
                await self.main.update_quote(quote_id, body, request=_FakeRequest(self.operator_id))
            self.assertEqual(ctx.exception.status_code, 403)

            resp = await self.main.update_quote(quote_id, body, request=_FakeRequest(self.admin_id))
            self.assertTrue(resp["ok"])

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
