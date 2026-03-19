from __future__ import annotations

import importlib
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from tests import clear_test_modules


class LegacyImportTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_env = os.environ.copy()
        self._tmpdir = tempfile.TemporaryDirectory()
        base = Path(self._tmpdir.name)

        os.environ["APP_ENV"] = "development"
        os.environ["AUTH_MODE"] = "local"
        os.environ["SESSION_SECRET"] = "test-session-secret"
        os.environ["SQLITE_DB_PATH"] = str(base / "runtime.db")
        os.environ["DATABASE_URL"] = "sqlite:///" + str(base / "core.db")
        os.environ["CONFIG_PATH"] = str(base / "config.json")
        os.environ["CHECKPOINT_PATH"] = str(base / "checkpoint.json")
        os.environ["STATIC_GENERATED_DIR"] = str(base / "generated")
        os.environ["COMPANION_TEMPLATE_PATH"] = str(base / "template.md")

        clear_test_modules()

        self.storage = importlib.import_module("storage")
        self.importer = importlib.import_module("scripts.import_legacy_data")
        self.storage.init_db()
        self.base = base

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._old_env)
        self._tmpdir.cleanup()

    def test_imports_legacy_sqlite_and_json_into_database(self) -> None:
        sqlite_path = self.base / "legacy.db"
        conn = sqlite3.connect(str(sqlite_path))
        try:
            conn.executescript(
                """
                CREATE TABLE app_users (
                    id INTEGER PRIMARY KEY,
                    email TEXT,
                    display_name TEXT,
                    password_hash TEXT,
                    role TEXT,
                    status TEXT,
                    created_at TEXT,
                    updated_at TEXT,
                    last_login_at TEXT
                );
                CREATE TABLE scheduled_posts (
                    id INTEGER PRIMARY KEY,
                    platform TEXT,
                    text TEXT,
                    image_url TEXT,
                    scheduled_at TEXT,
                    status TEXT,
                    source_label TEXT,
                    created_at TEXT,
                    published_at TEXT,
                    post_id TEXT,
                    error TEXT,
                    timezone TEXT,
                    note_id INTEGER
                );
                CREATE TABLE runs (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT,
                    title TEXT,
                    article_url TEXT,
                    data_json TEXT,
                    tokens_in INTEGER,
                    tokens_out INTEGER,
                    cost_usd REAL,
                    tags TEXT
                );
                CREATE TABLE image_costs (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT,
                    source TEXT,
                    count INTEGER,
                    cost_usd REAL
                );
                CREATE TABLE thumbnails (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT,
                    article_title TEXT,
                    article_url TEXT,
                    concept_name TEXT,
                    image_hash TEXT,
                    image_b64 TEXT
                );
                CREATE TABLE post_feedback (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT,
                    run_title TEXT,
                    platform TEXT,
                    source TEXT,
                    language TEXT,
                    post_index INTEGER,
                    rating INTEGER,
                    preview TEXT
                );
                CREATE TABLE ideas (
                    id INTEGER PRIMARY KEY,
                    theme TEXT,
                    category TEXT,
                    emoji TEXT,
                    frequency INTEGER,
                    article_angle TEXT,
                    example TEXT,
                    source TEXT,
                    status TEXT,
                    created_at TEXT,
                    updated_at TEXT
                );
                CREATE TABLE article_quotes (
                    id INTEGER PRIMARY KEY,
                    run_id INTEGER,
                    timestamp TEXT,
                    article_title TEXT,
                    article_url TEXT,
                    quote_text TEXT,
                    context TEXT,
                    quote_type TEXT,
                    shared INTEGER,
                    signal TEXT,
                    linkedin_post TEXT,
                    threads_post TEXT,
                    instagram_post TEXT
                );
                CREATE TABLE substack_subscribers (
                    id INTEGER PRIMARY KEY,
                    email TEXT,
                    name TEXT,
                    photo_url TEXT,
                    subscription_interval TEXT,
                    is_subscribed INTEGER,
                    is_comp INTEGER,
                    activity_rating INTEGER,
                    subscription_created_at TEXT,
                    total_revenue_generated INTEGER,
                    subscription_country TEXT,
                    detail_json TEXT,
                    synced_at TEXT,
                    detail_synced_at TEXT
                );
                CREATE TABLE substack_batches (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT,
                    note_count INTEGER
                );
                CREATE TABLE substack_notes (
                    id INTEGER PRIMARY KEY,
                    batch_id INTEGER,
                    timestamp TEXT,
                    issue TEXT,
                    intent TEXT,
                    note_text TEXT,
                    shared INTEGER,
                    signal TEXT,
                    linkedin_post TEXT,
                    threads_post TEXT,
                    instagram_post TEXT
                );
                """
            )
            conn.execute(
                "INSERT INTO app_users VALUES (1, 'admin@example.com', 'Admin', 'hash', 'superadmin', 'active', '2026-01-01T00:00:00', '2026-01-01T00:00:00', '2026-01-02T00:00:00')"
            )
            conn.execute(
                "INSERT INTO scheduled_posts VALUES (2, 'linkedin', 'queued text', '', '2030-01-02T15:00:00', 'pending', 'Legacy', '2026-01-01T00:00:00', '', '', '', 'UTC', NULL)"
            )
            conn.execute(
                "INSERT INTO runs VALUES (3, '2026-01-03T00:00:00', 'Imported Run', 'https://example.com/post', '{\"social\": {\"linkedin\": \"Copy\"}}', 10, 20, 0.5, 'alpha,beta')"
            )
            conn.execute(
                "INSERT INTO image_costs VALUES (4, '2026-01-04T00:00:00', 'openai', 2, 0.66)"
            )
            conn.execute(
                "INSERT INTO thumbnails VALUES (5, '2026-01-05T00:00:00', 'Imported Title', 'https://example.com/post', 'Concept', 'abc', 'base64-data')"
            )
            conn.execute(
                "INSERT INTO post_feedback VALUES (6, '2026-01-06T00:00:00', 'Imported Run', 'linkedin', 'reflection', 'en', 0, 1, 'good')"
            )
            conn.execute(
                "INSERT INTO ideas VALUES (7, 'Imported Idea', 'Category', 'I', 2, 'Angle', 'Example', 'reddit', 'new', '2026-01-07T00:00:00', '2026-01-07T00:00:00')"
            )
            conn.execute(
                "INSERT INTO article_quotes VALUES (8, 3, '2026-01-08T00:00:00', 'Imported Run', 'https://example.com/post', 'Imported Quote', 'Ctx', 'insight', 1, 'positive', 'LI', 'TH', 'IG')"
            )
            conn.execute(
                "INSERT INTO substack_subscribers VALUES (9, 'reader@example.com', 'Reader', '', 'monthly', 1, 0, 4, '2026-01-09T00:00:00', 1000, 'US', '{\"crmData\": {\"num_emails_received\": 4, \"num_emails_opened\": 2}}', '2026-01-10T00:00:00', '2026-01-10T00:00:00')"
            )
            conn.execute(
                "INSERT INTO substack_batches VALUES (10, '2026-01-10T00:00:00', 1)"
            )
            conn.execute(
                "INSERT INTO substack_notes VALUES (11, 10, '2026-01-10T00:00:00', 'Issue', 'Intent', 'Note text', 1, 'positive', 'LI', 'TH', 'IG')"
            )
            conn.commit()
        finally:
            conn.close()

        config_path = self.base / "legacy-config.json"
        config_path.write_text(json.dumps({"tone_level": 7}), encoding="utf-8")
        checkpoint_path = self.base / "legacy-checkpoint.json"
        checkpoint_path.write_text(json.dumps({"reflection_title": "Checkpoint"}), encoding="utf-8")

        summary = {
            "config": self.importer.import_json_file(config_path, self.importer.db_import.import_config),
            "checkpoint": self.importer.import_json_file(checkpoint_path, self.importer.db_import.import_checkpoint),
        }
        summary.update(self.importer.import_sqlite(sqlite_path))

        self.assertEqual(summary["app_users"], 1)
        self.assertEqual(summary["scheduled_posts"], 1)
        self.assertEqual(summary["runs"], 1)
        self.assertEqual(summary["ideas"], 1)
        self.assertEqual(self.storage.load_config(), {"tone_level": 7})
        self.assertEqual(self.storage.load_checkpoint(), {"reflection_title": "Checkpoint"})
        self.assertEqual(self.storage.list_users()[0]["email"], "admin@example.com")
        self.assertEqual(self.storage.list_scheduled_posts()[0]["source_label"], "Legacy")
        self.assertEqual(self.storage.get_history_run(3)["title"], "Imported Run")
        self.assertEqual(self.storage.list_thumbnails()[0]["concept_name"], "Concept")
        self.assertEqual(self.storage.get_feedback_summary()[0]["thumbs_up"], 1)
        self.assertEqual(self.storage.list_ideas()[0]["theme"], "Imported Idea")
        self.assertEqual(self.storage.get_quotes_for_run(3)[0]["quote_text"], "Imported Quote")
        self.assertEqual(self.storage.get_subscribers()["total"], 1)
        self.assertEqual(self.storage.list_substack_batches()[0]["id"], 10)
        self.assertEqual(self.storage.get_substack_notes(10)[0]["id"], 11)
        created_id = self.storage.create_user(
            "second@example.com",
            "hash-2",
            role="operator",
            display_name="Second",
            status="active",
        )
        self.assertGreater(created_id, 1)


if __name__ == "__main__":
    unittest.main()
