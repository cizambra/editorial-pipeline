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

from typing import Any, Dict

import requests

from app.core.provider_clients import get_linkedin_credentials

LINKEDIN_API = "https://api.linkedin.com/rest"


def _headers() -> Dict[str, str]:
    creds = get_linkedin_credentials()
    return {
        "Authorization": f"Bearer {creds['access_token']}",
        "LinkedIn-Version": "202501",
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
    }


def get_profile() -> Dict[str, Any]:
    """Fetch the authenticated member's profile. Used to get the person URN."""
    access_token = get_linkedin_credentials()["access_token"]
    if not access_token:
        raise ValueError("LINKEDIN_ACCESS_TOKEN not set in .env")
    resp = requests.get(
        "https://api.linkedin.com/v2/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    resp.raise_for_status()
    data = resp.json()
    urn = f"urn:li:person:{data.get('id', '')}"
    return {"id": data.get("id", ""), "urn": urn, "raw": data}


def publish_post(text: str) -> Dict[str, Any]:
    """Publish a text post to LinkedIn immediately."""
    creds = get_linkedin_credentials()
    if not creds["access_token"]:
        raise ValueError("LINKEDIN_ACCESS_TOKEN not set in .env")
    if not creds["person_urn"]:
        raise ValueError("LINKEDIN_PERSON_URN not set in .env — run setup_social.py to get it")

    resp = requests.post(
        f"{LINKEDIN_API}/posts",
        headers=_headers(),
        json={
            "author": creds["person_urn"],
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
    post_id = resp.headers.get("X-RestLi-Id", "")
    return {"platform": "linkedin", "post_id": post_id, "published": True}
