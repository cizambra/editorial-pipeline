from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.core import auth
from app.core.logging import get_logger
from app.api.routes import media as media_routes
from app.persistence import storage
from app.services import generator, social_client, threads_client


router = APIRouter()
_logger = get_logger("editorial.routes.operations")


class SaveThumbnailRequest(BaseModel):
    article_title: str
    article_url: str = ""
    concept_name: str = ""
    image_b64: str


class IdeaCreate(BaseModel):
    theme: str
    category: str = ""
    emoji: str = "💡"
    article_angle: str = ""
    source: str = "manual"


class IdeaStatusUpdate(BaseModel):
    status: str


class IdeasBatchSave(BaseModel):
    categories: list


@router.get("/api/history")
async def get_history():
    return {"runs": await run_in_threadpool(storage.list_history_runs, 50)}


@router.get("/api/history/{run_id}")
async def get_history_run(run_id: int):
    run = await run_in_threadpool(storage.get_history_run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/api/marketing/library")
async def get_marketing_library():
    return {"runs": await run_in_threadpool(storage.list_marketing_runs, 100)}


@router.post("/api/history/{run_id}/thumbnail-concepts")
async def save_run_thumbnail_concepts(run_id: int, body: dict):
    concepts = body.get("concepts")
    if not isinstance(concepts, list):
        raise HTTPException(status_code=400, detail="concepts must be a list")
    await run_in_threadpool(storage.patch_run_data, run_id, {"thumbnail_concepts": concepts})
    return {"ok": True}


@router.delete("/api/history/{run_id}")
async def delete_history_run(run_id: int, request: Request = None):
    if request is not None:
        auth.require_superadmin(request)
    await run_in_threadpool(storage.delete_history_run, run_id)
    _logger.info("History run deleted", extra={"fields": {"run_id": run_id}})
    return {"message": "Run deleted"}


@router.post("/api/thumbnails/save")
async def save_thumbnail(req: SaveThumbnailRequest):
    saved = await run_in_threadpool(
        storage.save_thumbnail,
        req.article_title,
        req.article_url,
        req.concept_name,
        req.image_b64,
    )
    return {
        "id": saved["id"],
        "created": saved["created"],
        "message": "Saved" if saved["created"] else "Already saved",
    }


@router.get("/api/thumbnails")
async def list_thumbnails(q: str = "", limit: int = 100):
    return {"thumbnails": await run_in_threadpool(storage.list_thumbnails, q, limit)}


@router.get("/api/thumbnails/{thumb_id}")
async def get_thumbnail(thumb_id: int):
    thumbnail = await run_in_threadpool(storage.get_thumbnail, thumb_id)
    if not thumbnail:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return thumbnail


@router.delete("/api/thumbnails/{thumb_id}")
async def delete_thumbnail(thumb_id: int, request: Request = None):
    if request is not None:
        auth.require_superadmin(request)
    await run_in_threadpool(storage.delete_thumbnail, thumb_id)
    _logger.info("Thumbnail deleted", extra={"fields": {"thumbnail_id": thumb_id}})
    return {"message": "Deleted"}


@router.get("/api/tokens/current")
async def get_current_tokens():
    return await run_in_threadpool(generator.get_token_summary)


@router.post("/api/feedback")
async def post_feedback(body: dict):
    await run_in_threadpool(
        storage.save_feedback,
        run_title=body.get("run_title", ""),
        platform=body.get("platform", ""),
        source=body.get("source", ""),
        language=body.get("language", ""),
        post_index=int(body.get("post_index", 0)),
        rating=int(body.get("rating", 0)),
        preview=str(body.get("preview", "")),
    )
    return {"message": "Feedback saved"}


@router.get("/api/feedback/summary")
async def get_feedback_summary():
    return {"summary": await run_in_threadpool(storage.get_feedback_summary)}


@router.get("/api/social/status")
async def get_social_status():
    return await run_in_threadpool(social_client.get_status)


@router.get("/api/social/debug/threads")
async def debug_threads(request: Request = None):
    if request is not None:
        auth.require_superadmin(request)
    session_id = os.getenv("THREADS_SESSION_ID", "")
    try:
        cookies = await run_in_threadpool(threads_client._cookies)
    except Exception as exc:
        _logger.exception("Threads debug cookie build failed")
        return {"error": f"Cookie build failed: {exc}"}

    kw = {"impersonate": threads_client._IMPERSONATE} if threads_client._IMPERSONATE else {}
    try:
        import time as _time
        resp = await run_in_threadpool(
            lambda: threads_client._req.post(
                threads_client._API_URL,
                headers=threads_client._headers(),
                data={
                    "audience": "default",
                    "caption": "__debug_test__",
                    "publish_mode": "text_post",
                    "upload_id": str(int(_time.time() * 1000)),
                    "jazoest": threads_client._jazoest(os.getenv("THREADS_CSRF_TOKEN", "")),
                    "text_post_app_info": '{"reply_control":0,"text_with_entities":{"entities":[],"text":"__debug_test__"}}',
                    "web_session_id": threads_client._random_session_id(),
                },
                timeout=15,
                **kw,
            )
        )
        return {
            "using_curl_cffi": threads_client._IMPERSONATE is not None,
            "endpoint": threads_client._API_URL,
            "ds_user_id": session_id.split("%3A")[0].split(":")[0] if session_id else "NOT SET",
            "cookies_sent": cookies[:80] + "...",
            "http_status": resp.status_code,
            "content_type": resp.headers.get("content-type", ""),
            "response_snippet": resp.text[:500],
        }
    except Exception as exc:
        _logger.exception("Threads debug request failed")
        return {"error": str(exc)}


@router.get("/api/debug/site-context")
async def debug_site_context(request: Request):
    auth.require_superadmin(request)
    status = await media_routes.get_site_context_status()
    return {"items": status}


@router.post("/api/debug/site-context/refresh")
async def refresh_debug_site_context(request: Request):
    auth.require_superadmin(request)
    items = await media_routes.refresh_site_context()
    return {"items": items}


@router.post("/api/social/publish")
async def publish_to_social(body: dict, request: Request = None):
    current = None
    if request is not None:
        current = auth.require_admin(request)
    platform = body.get("platform", "")
    text = body.get("text", "")
    image_url = body.get("image_url", "")
    source_label = body.get("source_label", "")
    if not platform or not text:
        raise HTTPException(status_code=400, detail="platform and text are required")
    try:
        result = await run_in_threadpool(social_client.publish_post, platform, text, image_url)
        await run_in_threadpool(storage.record_published_post, platform, text, image_url, source_label)
        if current:
            await run_in_threadpool(
                storage.append_audit_event,
                action="queue.published_now",
                actor_user_id=current.id,
                actor_email=current.email,
                actor_role=current.role,
                target_type="social_post",
                target_id=platform,
                details={"platform": platform, "source_label": source_label},
            )
        _logger.info(
            "Social publish succeeded",
            extra={"fields": {"platform": platform, "source_label": source_label}},
        )
        return {"message": "Published successfully", "result": result}
    except Exception as exc:
        _logger.exception(
            "Social publish failed",
            extra={"fields": {"platform": platform, "source_label": source_label}},
        )
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/social/schedule")
async def schedule_social_post(body: dict, request: Request = None):
    current = None
    if request is not None:
        current = auth.require_admin(request)
    platform = body.get("platform", "")
    text = body.get("text", "")
    scheduled_at = body.get("scheduled_at", "")
    image_url = body.get("image_url", "")
    source_label = body.get("source_label", "")
    timezone_name = body.get("timezone", "")
    note_id = body.get("note_id")
    if not platform or not text or not scheduled_at:
        raise HTTPException(status_code=400, detail="platform, text, and scheduled_at are required")
    post_id = await run_in_threadpool(
        storage.create_scheduled_post,
        platform,
        text,
        scheduled_at,
        image_url,
        source_label,
        timezone_name,
        note_id,
    )
    _logger.info(
        "Social post scheduled",
        extra={"fields": {"scheduled_post_id": post_id, "platform": platform, "note_id": note_id, "source_label": source_label}},
    )
    if current:
        await run_in_threadpool(
            storage.append_audit_event,
            action="queue.scheduled",
            actor_user_id=current.id,
            actor_email=current.email,
            actor_role=current.role,
            target_type="scheduled_post",
            target_id=str(post_id),
            details={"platform": platform, "source_label": source_label, "scheduled_at": scheduled_at},
        )
    return {"id": post_id, "scheduled_at": scheduled_at, "platform": platform}


@router.get("/api/social/scheduled")
async def list_scheduled():
    return {"posts": await run_in_threadpool(storage.list_scheduled_posts, "pending")}


@router.get("/api/social/published")
async def list_published(limit: int = 50):
    posts = await run_in_threadpool(storage.list_scheduled_posts, "published", limit)
    posts.sort(key=lambda p: p.get("published_at", ""), reverse=True)
    return {"posts": posts}


@router.delete("/api/social/scheduled/{post_id}")
async def cancel_scheduled(post_id: int, request: Request = None):
    current = None
    if request is not None:
        current = auth.require_admin(request)
    await run_in_threadpool(storage.cancel_scheduled_post, post_id)
    if current:
        await run_in_threadpool(
            storage.append_audit_event,
            action="queue.cancelled",
            actor_user_id=current.id,
            actor_email=current.email,
            actor_role=current.role,
            target_type="scheduled_post",
            target_id=str(post_id),
        )
    _logger.info("Scheduled post cancelled", extra={"fields": {"scheduled_post_id": post_id}})
    return {"ok": True}


@router.delete("/api/social/scheduled/{post_id}/hard")
async def delete_scheduled(post_id: int, request: Request = None):
    current = None
    if request is not None:
        current = auth.require_superadmin(request)
    await run_in_threadpool(storage.delete_scheduled_post, post_id)
    if current:
        await run_in_threadpool(
            storage.append_audit_event,
            action="queue.deleted",
            actor_user_id=current.id,
            actor_email=current.email,
            actor_role=current.role,
            target_type="scheduled_post",
            target_id=str(post_id),
        )
    _logger.info("Scheduled post deleted", extra={"fields": {"scheduled_post_id": post_id}})
    return {"ok": True}


@router.get("/api/ideas")
async def get_ideas(status: str = None, source: str = None):
    return {"ideas": await run_in_threadpool(storage.list_ideas, status, source)}


@router.post("/api/ideas")
async def create_idea(idea: IdeaCreate):
    idea_id = await run_in_threadpool(
        storage.create_idea,
        theme=idea.theme,
        category=idea.category,
        emoji=idea.emoji,
        article_angle=idea.article_angle,
        source=idea.source,
    )
    return {"id": idea_id}


@router.patch("/api/ideas/{idea_id}")
async def update_idea_status(idea_id: int, body: IdeaStatusUpdate):
    allowed = {"new", "writing", "done"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")
    await run_in_threadpool(storage.update_idea_status, idea_id, body.status)
    return {"ok": True}


@router.delete("/api/ideas/{idea_id}")
async def delete_idea(idea_id: int, request: Request = None):
    if request is not None:
        auth.require_admin(request)
    await run_in_threadpool(storage.delete_idea, idea_id)
    return {"ok": True}


@router.post("/api/ideas/save-batch")
async def save_ideas_batch(body: IdeasBatchSave):
    return await run_in_threadpool(storage.save_ideas_batch, body.categories, "reddit")
