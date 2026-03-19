from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.logging import get_logger
from app.persistence import storage
from app.services import social_client, substack_client


_logger = get_logger("editorial.scheduler")


def publish_due_posts() -> None:
    due = storage.get_due_scheduled_posts()
    for post in due:
        try:
            result = social_client.publish_post(
                post["platform"], post["text"], post.get("image_url", "")
            )
            storage.update_scheduled_post_status(
                post["id"], "published", post_id_result=result.get("post_id", "")
            )
            if post["platform"] == "substack_note" and post.get("note_id"):
                storage.update_substack_note(post["note_id"], shared=True)
        except Exception as exc:
            _logger.exception(
                "Scheduled post publish failed",
                extra={"fields": {"scheduled_post_id": post["id"], "platform": post["platform"]}},
            )
            storage.update_scheduled_post_status(post["id"], "failed", error=str(exc))


def enrich_subscriber_profiles() -> None:
    try:
        sub = storage.get_next_subscriber_for_enrichment()
        if not sub:
            return
        detail = substack_client.get_subscriber_detail(sub["email"])
        if detail:
            storage.save_subscriber_detail(sub["email"], detail)
    except Exception:
        _logger.exception("Subscriber enrichment failed")


def create_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(publish_due_posts, "interval", minutes=1, id="publish_due_posts")
    scheduler.add_job(enrich_subscriber_profiles, "interval", minutes=2, id="enrich_subscribers")
    return scheduler
