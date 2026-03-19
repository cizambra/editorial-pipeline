from __future__ import annotations

import asyncio
import importlib
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock
from tests import clear_test_modules


class HealthEndpointTests(unittest.TestCase):
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

        self.main = importlib.import_module("main")
        self.storage = importlib.import_module("storage")
        self.storage.init_db()

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._old_env)
        sys.modules.pop("starlette.middleware.sessions", None)
        self._tmpdir.cleanup()

    def test_healthz_reports_ok(self) -> None:
        async def run() -> None:
            response = await self.main.healthz()
            self.assertEqual(response["status"], "ok")
            self.assertEqual(response["service"], "editorial-pipeline")

        asyncio.run(run())

    def test_readyz_reports_ready_when_database_ping_passes(self) -> None:
        async def run() -> None:
            response = await self.main.readyz()
            self.assertEqual(response["status"], "ready")
            self.assertEqual(response["database"], "ok")

        asyncio.run(run())

    def test_readyz_returns_503_when_database_ping_fails(self) -> None:
        async def run() -> None:
            with mock.patch.object(self.storage, "database_ready", side_effect=RuntimeError("db down")):
                response = await self.main.readyz()
            self.assertEqual(response.status_code, 503)
            payload = json.loads(response.body.decode("utf-8"))
            self.assertEqual(payload["status"], "not_ready")
            self.assertEqual(payload["database"], "error")

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
