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


class _FakeRequest:
    def __init__(self) -> None:
        self.scope = {"session": {}}
        self.session = self.scope["session"]


class ShellBootTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_env = os.environ.copy()
        self._tmpdir = tempfile.TemporaryDirectory()
        base = Path(self._tmpdir.name)

        os.environ["APP_ENV"] = "development"
        os.environ["AUTH_MODE"] = "local"
        os.environ["SESSION_SECRET"] = "test-session-secret"
        os.environ["BOOTSTRAP_ADMIN_EMAIL"] = "admin@example.com"
        os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = "password123"
        os.environ["BOOTSTRAP_ADMIN_NAME"] = "Admin"
        os.environ["DATABASE_URL"] = "sqlite:///" + str(base / "core.db")
        os.environ["STATIC_GENERATED_DIR"] = str(base / "generated")
        os.environ["COMPANION_TEMPLATE_PATH"] = str(base / "template.md")

        (base / "template.md").write_text("template", encoding="utf-8")

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
        self.storage.ensure_bootstrap_user(self.auth.hash_password(os.environ["BOOTSTRAP_ADMIN_PASSWORD"]))

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._old_env)
        sys.modules.pop("starlette.middleware.sessions", None)
        self._tmpdir.cleanup()

    def test_shell_renders_auth_overlay_and_boot_scripts(self) -> None:
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
            self.assertIn('id="auth-overlay"', body)
            self.assertIn("/static/js/auth.js", body)
            self.assertIn("/static/js/actions-dispatch.js", body)
            self.assertIn("/static/js/bootstrap.js", body)

        asyncio.run(run())

    def test_auth_me_reflects_signed_out_and_signed_in_session(self) -> None:
        async def run() -> None:
            request = _FakeRequest()

            signed_out = await self.main.auth_me(request)
            self.assertFalse(signed_out["authenticated"])
            self.assertEqual(signed_out["auth_mode"], "local")

            signed_in = await self.main.auth_login(
                self.main.LoginRequest(
                    email=os.environ["BOOTSTRAP_ADMIN_EMAIL"],
                    password=os.environ["BOOTSTRAP_ADMIN_PASSWORD"],
                ),
                request,
            )
            self.assertTrue(signed_in["authenticated"])

            current = await self.main.auth_me(request)
            self.assertTrue(current["authenticated"])
            self.assertEqual(current["user"]["email"], os.environ["BOOTSTRAP_ADMIN_EMAIL"])
            self.assertEqual(current["user"]["role"], "superadmin")

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
