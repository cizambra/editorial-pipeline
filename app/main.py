# -*- coding: utf-8 -*-
from __future__ import annotations

"""
main.py - FastAPI backend for the Editorial Pipeline.
Run with: python -m uvicorn app.main:app --reload
"""

import os
from datetime import datetime
from pathlib import Path

from contextlib import asynccontextmanager

from app.core.env import load_environment

load_environment()

from fastapi import FastAPI, Request, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
import uuid
from app.core import auth, prompt_state
from app.core.ai_clients import get_claude_client
from app.core.logging import bind_log_context, configure_logging, reset_log_context
from app.services import imagen_client
from app.persistence import storage
from app.api.routes.auth import (
    router as auth_router,
    LoginRequest,
    SupabaseLoginRequest,
    CreateUserRequest,
    UpdateUserRequest,
    CreateInviteRequest,
    AcceptInviteRequest,
    PasswordResetRequest,
    auth_me,
    auth_login,
    auth_login_supabase,
    auth_logout,
    auth_list_users,
    auth_create_user,
    auth_update_user,
    auth_create_invite,
    auth_resend_invite,
    auth_revoke_invite,
    auth_accept_invite,
    auth_password_reset,
    auth_list_audit_events,
)
from app.api.routes.settings import (
    router as settings_router,
    get_articles,
    inspect_uploaded_file,
    refresh_articles,
    index_new_articles,
    fetch_article_content,
    get_dashboard,
    get_template,
    upload_template,
    get_config,
    post_config,
)
from app.api.routes.operations import (
    router as operations_router,
    SaveThumbnailRequest,
    IdeaCreate,
    IdeaStatusUpdate,
    IdeasBatchSave,
    get_history,
    get_history_run,
    get_marketing_library,
    delete_history_run,
    save_thumbnail,
    list_thumbnails,
    get_thumbnail,
    delete_thumbnail,
    get_current_tokens,
    post_feedback,
    get_feedback_summary,
    get_social_status,
    debug_threads,
    publish_to_social,
    schedule_social_post,
    list_scheduled,
    list_published,
    cancel_scheduled,
    delete_scheduled,
    get_ideas,
    create_idea,
    update_idea_status,
    delete_idea,
    save_ideas_batch,
)
from app.api.routes.media import router as media_router
from app.api.routes.content import (
    router as content_router,
    generate_substack_notes,
    search_substack_notes,
    list_substack_batches,
    get_substack_notes,
    update_substack_note,
    delete_substack_note,
    delete_substack_batch,
    repurpose_substack_note,
    promote_substack_note_to_idea,
    compose_repurpose,
    test_substack_connection,
    get_audience_insights,
    get_substack_audience,
    sync_subscribers,
    list_subscribers,
    subscriber_detail,
    list_quote_runs,
    get_quotes_for_run,
    update_quote,
    repurpose_quote,
    promote_quote_to_idea,
)
from app.api.routes.content import (
    QuoteUpdate,
    QuoteRepurposeRequest,
    ComposeRepurposeRequest,
    SubstackNoteUpdate,
)
from app.api.routes.pipeline import (
    router as pipeline_router,
    get_checkpoint,
    clear_checkpoint,
    cancel_pipeline,
    regenerate_platform,
    repurpose_from_archive,
    generate_companion_only,
)
from app.core.settings import get_settings
from app.services.pipeline import _queue_repurposed_bundle, build_pipeline_stream as _build_pipeline_stream
from app.workers.scheduler import create_scheduler

_settings = get_settings()
configure_logging()
_settings.validate()

_scheduler = create_scheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.init_db()
    storage.fail_all_running_runs()
    if _settings.auth_mode == "local" and _settings.bootstrap_admin_email and _settings.bootstrap_admin_password:
        storage.ensure_bootstrap_user(auth.hash_password(_settings.bootstrap_admin_password))
    _settings.static_generated_dir.mkdir(parents=True, exist_ok=True)
    prompt_state.initialize_runtime()
    _scheduler.start()
    try:
        yield
    finally:
        _scheduler.shutdown(wait=False)
        storage.close_db()


app = FastAPI(title="Editorial Pipeline", lifespan=lifespan)

_STATIC_DIR = Path(__file__).parent.parent / "static"
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

# Serve React build — absolute path so it works regardless of CWD
_REACT_INDEX = Path(__file__).parent.parent / "static" / "dist" / "index.html"

# --- Image pricing (gpt-image-1, 1536x1024) ----------------------------------
# https://openai.com/api/pricing  (portrait/landscape sizes)
_IMG_PRICE_MEDIUM = 0.063   # per image, medium quality
_IMG_PRICE_HIGH   = 0.250   # per image, high quality


# --- Routes ------------------------------------------------------------------

_PUBLIC_API_PATHS = {
    "/api/auth/login",
    "/api/auth/login/supabase",
    "/api/auth/logout",
    "/api/auth/me",
    "/api/auth/invites/accept",
}

class AuthEnforcerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/") and request.url.path not in _PUBLIC_API_PATHS:
            if not auth.current_user_from_request(request):
                return JSONResponse(status_code=401, content={"detail": "Authentication required"})
        return await call_next(request)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        user = auth.current_user_from_request(request)
        token = bind_log_context(
            request_id=request.headers.get("x-request-id") or str(uuid.uuid4()),
            method=request.method,
            path=request.url.path,
            user_id=user.get("id") if isinstance(user, dict) else None,
            user_role=user.get("role") if isinstance(user, dict) else None,
        )
        try:
            return await call_next(request)
        finally:
            reset_log_context(token)


app.add_middleware(AuthEnforcerMiddleware)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    SessionMiddleware,
    secret_key=_settings.session_secret,
    same_site="lax",
    https_only=_settings.app_env == "production",
)

app.include_router(auth_router)
app.include_router(settings_router)
app.include_router(operations_router)
app.include_router(media_router)
app.include_router(content_router)
app.include_router(pipeline_router)

templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    import logging
    if _REACT_INDEX.exists():
        logging.info(f"Serving React app from {_REACT_INDEX}")
        return HTMLResponse(_REACT_INDEX.read_text())
    logging.warning(f"React build not found at {_REACT_INDEX}, falling back to Jinja2 template")
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/invite", response_class=HTMLResponse)
async def invite_page(request: Request):
    return templates.TemplateResponse(
        "invite.html",
        {
            "request": request,
            "invite_token": request.query_params.get("token", ""),
            "auth_mode": _settings.auth_mode,
        },
    )


@app.get("/healthz")
async def healthz():
    return {
        "status": "ok",
        "service": "editorial-pipeline",
        "auth_mode": _settings.auth_mode,
        "scheduler_running": bool(getattr(_scheduler, "running", False)),
    }


@app.get("/readyz")
async def readyz():
    try:
        storage.database_ready()
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "database": "error",
                "detail": str(exc),
            },
        )
    return {
        "status": "ready",
        "database": "ok",
        "auth_mode": _settings.auth_mode,
        "scheduler_running": bool(getattr(_scheduler, "running", False)),
    }


@app.get("/{full_path:path}", response_class=HTMLResponse)
async def spa_fallback(request: Request, full_path: str):
    # Don't intercept API, static, or health routes
    if full_path.startswith(("api/", "static/", "healthz", "readyz", "invite")):
        raise HTTPException(status_code=404)
    if _REACT_INDEX.exists():
        return HTMLResponse(_REACT_INDEX.read_text())
    return templates.TemplateResponse("index.html", {"request": request})


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
        msg = await run_in_threadpool(
            lambda: get_claude_client().messages.create(
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
        )
        prompt = msg.content[0].text.strip()

    try:
        image_bytes = await run_in_threadpool(imagen_client.generate_image, prompt, aspect_ratio)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    filename = uuid.uuid4().hex + ".jpg"
    filepath = Path("static/generated") / filename
    filepath.write_bytes(image_bytes)

    return {"local_url": f"/static/generated/{filename}", "prompt_used": prompt}


async def run_pipeline(
    reflection,
    title: str,
    article_url: str = "",
    queue_social: str = "false",
    include_spanish: str = "true",
    tone_level: str = "",
):
    reflection_text = (await reflection.read()).decode("utf-8")
    do_queue_social = queue_social.lower() == "true"
    do_spanish = include_spanish.lower() == "true"
    tone = int(tone_level) if tone_level.strip().isdigit() else None

    return StreamingResponse(
        _build_pipeline_stream(
            reflection_text,
            title,
            article_url,
            do_spanish,
            do_queue_social,
            tone_level=tone,
        ),
        media_type="text/event-stream",
    )


async def resume_pipeline():
    checkpoint = storage.load_checkpoint()
    if not checkpoint:
        raise HTTPException(status_code=404, detail="No checkpoint found")

    return StreamingResponse(
        _build_pipeline_stream(
            reflection_text=checkpoint.get("reflection", ""),
            reflection_title=checkpoint.get("reflection_title", ""),
            article_url=checkpoint.get("article_url", ""),
            include_spanish=checkpoint.get("include_spanish", True),
            queue_social=False,
            checkpoint_data=checkpoint.get("data", {}),
        ),
        media_type="text/event-stream",
    )

# --- Run ---------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=_settings.host, port=_settings.port, reload=_settings.reload)
