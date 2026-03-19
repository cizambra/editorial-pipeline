from __future__ import annotations

import re
from pathlib import Path
from typing import Dict

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.core import auth, prompt_state
from app.core.logging import get_logger
from app.persistence import storage
from app.services import generator, scraper


router = APIRouter()
_logger = get_logger("editorial.routes.settings")


def _slugify_text(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")[:120]


def _extract_file_metadata(filename: str, content: str) -> Dict[str, str]:
    text = content or ""
    title = ""
    slug = ""
    article_url = ""

    frontmatter = re.match(r"^---\n(.*?)\n---\n?", text, flags=re.DOTALL)
    if frontmatter:
        for line in frontmatter.group(1).splitlines():
            key, _, value = line.partition(":")
            value = value.strip().strip('"').strip("'")
            lowered = key.strip().lower()
            if lowered == "slug" and value:
                slug = _slugify_text(value)
            elif lowered in {"url", "article_url"} and value:
                article_url = value

    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            title = stripped[2:].strip()
            break

    if not title:
        stem = Path(filename or "document").stem
        words = re.sub(r"[-_]+", " ", stem).strip().split()
        title = " ".join((w[0].upper() + w[1:]) if w else w for w in words)

    if not slug:
        slug = _slugify_text(title or Path(filename or "document").stem)
    return {"title": title, "slug": slug, "article_url": article_url}


@router.get("/api/articles")
async def get_articles():
    try:
        articles = await run_in_threadpool(scraper.fetch_articles)
        return {"articles": articles, "count": len(articles)}
    except Exception as exc:
        _logger.exception("Failed to load indexed articles")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/files/inspect")
async def inspect_uploaded_file(file: UploadFile = File(...)):
    try:
        raw = await file.read()
        text = raw.decode("utf-8", errors="ignore")
        return _extract_file_metadata(file.filename or "document.md", text)
    except Exception as exc:
        _logger.exception("Uploaded file inspection failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/articles/refresh")
async def refresh_articles():
    try:
        articles = await run_in_threadpool(scraper.refresh_index)
        return {"articles": articles, "count": len(articles)}
    except Exception as exc:
        _logger.exception("Article refresh failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/articles/index-new")
async def index_new_articles():
    try:
        return await run_in_threadpool(scraper.index_new_articles)
    except Exception as exc:
        _logger.exception("Article incremental indexing failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/articles/fetch")
async def fetch_article_content(url: str):
    try:
        return await run_in_threadpool(scraper.fetch_article_content, url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        _logger.exception("Article fetch failed", extra={"fields": {"url": url}})
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/dashboard")
async def get_dashboard():
    try:
        articles = await run_in_threadpool(scraper.fetch_articles)
        return await run_in_threadpool(storage.get_dashboard_data, articles)
    except Exception as exc:
        _logger.exception("Dashboard load failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/template")
async def get_template():
    template_path = prompt_state.get_template_path()
    if template_path.exists():
        return {"template": await run_in_threadpool(template_path.read_text, encoding="utf-8"), "exists": True}
    return {"template": "", "exists": False}


@router.post("/api/template")
async def upload_template(file: UploadFile = File(...), request: Request = None):
    current = None
    if request is not None:
        current = auth.require_superadmin(request)
    template_path = prompt_state.get_template_path()
    content = await file.read()
    await run_in_threadpool(lambda: template_path.parent.mkdir(parents=True, exist_ok=True))
    await run_in_threadpool(template_path.write_bytes, content)
    if current:
        await run_in_threadpool(
            storage.append_audit_event,
            action="config.template_uploaded",
            actor_user_id=current.id,
            actor_email=current.email,
            actor_role=current.role,
            target_type="template",
            target_id=str(template_path),
            details={"bytes": len(content)},
        )
    return {"message": "Template saved successfully"}


@router.get("/api/config")
async def get_config():
    config = await run_in_threadpool(generator.get_current_prompts)
    config["thumbnail_prompt"] = prompt_state.get_thumbnail_prompt()
    return config


@router.post("/api/config")
async def post_config(body: dict, request: Request = None):
    current = None
    if request is not None:
        current = auth.require_superadmin(request)
    allowed = {"voice_brief", "companion_voice_brief", "spanish_style_guide", "tone_level", "platform_personas", "platform_prompts", "thumbnail_prompt"}
    filtered = {k: v for k, v in body.items() if k in allowed}
    await run_in_threadpool(storage.save_config, filtered)
    if "thumbnail_prompt" in filtered:
        prompt_state.set_thumbnail_prompt(filtered["thumbnail_prompt"])
    await run_in_threadpool(
        generator.apply_config_overrides,
        {k: v for k, v in filtered.items() if k != "thumbnail_prompt"},
    )
    if current:
        await run_in_threadpool(
            storage.append_audit_event,
            action="config.updated",
            actor_user_id=current.id,
            actor_email=current.email,
            actor_role=current.role,
            target_type="config",
            target_id="app_config",
            details={"keys": sorted(filtered.keys())},
        )
    return {"message": "Config saved", "keys": list(filtered.keys())}
