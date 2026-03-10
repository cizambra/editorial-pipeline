"""
threads_client.py — Threads text posts via the Instagram private REST API.

Endpoint: POST https://www.threads.com/api/v1/media/configure_text_only_post/
Auth: session cookies — no developer account needed.

How to get your cookies:
  1. Open https://www.threads.com in Chrome and log in
  2. DevTools (F12) → Application → Cookies → https://www.threads.com
  3. Copy these values into .env:
       sessionid  → THREADS_SESSION_ID   (URL-encoded, e.g. 123%3Aabc...)
       csrftoken  → THREADS_CSRF_TOKEN
       ds_user_id → THREADS_DS_USER_ID   (optional — derived from sessionid)
       ig_did     → THREADS_IG_DID       (recommended)
       mid        → THREADS_MID          (recommended)

Notes:
  - sessionid typically lasts 90 days.
  - X-Bloks-Version-ID may rotate with app updates. Update _BLOKS_VERSION_ID
    if posts start failing. Find it in any POST request to threads.com/api/v1/.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any, Dict

from app.core.provider_clients import get_http_backend

_req, _IMPERSONATE = get_http_backend()

_API_URL = "https://www.threads.com/api/v1/media/configure_text_only_post/"
_APP_ID = "238260118697367"
# Captured from Chrome DevTools — update if posts start failing with 400/401
_BLOKS_VERSION_ID = "1363ee4ad31aa321b811ce30b2aacd0f644c2fb57f440040b43e585a4befa092"


def _cookies() -> str:
    session_id = os.getenv("THREADS_SESSION_ID", "").strip()
    csrf = os.getenv("THREADS_CSRF_TOKEN", "").strip()
    if not session_id:
        raise RuntimeError("THREADS_SESSION_ID is not set in .env")
    if not csrf:
        raise RuntimeError("THREADS_CSRF_TOKEN is not set in .env")

    # sessionid is sent as-is (URL-encoded) — that's exactly how Chrome sends it.
    ds_user_id = (
        os.getenv("THREADS_DS_USER_ID", "").strip()
        or session_id.split("%3A")[0].split(":")[0]
    )

    parts = [
        f"sessionid={session_id}",
        f"csrftoken={csrf}",
        f"ds_user_id={ds_user_id}",
    ]
    ig_did = os.getenv("THREADS_IG_DID", "").strip()
    mid = os.getenv("THREADS_MID", "").strip()
    if ig_did:
        parts.append(f"ig_did={ig_did}")
    if mid:
        parts.append(f"mid={mid}")

    return "; ".join(parts)


def _jazoest(value: str) -> str:
    """Meta's checksum: '2' + sum of ASCII values of csrftoken characters."""
    return "2" + str(sum(ord(c) for c in value))


def _headers() -> Dict[str, str]:
    csrf = os.getenv("THREADS_CSRF_TOKEN", "").strip()
    return {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Cookie": _cookies(),
        "X-CSRFToken": csrf,
        "X-IG-App-ID": _APP_ID,
        "X-Instagram-AJAX": "0",
        "X-Bloks-Version-ID": _BLOKS_VERSION_ID,
        "X-ASBD-ID": "359341",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://www.threads.com",
        "Referer": "https://www.threads.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    }


def publish_threads(text: str) -> Dict[str, Any]:
    """Publish a text-only post to Threads. Raises RuntimeError on failure."""
    csrf = os.getenv("THREADS_CSRF_TOKEN", "").strip()
    upload_id = str(int(time.time() * 1000))

    text_post_app_info = {
        "community_flair_id": None,
        "entry_point": "top_of_feed",
        "excluded_inline_media_ids": "[]",
        "fediverse_composer_enabled": True,
        "is_reply_approval_enabled": False,
        "is_spoiler_media": False,
        "link_attachment_url": None,
        "reply_control": 0,
        "self_thread_context_id": str(uuid.uuid4()),
        "snippet_attachment": None,
        "special_effects_enabled_str": None,
        "tag_header": None,
        "text_with_entities": {"entities": [], "text": text},
    }

    data = {
        "audience": "default",
        "barcelona_source_reply_id": "",
        "caption": text,
        "creator_geo_gating_info": json.dumps({"whitelist_country_codes": []}),
        "cross_share_info": "",
        "custom_accessibility_caption": "",
        "gen_ai_detection_method": "",
        "internal_features": "",
        "is_meta_only_post": "",
        "is_paid_partnership": "",
        "is_upload_type_override_allowed": "1",
        "jazoest": _jazoest(csrf),
        "publish_mode": "text_post",
        "should_include_permalink": "true",
        "text_post_app_info": json.dumps(text_post_app_info),
        "upload_id": upload_id,
        "web_session_id": _random_session_id(),
    }

    kw: Dict[str, Any] = {"impersonate": _IMPERSONATE} if _IMPERSONATE else {}
    resp = _req.post(_API_URL, headers=_headers(), data=data, timeout=30, **kw)

    if not resp.ok:
        raise RuntimeError(f"Threads API {resp.status_code} — {resp.text[:500]}")

    try:
        result = resp.json()
    except Exception:
        raise RuntimeError(f"Threads returned non-JSON: {resp.text[:400]}")

    if result.get("status") != "ok":
        raise RuntimeError(f"Threads post failed: {json.dumps(result)[:400]}")

    media = result.get("media", {})
    return {
        "platform": "threads",
        "post_id": str(media.get("pk") or media.get("id") or ""),
        "permalink": media.get("permalink", ""),
        "published": True,
    }


def _random_session_id() -> str:
    """Generate a random web_session_id in Meta's format (3 x 6-char segments)."""
    import random, string
    chars = string.ascii_lowercase + string.digits
    return ":".join("".join(random.choices(chars, k=6)) for _ in range(3))


def test_connection() -> Dict[str, Any]:
    session_id = os.getenv("THREADS_SESSION_ID", "").strip()
    csrf = os.getenv("THREADS_CSRF_TOKEN", "").strip()
    if not session_id:
        raise RuntimeError("THREADS_SESSION_ID is not set in .env")
    if not csrf:
        raise RuntimeError("THREADS_CSRF_TOKEN is not set in .env")
    return {"ok": True, "note": "Credentials present — post a test to verify"}


def is_configured() -> bool:
    return bool(
        os.getenv("THREADS_SESSION_ID", "").strip()
        and os.getenv("THREADS_CSRF_TOKEN", "").strip()
    )
