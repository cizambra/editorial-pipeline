from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from starlette.concurrency import iterate_in_threadpool

from app.core import auth, prompt_state
from app.core.logging import get_logger
from app.persistence import storage
from app.services import generator


router = APIRouter()
_logger = get_logger("editorial.routes.pipeline")


@router.get("/api/pipeline/checkpoint")
async def get_checkpoint():
    checkpoint = await run_in_threadpool(storage.load_checkpoint)
    if not checkpoint:
        return {"exists": False}
    completed_steps = list(checkpoint.get("data", {}).keys())
    return {
        "exists": True,
        "title": checkpoint.get("reflection_title", "Unknown"),
        "reflection_title": checkpoint.get("reflection_title", "Unknown"),
        "timestamp": checkpoint.get("timestamp", ""),
        "article_url": checkpoint.get("article_url", ""),
        "include_spanish": checkpoint.get("include_spanish", True),
        "reflection": checkpoint.get("reflection", ""),
        "data": checkpoint.get("data", {}),
        "completed_steps": completed_steps,
        "total_steps": 8,
    }


@router.delete("/api/pipeline/checkpoint")
async def clear_checkpoint(request: Request = None):
    if request is not None:
        auth.require_superadmin(request)
    await run_in_threadpool(storage.clear_checkpoint)
    _logger.info("Pipeline checkpoint cleared")
    return {"message": "Checkpoint cleared"}


@router.post("/api/pipeline/cancel")
async def cancel_pipeline(request: Request = None):
    from app.services import pipeline as pipeline_service

    if request is not None:
        auth.require_admin(request)
    pipeline_service.cancel_current_run()
    _logger.info("Pipeline cancel requested")
    return {"message": "Cancel signal sent"}


@router.get("/api/pipeline/queue")
async def get_queue():
    items = await run_in_threadpool(storage.load_pipeline_queue)
    return {"items": items}


@router.post("/api/pipeline/queue")
async def save_queue(body: dict):
    items = body.get("items", [])
    await run_in_threadpool(storage.save_pipeline_queue, items)
    return {"ok": True}


@router.delete("/api/pipeline/queue")
async def delete_queue():
    await run_in_threadpool(storage.clear_pipeline_queue)
    return {"ok": True}


@router.post("/api/pipeline/regenerate")
async def regenerate_platform(body: dict):
    platform = body.get("platform", "")
    source_text = body.get("source_text", "")
    title = body.get("title", "")
    article_url = body.get("article_url", "")
    language = body.get("language", "english")
    tone_level = body.get("tone_level")

    if not platform or not source_text:
        raise HTTPException(status_code=400, detail="platform and source_text are required")
    if tone_level is not None:
        generator.set_tone_level(int(tone_level))

    try:
        content = await run_in_threadpool(
            generator.generate_single_platform,
            text=source_text,
            title=title,
            article_url=article_url,
            platform=platform,
            language=language,
        )
        return {"platform": platform, "content": content}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        _logger.exception("Platform regeneration failed", extra={"fields": {"platform": platform, "article_url": article_url, "title": title}})
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/pipeline/repurpose")
async def repurpose_from_archive(body: dict):
    text = body.get("text", "").strip()
    title = body.get("title", "").strip()
    article_url = body.get("article_url", "")
    original_date = body.get("original_date", "")
    angle_note = body.get("angle_note", "")
    language = body.get("language", "english")
    tone_level = body.get("tone_level")
    save_to_history = bool(body.get("save_to_history", False))

    if not text or not title:
        raise HTTPException(status_code=400, detail="text and title are required")
    if tone_level is not None:
        generator.set_tone_level(int(tone_level))

    generator.reset_token_log()
    try:
        results = await run_in_threadpool(
            generator.generate_repurposed_from_archive,
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
            data = {"reflection": {lang_key: text, f"repurposed_{lang_key}": results}}
            await run_in_threadpool(storage.save_run, title, article_url, data, token_summary)
        return {"social": results, "tokens": token_summary}
    except Exception as exc:
        _logger.exception("Archive repurpose failed", extra={"fields": {"title": title, "article_url": article_url}})
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/pipeline/companion")
async def generate_companion_only(body: dict):
    text = body.get("text", "").strip()
    title = body.get("title", "").strip()
    article_url = body.get("article_url", "")
    include_spanish = body.get("include_spanish", True)
    tone_level = body.get("tone_level")

    if not text or not title:
        raise HTTPException(status_code=400, detail="text and title are required")
    template_path = prompt_state.get_template_path()
    if not template_path.exists():
        raise HTTPException(status_code=400, detail="Companion template not found. Upload it in Settings first.")
    if tone_level is not None:
        generator.set_tone_level(int(tone_level))

    template = await run_in_threadpool(template_path.read_text, encoding="utf-8")
    generator.reset_token_log()
    try:
        result = await run_in_threadpool(
            generator.generate_companion_only,
            reflection=text,
            reflection_title=title,
            template=template,
            article_url=article_url,
            include_spanish=bool(include_spanish),
        )
        token_summary = generator.get_token_summary()
        return {**result, "tokens": token_summary}
    except Exception as exc:
        _logger.exception("Companion generation failed", extra={"fields": {"title": title, "article_url": article_url}})
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/pipeline/run")
async def run_pipeline(
    request: Request,
    reflection: UploadFile = File(...),
    title: str = Form(...),
    article_url: str = Form(default=""),
    queue_social: str = Form(default="false"),
    include_spanish: str = Form(default="true"),
    tone_level: str = Form(default=""),
):
    from app.services import pipeline as pipeline_service

    reflection_text = (await reflection.read()).decode("utf-8")
    do_queue_social = queue_social.lower() == "true"
    do_spanish = include_spanish.lower() == "true"
    tone = int(tone_level) if tone_level.strip().isdigit() else None

    stream = await run_in_threadpool(
        pipeline_service.build_pipeline_stream,
            reflection_text,
            title,
            article_url,
            do_spanish,
            do_queue_social,
            tone_level=tone,
    )

    async def monitored_stream():
        disconnected = False
        try:
            async for chunk in iterate_in_threadpool(stream):
                if not disconnected and await request.is_disconnected():
                    disconnected = True
                if disconnected:
                    continue
                yield chunk
        except Exception:
            if not disconnected:
                raise

    return StreamingResponse(
        monitored_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/pipeline/resume")
async def resume_pipeline():
    from app.services import pipeline as pipeline_service

    checkpoint = await run_in_threadpool(storage.load_checkpoint)
    if not checkpoint:
        raise HTTPException(status_code=404, detail="No checkpoint found")

    stream = await run_in_threadpool(
        pipeline_service.build_pipeline_stream,
            reflection_text=checkpoint.get("reflection", ""),
            reflection_title=checkpoint.get("reflection_title", ""),
            article_url=checkpoint.get("article_url", ""),
            include_spanish=checkpoint.get("include_spanish", True),
            queue_social=False,
            checkpoint_data=checkpoint.get("data", {}),
    )
    return StreamingResponse(stream, media_type="text/event-stream")


@router.post("/api/pipeline/{run_id}/triage")
async def post_triage(run_id: int, body: dict, request: Request = None):
    """Accept a triage summary for a pipeline run and record it on the run record.
    Authentication: prefer an internal shared secret via X-INTERNAL-TOKEN header (TRIAGE_SHARED_SECRET).
    Falls back to admin-auth if no shared secret is configured.
    """
    # internal token check (optional)
    shared = os.environ.get("TRIAGE_SHARED_SECRET")
    header = request.headers.get("X-INTERNAL-TOKEN") if request is not None else None
    if shared:
        if header != shared:
            # not allowed
            auth.require_admin(request)
    else:
        # fall back to requiring admin if no shared secret configured
        auth.require_admin(request)

    # persist triage into run data under key 'triage'
    await run_in_threadpool(storage.patch_run_data, run_id, {"triage": body})
    _logger.info("Triage recorded for run", extra={"fields": {"run_id": run_id}})
    return {"ok": True}


@router.post("/api/pipeline/triage")
async def post_triage_create(body: dict, request: Request = None):
    """Create a persistent triage entry when no run_id is available.
    This creates a new run record with the triage payload stored in `data.triage`.
    """
    title = body.get("title", "Triage")
    article_url = body.get("article_url", "")
    triage = body.get("triage", body)
    await run_in_threadpool(storage.save_run, title, article_url, {"triage": triage}, None)
    _logger.info("Created triage run", extra={"fields": {"title": title}})
    return {"ok": True}
