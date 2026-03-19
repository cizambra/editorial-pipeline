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


class RootTemplateTests(unittest.TestCase):
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

    def test_root_renders_template_shell_with_split_scripts(self) -> None:
        async def run() -> None:
            request = Request(
                {
                    "type": "http",
                    "method": "GET",
                    "path": "/",
                    "headers": [],
                    "query_string": b"",
                    "client": ("127.0.0.1", 12345),
                    "server": ("testserver", 80),
                    "scheme": "http",
                }
            )
            response = await self.main.root(request)
            body = response.body.decode("utf-8")
            self.assertIn("/static/js/actions-core.js", body)
            self.assertIn("/static/js/actions-marketing.js", body)
            self.assertIn("/static/js/ui-core.js", body)
            self.assertIn("/static/js/ui-marketing.js", body)
            self.assertIn("/static/js/bootstrap.js", body)

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
