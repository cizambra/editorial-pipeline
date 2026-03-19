from __future__ import annotations

import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path
from tests import clear_test_modules


class StoragePostgresTests(unittest.TestCase):
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

        self.storage = importlib.import_module("storage")
        self.storage.init_db()

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._old_env)
        self._tmpdir.cleanup()

    def test_config_and_checkpoint_use_database_url_store(self) -> None:
        config = {"timezone": "America/Los_Angeles", "brand": "Epicurean Media"}
        checkpoint = {"step": "marketing", "run_id": 7}

        self.storage.save_config(config)
        self.storage.save_checkpoint(checkpoint)

        self.assertEqual(self.storage.load_config(), config)
        self.assertEqual(self.storage.load_checkpoint(), checkpoint)

        config_path = Path(os.environ["CONFIG_PATH"])
        checkpoint_path = Path(os.environ["CHECKPOINT_PATH"])
        self.assertFalse(config_path.exists())
        self.assertFalse(checkpoint_path.exists())

        self.storage.clear_checkpoint()
        self.assertIsNone(self.storage.load_checkpoint())

    def test_runs_and_history_use_database_url_store(self) -> None:
        run_id = self.storage.save_run(
            "Epicurean Test Run",
            "https://example.com/post",
            {
                "summary": "hello",
                "tags": ["media", "ops"],
                "reflection": {"repurposed_en": {"linkedin": "LinkedIn copy"}},
            },
            {
                "input_tokens": 111,
                "output_tokens": 222,
                "estimated_cost_usd": 0.45,
            },
        )

        history = self.storage.list_history_runs()
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["id"], run_id)
        self.assertEqual(history[0]["title"], "Epicurean Test Run")
        self.assertEqual(history[0]["tags"], ["media", "ops"])
        self.assertEqual(history[0]["status"], "done")

        marketing = self.storage.list_marketing_runs()
        self.assertEqual(len(marketing), 1)
        self.assertEqual(marketing[0]["id"], run_id)
        self.assertEqual(marketing[0]["asset_count"], 1)

        run = self.storage.get_history_run(run_id)
        self.assertIsNotNone(run)
        self.assertEqual(run["data"]["summary"], "hello")
        self.assertEqual(run["tokens_in"], 111)
        self.assertEqual(run["tokens_out"], 222)
        self.assertEqual(run["cost_usd"], 0.45)
        self.assertEqual(run["status"], "done")

        self.storage.delete_history_run(run_id)
        self.assertEqual(self.storage.list_history_runs(), [])

    def test_pending_run_is_visible_in_history(self) -> None:
        run_id = self.storage.create_pending_run("Live Run", "https://example.com/live")

        history = self.storage.list_history_runs()

        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["id"], run_id)
        self.assertEqual(history[0]["status"], "running")
        self.assertEqual(history[0]["cost_usd"], 0)

    def test_fail_all_running_runs_marks_orphaned_runs_as_error(self) -> None:
        run_id = self.storage.create_pending_run("Interrupted Run", "https://example.com/interrupted")

        changed = self.storage.fail_all_running_runs()
        run = self.storage.get_history_run(run_id)

        self.assertEqual(changed, 1)
        self.assertEqual(run["status"], "error")

    def test_cancel_run_marks_pending_run_as_cancelled(self) -> None:
        run_id = self.storage.create_pending_run("Cancelled Run", "https://example.com/cancelled")

        self.storage.cancel_run(run_id)
        run = self.storage.get_history_run(run_id)
        history = self.storage.list_history_runs()

        self.assertEqual(run["status"], "cancelled")
        self.assertEqual(history[0]["status"], "cancelled")

    def test_dashboard_uses_database_runs_and_image_costs(self) -> None:
        self.storage.save_run(
            "Dashboard Run",
            "https://example.com/post",
            {
                "social": {"linkedin": "Primary post"},
                "tags": ["marketing"],
            },
            {
                "input_tokens": 10,
                "output_tokens": 20,
                "estimated_cost_usd": 1.25,
            },
        )
        total = self.storage.record_image_cost("openai", 2, 0.33)
        self.assertEqual(total, 0.66)

        dashboard = self.storage.get_dashboard_data(
            [
                {
                    "url": "https://example.com/post",
                    "published": "2026-03-01T10:00:00",
                },
                {
                    "url": "https://example.com/next",
                    "published": "2026-03-02T10:00:00",
                },
            ]
        )

        self.assertEqual(dashboard["articles_total"], 2)
        self.assertEqual(dashboard["articles_covered"], 1)
        self.assertEqual(dashboard["articles_remaining"], 1)
        self.assertEqual(dashboard["total_runs"], 1)
        self.assertEqual(dashboard["total_cost_usd"], 1.25)
        self.assertEqual(dashboard["total_image_cost_usd"], 0.66)
        self.assertEqual(dashboard["image_cost_by_source"]["openai"]["count"], 2)
        self.assertIn("daily_spend", dashboard)
        daily = next(iter(dashboard["daily_spend"].values()))
        self.assertEqual(daily["run_cost_usd"], 1.25)
        self.assertEqual(daily["image_cost_usd"], 0.66)
        self.assertEqual(daily["total_cost_usd"], 1.91)

    def test_thumbnails_feedback_and_ideas_use_database_url_store(self) -> None:
        saved = self.storage.save_thumbnail(
            "Epicurean Title",
            "https://example.com/post",
            "Calm desk",
            "image-data-1",
        )
        duplicate = self.storage.save_thumbnail(
            "Epicurean Title",
            "https://example.com/post",
            "Calm desk",
            "image-data-1",
        )
        thumbs = self.storage.list_thumbnails(query="epicurean")
        thumb = self.storage.get_thumbnail(saved["id"])

        self.assertTrue(saved["created"])
        self.assertFalse(duplicate["created"])
        self.assertEqual(len(thumbs), 1)
        self.assertEqual(thumb["concept_name"], "Calm desk")

        self.storage.save_feedback("Run A", "linkedin", "reflection", "en", 0, 1, "Strong post")
        self.storage.save_feedback("Run A", "linkedin", "reflection", "en", 1, -1, "Weak post")
        summary = self.storage.get_feedback_summary()
        self.assertEqual(summary, [{"platform": "linkedin", "thumbs_up": 1, "thumbs_down": 1}])

        idea_id = self.storage.create_idea("Theme A", "Category", "X", "Angle", "manual")
        self.storage.update_idea_status(idea_id, "writing")
        batch = self.storage.save_ideas_batch(
            [
                {
                    "category": "Focus",
                    "emoji": "F",
                    "struggles": [
                        {"theme": "Theme A", "frequency": 2, "article_angle": "Angle 2"},
                        {"theme": "Theme B", "frequency": 1, "article_angle": "Angle 3"},
                    ],
                }
            ],
            source="reddit",
        )
        ideas = self.storage.list_ideas()
        self.assertEqual(batch, {"saved": 1, "updated": 1})
        self.assertEqual(len(ideas), 2)
        idea_a = next(item for item in ideas if item["theme"] == "Theme A")
        self.assertEqual(idea_a["status"], "writing")
        self.assertEqual(idea_a["frequency"], 3)

    def test_quotes_and_substack_data_use_database_url_store(self) -> None:
        run_id = self.storage.save_run("Quotes Run", "https://example.com/post", {"summary": "x"})
        quote_ids = self.storage.save_quotes(
            run_id,
            "Quotes Run",
            "https://example.com/post",
            [{"quote_text": "A useful quote", "context": "Context", "quote_type": "insight"}],
        )
        self.storage.update_quote(quote_ids[0], shared=True, signal="positive", linkedin="LinkedIn text")
        quote = self.storage.get_quote(quote_ids[0])
        self.assertEqual(self.storage.list_quote_runs()[0]["run_id"], run_id)
        self.assertEqual(self.storage.get_quotes_for_run(run_id)[0]["quote_text"], "A useful quote")
        self.assertEqual(quote["signal"], "positive")
        self.assertEqual(quote["linkedin_post"], "LinkedIn text")

        saved = self.storage.upsert_subscribers(
            [
                {
                    "user_id": 1,
                    "user_email_address": "reader@example.com",
                    "user_name": "Reader",
                    "subscription_interval": "monthly",
                    "is_subscribed": True,
                    "is_comp": False,
                    "activity_rating": 4,
                    "subscription_created_at": "2026-02-01T00:00:00",
                    "total_revenue_generated": 1000,
                    "subscription_country": "US",
                }
            ]
        )
        self.assertEqual(saved, 1)
        sub = self.storage.get_subscriber("reader@example.com")
        self.assertEqual(sub["activity_rating"], 4)
        audience = self.storage.get_audience_stats()
        self.assertEqual(audience["total"], 1)
        self.assertEqual(audience["paid"], 1)

        self.storage.save_subscriber_detail(
            "reader@example.com",
            {"crmData": {"subscription_country": "CA", "num_emails_received": 10, "num_emails_opened": 5}},
        )
        detail = self.storage.get_subscriber("reader@example.com")
        self.assertIn("crmData", detail["detail_json"])
        insights = self.storage.get_insights_data()
        self.assertEqual(insights["enriched_count"], 1)

        batch_id = self.storage.save_substack_batch(
            [{"issue": "Issue", "intent": "Intent", "note_text": "Note text"}]
        )
        notes = self.storage.get_substack_notes(batch_id)
        note_id = notes[0]["id"]
        self.storage.update_substack_note(note_id, shared=True, signal="positive", note_text="Updated note")
        self.storage.save_substack_repurpose(note_id, "LI", "TH", "IG")
        searched = self.storage.search_substack_notes(shared=True, repurposed=True, signal="positive")
        self.assertEqual(searched[0]["note_text"], "Updated note")
        batches = self.storage.list_substack_batches()
        self.assertEqual(batches[0]["note_count"], 1)


if __name__ == "__main__":
    unittest.main()
