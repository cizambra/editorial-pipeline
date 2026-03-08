# -*- coding: utf-8 -*-
from __future__ import annotations

"""
main.py - FastAPI backend for the Editorial Pipeline.
Run with: python -m uvicorn main:app --reload
"""

import os
import json
import threading
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Optional

from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
import re

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

import anthropic as _anthropic

import uuid
import scraper
import imagen_client
import generator
import social_client
import storage
import substack_client

# Shared Anthropic client for main.py endpoints (thumbnail concepts, Reddit analysis).
# The beta header enables prompt caching so large stable system prompts are cached
# and re-read at 10% of normal cost on subsequent calls.
_claude = _anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY", ""),
    default_headers={"anthropic-beta": "prompt-caching-2024-07-31"},
)

# ── Background scheduler: publishes due social posts every minute ─────────────

def _publish_due_posts() -> None:
    due = storage.get_due_scheduled_posts()
    for post in due:
        try:
            result = social_client.publish_post(
                post["platform"], post["text"], post.get("image_url", "")
            )
            storage.update_scheduled_post_status(
                post["id"], "published", post_id_result=result.get("post_id", "")
            )
            if post["platform"] == "substack_note" and post.get("note_id"):
                storage.update_substack_note(post["note_id"], shared=True)
        except Exception as e:
            storage.update_scheduled_post_status(post["id"], "failed", error=str(e))


def _enrich_subscriber_profiles() -> None:
    """Fetch detail for one un-enriched subscriber per run (slow background cadence)."""
    try:
        sub = storage.get_next_subscriber_for_enrichment()
        if not sub:
            return
        detail = substack_client.get_subscriber_detail(sub["email"])
        if detail:
            storage.save_subscriber_detail(sub["email"], detail)
    except Exception:
        pass  # silently skip on Cloudflare block or transient errors


_scheduler = BackgroundScheduler(timezone="UTC")
_scheduler.add_job(_publish_due_posts, "interval", minutes=1, id="publish_due_posts")
_scheduler.add_job(_enrich_subscriber_profiles, "interval", minutes=2, id="enrich_subscribers")


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.init_db()
    Path("static/generated").mkdir(parents=True, exist_ok=True)
    _scheduler.start()
    yield
    _scheduler.shutdown(wait=False)


app = FastAPI(title="Editorial Pipeline", lifespan=lifespan)

app.mount("/static", StaticFiles(directory="static"), name="static")

TEMPLATE_PATH = Path(os.getenv("COMPANION_TEMPLATE_PATH", "templates/companion_template.md"))
REFLECTION_DAY = int(os.getenv("REFLECTION_DAY", 2))
REFLECTION_TIME = os.getenv("REFLECTION_TIME", "07:00")
COMPANION_DAY = int(os.getenv("COMPANION_DAY", 3))
COMPANION_TIME = os.getenv("COMPANION_TIME", "08:00")

# Global cancel event - replaced each run
_cancel_event: Optional[threading.Event] = None
_cancel_lock = threading.Lock()
_CHECKPOINT_PERSIST_KEYS = {
    "related_articles",
    "reflection_es",
    "companion_en",
    "companion_es",
    "tags",
}


# Apply persisted overrides at startup
_startup_config = storage.load_config()
if _startup_config:
    generator.apply_config_overrides({
        k: v for k, v in _startup_config.items()
        if k != "thumbnail_prompt"
    })
# --- Image pricing (gpt-image-1, 1536x1024) ----------------------------------
# https://openai.com/api/pricing  (portrait/landscape sizes)
_IMG_PRICE_MEDIUM = 0.063   # per image, medium quality
_IMG_PRICE_HIGH   = 0.250   # per image, high quality


# --- Routes ------------------------------------------------------------------

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

@app.get("/", response_class=HTMLResponse)
async def root():
    with open("static/index.html", encoding="utf-8") as f:
        return f.read()


# --- Articles ----------------------------------------------------------------

@app.get("/api/articles")
async def get_articles():
    try:
        articles = scraper.fetch_articles()
        return {"articles": articles, "count": len(articles)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/inspect")
async def inspect_uploaded_file(file: UploadFile = File(...)):
    try:
        raw = await file.read()
        text = raw.decode("utf-8", errors="ignore")
        return _extract_file_metadata(file.filename or "document.md", text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/articles/refresh")
async def refresh_articles():
    """Full re-index: fetches ALL posts via Substack API (paginated)."""
    try:
        articles = scraper.refresh_index()
        return {"articles": articles, "count": len(articles)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/articles/index-new")
async def index_new_articles():
    """Incremental index: fetches only posts newer than the current cache."""
    try:
        result = scraper.index_new_articles()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/articles/fetch")
async def fetch_article_content(url: str):
    """Fetch and extract the full text of a public article by URL."""
    try:
        result = scraper.fetch_article_content(url)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dashboard")
async def get_dashboard():
    """Returns aggregated stats for the dashboard view."""
    try:
        articles = scraper.fetch_articles()
        return storage.get_dashboard_data(articles)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Template ----------------------------------------------------------------

@app.get("/api/template")
async def get_template():
    if TEMPLATE_PATH.exists():
        return {"template": TEMPLATE_PATH.read_text(encoding="utf-8"), "exists": True}
    return {"template": "", "exists": False}


@app.post("/api/template")
async def upload_template(file: UploadFile = File(...)):
    content = await file.read()
    TEMPLATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    TEMPLATE_PATH.write_bytes(content)
    return {"message": "Template saved successfully"}


# --- Config / Prompt overrides ------------------------------------------------

@app.get("/api/config")
async def get_config():
    config = generator.get_current_prompts()
    config["thumbnail_prompt"] = _CONCEPTS_SYSTEM
    return config


@app.post("/api/config")
async def post_config(body: dict):
    global _CONCEPTS_SYSTEM
    allowed = {"voice_brief", "companion_voice_brief", "spanish_style_guide", "tone_level", "platform_personas", "thumbnail_prompt"}
    filtered = {k: v for k, v in body.items() if k in allowed}
    storage.save_config(filtered)
    if "thumbnail_prompt" in filtered:
        _CONCEPTS_SYSTEM = filtered["thumbnail_prompt"]
    generator.apply_config_overrides({
        k: v for k, v in filtered.items()
        if k != "thumbnail_prompt"
    })
    return {"message": "Config saved", "keys": list(filtered.keys())}


# --- Run History -------------------------------------------------------------

@app.get("/api/history")
async def get_history():
    return {"runs": storage.list_history_runs(limit=50)}


@app.get("/api/history/{run_id}")
async def get_history_run(run_id: int):
    run = storage.get_history_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.get("/api/marketing/library")
async def get_marketing_library():
    return {"runs": storage.list_marketing_runs(limit=100)}


@app.delete("/api/history/{run_id}")
async def delete_history_run(run_id: int):
    storage.delete_history_run(run_id)
    return {"message": "Run deleted"}


# --- Thumbnail library -------------------------------------------------------

class SaveThumbnailRequest(BaseModel):
    article_title: str
    article_url: str = ""
    concept_name: str = ""
    image_b64: str


@app.post("/api/thumbnails/save")
async def save_thumbnail(req: SaveThumbnailRequest):
    saved = storage.save_thumbnail(req.article_title, req.article_url, req.concept_name, req.image_b64)
    return {
        "id": saved["id"],
        "created": saved["created"],
        "message": "Saved" if saved["created"] else "Already saved",
    }


@app.get("/api/thumbnails")
async def list_thumbnails(q: str = "", limit: int = 100):
    return {"thumbnails": storage.list_thumbnails(query=q, limit=limit)}


@app.get("/api/thumbnails/{thumb_id}")
async def get_thumbnail(thumb_id: int):
    thumbnail = storage.get_thumbnail(thumb_id)
    if not thumbnail:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return thumbnail


@app.delete("/api/thumbnails/{thumb_id}")
async def delete_thumbnail(thumb_id: int):
    storage.delete_thumbnail(thumb_id)
    return {"message": "Deleted"}


# --- Tokens ------------------------------------------------------------------

@app.get("/api/tokens/current")
async def get_current_tokens():
    """Return token usage for the current (or most recent) pipeline run."""
    return generator.get_token_summary()


# --- Post Feedback ------------------------------------------------------------

@app.post("/api/feedback")
async def post_feedback(body: dict):
    """Save a thumbs-up / thumbs-down rating for a specific carousel post."""
    storage.save_feedback(
        run_title=body.get("run_title", ""),
        platform=body.get("platform", ""),
        source=body.get("source", ""),
        language=body.get("language", ""),
        post_index=int(body.get("post_index", 0)),
        rating=int(body.get("rating", 0)),
        preview=str(body.get("preview", "")),
    )
    return {"message": "Feedback saved"}


@app.get("/api/feedback/summary")
async def get_feedback_summary():
    """Return aggregate thumbs counts per platform."""
    return {"summary": storage.get_feedback_summary()}


# --- Social publishing -------------------------------------------------------

@app.get("/api/social/status")
async def get_social_status():
    """Return which platforms are configured."""
    return social_client.get_status()


@app.get("/api/social/debug/threads")
async def debug_threads():
    """Diagnostic endpoint — makes a real Threads REST API request and returns details."""
    import threads_client as _tc
    session_id = os.getenv("THREADS_SESSION_ID", "")
    try:
        cookies = _tc._cookies()
    except Exception as e:
        return {"error": f"Cookie build failed: {e}"}

    kw = {"impersonate": _tc._IMPERSONATE} if _tc._IMPERSONATE else {}
    try:
        import time as _time
        resp = _tc._req.post(
            _tc._API_URL,
            headers=_tc._headers(),
            data={
                "audience": "default",
                "caption": "__debug_test__",
                "publish_mode": "text_post",
                "upload_id": str(int(_time.time() * 1000)),
                "jazoest": _tc._jazoest(os.getenv("THREADS_CSRF_TOKEN", "")),
                "text_post_app_info": '{"reply_control":0,"text_with_entities":{"entities":[],"text":"__debug_test__"}}',
                "web_session_id": _tc._random_session_id(),
            },
            timeout=15,
            **kw,
        )
        return {
            "using_curl_cffi": _tc._IMPERSONATE is not None,
            "endpoint": _tc._API_URL,
            "ds_user_id": session_id.split("%3A")[0].split(":")[0] if session_id else "NOT SET",
            "cookies_sent": cookies[:80] + "...",
            "http_status": resp.status_code,
            "content_type": resp.headers.get("content-type", ""),
            "response_snippet": resp.text[:500],
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/social/publish")
async def publish_to_social(body: dict):
    """Publish a single post to a platform immediately."""
    platform = body.get("platform", "")
    text = body.get("text", "")
    image_url = body.get("image_url", "")
    source_label = body.get("source_label", "")
    if not platform or not text:
        raise HTTPException(status_code=400, detail="platform and text are required")
    try:
        result = social_client.publish_post(platform, text, image_url)
        storage.record_published_post(platform, text, image_url, source_label)
        return {"message": "Published successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/social/schedule")
async def schedule_social_post(body: dict):
    """Schedule a post for future publishing."""
    platform = body.get("platform", "")
    text = body.get("text", "")
    scheduled_at = body.get("scheduled_at", "")   # UTC ISO datetime string
    image_url = body.get("image_url", "")
    source_label = body.get("source_label", "")
    timezone_name = body.get("timezone", "")
    note_id = body.get("note_id")
    if not platform or not text or not scheduled_at:
        raise HTTPException(status_code=400, detail="platform, text, and scheduled_at are required")
    post_id = storage.create_scheduled_post(platform, text, scheduled_at, image_url, source_label, timezone_name, note_id)
    return {"id": post_id, "scheduled_at": scheduled_at, "platform": platform}


@app.get("/api/social/scheduled")
async def list_scheduled():
    """List pending and in-progress scheduled posts."""
    return {"posts": storage.list_scheduled_posts(status="pending")}


@app.get("/api/social/published")
async def list_published(limit: int = 50):
    """List successfully published posts, newest first."""
    posts = storage.list_scheduled_posts(status="published", limit=limit)
    posts.sort(key=lambda p: p.get("published_at", ""), reverse=True)
    return {"posts": posts}


@app.delete("/api/social/scheduled/{post_id}")
async def cancel_scheduled(post_id: int):
    storage.cancel_scheduled_post(post_id)
    return {"ok": True}


@app.delete("/api/social/scheduled/{post_id}/hard")
async def delete_scheduled(post_id: int):
    storage.delete_scheduled_post(post_id)
    return {"ok": True}


# --- Imagen ------------------------------------------------------------------

@app.post("/api/imagen/generate")
async def generate_imagen(body: dict):
    """
    Generate an Instagram image with Imagen 3.
    Accepts { post_text, prompt, aspect_ratio }.
    If prompt is omitted, Claude generates one from post_text.
    Returns { local_url, prompt_used }.
    """
    if not imagen_client.is_configured():
        raise HTTPException(status_code=400, detail="GOOGLE_API_KEY is not set in .env")

    post_text: str = body.get("post_text", "")
    prompt: str = body.get("prompt", "").strip()
    aspect_ratio: str = body.get("aspect_ratio", "1:1")

    if not prompt:
        if not post_text:
            raise HTTPException(status_code=400, detail="prompt or post_text required")
        client = _anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=120,
            messages=[{
                "role": "user",
                "content": (
                    "Write a concise Imagen 3 prompt (max 60 words) for a photorealistic "
                    "Instagram lifestyle photo that complements this post. "
                    "Warm natural lighting, depth of field, authentic moment. "
                    "No text, no words, no logos in the image.\n\nPost:\n" + post_text[:600]
                ),
            }],
        )
        prompt = msg.content[0].text.strip()

    try:
        image_bytes = imagen_client.generate_image(prompt, aspect_ratio=aspect_ratio)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    filename = uuid.uuid4().hex + ".jpg"
    filepath = Path("static/generated") / filename
    filepath.write_bytes(image_bytes)

    return {"local_url": f"/static/generated/{filename}", "prompt_used": prompt}


# --- Checkpoint --------------------------------------------------------------

@app.get("/api/pipeline/checkpoint")
async def get_checkpoint():
    cp = storage.load_checkpoint()
    if not cp:
        return {"exists": False}
    completed_steps = list(cp.get("data", {}).keys())
    return {
        "exists": True,
        "title": cp.get("reflection_title", "Unknown"),
        "timestamp": cp.get("timestamp", ""),
        "article_url": cp.get("article_url", ""),
        "include_spanish": cp.get("include_spanish", True),
        "completed_steps": completed_steps,
        "total_steps": 8,
    }


@app.delete("/api/pipeline/checkpoint")
async def clear_checkpoint():
    storage.clear_checkpoint()
    return {"message": "Checkpoint cleared"}


# --- Cancel ------------------------------------------------------------------

@app.post("/api/pipeline/cancel")
async def cancel_pipeline():
    global _cancel_event
    with _cancel_lock:
        if _cancel_event is not None:
            _cancel_event.set()
    return {"message": "Cancel signal sent"}


# --- Regenerate single platform -----------------------------------------------

@app.post("/api/pipeline/regenerate")
async def regenerate_platform(body: dict):
    """
    Regenerate social posts for a single platform.
    Useful for refreshing a weak platform output without re-running everything.

    Body:
        platform:    'linkedin' | 'instagram' | 'threads' | 'substack_note'
        source_text: raw article / companion text
        title:       article title
        article_url: (optional) article URL for link embedding
        language:    'english' | 'Spanish' (default 'english')
        tone_level:  0-10 (optional, applies for this call only)
    """
    platform    = body.get("platform", "")
    source_text = body.get("source_text", "")
    title       = body.get("title", "")
    article_url = body.get("article_url", "")
    language    = body.get("language", "english")
    tone_level  = body.get("tone_level")

    if not platform or not source_text:
        raise HTTPException(status_code=400, detail="platform and source_text are required")

    if tone_level is not None:
        generator.set_tone_level(int(tone_level))

    try:
        content = generator.generate_single_platform(
            text=source_text,
            title=title,
            article_url=article_url,
            platform=platform,
            language=language,
        )
        return {"platform": platform, "content": content}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# --- Repurpose from Archive ---------------------------------------------------

@app.post("/api/pipeline/repurpose")
async def repurpose_from_archive(body: dict):
    """
    Generate fresh social posts from a previously published article.
    Does NOT run the full pipeline - only generates social content (no companion, no translation).

    Body:
        text:          article text (required)
        title:         article title (required)
        article_url:   article URL for link embedding (optional)
        original_date: e.g. "March 2024" (optional)
        angle_note:    specific angle to focus on (optional)
        language:      'english' | 'Spanish' (default 'english')
        tone_level:    0-10 (optional)
    """
    text          = body.get("text", "").strip()
    title         = body.get("title", "").strip()
    article_url   = body.get("article_url", "")
    original_date = body.get("original_date", "")
    angle_note    = body.get("angle_note", "")
    language      = body.get("language", "english")
    tone_level    = body.get("tone_level")
    save_to_history = bool(body.get("save_to_history", False))

    if not text or not title:
        raise HTTPException(status_code=400, detail="text and title are required")

    if tone_level is not None:
        generator.set_tone_level(int(tone_level))

    generator.reset_token_log()

    try:
        results = generator.generate_repurposed_from_archive(
            text=text,
            title=title,
            article_url=article_url,
            original_date=original_date,
            angle_note=angle_note,
            language=language,
        )
        token_summary = generator.get_token_summary()
        if save_to_history:
            lang_key = "es" if str(language).lower().startswith("spanish") else "en"
            data = {
                "reflection": {
                    lang_key: text,
                    f"repurposed_{lang_key}": results,
                }
            }
            storage.save_run(title, article_url, data, token_summary)
        return {
            "social": results,
            "tokens": token_summary,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pipeline/companion")
async def generate_companion_only(body: dict):
    """
    Generate only the paid companion flow from a reflection:
    companion EN, and optionally companion ES.

    Body:
        text:             reflection text (required)
        title:            reflection title (required)
        article_url:      reflection URL (optional)
        include_spanish:  bool (default true)
        tone_level:       0-10 (optional)
    """
    text = body.get("text", "").strip()
    title = body.get("title", "").strip()
    article_url = body.get("article_url", "")
    include_spanish = body.get("include_spanish", True)
    tone_level = body.get("tone_level")

    if not text or not title:
        raise HTTPException(status_code=400, detail="text and title are required")
    if not TEMPLATE_PATH.exists():
        raise HTTPException(status_code=400, detail="Companion template not found. Upload it in Settings first.")

    if tone_level is not None:
        generator.set_tone_level(int(tone_level))

    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    generator.reset_token_log()

    try:
        result = generator.generate_companion_only(
            reflection=text,
            reflection_title=title,
            template=template,
            article_url=article_url,
            include_spanish=bool(include_spanish),
        )
        token_summary = generator.get_token_summary()
        return {
            **result,
            "tokens": token_summary,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Thumbnail generation ----------------------------------------------------

class ThumbnailRequest(BaseModel):
    title: str
    prompt_override: Optional[str] = None   # optional custom prompt from settings


class ThumbnailConceptsRequest(BaseModel):
    title: str
    article_text: str
    auto_generate: bool = True   # False = stop after concepts, let client trigger images


class ThumbnailImagesRequest(BaseModel):
    concepts: List[Dict[str, Any]]         # [{index, name, scene, dalle_prompt}, ...]


_CONCEPTS_SYSTEM = """\
You are operating as a 3-stage creative studio for a self-discipline newsletter.

Given an article, generate exactly 3 thumbnail scene concepts as a JSON array.

CRITICAL OUTPUT REQUIREMENT:
- You MUST include "dalle_prompt" for every concept.
- "dalle_prompt" must be a single plain string that can be sent directly to the OpenAI images generation endpoint.
- No missing fields.
- If you cannot generate a valid dalle_prompt for all three concepts, return an empty array [].
- Do NOT include markdown fences.
- Return only valid JSON.

Internally follow these stages for each concept:

STAGE 1 - STORYTELLER
- Identify the article's core idea in one sentence.
- Invent a grounded, real-world situation where this idea is visibly embodied.
- The scene must depict something that could realistically be photographed.
- No giant symbolic objects.
- No floating items.
- No surreal scale shifts.
- No abstract visual metaphors.

The frozen moment may represent:
- The behavior itself
- The aligned outcome
- A quiet everyday expression of the idea
- Or a visible decision in progress

Each concept must use a DIFFERENT real-world scenario.

STAGE 2 - ART DIRECTOR
Translate the snapshot into a clean, readable composition.

The image must visually communicate the idea without text.

Allowed:
- Calm scenes
- Aligned states
- Transitional moments
- Everyday behaviors

Not allowed:
- Conceptual metaphors (hourglasses, giant clocks, split worlds, scales, etc.)
- Decorative filler scenes unrelated to the core idea
- Passive object placement with no narrative relationship

Composition rules:
- 2 to 4 meaningful elements maximum.
- All elements must exist naturally in the same physical space.
- Normal object scale only.
- Clear foreground/background hierarchy.
- Strong silhouette readability at thumbnail size.
- No decorative clutter.
- The relationship between elements must visually express the idea.

STAGE 3 - VISUAL DESIGNER
Convert each composition into a complete DALL-E-ready prompt.

Each object in the JSON array must contain ALL of the following fields:

{
  "name": "3-6 word concept title",
  "scene": "One sentence describing what is visually shown and what is happening.",
  "why": "One sentence explaining why this captures a key idea from the article.",
  "dalle_prompt": "Full DALL-E prompt string"
}

Every dalle_prompt must:

1) Begin exactly with:
   Flat vector illustration

2) Describe only concrete, physically plausible visible elements.
   - No floating objects.
   - No oversized symbolic props.
   - No surreal environments.
   - Maximum 3 to 5 visible elements.

3) Clearly describe posture, orientation, spatial layout, and object positioning.

4) OBJECT STATE ENFORCEMENT:
   If any object requires a specific state (e.g., closed laptop, phone face-down, half-open door),
   explicitly describe its physical condition and what is NOT visible.
   Example: "laptop lid fully shut flat, no screen visible"

5) End exactly with:
   Undraw.co style: rounded geometric shapes, solid fills, subtle drop shadows. No text overlays, no labels, no UI elements. Minimal or simplified faces only. 16:9 widescreen ratio.

Style constraints:
- Flat editorial vector illustration.
- Clean rounded geometry.
- Warm but controlled color palette.
- Subtle grounding shadows only.
- No dramatic lighting.
- No complex decorative backgrounds.
- Must feel like a stylized real-life moment.
"""

if _startup_config and _startup_config.get("thumbnail_prompt"):
    _CONCEPTS_SYSTEM = _startup_config["thumbnail_prompt"]

_DALLE_STYLE_SUFFIX = (
    " Minimal 2-3 color palette (muted blues, coral, cream). "
    "Undraw.co style: rounded geometric shapes, solid fills, subtle drop shadows. "
    "No text overlays, no labels, no UI elements. 16:9 widescreen ratio."
)


async def _generate_one_dalle(httpx_client, api_key: str, prompt: str, index: int) -> Dict[str, Any]:
    """Call gpt-image-1 for a single concept. Medium quality for concept exploration."""
    resp = await httpx_client.post(
        "https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": "gpt-image-1",
            "prompt": prompt,
            "n": 1,
            "size": "1536x1024",
            "quality": "medium",
        },
        timeout=120,
    )
    if not resp.is_success:
        # Surface the actual OpenAI error body so we can see exactly what went wrong
        try:
            err_body = resp.json()
            err_msg = err_body.get("error", {}).get("message", resp.text)
        except Exception:
            err_msg = resp.text
        raise Exception(f"OpenAI {resp.status_code}: {err_msg}")
    data = resp.json()
    return {
        "index": index,
        "image_b64": data["data"][0]["b64_json"],
        "revised_prompt": data["data"][0].get("revised_prompt", prompt),
    }


@app.post("/api/generate-thumbnail-concepts")
async def generate_thumbnail_concepts(req: ThumbnailConceptsRequest):
    # Two-step thumbnail concept generator:
    #   1. Claude reads the article and brainstorms 3 distinct scene concepts.
    #   2. All 3 DALL-E images are generated in parallel.

    # Streams SSE events:
    #   event: concepts_ready  - Claude's 3 scene concepts (name + scene description)
    #   event: concept_image   - one per image as it finishes {index, name, scene, image_b64, revised_prompt}
    #   event: done            - all images generated
    #   event: error           - something went wrong
    import asyncio
    import anthropic as _anthropic

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not set in .env")

    def sse(event: str, data: Dict[str, Any]) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def stream():
        # -- Step 1: Claude brainstorms 3 scene concepts ----------------------
        try:
            article_excerpt = req.article_text[:4000]  # keep tokens reasonable
            response = _claude.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=2048,   # raised: 3 concepts x ~4 fields incl. long dalle_prompt ~ 1200-1800 tokens
                # _CONCEPTS_SYSTEM is stable (~1000 tokens) - mark for caching so repeated
                # calls (retries, back-to-back articles) read it at ~10% of normal cost.
                system=[{
                    "type": "text",
                    "text": _CONCEPTS_SYSTEM,
                    "cache_control": {"type": "ephemeral"},
                }],
                messages=[{
                    "role": "user",
                    "content": (
                        f"Article title: {req.title}\n\n"
                        f"Article text:\n{article_excerpt}\n\n"
                        "Generate 3 thumbnail scene concepts. "
                        "Every concept MUST include a dalle_prompt field. Do not omit it."
                    ),
                }],
            )
            raw = response.content[0].text.strip()
            # Strip markdown fences if Claude added them anyway
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            concepts = json.loads(raw)

            # Validate every concept has the required fields
            required = {"name", "scene", "dalle_prompt"}
            missing = [i for i, c in enumerate(concepts) if not required.issubset(c)]
            if missing:
                raise ValueError(
                    f"Claude returned concepts missing required fields at index(es) {missing}. "
                    f"Keys present: {[list(concepts[i].keys()) for i in missing]}"
                )

        except Exception as e:
            yield sse("error", {"message": f"Concept generation failed: {e}"})
            return

        yield sse("concepts_ready", {"concepts": [
            {
                "index": i,
                "name": c["name"],
                "scene": c["scene"],
                "why": c.get("why", ""),
                "dalle_prompt": c.get("dalle_prompt", ""),   # needed by client review mode
            }
            for i, c in enumerate(concepts)
        ]})

        # -- Step 2: Generate images (skipped when client wants review first) ----
        if not req.auto_generate:
            yield sse("done", {})
            return

        import httpx as _httpx
        async with _httpx.AsyncClient() as http:
            tasks = [
                _generate_one_dalle(http, api_key, c["dalle_prompt"], i)
                for i, c in enumerate(concepts)
            ]
            for coro in asyncio.as_completed(tasks):
                result = None
                try:
                    result = await coro
                    idx = result["index"]
                    yield sse("concept_image", {
                        "index": idx,
                        "name": concepts[idx]["name"],
                        "scene": concepts[idx]["scene"],
                        "image_b64": result["image_b64"],
                        "revised_prompt": result["revised_prompt"],
                    })
                except Exception as e:
                    idx = result["index"] if result else "?"
                    yield sse("error", {"message": f"Image {idx} failed: {e}"})

        cost = storage.record_image_cost("concept_medium", len(concepts), _IMG_PRICE_MEDIUM)
        yield sse("image_cost", {"cost_usd": cost, "count": len(concepts), "quality": "medium"})
        yield sse("done", {})

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/api/generate-thumbnail-images")
async def generate_thumbnail_images(req: ThumbnailImagesRequest):
    # Streams DALL-E images for a pre-approved set of concepts.
    # Used when the client has already shown concepts for review and the user
    # wants to trigger image generation separately.

    # Streams the same SSE events as /api/generate-thumbnail-concepts:
    #   event: concept_image - {index, name, scene, image_b64, revised_prompt}
    #   event: done
    #   event: error
    
    import asyncio

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not set in .env")

    def sse(event: str, data: Dict[str, Any]) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def stream():
        import httpx as _httpx
        concepts = req.concepts
        async with _httpx.AsyncClient() as http:
            tasks = [
                _generate_one_dalle(http, api_key, c["dalle_prompt"], c.get("index", i))
                for i, c in enumerate(concepts)
            ]
            for coro in asyncio.as_completed(tasks):
                result = None
                try:
                    result = await coro
                    idx = result["index"]
                    match = next((c for c in concepts if c.get("index") == idx), concepts[idx] if idx < len(concepts) else {})
                    yield sse("concept_image", {
                        "index": idx,
                        "name": match.get("name", ""),
                        "scene": match.get("scene", ""),
                        "image_b64": result["image_b64"],
                        "revised_prompt": result["revised_prompt"],
                    })
                except Exception as e:
                    idx = result["index"] if result else "?"
                    yield sse("error", {"message": f"Image {idx} failed: {e}"})
        cost = storage.record_image_cost("concept_medium", len(concepts), _IMG_PRICE_MEDIUM)
        yield sse("image_cost", {"cost_usd": cost, "count": len(concepts), "quality": "medium"})
        yield sse("done", {})

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/api/generate-thumbnail")
async def generate_thumbnail(req: ThumbnailRequest):
    """
    Generates a thumbnail image via DALL-E 3.
    Returns a base64-encoded PNG and the revised prompt used.
    """
    import base64

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not set in .env")

    config = storage.load_config()

    # Build the prompt: user override → config setting → sensible default template
    base_prompt = (
        req.prompt_override
        or config.get("thumbnail_prompt")
        or (
            "Create a flat editorial illustration for a self-discipline newsletter article "
            "about \"{title}\". Depict a specific, relatable everyday scene that captures "
            "the core tension or insight of the article. One or two expressive characters "
            "in a recognizable real-world setting. Where relevant, include a thought bubble "
            "showing the contrasting mental state (e.g. the task being avoided, the ideal "
            "vs. the reality). Style: clean flat vector illustration, warm vibrant colors, "
            "bold simple shapes, expressive faces, no text overlays, no UI elements. "
            "16:9 widescreen. Suitable for Substack and LinkedIn."
        )
    )
    final_prompt = base_prompt.replace("{title}", req.title)

    try:
        import httpx
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-image-1",
                    "prompt": final_prompt,
                    "n": 1,
                    "size": "1536x1024",
                    "quality": "high",
                },
            )
        if not resp.is_success:
            try:
                err_body = resp.json()
                err_msg = err_body.get("error", {}).get("message", resp.text)
            except Exception:
                err_msg = resp.text
            raise Exception(f"OpenAI {resp.status_code}: {err_msg}")
        data = resp.json()
        image_b64 = data["data"][0]["b64_json"]
        revised_prompt = data["data"][0].get("revised_prompt", final_prompt)
        cost = storage.record_image_cost("custom_high", 1, _IMG_PRICE_HIGH)
        return {
            "image_b64": image_b64,
            "revised_prompt": revised_prompt,
            "cost_usd": cost,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {e}")


# --- Reddit Struggles Crawler ------------------------------------------------

_REDDIT_SUBREDDITS = ["Discipline", "getdisciplined"]
_REDDIT_POSTS_PER_SUB = 50

_STRUGGLES_SYSTEM = """You are an editorial analyst for a self-discipline newsletter called "Self Disciplined".

You will receive a list of Reddit post titles from communities about self-discipline and personal improvement.
Your job is to identify the most common struggles, group them into clear categories, and surface them as content ideas.

Return a JSON array of categories. Each category has:
- "category": short label (e.g. "Procrastination & Avoidance")
- "emoji": a single relevant emoji
- "struggles": array of objects, each with:
  - "theme": one-line description of the specific struggle (e.g. "Can't start tasks even when motivated")
  - "frequency": integer - how many posts relate to this theme
  - "example": one short representative quote from the post titles (verbatim, under 12 words)
  - "article_angle": a punchy one-line article idea for the "Self Disciplined" newsletter

Return 4-6 categories, each with 2-4 struggles. Most frequent struggles first within each category.
Output ONLY the JSON array, no markdown fences, no commentary."""


@app.post("/api/reddit-struggles")
async def reddit_struggles():
    """
    Fetches top posts from r/Discipline and r/getdisciplined via Reddit's
    public JSON endpoint (no API key required), then uses Claude to extract
    and categorise common struggles as content ideas.

    Streams SSE events:
      event: progress  - {message: str}
      event: result    - {categories: [...], total_posts: int}
      event: error     - {message: str}
      event: done      - {}
    """
    def sse(event: str, data: Dict[str, Any]) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def stream():
        import httpx as _httpx

        # Reddit's public JSON API - no auth needed, just a real User-Agent
        headers = {
            "User-Agent": "editorial-pipeline/1.0 (content research tool)",
            "Accept": "application/json",
        }

        # -- Step 1: Fetch posts via public JSON endpoint ---------------------
        all_titles = []
        try:
            async with _httpx.AsyncClient(timeout=30, headers=headers) as http:
                for sub_name in _REDDIT_SUBREDDITS:
                    yield sse("progress", {"message": f"Fetching r/{sub_name}..."})

                    url = (
                        f"https://www.reddit.com/r/{sub_name}/top.json"
                        f"?t=week&limit={_REDDIT_POSTS_PER_SUB}"
                    )
                    resp = await http.get(url)
                    if not resp.is_success:
                        yield sse("error", {"message": f"r/{sub_name} returned {resp.status_code}"})
                        return

                    posts = resp.json().get("data", {}).get("children", [])
                    titles = [
                        p["data"]["title"]
                        for p in posts
                        if not p["data"].get("stickied")
                    ]
                    all_titles.extend(titles)
                    yield sse("progress", {"message": f"r/{sub_name}: {len(titles)} posts collected"})

        except Exception as e:
            yield sse("error", {"message": f"Reddit fetch failed: {e}"})
            return

        if not all_titles:
            yield sse("error", {"message": "No posts found - Reddit may be rate-limiting. Try again in a moment."})
            return

        yield sse("progress", {"message": f"Analysing {len(all_titles)} posts with Claude..."})

        # -- Step 2: Claude categorises the struggles -------------------------
        try:
            titles_text = "\n".join(f"{i+1}. {t}" for i, t in enumerate(all_titles[:100]))

            response = _claude.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=2048,
                # _STRUGGLES_SYSTEM is currently ~350 tokens (below the 1024 cache minimum),
                # but marking it now is harmless and future-proofs any expansions.
                system=[{
                    "type": "text",
                    "text": _STRUGGLES_SYSTEM,
                    "cache_control": {"type": "ephemeral"},
                }],
                messages=[{
                    "role": "user",
                    "content": (
                        f"Here are {len(all_titles)} post titles from r/Discipline and r/getdisciplined "
                        f"(top posts this week):\n\n{titles_text}\n\n"
                        "Identify and categorise the most common struggles. Return the JSON array."
                    ),
                }],
            )

            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            categories = json.loads(raw)

        except Exception as e:
            yield sse("error", {"message": f"Analysis failed: {e}"})
            return

        # Auto-save to ideas pool
        try:
            storage.save_ideas_batch(categories, source="reddit")
        except Exception:
            pass  # Don't fail the stream if saving fails

        yield sse("result", {"categories": categories, "total_posts": len(all_titles)})
        yield sse("done", {})

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.get("/api/ideas")
async def get_ideas(status: str = None, source: str = None):
    """Return all saved ideas, optionally filtered by status or source."""
    return {"ideas": storage.list_ideas(status=status, source=source)}


class IdeaCreate(BaseModel):
    theme: str
    category: str = ""
    emoji: str = "💡"
    article_angle: str = ""
    source: str = "manual"


@app.post("/api/ideas")
async def create_idea(idea: IdeaCreate):
    """Add a manual idea to the pool."""
    idea_id = storage.create_idea(
        theme=idea.theme,
        category=idea.category,
        emoji=idea.emoji,
        article_angle=idea.article_angle,
        source=idea.source,
    )
    return {"id": idea_id}


class IdeaStatusUpdate(BaseModel):
    status: str  # 'new' | 'writing' | 'done'


@app.patch("/api/ideas/{idea_id}")
async def update_idea_status(idea_id: int, body: IdeaStatusUpdate):
    """Update the status of an idea."""
    allowed = {"new", "writing", "done"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")
    storage.update_idea_status(idea_id, body.status)
    return {"ok": True}


@app.delete("/api/ideas/{idea_id}")
async def delete_idea(idea_id: int):
    """Delete an idea from the pool."""
    storage.delete_idea(idea_id)
    return {"ok": True}


class IdeasBatchSave(BaseModel):
    categories: list  # the categories array from /api/reddit-struggles result event


@app.post("/api/ideas/save-batch")
async def save_ideas_batch(body: IdeasBatchSave):
    """
    Save a Reddit batch to the ideas pool with deduplication.
    For each struggle in each category:
      - If a very similar theme already exists (case-insensitive, first 60 chars), increment frequency.
      - Otherwise insert as new idea.
    Returns counts: {saved: int, updated: int, skipped: int}
    """
    return storage.save_ideas_batch(body.categories, source="reddit")


# --- Substack Notes -----------------------------------------------------------

_SUBSTACK_SYSTEM_PROMPT = """You are writing Substack Notes for Camilo Zambrano in a "dinner table talk" voice (warm, grounded, plain language, like talking to a friend). Generate ONE cycle of 20 notes.

Camilo writes about Discipline as a practice of returning to coherence, where actions match our principles.
Returning is the skill that helps us manage drift, is what helps us remain coherent once we have fallen under
the influence of drift.
Comeback speed is the metric we use to measure our discipline, how fast to we come back when we drift.
He created adaptable discipline (www.adaptable-discipline.com), a framework he designed to help people
engineer the conditions that help them to practice discipline, just like a soccer coach would
improve the conditions under which his students would train the soccer skill.
He also created The Way of Realignment, his philosophy on how to practice discipline, based
on neuroscience, behavioral theory, psychology and systems theory. He writes his paid companions
based on this. In there he shares practices that are thought to help train discipline in
a sustainable, repeatable and successful way. Following the analogy of soccer, this is the own
way the coach teaches soccer, the particular drills, plays, etc. This means, that TWOR is
based on the precepts and philosophy behind adaptable discipline.
This means Camilo, besides reframing discipline, also teaches how
to train returning, and how to engineer the conditions for that to stick.

FORMAT (must follow exactly for every note):
🧩 Issue: <specific struggle>
🎯 Intent: <one of: Validation | Education | Practice (Kata) | Reflection | Positive Alignment | Universal Model (A/B/C) | CDT | Metaphor>
🪞 Note:
<3–5 lines max, each line is one complete idea. No poetic line breaks. No clause-splitting for rhythm.>

GLOBAL RULES (non-negotiable):
- The Note MUST explicitly include the Issue context (so it can be posted as-is).
- No "guru" tone, no therapy tone, no professor tone. Sounds like dinner table talk.
- Avoid clichés. Avoid parallelism patterns. Avoid em dashes.
- Avoid empty qualifiers (e.g., quietly, softly, subtly, gently, slowly, calmly, etc.) unless strictly necessary.
- Avoid jargon (especially in CDT notes). If a technical word is used, it must be common and clearly understood.
- Avoid starting every note with "You…". Vary openings naturally.
- Metaphor notes: first name the struggle, THEN introduce the metaphor to illuminate it, and end with a grounded insight. Do not start with "It feels like…" unless the struggle is named first.

CONTENT MIX (20 notes, roughly normal distribution — vary within these ranges):
- CDT notes (2–3): aimed at founders/operators — organizational drift, leadership tension, unclear ownership, coordination breakdown, decision bottlenecks, shifting priorities, misaligned metrics, context gaps, team pace mismatch. Authority must be subtle: show accuracy, don't claim authority.
- Metaphor notes (2–3): anchored and useful, not atmospheric.
- Practice (Kata) notes (3–4): diverse katas (not just breathing). You may include known practices (physiological sigh, box breathing, 5-4-3-2-1, progressive muscle relaxation, orienting response, etc.) and must describe them enough to be usable immediately without turning into a tutorial.
- Education notes (2–3): must explicitly name one mental model or neuroscience concept (e.g., Zeigarnik Effect, Negativity Bias, Switching Cost, Choice Overload, Cognitive Tunneling, Planning Fallacy, Window of Tolerance, Co-regulation, etc.) and explain it in plain language.
- Positive Alignment notes (3–4): praise "micro-discipline" beyond conflict (autopilot interruptions like pantry/fridge/phone, closing tabs, picking up a small mess, putting something back, choosing the small version of a habit, etc.).
- Reflection/Validation notes (3–4): personal, relatable, emotionally safe.
- Universal Model notes (2–3): include at least one Level A, one Level B, one Level C across the set.
  - A = lightly conceptual but simple.
  - B = grounded, minimal theory language.
  - C = fully human, no theory terms.

ADDITIONAL CONTEXT FOR CDT NOTES:
CDT assumes drift is present in all human systems (individuals, relationships, teams, orgs). Drift is not failure; it's data. Systems need detection and return loops. Apply this lens to companies and teams in a founder-friendly way.

OUTPUT:
Only output the 20 notes in the specified format. Separate notes with a blank line and "---". No preface, no explanation, no numbering."""


def _parse_substack_notes(raw: str) -> List[Dict[str, Any]]:
    """Parse the Claude response into a list of note dicts."""
    notes = []
    blocks = [b.strip() for b in raw.split("---") if b.strip()]
    for block in blocks:
        lines = block.splitlines()
        issue, intent, note_lines = "", "", []
        in_note = False
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("🧩 Issue:"):
                issue = stripped[len("🧩 Issue:"):].strip()
                in_note = False
            elif stripped.startswith("🎯 Intent:"):
                intent = stripped[len("🎯 Intent:"):].strip()
                in_note = False
            elif stripped.startswith("🪞 Note:"):
                in_note = True
                remainder = stripped[len("🪞 Note:"):].strip()
                if remainder:
                    note_lines.append(remainder)
            elif in_note and stripped:
                note_lines.append(stripped)
        if issue and intent and note_lines:
            notes.append({"issue": issue, "intent": intent, "note_text": "\n".join(note_lines)})
    return notes


def _parse_batch_repurpose(raw: str, notes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Parse block-formatted batch repurpose response into per-note dicts."""
    results = []
    for i, note in enumerate(notes):
        n = i + 1
        # Find the block for NOTE N
        block_pat = rf"NOTE\s+{n}\s*:\s*\n([\s\S]*?)(?=NOTE\s+\d+\s*:|$)"
        block_m = re.search(block_pat, raw, re.IGNORECASE)
        block = block_m.group(1) if block_m else ""

        def extract(label: str) -> str:
            m = re.search(rf"{label}\s*:\s*\n([\s\S]*?)(?=\n(?:LINKEDIN|THREADS|INSTAGRAM):|$)", block, re.IGNORECASE)
            return m.group(1).strip() if m else ""

        results.append({
            "id": note.get("id"),
            "linkedin": extract("LINKEDIN"),
            "threads": extract("THREADS"),
            "instagram": extract("INSTAGRAM"),
        })
    return results


@app.post("/api/substack-notes/generate")
async def generate_substack_notes():
    """Call Claude to generate a batch of 20 Substack notes, parse, save, and auto-repurpose."""
    try:
        response = _claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=_SUBSTACK_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": "Generate 20 Substack notes now."}],
        )
        raw = response.content[0].text if response.content else ""
        notes = _parse_substack_notes(raw)
        if not notes:
            raise HTTPException(status_code=500, detail="Failed to parse any notes from Claude response.")
        batch_id = storage.save_substack_batch(notes)

        # Fetch saved notes with IDs for batch repurpose
        saved_notes = storage.get_substack_notes(batch_id)

        # Build batch repurpose prompt
        note_blocks = "\n\n".join(
            f"NOTE {i+1}:\n{n['note_text']}" for i, n in enumerate(saved_notes)
        )
        repurpose_prompt = f"""For each of these {len(saved_notes)} Substack Notes, generate LinkedIn, Threads, and Instagram variants.

Use the same voice: direct, warm, "dinner table talk." Each variant must stand alone.

LinkedIn: 3-5 short paragraphs, insightful, no hashtags, max 1500 chars.
Threads: punchy, one idea, max 400 chars, no hashtags.
Instagram: warm, ends with reflection prompt, 150-300 chars, then 5-8 hashtags on new line.

{note_blocks}

Output exactly:
NOTE 1:
LINKEDIN:
<text>
THREADS:
<text>
INSTAGRAM:
<text>
... (repeat for each note)"""

        repurposed = False
        try:
            rep_response = _claude.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=7000,
                messages=[{"role": "user", "content": repurpose_prompt}],
            )
            rep_raw = rep_response.content[0].text if rep_response.content else ""
            parsed = _parse_batch_repurpose(rep_raw, saved_notes)
            for item in parsed:
                if item["id"] and (item["linkedin"] or item["threads"] or item["instagram"]):
                    storage.save_substack_repurpose(item["id"], item["linkedin"], item["threads"], item["instagram"])
            repurposed = True
        except Exception:
            pass  # Repurpose failure is non-fatal

        return {"ok": True, "batch_id": batch_id, "note_count": len(notes), "repurposed": repurposed}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/substack-notes/search")
async def search_substack_notes(
    q: str = "",
    shared: str = "",
    repurposed: str = "",
    signal: str = "",
):
    notes = storage.search_substack_notes(
        q=q,
        shared=shared == "1",
        repurposed=repurposed == "1",
        signal=signal or None,
    )
    return {"notes": notes}


@app.get("/api/substack-notes/batches")
async def list_substack_batches():
    return {"batches": storage.list_substack_batches()}


@app.get("/api/substack-notes/batches/{batch_id}")
async def get_substack_notes(batch_id: int):
    return {"notes": storage.get_substack_notes(batch_id)}


class SubstackNoteUpdate(BaseModel):
    shared: Optional[bool] = None
    signal: Optional[str] = None
    note_text: Optional[str] = None


@app.patch("/api/substack-notes/{note_id}")
async def update_substack_note(note_id: int, body: SubstackNoteUpdate):
    storage.update_substack_note(note_id, shared=body.shared, signal=body.signal, note_text=body.note_text)
    return {"ok": True}


@app.delete("/api/substack-notes/{note_id}")
async def delete_substack_note(note_id: int):
    storage.delete_substack_note(note_id)
    return {"ok": True}


@app.delete("/api/substack-notes/batches/{batch_id}")
async def delete_substack_batch(batch_id: int):
    storage.delete_substack_batch(batch_id)
    return {"ok": True}


@app.post("/api/substack-notes/{note_id}/repurpose")
async def repurpose_substack_note(note_id: int):
    """Adapt a Substack note into LinkedIn, Threads, and Instagram post formats."""
    with storage._connect() as conn:
        row = conn.execute("SELECT * FROM substack_notes WHERE id=?", (note_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Note not found")
    note = dict(row)

    prompt = f"""You are adapting a Substack Note written by Camilo Zambrano into three social media formats.

ORIGINAL NOTE:
Issue: {note['issue']}
Intent: {note['intent']}
Note:
{note['note_text']}

Produce exactly three sections in this format:

LINKEDIN:
<Professional LinkedIn post. 3-5 short paragraphs. Insightful, direct, no corporate fluff. Can include a brief hook line. Max 1500 chars. No hashtags.>

THREADS:
<Punchy Threads post. Conversational, single idea, max 400 chars. No hashtags.>

INSTAGRAM:
<Instagram caption. Engaging, warm, ends with a subtle call-to-action or reflection prompt. 150-300 chars. Then add 5-8 relevant hashtags on a new line.>

Use the same "dinner table talk" voice as the original. Each format must stand alone — include the core insight without referencing the others. Output only the three labeled sections."""

    try:
        response = _claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text if response.content else ""

        def extract(label: str) -> str:
            import re
            m = re.search(rf"{label}:\s*\n([\s\S]*?)(?=\n(?:LINKEDIN|THREADS|INSTAGRAM):|$)", raw, re.IGNORECASE)
            return m.group(1).strip() if m else ""

        linkedin = extract("LINKEDIN")
        threads = extract("THREADS")
        instagram = extract("INSTAGRAM")

        storage.save_substack_repurpose(note_id, linkedin, threads, instagram)
        return {"ok": True, "linkedin": linkedin, "threads": threads, "instagram": instagram}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/substack-notes/{note_id}/promote")
async def promote_substack_note_to_idea(note_id: int):
    """Promote a note to the Ideas pool as an article prompt."""
    with storage._connect() as conn:
        row = conn.execute("SELECT * FROM substack_notes WHERE id=?", (note_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Note not found")
    note = dict(row)
    idea_id = storage.create_idea(
        theme=note["issue"],
        category="Substack Note",
        emoji="📝",
        article_angle=f"[{note['intent']}] {note['note_text'][:120]}",
        source="substack_note",
    )
    return {"ok": True, "idea_id": idea_id}


# --- Social compose repurpose ------------------------------------------------

class ComposeRepurposeRequest(BaseModel):
    text: str
    platform: str


@app.post("/api/social/compose/repurpose")
async def compose_repurpose(body: ComposeRepurposeRequest):
    """Repurpose a composed post to the other 3 platforms."""
    plat_labels = {
        "substack_note": "Substack Note",
        "linkedin": "LinkedIn",
        "threads": "Threads",
        "instagram": "Instagram",
    }
    all_platforms = ["substack_note", "linkedin", "threads", "instagram"]
    targets = [p for p in all_platforms if p != body.platform]
    target_names = [plat_labels[p] for p in targets]

    prompt = f"""You are adapting a social media post into {len(targets)} platform variants.

ORIGINAL ({plat_labels.get(body.platform, body.platform)}):
{body.text}

Produce exactly these sections:

LINKEDIN:
<Professional LinkedIn post. 3-5 short paragraphs. Insightful, direct, no corporate fluff. Max 1500 chars. No hashtags.>

THREADS:
<Punchy Threads post. Conversational, single idea, max 400 chars. No hashtags.>

INSTAGRAM:
<Instagram caption. Engaging, warm, ends with a subtle reflection prompt. 150-300 chars. Then 5-8 relevant hashtags on a new line.>

SUBSTACK_NOTE:
<Substack Note. Reflective, personal, conversational. 150-400 chars. No hashtags.>

Use the same voice as the original. Each format must stand alone. Output only the four labeled sections."""

    try:
        response = _claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text if response.content else ""

        def extract(label: str) -> str:
            m = re.search(
                rf"{label}\s*:\s*\n([\s\S]*?)(?=\n(?:LINKEDIN|THREADS|INSTAGRAM|SUBSTACK_NOTE)\s*:|$)",
                raw, re.IGNORECASE
            )
            return m.group(1).strip() if m else ""

        result = {
            "linkedin": extract("LINKEDIN") if body.platform != "linkedin" else "",
            "threads": extract("THREADS") if body.platform != "threads" else "",
            "instagram": extract("INSTAGRAM") if body.platform != "instagram" else "",
            "substack_note": extract("SUBSTACK_NOTE") if body.platform != "substack_note" else "",
        }
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Substack connection test ------------------------------------------------

@app.post("/api/substack/test")
async def test_substack_connection():
    """Verify the SUBSTACK_SESSION_COOKIE is valid."""
    try:
        result = substack_client.test_connection()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Substack audience -------------------------------------------------------

@app.get("/api/substack/insights")
async def get_audience_insights():
    """Compute audience insights from enriched profiles + AI recommendations."""
    import json as _json
    try:
        stats = storage.get_insights_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if stats.get("enriched_count", 0) < 10:
        stats["recommendations"] = []
        return stats

    top = stats.get("top_segment", {})
    top_countries = ", ".join(f"{c} ({n})" for c, n in top.get("top_countries", [])[:3]) or "unknown"
    top_attr = ", ".join(f"{a} ({n})" for a, n in top.get("top_attribution", [])[:3]) or "unknown"
    best_cohort = stats.get("best_cohort") or "unknown"

    prompt = f"""You are advising a Substack newsletter author on audience growth strategy.

AUDIENCE DATA (from {stats['enriched_count']} enriched subscriber profiles):
- Average open rate: {stats['avg_open_rate']}%
- Average click rate: {stats['avg_click_rate']}%
- Average re-open ratio: {stats['avg_reopen_rate']}x (>1 means readers re-open emails)
- Top segment (activity 4-5): {top['count']} subscribers ({top['pct']}% of enriched)
  - {top['creator_pct']}% are creators (have their own Substack publication)
  - {top['paid_pct']}% are paid subscribers
  - Top countries: {top_countries}
  - Acquired via: {top_attr}
- At-risk readers (engaged before, gone cold 45+ days): {stats['at_risk_count']}
- Web readers (read on site, not just email): {stats['web_reader_pct']}%
- Commenters: {stats['commenters_count']} | Sharers: {stats['sharers_count']}
- Best subscriber cohort (highest avg engagement): {best_cohort}

The newsletter is about self-discipline and personal development. The author publishes Substack Notes to grow their audience.

Generate exactly 6 recommendations — 3 to ATTRACT similar new readers, 3 to RETAIN existing ones.
Each must be specific and directly tied to the data above. No generic advice.

Return ONLY valid JSON, no markdown fences:
[
  {{"type":"attract","title":"...","action":"...","why":"..."}} ,
  ...
]
Fields: type (attract|retain), title (short label), action (1-2 sentence concrete step), why (1 sentence data-backed reason)."""

    try:
        resp = _claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        start, end = raw.find("["), raw.rfind("]") + 1
        recs = _json.loads(raw[start:end])
    except Exception:
        recs = []

    stats["recommendations"] = recs
    return stats


@app.get("/api/substack/audience")
async def get_substack_audience():
    """Return aggregated audience stats from the locally cached subscribers table."""
    try:
        return storage.get_audience_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Subscriber browser ------------------------------------------------------

@app.post("/api/substack/subscribers/sync")
async def sync_subscribers():
    """Paginate Substack subscriber-stats and upsert all into SQLite."""
    try:
        all_subs: list = []
        offset, limit = 0, 100
        total = None
        while True:
            page = substack_client.get_subscriber_page(offset=offset, limit=limit)
            if total is None:
                total = page.get("count", 0)
            batch = page.get("subscribers", [])
            all_subs.extend(batch)
            offset += limit
            if not batch or offset >= (total or 0):
                break
        saved = storage.upsert_subscribers(all_subs)
        return {"ok": True, "synced": saved, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/substack/subscribers")
async def list_subscribers(
    q: str = "",
    activity: Optional[int] = None,
    interval: str = "",
    offset: int = 0,
    limit: int = 50,
):
    """List cached subscribers from SQLite with optional search/filter."""
    try:
        result = storage.get_subscribers(
            search=q, activity=activity, interval=interval, offset=offset, limit=limit
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/substack/subscribers/{email}/detail")
async def subscriber_detail(email: str):
    """Lazy-fetch individual subscriber detail; cache in SQLite."""
    import urllib.parse as _up
    email = _up.unquote(email)
    try:
        row = storage.get_subscriber(email)
        # Return cached detail if fresh (< 7 days)
        if row and row.get("detail_synced_at"):
            import datetime as _dt
            age = (_dt.datetime.utcnow() - _dt.datetime.fromisoformat(row["detail_synced_at"].rstrip("Z"))).days
            if age < 7:
                import json as _json
                detail = _json.loads(row["detail_json"]) if row.get("detail_json") else {}
                return {"ok": True, "cached": True, "subscriber": row, "detail": detail}
        # Fetch live
        detail = substack_client.get_subscriber_detail(email)
        if detail:
            storage.save_subscriber_detail(email, detail)
            row = storage.get_subscriber(email)
        return {"ok": True, "cached": False, "subscriber": row or {}, "detail": detail}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Quotes API --------------------------------------------------------------

@app.get("/api/quotes")
async def list_quote_runs():
    """List all runs that have extracted quotes, newest first."""
    return {"runs": storage.list_quote_runs()}


@app.get("/api/quotes/{run_id}")
async def get_quotes_for_run(run_id: int):
    """Get all quotes for a specific run."""
    return {"quotes": storage.get_quotes_for_run(run_id)}


class QuoteUpdate(BaseModel):
    shared: Optional[bool] = None
    signal: Optional[str] = None


@app.patch("/api/quotes/{quote_id}")
async def update_quote(quote_id: int, body: QuoteUpdate):
    updates = {}
    if body.shared is not None:
        updates["shared"] = 1 if body.shared else 0
    if body.signal is not None:
        updates["signal"] = body.signal
    if updates:
        storage.update_quote(quote_id, **updates)
    return {"ok": True}


class QuoteRepurposeRequest(BaseModel):
    quote_text: str
    context: str = ""
    article_title: str = ""
    article_url: str = ""


@app.post("/api/quotes/{quote_id}/repurpose")
async def repurpose_quote(quote_id: int, body: QuoteRepurposeRequest):
    """Generate LinkedIn, Threads, and Instagram posts from a quote."""
    try:
        prompt = (
            f"Turn this quote into short social media posts.\n\n"
            f"Quote: \"{body.quote_text}\"\n"
            f"Context: {body.context}\n"
            f"Article: {body.article_title}\n\n"
            + generator.VOICE_BRIEF +
            "\nWrite three posts:\n\n"
            "LINKEDIN:\n"
            "1,000–1,500 characters. Expand on the idea with a professional angle. "
            "No hashtags.\n\n"
            "THREADS:\n"
            "Under 400 characters. Sharp, standalone. No hashtags.\n\n"
            "INSTAGRAM:\n"
            "150–300 characters. Hook-first. End with 5–8 targeted hashtags on a new line.\n\n"
            "Format your response EXACTLY as:\n"
            "LINKEDIN:\n[post text]\n\nTHREADS:\n[post text]\n\nINSTAGRAM:\n[post text]"
        )
        response = _claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text

        def extract(label: str) -> str:
            m = re.search(rf"{label}:\s*\n([\s\S]*?)(?=\n(?:LINKEDIN|THREADS|INSTAGRAM):|$)", raw, re.IGNORECASE)
            return m.group(1).strip() if m else ""

        linkedin = extract("LINKEDIN")
        threads = extract("THREADS")
        instagram = extract("INSTAGRAM")

        storage.update_quote(quote_id, linkedin=linkedin, threads=threads, instagram=instagram)
        return {"ok": True, "linkedin": linkedin, "threads": threads, "instagram": instagram}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/quotes/{quote_id}/promote")
async def promote_quote_to_idea(quote_id: int):
    """Promote a quote to the Ideas pool."""
    with storage._connect() as conn:
        row = conn.execute("SELECT * FROM article_quotes WHERE id=?", (quote_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Quote not found")
    q = dict(row)
    idea_id = storage.create_idea(
        theme=q["article_title"] or "Quote",
        category="Quote",
        emoji="💬",
        article_angle=q["quote_text"][:200],
        source="quote",
    )
    return {"ok": True, "idea_id": idea_id}


# --- Pipeline core -----------------------------------------------------------

def _build_pipeline_stream(
    reflection_text: str,
    reflection_title: str,
    article_url: str,
    include_spanish: bool,
    schedule_to_buffer: bool,
    checkpoint_data: Optional[Dict[str, Any]] = None,
    tone_level: int = None,
):
    """
    Builds the SSE streaming generator for the full pipeline.
    Resets token log before each run. Saves token summary with history on completion.
    """
    global _cancel_event

    if not TEMPLATE_PATH.exists():
        def error_stream():
            yield f"event: error\ndata: {json.dumps({'message': 'Companion template not found. Upload it in Settings first.'})}\n\n"
        return error_stream()

    template = TEMPLATE_PATH.read_text(encoding="utf-8")

    try:
        articles = scraper.fetch_articles()
    except Exception as e:
        def error_stream():
            yield f"event: error\ndata: {json.dumps({'message': f'Failed to load article index: {str(e)}'})}\n\n"
        return error_stream()

    # Apply tone if provided
    if tone_level is not None:
        generator.set_tone_level(tone_level)

    # Reset token tracking for this run
    generator.reset_token_log()

    # Create a fresh cancel event for this run
    with _cancel_lock:
        _cancel_event = threading.Event()
    cancel_ev = _cancel_event

    checkpoint_meta = {
        "timestamp": datetime.now().isoformat(),
        "reflection_title": reflection_title,
        "article_url": article_url,
        "include_spanish": include_spanish,
        "reflection": reflection_text,
        "data": dict(checkpoint_data) if checkpoint_data else {},
    }

    def on_step_complete(key: str, data):
        checkpoint_meta["data"][key] = data
        if key in _CHECKPOINT_PERSIST_KEYS:
            storage.save_checkpoint(checkpoint_meta)

    def stream():
        try:
            final_result = None

            for chunk in generator.run_full_pipeline_stream(
                reflection=reflection_text,
                reflection_title=reflection_title,
                article_url=article_url,
                template=template,
                articles=articles,
                include_spanish=include_spanish,
                checkpoint=checkpoint_data,
                on_step_complete=on_step_complete,
                cancel_event=cancel_ev,
            ):
                yield chunk
                if chunk.startswith("event: result"):
                    data_line = chunk.split("\ndata: ", 1)[1].strip()
                    final_result = json.loads(data_line)

            if cancel_ev.is_set():
                yield f"event: cancelled\ndata: {{}}\n\n"
                return

            # Pipeline completed - clear checkpoint, save to history with tokens
            storage.clear_checkpoint()

            token_summary = generator.get_token_summary()

            if final_result:
                try:
                    run_id = storage.save_run(reflection_title, article_url, final_result, token_summary)
                    quotes = final_result.get("quotes") or []
                    if quotes:
                        storage.save_quotes(run_id, reflection_title, article_url, quotes)
                except Exception:
                    pass

            # Emit token summary so the UI can display cost
            yield f"event: tokens\ndata: {json.dumps(token_summary)}\n\n"

            # Optionally publish to social platforms
            if schedule_to_buffer and final_result:
                yield f"event: progress\ndata: {json.dumps({'message': 'Publishing to social platforms...', 'done': False})}\n\n"
                try:
                    reflection_date = social_client.get_next_weekday(
                        REFLECTION_DAY, *map(int, REFLECTION_TIME.split(":"))
                    )
                    companion_date = social_client.get_next_weekday(
                        COMPANION_DAY, *map(int, COMPANION_TIME.split(":"))
                    )
                    schedule_results = {
                        "reflection": social_client.schedule_all_repurposed(
                            repurposed_en=final_result["reflection"]["repurposed_en"],
                            repurposed_es=final_result["reflection"]["repurposed_es"],
                            base_date=reflection_date,
                        ),
                        "companion": social_client.schedule_all_repurposed(
                            repurposed_en=final_result["companion"]["repurposed_en"],
                            repurposed_es=final_result["companion"]["repurposed_es"],
                            base_date=companion_date,
                        ),
                    }
                    yield f"event: progress\ndata: {json.dumps({'message': 'Published to social platforms', 'done': True})}\n\n"
                    yield f"event: schedule\ndata: {json.dumps(schedule_results)}\n\n"
                except Exception as e:
                    yield f"event: progress\ndata: {json.dumps({'message': f'Publish error: {str(e)}', 'done': True})}\n\n"

            yield f"event: done\ndata: {{}}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

    return stream()


# --- Pipeline endpoints -------------------------------------------------------

@app.post("/api/pipeline/run")
async def run_pipeline(
    reflection: UploadFile = File(...),
    title: str = Form(...),
    article_url: str = Form(default=""),
    schedule_to_buffer: str = Form(default="false"),
    include_spanish: str = Form(default="true"),
    tone_level: str = Form(default=""),
):
    reflection_text = (await reflection.read()).decode("utf-8")
    do_schedule = schedule_to_buffer.lower() == "true"
    do_spanish = include_spanish.lower() == "true"
    tone = int(tone_level) if tone_level.strip().isdigit() else None

    return StreamingResponse(
        _build_pipeline_stream(
            reflection_text, title, article_url, do_spanish, do_schedule,
            tone_level=tone,
        ),
        media_type="text/event-stream",
    )


@app.post("/api/pipeline/resume")
async def resume_pipeline():
    cp = storage.load_checkpoint()
    if not cp:
        raise HTTPException(status_code=404, detail="No checkpoint found")

    return StreamingResponse(
        _build_pipeline_stream(
            reflection_text=cp.get("reflection", ""),
            reflection_title=cp.get("reflection_title", ""),
            article_url=cp.get("article_url", ""),
            include_spanish=cp.get("include_spanish", True),
            schedule_to_buffer=False,
            checkpoint_data=cp.get("data", {}),
        ),
        media_type="text/event-stream",
    )


# --- Run ---------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
