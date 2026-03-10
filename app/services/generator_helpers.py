from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict
from urllib.parse import urlsplit, urlunsplit


def slugify_title(title: str) -> str:
    normalized = unicodedata.normalize("NFKD", title or "")
    ascii_title = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9\s-]", " ", ascii_title.lower()).strip()
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def localize_article_url(article_url: str, localized_title: str) -> str:
    if not article_url.strip() or not localized_title.strip():
        return article_url

    parts = urlsplit(article_url)
    slug = slugify_title(localized_title)
    if not slug:
        return article_url

    path = parts.path.rstrip("/")
    if not path:
        return article_url

    segments = path.split("/")
    if segments[-1]:
        segments[-1] = slug
    localized_path = "/".join(segments)
    if parts.path.endswith("/"):
        localized_path += "/"

    return urlunsplit((parts.scheme, parts.netloc, localized_path, parts.query, parts.fragment))


def extract_title(text: str) -> str:
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#"):
            return line.lstrip("#").strip()
        if line:
            return line[:80]
    return ""


def initial_pipeline_values(checkpoint: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "related": checkpoint.get("related_articles"),
        "reflection_es": checkpoint["reflection_es"]["content"] if "reflection_es" in checkpoint else "",
        "reflection_es_title": checkpoint.get("reflection_es_title", ""),
        "reflection_es_url": checkpoint.get("reflection_es_url", ""),
        "refl_social_en": checkpoint.get("reflection_social_en", {}),
        "refl_social_es": checkpoint.get("reflection_social_es", {}),
        "companion": checkpoint["companion_en"]["content"] if "companion_en" in checkpoint else "",
        "companion_title": checkpoint["companion_en"]["title"] if "companion_en" in checkpoint else "",
        "companion_es": checkpoint["companion_es"]["content"] if "companion_es" in checkpoint else "",
        "companion_es_title": checkpoint.get("companion_es_title", ""),
        "comp_social_en": checkpoint.get("companion_social_en", {}),
        "comp_social_es": checkpoint.get("companion_social_es", {}),
        "tags": checkpoint.get("tags", []),
        "quotes": checkpoint.get("quotes", []),
    }
