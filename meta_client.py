"""
meta_client.py — Instagram via instagrapi (unofficial private API).

No Meta developer account required. Authenticates as the Instagram mobile app
using your username and password.

Setup:
  1. Add to .env:
       INSTAGRAM_USERNAME=your_instagram_username
       INSTAGRAM_PASSWORD=your_instagram_password
  2. On first login, Instagram may ask for a verification code — the app will
     prompt you in the terminal. After that, the session is cached to
     static/.instagrapi_session.json and reused automatically.

Image posts:
  - Requires an image file path (local file, not a URL).
  - The generated image from Imagen is saved to static/generated/ and passed
    directly — no public URL needed.
  - Instagram requires images to be JPEG. PNG files are converted automatically.
  - Square (1:1) crops best on feed. 4:5 portrait also works well.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional

_SESSION_FILE = Path("static/.instagrapi_session.json")
_client: Optional[Any] = None


def _get_client() -> Any:
    global _client
    if _client is not None:
        return _client

    try:
        from instagrapi import Client
    except ImportError:
        raise RuntimeError(
            "instagrapi is not installed. Run: python3.11 -m pip install instagrapi"
        )

    username = os.getenv("INSTAGRAM_USERNAME", "").strip()
    password = os.getenv("INSTAGRAM_PASSWORD", "").strip()
    if not username or not password:
        raise RuntimeError(
            "INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD must be set in .env"
        )

    cl = Client()
    cl.delay_range = [1, 3]  # human-like delays between requests

    if _SESSION_FILE.exists():
        try:
            cl.load_settings(_SESSION_FILE)
            cl.login(username, password)
            _client = cl
            return _client
        except Exception:
            # Session expired — fall through to fresh login
            pass

    cl = Client()
    cl.delay_range = [1, 3]
    cl.login(username, password)
    _SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    cl.dump_settings(_SESSION_FILE)
    _client = cl
    return _client


def publish_instagram(caption: str, image_url: str) -> Dict[str, Any]:
    """
    Publish an image post to Instagram.

    image_url may be a local filesystem path (e.g. /static/generated/abc.jpg)
    or an absolute path. The file must exist on disk.
    """
    if not image_url:
        raise ValueError("Instagram requires an image file path or URL.")

    # Resolve path — strip leading slash for local files
    path = Path(image_url.lstrip("/"))
    if not path.exists():
        path = Path(image_url)
    if not path.exists():
        raise ValueError(f"Image file not found: {image_url}")

    cl = _get_client()
    media = cl.photo_upload(path, caption=caption)
    return {"platform": "instagram", "post_id": str(media.pk), "published": True}


def is_configured() -> bool:
    return bool(
        os.getenv("INSTAGRAM_USERNAME", "").strip()
        and os.getenv("INSTAGRAM_PASSWORD", "").strip()
    )
