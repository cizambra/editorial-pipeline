"""
scraper.py — Fetches and indexes articles from your Substack newsletter.

Uses the Substack public API (/api/v1/posts) to fetch ALL posts with pagination,
falling back to RSS if the API is unavailable. Articles are cached locally.
"""

from __future__ import annotations

import feedparser
import json
import os
import re
import requests
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

CACHE_FILE = Path(__file__).parent / "articles_cache.json"
_MEM_CACHE: Dict[str, Any] = {
    "mtime": None,
    "articles": None,
}

# Substack base URL (custom domain or .substack.com)
SUBSTACK_BASE = os.getenv("SUBSTACK_BASE_URL", "https://www.self-disciplined.com")
RSS_URL       = os.getenv("NEWSLETTER_RSS_URL", f"{SUBSTACK_BASE}/feed")

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    ),
    "Accept": "application/json, text/html,application/xhtml+xml",
}


# ── Public cache read ─────────────────────────────────────────────────────────

def fetch_articles(force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Returns the full cached article index.
    Rebuilds from the Substack API on first call or when force_refresh=True.
    """
    if not force_refresh and CACHE_FILE.exists():
        mtime = CACHE_FILE.stat().st_mtime
        if _MEM_CACHE["articles"] is not None and _MEM_CACHE["mtime"] == mtime:
            return list(_MEM_CACHE["articles"])
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            cache = json.load(f)
        _MEM_CACHE["mtime"] = mtime
        _MEM_CACHE["articles"] = cache["articles"]
        print(f"[scraper] Using cached index ({len(cache['articles'])} articles, "
              f"last updated {cache['updated_at']})")
        return cache["articles"]
    return refresh_index()


# ── Full re-index ─────────────────────────────────────────────────────────────

def refresh_index() -> List[Dict[str, Any]]:
    """
    Fetches EVERY post from the Substack API (paginated) and rebuilds the cache.
    Falls back to RSS if the API is unreachable.
    """
    articles = _fetch_all_via_api()
    if not articles:
        print("[scraper] API returned nothing — falling back to RSS.")
        articles = _fetch_via_rss()

    cache = {
        "updated_at": datetime.now().isoformat(),
        "articles": articles,
    }
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
    _MEM_CACHE["mtime"] = CACHE_FILE.stat().st_mtime
    _MEM_CACHE["articles"] = articles
    print(f"[scraper] Indexed {len(articles)} articles.")
    return articles


# ── Incremental index (add new posts only) ────────────────────────────────────

def index_new_articles() -> Dict[str, Any]:
    """
    Fetches only the newest posts from the API and merges them into the cache.
    Returns {'added': int, 'total': int, 'articles': list}.
    """
    existing = []
    if CACHE_FILE.exists():
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            existing = json.load(f).get("articles", [])

    existing_urls = {a["url"] for a in existing}

    # Fetch first page(s) of the API until we hit known articles
    new_articles = []
    offset = 0
    limit  = 25
    while True:
        batch = _fetch_api_page(offset, limit)
        if not batch:
            break
        fresh = [a for a in batch if a["url"] not in existing_urls]
        new_articles.extend(fresh)
        if len(fresh) < len(batch):
            # Hit overlap — no need to paginate further
            break
        offset += limit

    merged = new_articles + existing  # newest first
    cache = {
        "updated_at": datetime.now().isoformat(),
        "articles": merged,
    }
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
    _MEM_CACHE["mtime"] = CACHE_FILE.stat().st_mtime
    _MEM_CACHE["articles"] = merged

    print(f"[scraper] Indexed {len(new_articles)} new articles ({len(merged)} total).")
    return {"added": len(new_articles), "total": len(merged), "articles": merged}


# ── Substack API helpers ──────────────────────────────────────────────────────

def _fetch_all_via_api() -> List[Dict[str, Any]]:
    """Paginate through /api/v1/posts until exhausted."""
    articles = []
    offset   = 0
    limit    = 50
    while True:
        batch = _fetch_api_page(offset, limit)
        if not batch:
            break
        articles.extend(batch)
        if len(batch) < limit:
            break          # last page
        offset += limit
    return articles


def _fetch_api_page(offset: int, limit: int) -> List[Dict[str, Any]]:
    """Fetch one page from the Substack API; returns [] on failure."""
    url = f"{SUBSTACK_BASE.rstrip('/')}/api/v1/posts"
    params = {"limit": limit, "offset": offset}
    try:
        resp = requests.get(url, headers=_HEADERS, params=params, timeout=15)
        resp.raise_for_status()
        posts = resp.json()
    except Exception as e:
        print(f"[scraper] API page fetch failed (offset={offset}): {e}")
        return []

    articles = []
    for post in posts:
        # Skip non-published posts (drafts, scheduled)
        if post.get("audience") == "only_paid":
            is_paid = True
        else:
            is_paid = False

        canonical = post.get("canonical_url") or post.get("slug") or ""
        if canonical and not canonical.startswith("http"):
            canonical = f"{SUBSTACK_BASE.rstrip('/')}/p/{canonical}"

        subtitle = post.get("subtitle") or ""
        description = post.get("description") or subtitle

        articles.append({
            "title":     post.get("title", ""),
            "url":       canonical,
            "summary":   _strip_html(description)[:400],
            "published": post.get("post_date") or post.get("publishedBylines", [{}])[0].get("") or "",
            "is_paid":   is_paid,
            "slug":      post.get("slug", ""),
        })
    return articles


def _fetch_via_rss() -> List[Dict[str, Any]]:
    """Fallback: parse the RSS feed (limited to ~20 posts)."""
    print(f"[scraper] Fetching RSS from {RSS_URL}…")
    feed = feedparser.parse(RSS_URL)
    articles = []
    for entry in feed.entries:
        summary = _strip_html(entry.get("summary", ""))[:400]
        articles.append({
            "title":     entry.get("title", ""),
            "url":       entry.get("link", ""),
            "summary":   summary,
            "published": entry.get("published", ""),
            "is_paid":   False,
            "slug":      "",
        })
    return articles


# ── Article content fetcher ───────────────────────────────────────────────────

def fetch_article_content(url: str) -> Dict[str, Any]:
    """
    Fetches the full text of a public Substack article by URL.
    Returns dict with 'title' and 'markdown'.
    Raises ValueError if paywalled or content cannot be extracted.
    """
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise ValueError(f"Could not fetch article: {e}")

    html = resp.text

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")

        title_el = (
            soup.find("h1", class_=re.compile(r"post-title"))
            or soup.find("h1")
        )
        title = title_el.get_text(strip=True) if title_el else ""

        body_el = (
            soup.find("div", class_=re.compile(r"body\s+markup"))
            or soup.find("div", class_=re.compile(r"available-content"))
            or soup.find("div", class_=re.compile(r"post-content"))
            or soup.find("article")
        )

        if not body_el:
            raise ValueError("Could not locate article body — article may be paywalled.")

        if soup.find(class_=re.compile(r"paywall|subscription-required|locked")):
            text_len = len(body_el.get_text(strip=True))
            if text_len < 500:
                raise ValueError(
                    "Article appears to be behind a paywall. "
                    "Please upload the .md file from your Substack dashboard."
                )

        lines = []
        if title:
            lines.append(f"# {title}\n")

        for el in body_el.find_all(
            ["h1", "h2", "h3", "h4", "p", "blockquote", "li", "hr"],
            recursive=True,
        ):
            tag  = el.name
            text = el.get_text(separator=" ", strip=True)
            if not text:
                continue
            if tag == "h1":
                lines.append(f"## {text}")
            elif tag in ("h2", "h3"):
                lines.append(f"### {text}")
            elif tag == "h4":
                lines.append(f"#### {text}")
            elif tag == "blockquote":
                lines.append(f"> {text}")
            elif tag == "li":
                lines.append(f"- {text}")
            elif tag == "hr":
                lines.append("---")
            else:
                lines.append(text)
            lines.append("")

        markdown = "\n".join(lines).strip()
        if len(markdown) < 300:
            raise ValueError(
                "Extracted content is too short — article may be paywalled. "
                "Please upload the .md file from your Substack dashboard."
            )
        return {"title": title, "markdown": markdown}

    except ImportError:
        title_m = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.S)
        title   = _strip_html(title_m.group(1)) if title_m else ""
        paras   = re.findall(r'<p[^>]*>(.*?)</p>', html, re.S)
        content = "\n\n".join(_strip_html(p) for p in paras if len(_strip_html(p)) > 40)
        if not content:
            raise ValueError("Could not extract article content.")
        markdown = f"# {title}\n\n{content}" if title else content
        return {"title": title, "markdown": markdown}


# ── HTML util ─────────────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    """Remove HTML tags from a string."""
    from html.parser import HTMLParser

    class MLStripper(HTMLParser):
        def __init__(self):
            super().__init__()
            self.reset()
            self.fed = []

        def handle_data(self, d):
            self.fed.append(d)

        def get_data(self):
            return " ".join(self.fed)

    s = MLStripper()
    s.feed(text)
    return s.get_data().strip()
