from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import prompt_state
from app.core.logging import get_logger


router = APIRouter()
_logger = get_logger("editorial.routes.media")

_IMG_PRICE_MEDIUM = 0.063
_IMG_PRICE_HIGH = 0.250
_REDDIT_SUBREDDITS = ["Discipline", "getdisciplined"]
_REDDIT_POSTS_PER_SUB = 50
_REDDIT_USER_AGENT = "editorial-pipeline/1.0 (+https://selfdisciplined.co; content research tool)"
_REDDIT_BASE_HEADERS = {
    "User-Agent": _REDDIT_USER_AGENT,
    "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "DNT": "1",
}

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


class ThumbnailRequest(BaseModel):
    title: str
    prompt_override: Optional[str] = None


class ThumbnailConceptsRequest(BaseModel):
    title: str
    article_text: str
    auto_generate: bool = True


class ThumbnailImagesRequest(BaseModel):
    concepts: List[Dict[str, Any]]


def _reddit_url_candidates(sub_name: str) -> List[str]:
    query = f"t=week&limit={_REDDIT_POSTS_PER_SUB}&raw_json=1"
    return [
        f"https://www.reddit.com/r/{sub_name}/top/.json?{query}",
        f"https://old.reddit.com/r/{sub_name}/top/.json?{query}",
    ]


def _extract_reddit_titles(payload: Dict[str, Any]) -> List[str]:
    posts = payload.get("data", {}).get("children", [])
    titles: List[str] = []
    seen = set()
    for item in posts:
        data = item.get("data", {})
        title = str(data.get("title", "")).strip()
        if not title or data.get("stickied"):
            continue
        if data.get("removed_by_category") or title in {"[removed]", "[deleted]"}:
            continue
        if title in seen:
            continue
        seen.add(title)
        titles.append(title)
    return titles


async def _fetch_subreddit_titles(http_client, sub_name: str) -> List[str]:
    last_error = ""
    for url in _reddit_url_candidates(sub_name):
        try:
            resp = await http_client.get(
                url,
                headers={"Referer": f"https://www.reddit.com/r/{sub_name}/"},
            )
        except Exception as exc:
            last_error = str(exc)
            continue
        if resp.is_success:
            return _extract_reddit_titles(resp.json())
        last_error = f"{resp.status_code} from {url}"
        if resp.status_code not in {403, 429}:
            break
    raise RuntimeError(last_error or f"Could not fetch r/{sub_name}")


async def _generate_one_dalle(httpx_client, api_key: str, prompt: str, index: int) -> Dict[str, Any]:
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


@router.post("/api/generate-thumbnail-concepts")
async def generate_thumbnail_concepts(req: ThumbnailConceptsRequest):
    import asyncio
    import httpx as _httpx

    from ai_clients import get_claude_client
    import storage

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not set in .env")

    def sse(event: str, data: Dict[str, Any]) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def stream():
        claude = get_claude_client()
        try:
            article_excerpt = req.article_text[:4000]
            response = await run_in_threadpool(
                lambda: claude.messages.create(
                    model="claude-sonnet-4-5-20250929",
                    max_tokens=2048,
                    system=[{
                        "type": "text",
                        "text": prompt_state.get_thumbnail_prompt(),
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
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            concepts = json.loads(raw)
            required = {"name", "scene", "dalle_prompt"}
            missing = [i for i, c in enumerate(concepts) if not required.issubset(c)]
            if missing:
                raise ValueError(
                    f"Claude returned concepts missing required fields at index(es) {missing}. "
                    f"Keys present: {[list(concepts[i].keys()) for i in missing]}"
                )
        except Exception as exc:
            yield sse("error", {"message": f"Concept generation failed: {exc}"})
            return

        yield sse("concepts_ready", {"concepts": [
            {
                "index": i,
                "name": c["name"],
                "scene": c["scene"],
                "why": c.get("why", ""),
                "dalle_prompt": c.get("dalle_prompt", ""),
            }
            for i, c in enumerate(concepts)
        ]})

        if not req.auto_generate:
            yield sse("done", {})
            return

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
                except Exception as exc:
                    idx = result["index"] if result else "?"
                    yield sse("error", {"message": f"Image {idx} failed: {exc}"})

        cost = storage.record_image_cost("concept_medium", len(concepts), _IMG_PRICE_MEDIUM)
        yield sse("image_cost", {"cost_usd": cost, "count": len(concepts), "quality": "medium"})
        yield sse("done", {})

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.post("/api/generate-thumbnail-images")
async def generate_thumbnail_images(req: ThumbnailImagesRequest):
    import asyncio
    import httpx as _httpx
    import storage

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not set in .env")

    def sse(event: str, data: Dict[str, Any]) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def stream():
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
                except Exception as exc:
                    idx = result["index"] if result else "?"
                    yield sse("error", {"message": f"Image {idx} failed: {exc}"})
        cost = storage.record_image_cost("concept_medium", len(concepts), _IMG_PRICE_MEDIUM)
        yield sse("image_cost", {"cost_usd": cost, "count": len(concepts), "quality": "medium"})
        yield sse("done", {})

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.post("/api/generate-thumbnail")
async def generate_thumbnail(req: ThumbnailRequest):
    import httpx
    import storage

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not set in .env")

    config = storage.load_config()
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
        cost = storage.record_image_cost("custom_high", 1, _IMG_PRICE_HIGH)
        return {
            "image_b64": data["data"][0]["b64_json"],
            "revised_prompt": data["data"][0].get("revised_prompt", final_prompt),
            "cost_usd": cost,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {exc}")


@router.post("/api/reddit-struggles")
async def reddit_struggles():
    import httpx as _httpx
    from ai_clients import get_claude_client
    import storage

    def sse(event: str, data: Dict[str, Any]) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def stream():
        all_titles = []
        failed_subs = []
        try:
            async with _httpx.AsyncClient(
                timeout=30,
                headers=_REDDIT_BASE_HEADERS,
                follow_redirects=True,
                http2=True,
            ) as http:
                for sub_name in _REDDIT_SUBREDDITS:
                    yield sse("progress", {"message": f"Fetching r/{sub_name}..."})
                    try:
                        titles = await _fetch_subreddit_titles(http, sub_name)
                    except Exception as exc:
                        failed_subs.append((sub_name, str(exc)))
                        yield sse("progress", {"message": f"r/{sub_name} blocked, trying the remaining sources..."})
                        continue
                    all_titles.extend(titles)
                    yield sse("progress", {"message": f"r/{sub_name}: {len(titles)} posts collected"})
        except Exception as exc:
            yield sse("error", {"message": f"Reddit fetch failed: {exc}"})
            return

        if not all_titles:
            detail = "; ".join(f"r/{name}: {msg}" for name, msg in failed_subs) or "no posts returned"
            yield sse("error", {"message": f"No posts found. Reddit likely blocked the requests. {detail}"})
            return

        if failed_subs:
            yield sse("progress", {"message": "Partial Reddit fetch complete. Continuing with the posts that loaded."})

        yield sse("progress", {"message": f"Analysing {len(all_titles)} posts with Claude..."})
        try:
            titles_text = "\n".join(f"{i+1}. {t}" for i, t in enumerate(all_titles[:100]))
            response = await run_in_threadpool(
                lambda: get_claude_client().messages.create(
                    model="claude-sonnet-4-5-20250929",
                    max_tokens=2048,
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
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            categories = json.loads(raw)
        except Exception as exc:
            yield sse("error", {"message": f"Analysis failed: {exc}"})
            return

        try:
            storage.save_ideas_batch(categories, source="reddit")
        except Exception:
            _logger.exception("Failed to persist Reddit-derived ideas")

        yield sse("result", {"categories": categories, "total_posts": len(all_titles)})
        yield sse("done", {})

    return StreamingResponse(stream(), media_type="text/event-stream")
