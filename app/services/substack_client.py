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
from html.parser import HTMLParser
from typing import Any, Dict, List

from app.core.provider_clients import get_http_backend

_req, _IMPERSONATE = get_http_backend()

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


def _html_to_prosemirror(html: str) -> Dict[str, Any]:
    """Convert contenteditable HTML to a ProseMirror JSON document."""

    class _Parser(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.doc: List[Dict[str, Any]] = []
            self._marks: List[Dict[str, Any]] = []
            self._para: List[Dict[str, Any]] = []
            self._in_list = False
            self._list_items: List[Dict[str, Any]] = []
            self._li_para: List[Dict[str, Any]] = []

        def _flush_para(self) -> None:
            if self._para:
                self.doc.append({"type": "paragraph", "content": list(self._para)})
                self._para = []

        def _flush_li(self) -> None:
            if self._li_para:
                self._list_items.append({
                    "type": "listItem",
                    "content": [{"type": "paragraph", "content": list(self._li_para)}],
                })
                self._li_para = []

        def _flush_list(self) -> None:
            self._flush_li()
            if self._list_items:
                self.doc.append({"type": "bulletList", "content": list(self._list_items)})
                self._list_items = []

        def _target(self) -> List[Dict[str, Any]]:
            return self._li_para if self._in_list else self._para

        def handle_starttag(self, tag: str, attrs: list) -> None:
            attrs_d = dict(attrs)
            if tag in ("p", "div"):
                if self._in_list:
                    self._flush_li()
                else:
                    self._flush_para()
            elif tag in ("strong", "b"):
                self._marks.append({"type": "bold"})
            elif tag in ("em", "i"):
                self._marks.append({"type": "italic"})
            elif tag == "a":
                href = attrs_d.get("href", "")
                self._marks.append({"type": "link", "attrs": {
                    "href": href, "target": "_blank",
                    "rel": "noopener noreferrer nofollow",
                }})
            elif tag == "ul":
                self._flush_para()
                self._in_list = True
            elif tag == "li":
                self._flush_li()
            elif tag == "br":
                self._target().append({"type": "hard_break"})

        def handle_endtag(self, tag: str) -> None:
            if tag in ("strong", "b", "em", "i", "a"):
                if self._marks:
                    self._marks.pop()
            elif tag == "ul":
                self._flush_list()
                self._in_list = False
            elif tag in ("p", "div"):
                if self._in_list:
                    self._flush_li()
                else:
                    self._flush_para()

        def handle_data(self, data: str) -> None:
            if not data:
                return
            node: Dict[str, Any] = {"type": "text", "text": data}
            if self._marks:
                node["marks"] = list(self._marks)
            self._target().append(node)

        def result(self) -> Dict[str, Any]:
            if self._in_list:
                self._flush_list()
            else:
                self._flush_para()
            content = self.doc or [{"type": "paragraph"}]
            return {"type": "doc", "attrs": {"schemaVersion": "v1"}, "content": content}

    p = _Parser()
    p.feed(html)
    return p.result()


def _pub_url() -> str:
    url = os.getenv("SUBSTACK_PUBLICATION_URL", "").strip().rstrip("/")
    if not url:
        raise ValueError("SUBSTACK_PUBLICATION_URL is not set in .env")
    return url


def _pub_headers() -> Dict[str, str]:
    """Headers for requests to the publication's own domain (uses connect.sid, not substack.sid)."""
    pub_url = _pub_url()
    # Publication domain uses connect.sid — grab from SUBSTACK_PUB_COOKIE
    pub_cookie = os.getenv("SUBSTACK_PUB_COOKIE", "").strip()
    if not pub_cookie:
        raise ValueError(
            "SUBSTACK_PUB_COOKIE is not set in .env — "
            "open Chrome DevTools on your publication, Application → Cookies → "
            "www.self-disciplined.com, copy the connect.sid value"
        )
    cookie = "connect.sid=" + pub_cookie
    cf = os.getenv("SUBSTACK_CF_CLEARANCE", "").strip()
    if cf:
        cookie += "; cf_clearance=" + cf
    return {
        "Content-Type": "application/json",
        "Cookie": cookie,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": pub_url + "/publish/subscribers",
        "Origin": pub_url,
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
    }


def get_subscriber_page(offset: int = 0, limit: int = 100) -> Dict[str, Any]:
    """Fetch one page of subscriber stats from the publication dashboard API."""
    endpoint = _pub_url() + "/api/v1/subscriber-stats"
    payload = {
        "filters": {"order_by_desc_nulls_last": "subscription_created_at"},
        "limit": limit,
        "offset": offset,
    }
    resp = _post(endpoint, headers=_pub_headers(), json=payload, timeout=30)
    if not resp.ok:
        raise RuntimeError(f"Substack subscriber-stats {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def get_subscriber_detail(email: str) -> Dict[str, Any]:
    """Fetch individual subscriber detail record (includes country, activity metrics)."""
    import urllib.parse
    endpoint = _pub_url() + "/api/v1/subscriber/" + urllib.parse.quote(email, safe="")
    resp = _get(endpoint, headers=_pub_headers(), timeout=15)
    if resp.status_code in (200, 304):
        try:
            return resp.json()
        except Exception:
            pass
    return {}


def fetch_all_subscribers() -> Dict[str, Any]:
    """
    Paginate through the full subscriber list and return aggregated audience data.
    Tries subscription_country from the bulk response first; for subscribers
    without it, falls back to individual detail calls (rate-limited to avoid hammering).
    """
    import datetime

    all_subs: List[Dict[str, Any]] = []
    offset, limit = 0, 100
    chart_counts = None
    total = None

    while True:
        page = get_subscriber_page(offset=offset, limit=limit)
        if chart_counts is None:
            chart_counts = page.get("chartCounts", {})
        if total is None:
            total = page.get("count", 0)
        batch = page.get("subscribers", [])
        all_subs.extend(batch)
        offset += limit
        if not batch or offset >= (total or 0):
            break

    # Aggregate
    activity_dist: Dict[int, int] = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    country_counts: Dict[str, int] = {}
    monthly_growth: Dict[str, int] = {}

    for s in all_subs:
        rating = int(s.get("activity_rating") or 0)
        activity_dist[rating] = activity_dist.get(rating, 0) + 1

        country = (s.get("subscription_country") or "").strip()
        if country:
            country_counts[country] = country_counts.get(country, 0) + 1

        created = (s.get("subscription_created_at") or "")[:7]
        if created:
            monthly_growth[created] = monthly_growth.get(created, 0) + 1

    cc = chart_counts or {}
    return {
        "total": total or len(all_subs),
        "paid": cc.get("subscribers", 0),
        "comp": cc.get("comp_subscribers", 0),
        "free_trial": cc.get("free_trial_subscribers", 0),
        "founding": cc.get("founding_subscribers", 0),
        "activity_distribution": activity_dist,
        "top_countries": sorted(country_counts.items(), key=lambda x: -x[1])[:15],
        "country_coverage": len([s for s in all_subs if s.get("subscription_country")]),
        "monthly_growth": dict(sorted(monthly_growth.items())[-12:]),
        "synced_at": datetime.datetime.utcnow().isoformat() + "Z",
    }


def post_note(text: str) -> Dict[str, Any]:
    """
    Post a Note to Substack immediately.

    Returns the API response dict (contains 'id', 'body', etc.).
    Raises RuntimeError on API failure.
    """
    is_html = text.lstrip().startswith("<")
    body_json = _html_to_prosemirror(text) if is_html else _text_to_prosemirror(text)
    payload = {
        "bodyJson": body_json,
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
