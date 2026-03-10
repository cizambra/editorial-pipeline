from __future__ import annotations

import importlib
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path


class PipelineQueueTests(unittest.TestCase):
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

        for name in ["main", "storage", "settings", "auth", "db"]:
            sys.modules.pop(name, None)

        fake_sessions = types.ModuleType("starlette.middleware.sessions")

        class DummySessionMiddleware:  # pragma: no cover - simple import stub
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

    def test_queue_repurposed_bundle_creates_shared_scheduled_posts(self) -> None:
        results = self.main._queue_repurposed_bundle(
            repurposed_en={
                "linkedin": "EN LinkedIn",
                "threads": "EN Threads",
                "substack_note": "EN Note",
                "instagram": "EN Insta",
            },
            repurposed_es={
                "linkedin": "ES LinkedIn",
                "threads": "ES Threads",
                "substack_note": "ES Note",
                "instagram": "ES Insta",
            },
            base_date=self.main.datetime.now(),
            source_label="Pipeline / Reflection",
        )

        self.assertTrue(results["linkedin_en"]["queued"])
        self.assertTrue(results["threads_en"]["queued"])
        self.assertTrue(results["substack_note_en"]["queued"])
        self.assertEqual(results["instagram_en"]["reason"], "Instagram requires an image URL")

        posts = self.storage.list_scheduled_posts()
        self.assertEqual(len(posts), 6)
        self.assertEqual({post["platform"] for post in posts}, {"linkedin", "threads", "substack_note"})
        self.assertTrue(all(post["source_label"] == "Pipeline / Reflection" for post in posts))
        self.assertTrue(all(post["status"] == "pending" for post in posts))


if __name__ == "__main__":
    unittest.main()
