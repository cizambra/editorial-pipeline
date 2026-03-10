from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Tuple


def get_linkedin_credentials() -> Dict[str, str]:
    return {
        "access_token": os.getenv("LINKEDIN_ACCESS_TOKEN", "").strip(),
        "person_urn": os.getenv("LINKEDIN_PERSON_URN", "").strip(),
    }


def get_google_api_key() -> str:
    return os.getenv("GOOGLE_API_KEY", "").strip()


@lru_cache(maxsize=1)
def get_http_backend() -> Tuple[Any, str | None]:
    try:
        from curl_cffi import requests as req
        return req, "chrome120"
    except ImportError:
        import requests as req  # type: ignore
        return req, None


@lru_cache(maxsize=1)
def get_instagram_client() -> Any:
    try:
        from instagrapi import Client
    except ImportError as exc:
        raise RuntimeError(
            "instagrapi is not installed. Run: python3.11 -m pip install instagrapi"
        ) from exc

    username = os.getenv("INSTAGRAM_USERNAME", "").strip()
    password = os.getenv("INSTAGRAM_PASSWORD", "").strip()
    if not username or not password:
        raise RuntimeError(
            "INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD must be set in .env"
        )

    session_file = Path("static/.instagrapi_session.json")
    client = Client()
    client.delay_range = [1, 3]

    if session_file.exists():
        try:
            client.load_settings(session_file)
            client.login(username, password)
            return client
        except Exception:
            pass

    client = Client()
    client.delay_range = [1, 3]
    client.login(username, password)
    session_file.parent.mkdir(parents=True, exist_ok=True)
    client.dump_settings(session_file)
    return client
