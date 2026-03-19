from __future__ import annotations

import asyncio
import importlib
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path

from starlette.requests import Request
from tests import clear_test_modules


class InvitePageTests(unittest.TestCase):
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

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._old_env)
        sys.modules.pop("starlette.middleware.sessions", None)
        self._tmpdir.cleanup()

    def test_invite_page_renders_token_and_invite_script(self) -> None:
        async def run() -> None:
            request = Request(
                {
                    "type": "http",
                    "method": "GET",
                    "path": "/invite",
                    "query_string": b"token=test-token-123",
                    "headers": [],
                    "client": ("127.0.0.1", 12345),
                    "server": ("testserver", 80),
                    "scheme": "http",
                }
            )
            response = await self.main.invite_page(request)
            body = response.body.decode("utf-8")
            self.assertIn("test-token-123", body)
            self.assertIn("/static/js/invite.js", body)
            self.assertIn("data-auth-mode=\"local\"", body)

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
