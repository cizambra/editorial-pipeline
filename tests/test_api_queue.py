from __future__ import annotations

import asyncio
import importlib
import os
import sys
import tempfile
import types
import unittest
from io import BytesIO
from pathlib import Path
from unittest import mock

from starlette.datastructures import UploadFile


class ApiQueueTests(unittest.TestCase):
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
        os.environ["SQLITE_DB_PATH"] = str(base / "test.db")
        os.environ["DATABASE_URL"] = "sqlite:///" + str(base / "core.db")
        os.environ["CONFIG_PATH"] = str(base / "config.json")
        os.environ["CHECKPOINT_PATH"] = str(base / "checkpoint.json")
        os.environ["STATIC_GENERATED_DIR"] = str(base / "generated")
        os.environ["COMPANION_TEMPLATE_PATH"] = str(base / "template.md")

        (base / "template.md").write_text("template", encoding="utf-8")

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

        self.storage = importlib.import_module("storage")
        self.main = importlib.import_module("main")
        self.storage.init_db()

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._old_env)
        sys.modules.pop("starlette.middleware.sessions", None)
        self._tmpdir.cleanup()

    def test_social_schedule_endpoint_queues_post(self) -> None:
        async def run() -> None:
            resp = await self.main.schedule_social_post(
                {
                    "platform": "linkedin",
                    "text": "Queued post",
                    "scheduled_at": "2030-01-02T15:00:00",
                    "timezone": "America/Los_Angeles",
                    "source_label": "Test",
                }
            )
            self.assertEqual(resp["platform"], "linkedin")
            posts = self.storage.list_scheduled_posts()
            self.assertEqual(len(posts), 1)
            self.assertEqual(posts[0]["platform"], "linkedin")
            self.assertEqual(posts[0]["source_label"], "Test")
            self.assertEqual(posts[0]["status"], "pending")

        asyncio.run(run())

    def test_pipeline_run_passes_queue_social_flag_into_stream_builder(self) -> None:
        async def run() -> None:
            upload = UploadFile(filename="reflection.md", file=BytesIO(b"# Test\n\nHello world"))
            fake_iter = iter(["event: done\ndata: {}\n\n"])
            with mock.patch.object(self.main, "_build_pipeline_stream", return_value=fake_iter) as build_stream:
                response = await self.main.run_pipeline(
                    reflection=upload,
                    title="Queued run",
                    article_url="https://example.com/post",
                    queue_social="true",
                    include_spanish="true",
                    tone_level="5",
                )

            self.assertEqual(response.media_type, "text/event-stream")
            build_stream.assert_called_once()
            args, kwargs = build_stream.call_args
            self.assertEqual(args[0], "# Test\n\nHello world")
            self.assertEqual(args[1], "Queued run")
            self.assertEqual(args[2], "https://example.com/post")
            self.assertTrue(args[3])
            self.assertTrue(args[4])
            self.assertEqual(kwargs["tone_level"], 5)

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
