"""
linkedin_client.py — LinkedIn REST API client.

Publishes text posts immediately to LinkedIn.
Native LinkedIn API does not support future scheduling — posts go live on call.

Setup:
  1. Create an app at https://www.linkedin.com/developers/apps
  2. Add scopes: openid, profile, w_member_social
  3. Generate an access token via the OAuth 2.0 token generator in the Developer Portal
     (Tools → OAuth Token Generator → Auth Code tab → select scopes → Get Token)
  4. Set in .env:
       LINKEDIN_ACCESS_TOKEN=...
       LINKEDIN_PERSON_URN=urn:li:person:XXXXXXXX   (run setup_social.py to get this)
"""

from __future__ import annotations

import os
import requests
from typing import Any, Dict

LINKEDIN_API = "https://api.linkedin.com/rest"
ACCESS_TOKEN = os.getenv("LINKEDIN_ACCESS_TOKEN", "")
PERSON_URN = os.getenv("LINKEDIN_PERSON_URN", "")  # e.g. urn:li:person:abc123


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "LinkedIn-Version": "202501",
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
    }


def get_profile() -> Dict[str, Any]:
    """Fetch the authenticated member's profile. Used to get the person URN."""
    if not ACCESS_TOKEN:
        raise ValueError("LINKEDIN_ACCESS_TOKEN not set in .env")
    resp = requests.get(
        "https://api.linkedin.com/v2/me",
        headers={"Authorization": f"Bearer {ACCESS_TOKEN}"},
    )
    resp.raise_for_status()
    data = resp.json()
    urn = f"urn:li:person:{data.get('id', '')}"
    return {"id": data.get("id", ""), "urn": urn, "raw": data}


def publish_post(text: str) -> Dict[str, Any]:
    """Publish a text post to LinkedIn immediately."""
    if not ACCESS_TOKEN:
        raise ValueError("LINKEDIN_ACCESS_TOKEN not set in .env")
    if not PERSON_URN:
        raise ValueError("LINKEDIN_PERSON_URN not set in .env — run setup_social.py to get it")

    resp = requests.post(
        f"{LINKEDIN_API}/posts",
        headers=_headers(),
        json={
            "author": PERSON_URN,
            "commentary": text,
            "visibility": "PUBLIC",
            "distribution": {
                "feedDistribution": "MAIN_FEED",
                "targetEntities": [],
                "thirdPartyDistributionChannels": [],
            },
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False,
        },
    )
    resp.raise_for_status()
    # LinkedIn 201 returns no body — post ID is in the X-RestLi-Id header
    post_id = resp.headers.get("X-RestLi-Id", "")
    return {"platform": "linkedin", "post_id": post_id, "published": True}
