"""
social_client.py — Unified social media publishing client.

Publishes directly to LinkedIn, Threads, Instagram, and Substack.
Instagram is supported only when a public image_url is provided.

Platforms:
  linkedin  — linkedin_client.py  (LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN)
  threads   — meta_client.py      (THREADS_USER_ID, THREADS_ACCESS_TOKEN)
  instagram — meta_client.py      (INSTAGRAM_USER_ID, META_ACCESS_TOKEN + public image_url)

Note: Native APIs do not support future-scheduled posting.
Posts go live immediately when publish_post() is called.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import linkedin_client
import meta_client
import threads_client
import substack_client


def is_configured(platform: str) -> bool:
    """Return True if the required env vars for a platform are set."""
    if platform == "linkedin":
        return bool(os.getenv("LINKEDIN_ACCESS_TOKEN") and os.getenv("LINKEDIN_PERSON_URN"))
    if platform == "threads":
        return threads_client.is_configured()
    if platform == "instagram":
        return meta_client.is_configured()
    if platform == "substack_note":
        return bool(os.getenv("SUBSTACK_SESSION_COOKIE"))
    return False


def get_status() -> Dict[str, Any]:
    """Return configuration status for each platform. Used by /api/social/status."""
    return {
        "linkedin": {
            "configured": is_configured("linkedin"),
            "note": "Publishes text posts immediately.",
        },
        "threads": {
            "configured": is_configured("threads"),
            "note": "Publishes text posts via browser session cookies.",
        },
        "instagram": {
            "configured": is_configured("instagram"),
            "note": "Publishes image posts via instagrapi (username + password).",
        },
        "substack_note": {
            "configured": is_configured("substack_note"),
            "note": "Posts Notes via unofficial Substack API (connect.sid cookie).",
        },
    }


def publish_post(platform: str, text: str, image_url: str = "") -> Dict[str, Any]:
    """Publish a post to the given platform immediately."""
    if platform == "linkedin":
        return linkedin_client.publish_post(text)
    if platform == "threads":
        return threads_client.publish_threads(text)
    if platform == "instagram":
        return meta_client.publish_instagram(text, image_url)
    if platform == "substack_note":
        return substack_client.post_note(text)
    raise ValueError("Unknown platform: {!r}. Valid: linkedin, threads, instagram, substack_note".format(platform))


def publish_all_repurposed(
    repurposed_en: Dict[str, Any],
    repurposed_es: Dict[str, Any],
    image_url: str = "",
) -> Dict[str, Any]:
    """
    Publish English and Spanish posts to LinkedIn and Threads immediately.
    Instagram is included if image_url is provided.

    Returns a dict of results keyed by platform_language.
    """
    results: Dict[str, Any] = {}
    platforms = ["linkedin", "threads"]
    if image_url:
        platforms.append("instagram")

    for platform in platforms:
        if not is_configured(platform):
            results[f"{platform}_en"] = {"skipped": True, "reason": f"{platform} not configured in .env"}
            results[f"{platform}_es"] = {"skipped": True, "reason": f"{platform} not configured in .env"}
            continue

        for lang, payload in [("en", repurposed_en), ("es", repurposed_es)]:
            text = payload.get(platform, "") if isinstance(payload, dict) else ""
            if not text:
                results[f"{platform}_{lang}"] = {"skipped": True, "reason": "No content"}
                continue
            try:
                kwargs = {"image_url": image_url} if platform == "instagram" else {}
                results[f"{platform}_{lang}"] = publish_post(platform, text, **kwargs)
            except Exception as e:
                results[f"{platform}_{lang}"] = {"error": str(e)}

    if "instagram" not in platforms:
        results["instagram_en"] = {"skipped": True, "reason": "No image_url — Instagram requires an image"}
        results["instagram_es"] = {"skipped": True, "reason": "No image_url — Instagram requires an image"}

    return results


def publish_repurposed_bundle(
    repurposed_en: Dict[str, Any],
    repurposed_es: Dict[str, Any],
    base_date: datetime,
    hour: int = 9,
    minute: int = 0,
) -> Dict[str, Any]:
    """
    Publishes immediately to configured platforms.
    base_date / hour / minute are accepted but not used —
    native APIs do not support future scheduling.
    """
    return publish_all_repurposed(repurposed_en, repurposed_es)


def get_next_weekday(weekday: int, hour: int, minute: int) -> datetime:
    """Returns the next occurrence of a given weekday (0=Mon) at a given time."""
    today = datetime.now()
    days_ahead = weekday - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    target = today + timedelta(days=days_ahead)
    return target.replace(hour=hour, minute=minute, second=0, microsecond=0)
