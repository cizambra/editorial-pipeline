"""
buffer_client.py — Buffer API client for scheduling social media posts.
Handles LinkedIn, Instagram, and Threads.
"""

from __future__ import annotations

import os
import requests
from datetime import datetime, timedelta
from typing import Any, Dict, List

BUFFER_API = "https://api.bufferapp.com/1"
ACCESS_TOKEN = os.getenv("BUFFER_ACCESS_TOKEN", "")

PROFILE_IDS = {
    "linkedin": os.getenv("BUFFER_LINKEDIN_PROFILE_ID", ""),
    "instagram": os.getenv("BUFFER_INSTAGRAM_PROFILE_ID", ""),
    "threads": os.getenv("BUFFER_THREADS_PROFILE_ID", ""),
}


def get_profiles() -> List[Dict[str, Any]]:
    """Fetch all connected Buffer profiles. Useful for initial setup."""
    resp = requests.get(
        f"{BUFFER_API}/profiles.json",
        params={"access_token": ACCESS_TOKEN},
    )
    resp.raise_for_status()
    return resp.json()


def schedule_post(platform: str, text: str, scheduled_at: datetime) -> Dict[str, Any]:
    """
    Schedule a post to a specific platform via Buffer.

    Args:
        platform: 'linkedin', 'instagram', or 'threads'
        text: The post content
        scheduled_at: When to publish (datetime object)

    Returns:
        Buffer API response dict
    """
    profile_id = PROFILE_IDS.get(platform)
    if not profile_id:
        raise ValueError(f"No Buffer profile ID configured for {platform}. Check your .env file.")

    payload = {
        "access_token": ACCESS_TOKEN,
        "profile_ids[]": profile_id,
        "text": text,
        "scheduled_at": scheduled_at.isoformat(),
    }

    resp = requests.post(f"{BUFFER_API}/updates/create.json", data=payload)
    resp.raise_for_status()
    return resp.json()


def schedule_all_repurposed(
    repurposed_en: Dict[str, Any],
    repurposed_es: Dict[str, Any],
    base_date: datetime,
    hour: int = 9,
    minute: int = 0,
) -> Dict[str, Any]:
    """
    Schedules English and Spanish posts for LinkedIn, Instagram, and Threads.
    English posts go on base_date, Spanish posts go the next day.

    Returns a dict of results keyed by platform_language.
    """
    results = {}
    platforms = ["linkedin", "instagram", "threads"]

    en_datetime = base_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
    es_datetime = en_datetime + timedelta(days=1)

    for platform in platforms:
        profile_id = PROFILE_IDS.get(platform, "")
        if not profile_id:
            results[f"{platform}_en"] = {"skipped": True, "reason": "No profile ID configured"}
            results[f"{platform}_es"] = {"skipped": True, "reason": "No profile ID configured"}
            continue

        # English post
        try:
            results[f"{platform}_en"] = schedule_post(
                platform, repurposed_en.get(platform, ""), en_datetime
            )
        except Exception as e:
            results[f"{platform}_en"] = {"error": str(e)}

        # Spanish post
        try:
            results[f"{platform}_es"] = schedule_post(
                platform, repurposed_es.get(platform, ""), es_datetime
            )
        except Exception as e:
            results[f"{platform}_es"] = {"error": str(e)}

    return results


def queue_post(platform: str, text: str) -> Dict[str, Any]:
    """
    Add a post to Buffer's queue (next available slot, no fixed schedule time).

    Args:
        platform: 'linkedin', 'instagram', or 'threads'
        text: The post content

    Returns:
        Buffer API response dict
    """
    profile_id = PROFILE_IDS.get(platform)
    if not profile_id:
        raise ValueError(f"No Buffer profile ID configured for {platform}. Check your .env file.")

    payload = {
        "access_token": ACCESS_TOKEN,
        "profile_ids[]": profile_id,
        "text": text,
        # Omitting scheduled_at puts the post in the next available slot
    }

    resp = requests.post(f"{BUFFER_API}/updates/create.json", data=payload)
    resp.raise_for_status()
    return resp.json()


def get_next_weekday(weekday: int, hour: int, minute: int) -> datetime:
    """
    Returns the next occurrence of a given weekday (0=Mon, 6=Sun) at a given time.
    """
    today = datetime.now()
    days_ahead = weekday - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    target = today + timedelta(days=days_ahead)
    return target.replace(hour=hour, minute=minute, second=0, microsecond=0)
