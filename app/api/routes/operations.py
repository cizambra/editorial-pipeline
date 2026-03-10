from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.core.logging import get_logger


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
    import storage

    return {"runs": await run_in_threadpool(storage.list_history_runs, 50)}


@router.get("/api/history/{run_id}")
async def get_history_run(run_id: int):
    import storage

    run = await run_in_threadpool(storage.get_history_run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/api/marketing/library")
async def get_marketing_library():
    import storage

    return {"runs": await run_in_threadpool(storage.list_marketing_runs, 100)}


@router.delete("/api/history/{run_id}")
async def delete_history_run(run_id: int, request: Request = None):
    import auth
    import storage

    if request is not None:
        auth.require_superadmin(request)
    await run_in_threadpool(storage.delete_history_run, run_id)
    _logger.info("History run deleted", extra={"fields": {"run_id": run_id}})
    return {"message": "Run deleted"}


@router.post("/api/thumbnails/save")
async def save_thumbnail(req: SaveThumbnailRequest):
    import storage

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
    import storage

    return {"thumbnails": await run_in_threadpool(storage.list_thumbnails, q, limit)}


@router.get("/api/thumbnails/{thumb_id}")
async def get_thumbnail(thumb_id: int):
    import storage

    thumbnail = await run_in_threadpool(storage.get_thumbnail, thumb_id)
    if not thumbnail:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return thumbnail


@router.delete("/api/thumbnails/{thumb_id}")
async def delete_thumbnail(thumb_id: int, request: Request = None):
    import auth
    import storage

    if request is not None:
        auth.require_superadmin(request)
    await run_in_threadpool(storage.delete_thumbnail, thumb_id)
    _logger.info("Thumbnail deleted", extra={"fields": {"thumbnail_id": thumb_id}})
    return {"message": "Deleted"}


@router.get("/api/tokens/current")
async def get_current_tokens():
    import generator

    return await run_in_threadpool(generator.get_token_summary)


@router.post("/api/feedback")
async def post_feedback(body: dict):
    import storage

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
    import storage

    return {"summary": await run_in_threadpool(storage.get_feedback_summary)}


@router.get("/api/social/status")
async def get_social_status():
    import social_client

    return await run_in_threadpool(social_client.get_status)


@router.get("/api/social/debug/threads")
async def debug_threads(request: Request = None):
    import auth
    import threads_client as _tc

    if request is not None:
        auth.require_superadmin(request)
    session_id = os.getenv("THREADS_SESSION_ID", "")
    try:
        cookies = await run_in_threadpool(_tc._cookies)
    except Exception as exc:
        _logger.exception("Threads debug cookie build failed")
        return {"error": f"Cookie build failed: {exc}"}

    kw = {"impersonate": _tc._IMPERSONATE} if _tc._IMPERSONATE else {}
    try:
        import time as _time
        resp = await run_in_threadpool(
            lambda: _tc._req.post(
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
    except Exception as exc:
        _logger.exception("Threads debug request failed")
        return {"error": str(exc)}


@router.post("/api/social/publish")
async def publish_to_social(body: dict, request: Request = None):
    import auth
    import social_client
    import storage

    if request is not None:
        auth.require_admin(request)
    platform = body.get("platform", "")
    text = body.get("text", "")
    image_url = body.get("image_url", "")
    source_label = body.get("source_label", "")
    if not platform or not text:
        raise HTTPException(status_code=400, detail="platform and text are required")
    try:
        result = await run_in_threadpool(social_client.publish_post, platform, text, image_url)
        await run_in_threadpool(storage.record_published_post, platform, text, image_url, source_label)
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
    import auth
    import storage

    if request is not None:
        auth.require_admin(request)
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
    return {"id": post_id, "scheduled_at": scheduled_at, "platform": platform}


@router.get("/api/social/scheduled")
async def list_scheduled():
    import storage

    return {"posts": await run_in_threadpool(storage.list_scheduled_posts, "pending")}


@router.get("/api/social/published")
async def list_published(limit: int = 50):
    import storage

    posts = await run_in_threadpool(storage.list_scheduled_posts, "published", limit)
    posts.sort(key=lambda p: p.get("published_at", ""), reverse=True)
    return {"posts": posts}


@router.delete("/api/social/scheduled/{post_id}")
async def cancel_scheduled(post_id: int, request: Request = None):
    import auth
    import storage

    if request is not None:
        auth.require_admin(request)
    await run_in_threadpool(storage.cancel_scheduled_post, post_id)
    _logger.info("Scheduled post cancelled", extra={"fields": {"scheduled_post_id": post_id}})
    return {"ok": True}


@router.delete("/api/social/scheduled/{post_id}/hard")
async def delete_scheduled(post_id: int, request: Request = None):
    import auth
    import storage

    if request is not None:
        auth.require_superadmin(request)
    await run_in_threadpool(storage.delete_scheduled_post, post_id)
    _logger.info("Scheduled post deleted", extra={"fields": {"scheduled_post_id": post_id}})
    return {"ok": True}


@router.get("/api/ideas")
async def get_ideas(status: str = None, source: str = None):
    import storage

    return {"ideas": await run_in_threadpool(storage.list_ideas, status, source)}


@router.post("/api/ideas")
async def create_idea(idea: IdeaCreate):
    import storage

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
    import storage

    allowed = {"new", "writing", "done"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")
    await run_in_threadpool(storage.update_idea_status, idea_id, body.status)
    return {"ok": True}


@router.delete("/api/ideas/{idea_id}")
async def delete_idea(idea_id: int, request: Request = None):
    import auth
    import storage

    if request is not None:
        auth.require_admin(request)
    await run_in_threadpool(storage.delete_idea, idea_id)
    return {"ok": True}


@router.post("/api/ideas/save-batch")
async def save_ideas_batch(body: IdeasBatchSave):
    import storage

    return await run_in_threadpool(storage.save_ideas_batch, body.categories, "reddit")
