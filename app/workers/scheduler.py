from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.logging import get_logger
from app.persistence import storage
from app.services import social_client, substack_client


_logger = get_logger("editorial.scheduler")


def publish_due_posts() -> None:
    due = storage.get_due_scheduled_posts()
    if due:
        _logger.info(
            "Scheduler picked up due scheduled posts",
            extra={"fields": {"due_count": len(due), "post_ids": [post["id"] for post in due]}},
        )
    for post in due:
        try:
            _logger.info(
                "Publishing scheduled post",
                extra={
                    "fields": {
                        "scheduled_post_id": post["id"],
                        "platform": post["platform"],
                        "note_id": post.get("note_id"),
                        "scheduled_at": str(post.get("scheduled_at", "")),
                        "source_label": post.get("source_label", ""),
                        "text_length": len(post.get("text", "") or ""),
                    }
                },
            )
            result = social_client.publish_post(
                post["platform"], post["text"], post.get("image_url", "")
            )
            storage.update_scheduled_post_status(
                post["id"], "published", post_id_result=result.get("post_id", "")
            )
            _logger.info(
                "Scheduled post published",
                extra={
                    "fields": {
                        "scheduled_post_id": post["id"],
                        "platform": post["platform"],
                        "note_id": post.get("note_id"),
                        "result_post_id": result.get("post_id", ""),
                        "source_label": post.get("source_label", ""),
                    }
                },
            )
            if post["platform"] == "substack_note" and post.get("note_id"):
                storage.update_substack_note(post["note_id"], shared=True)
                _logger.info(
                    "Marked substack note as shared after scheduled publish",
                    extra={"fields": {"scheduled_post_id": post["id"], "note_id": post["note_id"]}},
                )
        except Exception as exc:
            _logger.exception(
                "Scheduled post publish failed",
                extra={
                    "fields": {
                        "scheduled_post_id": post["id"],
                        "platform": post["platform"],
                        "note_id": post.get("note_id"),
                        "scheduled_at": str(post.get("scheduled_at", "")),
                        "source_label": post.get("source_label", ""),
                    }
                },
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
