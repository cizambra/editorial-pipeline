"""
substack_client.py — Unofficial Substack Notes API client.

Substack has no official Notes API. This module uses the internal REST
endpoints the Substack web editor uses, authenticated via a session cookie.

Cloudflare protection requires curl_cffi to impersonate Chrome's TLS
fingerprint. Without it, all requests will be rejected with 403.

How to get your cookies:
  1. Open substack.com in Chrome and log in
  2. DevTools → Application → Cookies → .substack.com
  3. Copy "substack.sid"   → SUBSTACK_SESSION_COOKIE in .env
  4. Copy "cf_clearance"   → SUBSTACK_CF_CLEARANCE in .env

Notes endpoint: POST https://substack.com/api/v1/comment/feed
Body: { "body": <ProseMirror JSON>, "type": "feed", "publication_id": null }
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List

try:
    from curl_cffi import requests as _req
    _IMPERSONATE = "chrome120"
except ImportError:
    import requests as _req  # type: ignore
    _IMPERSONATE = None


_INLINE_RE = re.compile(
    r"\*\*(.+?)\*\*"           # **bold**
    r"|\*(.+?)\*"               # *italic*
    r"|\[(.+?)\]\((.+?)\)"      # [text](url)
)


def _inline_to_prosemirror(text: str) -> List[Dict[str, Any]]:
    """Parse inline markdown into ProseMirror inline nodes."""
    nodes: List[Dict[str, Any]] = []
    last = 0
    for m in _INLINE_RE.finditer(text):
        if m.start() > last:
            nodes.append({"type": "text", "text": text[last:m.start()]})
        if m.group(1) is not None:  # **bold**
            nodes.append({"type": "text", "text": m.group(1), "marks": [{"type": "bold"}]})
        elif m.group(2) is not None:  # *italic*
            nodes.append({"type": "text", "text": m.group(2), "marks": [{"type": "italic"}]})
        else:  # [text](url)
            nodes.append({
                "type": "text",
                "text": m.group(3),
                "marks": [{"type": "link", "attrs": {"href": m.group(4), "target": "_blank", "rel": "noopener noreferrer nofollow"}}],
            })
        last = m.end()
    if last < len(text):
        nodes.append({"type": "text", "text": text[last:]})
    return nodes or [{"type": "text", "text": text}]


def _get_cookie() -> str:
    """Return the Substack substack.sid session cookie value."""
    cookie = os.getenv("SUBSTACK_SESSION_COOKIE", "").strip()
    if not cookie:
        raise ValueError("SUBSTACK_SESSION_COOKIE is not set in .env")
    return cookie


def _headers() -> Dict[str, str]:
    cookie = "substack.sid=" + _get_cookie()
    lli = os.getenv("SUBSTACK_LLI", "").strip()
    if lli:
        cookie += "; substack.lli=" + lli
    cf = os.getenv("SUBSTACK_CF_CLEARANCE", "").strip()
    if cf:
        cookie += "; cf_clearance=" + cf
    return {
        "Content-Type": "application/json",
        "Cookie": cookie,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://substack.com",
        "Origin": "https://substack.com",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
    }


def _get(url: str, **kwargs) -> Any:
    if _IMPERSONATE:
        return _req.get(url, impersonate=_IMPERSONATE, **kwargs)
    return _req.get(url, **kwargs)


def _post(url: str, **kwargs) -> Any:
    if _IMPERSONATE:
        return _req.post(url, impersonate=_IMPERSONATE, **kwargs)
    return _req.post(url, **kwargs)


def _text_to_prosemirror(text: str) -> Dict[str, Any]:
    """
    Convert markdown text to a ProseMirror JSON document.
    Double newlines become paragraph breaks; single newlines become hard breaks.
    Supports **bold**, *italic*, and [links](url).
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    content: List[Dict[str, Any]] = []

    for para in paragraphs:
        lines = para.split("\n")
        para_content: List[Dict[str, Any]] = []
        for i, line in enumerate(lines):
            if line:
                para_content.extend(_inline_to_prosemirror(line))
            if i < len(lines) - 1:
                para_content.append({"type": "hard_break"})
        if para_content:
            content.append({"type": "paragraph", "content": para_content})

    if not content:
        content = [{"type": "paragraph"}]

    return {"type": "doc", "attrs": {"schemaVersion": "v1"}, "content": content}


def post_note(text: str) -> Dict[str, Any]:
    """
    Post a Note to Substack immediately.

    Returns the API response dict (contains 'id', 'body', etc.).
    Raises RuntimeError on API failure.
    """
    payload = {
        "bodyJson": _text_to_prosemirror(text),
        "surface": "profile",
        "replyMinimumRole": "everyone",
    }
    resp = _post(
        "https://substack.com/api/v1/comment/feed",
        headers=_headers(),
        json=payload,
        timeout=20,
    )
    if not resp.ok:
        raise RuntimeError(
            "Substack Notes API {} — {}".format(resp.status_code, resp.text[:500])
        )
    return resp.json()


def test_connection() -> Dict[str, Any]:
    """
    Verify Substack credentials by checking cookies are present and the
    substack.lli JWT is not expired. Avoids undocumented endpoint guessing.
    Returns {"ok": True, "handle": "user #<id> (expires <date>)"} on success.
    Raises RuntimeError if a credential is missing or the JWT has expired.
    """
    import base64
    import json as _json
    import time

    _get_cookie()  # raises ValueError if SUBSTACK_SESSION_COOKIE not set

    lli = os.getenv("SUBSTACK_LLI", "").strip()
    if not lli:
        raise RuntimeError(
            "SUBSTACK_LLI is not set in .env — copy the substack.lli cookie from DevTools"
        )

    try:
        parts = lli.split(".")
        if len(parts) < 2:
            raise ValueError("not a valid JWT")
        payload_b64 = parts[1]
        # Restore base64 padding
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = _json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception as exc:
        raise RuntimeError("Could not parse substack.lli JWT: {}".format(exc))

    exp = payload.get("exp", 0)
    if exp and exp < time.time():
        from datetime import datetime as _dt
        expired_at = _dt.utcfromtimestamp(exp).strftime("%Y-%m-%d")
        raise RuntimeError(
            "substack.lli expired on {} — grab a fresh cookie from Chrome DevTools".format(expired_at)
        )

    user_id = payload.get("userId", "unknown")
    exp_date = ""
    if exp:
        from datetime import datetime as _dt
        exp_date = ", expires {}".format(_dt.utcfromtimestamp(exp).strftime("%Y-%m-%d"))
    return {"ok": True, "handle": "user #{}{} — credentials look good".format(user_id, exp_date)}
