from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta
from xml.etree import ElementTree
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from bs4 import BeautifulSoup

from app.core import prompt_state
from app.core.ai_clients import get_claude_client
from app.core.logging import get_logger
from app.persistence import storage


router = APIRouter()
_logger = get_logger("editorial.routes.media")

_IMG_PRICE_MEDIUM = 0.063
_IMG_PRICE_HIGH = 0.250
_SONNET_PRICE_IN = 3.0 / 1_000_000
_SONNET_PRICE_CACHE_W = 3.75 / 1_000_000
_SONNET_PRICE_CACHE_R = 0.30 / 1_000_000
_SONNET_PRICE_OUT = 15.0 / 1_000_000
_REDDIT_SUBREDDITS = ["Discipline", "getdisciplined"]
_REDDIT_POSTS_PER_SUB = 50
_SITE_CONTEXT_TTL_DAYS = 7
_SITE_CONTEXT_URLS = [
    "https://www.adaptable-discipline.com",
    "https://www.adaptable-discipline.com/cdt",
]
_REDDIT_USER_AGENT = "editorial-pipeline/1.0 (+https://selfdisciplined.co; content research tool)"
_REDDIT_BASE_HEADERS = {
    "User-Agent": _REDDIT_USER_AGENT,
    "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "DNT": "1",
}

_STRUGGLES_SYSTEM = """You are an editorial analyst for a self-discipline newsletter called "Self Disciplined".

You will receive a numbered list of Reddit post titles from communities about self-discipline and personal improvement.
Your job is to identify the most common struggles, group them into clear categories, and surface them as content ideas.

When generating article angles, use the Adaptable Discipline framework as the editorial lens:
- Treat discipline as a skill, not a personality trait
- Prioritize coherence over achievement
- Frame drift as information, not moral failure
- Emphasize comeback speed over streaks or perfection
- Assume variable capacity is normal
- Focus on return, realignment, and self-governance
- Use the framework to engineer conditions that make the struggle easier to work with, not just to describe the struggle well
- Look for environmental, structural, temporal, emotional, and identity-level conditions that can be redesigned
- Prefer angles that help readers build better defaults, recovery paths, cues, boundaries, and supportive constraints
- Ask what conditions would make the desired behavior more likely, more repeatable, and easier to resume after drift

Use Coherence Dynamics Theory only implicitly in the angle construction:
- Think in terms of drift, regulation, return, reintegration, and directional stability
- Treat recurring struggle patterns as signals about system design, not just motivation problems
- If a person keeps failing in the same way, consider whether the regime, environment, or expectations need to change
- Do not mention "CDT", "Coherence Dynamics Theory", or academic theory language explicitly unless the user input already does

Article angles must feel native to Adaptable Discipline:
- They should sound like thoughtful newsletter angles for Self Disciplined, not generic productivity blog headlines
- Prefer angles about recovery, friction, coherence, identity, regulation, and sustainable return
- Avoid shallow angles centered on hustle, willpower, hacks, rigid consistency, or shame-based self-improvement
- When possible, translate the struggle into a principled reframe, a more coherent practice, or a better return process
- Strong angles often ask how to redesign the conditions around the person so discipline becomes more workable
- Prefer "how to structure conditions" over "how to try harder"

Return a JSON array of categories. Each category has:
- "category": short label (e.g. "Procrastination & Avoidance")
- "emoji": a single relevant emoji
- "struggles": array of objects, each with:
  - "theme": one-line description of the specific struggle (e.g. "Can't start tasks even when motivated")
  - "frequency": integer - how many posts relate to this theme
  - "post_indices": array of up to 3 integer indices (1-based, from the input list) that best represent this struggle
  - "example": one short representative quote from the post titles (verbatim, under 12 words)
  - "article_angle": a punchy one-line article idea for the "Self Disciplined" newsletter
  - "main_struggle": one sentence describing the core emotional/behavioural struggle readers face

Return 4-6 categories, each with 2-4 struggles. Most frequent struggles first within each category.
Output ONLY the JSON array, no markdown fences, no commentary."""


def _site_context_cache_key(url: str) -> str:
    return f"site_context:{url}"


def _normalize_site_text(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    return cleaned[:4000]


def _extract_site_context(html: str, url: str) -> Dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    meta_description = ""
    desc_tag = soup.find("meta", attrs={"name": "description"})
    if desc_tag and desc_tag.get("content"):
        meta_description = str(desc_tag.get("content")).strip()
    headings = [
        _normalize_site_text(tag.get_text(" ", strip=True))
        for tag in soup.find_all(["h1", "h2", "h3"], limit=12)
    ]
    paragraphs = [
        _normalize_site_text(tag.get_text(" ", strip=True))
        for tag in soup.find_all("p", limit=24)
    ]
    blocks = [value for value in [title, meta_description, *headings, *paragraphs] if value]
    return {
        "url": url,
        "title": title,
        "summary": "\n".join(blocks[:18])[:6000],
    }


async def _get_cached_site_context(http_client, url: str) -> Dict[str, Any]:
    cache_key = _site_context_cache_key(url)
    cached = storage.load_app_config_value(cache_key) or {}
    now = datetime.utcnow()
    expires_at_raw = cached.get("expires_at", "")
    if expires_at_raw:
        try:
            if datetime.fromisoformat(expires_at_raw) > now and cached.get("summary"):
                return cached
        except ValueError:
            pass

    resp = await http_client.get(url, follow_redirects=True, timeout=20)
    resp.raise_for_status()
    extracted = _extract_site_context(resp.text, str(resp.url))
    payload = {
        **extracted,
        "fetched_at": now.isoformat(),
        "expires_at": (now + timedelta(days=_SITE_CONTEXT_TTL_DAYS)).isoformat(),
    }
    storage.save_app_config_value(cache_key, payload)
    return payload


async def _build_adaptable_discipline_context(http_client) -> str:
    entries = []
    for url in _SITE_CONTEXT_URLS:
        try:
            cached = await _get_cached_site_context(http_client, url)
        except Exception:
            _logger.exception("Failed to load site context", extra={"fields": {"url": url}})
            continue
        entries.append(
            f"Source: {cached.get('url', url)}\n"
            f"Title: {cached.get('title', '')}\n"
            f"Notes:\n{cached.get('summary', '')}"
        )
    return "\n\n".join(entry for entry in entries if entry.strip())


async def get_site_context_status() -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for url in _SITE_CONTEXT_URLS:
        cached = storage.load_app_config_value(_site_context_cache_key(url)) or {}
        results.append(
            {
                "url": url,
                "cached": bool(cached.get("summary")),
                "title": cached.get("title", ""),
                "fetched_at": cached.get("fetched_at", ""),
                "expires_at": cached.get("expires_at", ""),
                "summary_preview": (cached.get("summary", "") or "")[:500],
            }
        )
    return results


async def refresh_site_context() -> List[Dict[str, Any]]:
    import httpx as _httpx

    refreshed: List[Dict[str, Any]] = []
    async with _httpx.AsyncClient(
        timeout=20,
        headers={"User-Agent": _REDDIT_USER_AGENT},
        follow_redirects=True,
    ) as http:
        for url in _SITE_CONTEXT_URLS:
            payload = await _get_cached_site_context(http, url)
            refreshed.append(
                {
                    "url": payload.get("url", url),
                    "title": payload.get("title", ""),
                    "fetched_at": payload.get("fetched_at", ""),
                    "expires_at": payload.get("expires_at", ""),
                    "summary_preview": (payload.get("summary", "") or "")[:500],
                }
            )
    return refreshed


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


def _reddit_rss_candidates(sub_name: str) -> List[str]:
    query = f"t=week"
    return [
        f"https://www.reddit.com/r/{sub_name}/top/.rss?{query}",
        f"https://old.reddit.com/r/{sub_name}/top/.rss?{query}",
    ]


def _extract_reddit_posts(payload: Dict[str, Any]) -> List[Dict[str, str]]:
    """Return list of {title, url} dicts from a Reddit JSON payload."""
    posts = payload.get("data", {}).get("children", [])
    result: List[Dict[str, str]] = []
    seen: set = set()
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
        permalink = data.get("permalink", "")
        url = f"https://www.reddit.com{permalink}" if permalink else ""
        result.append({"title": title, "url": url})
    return result


def _extract_reddit_rss_posts(xml_text: str) -> List[Dict[str, str]]:
    result: List[Dict[str, str]] = []
    seen: set[str] = set()
    try:
      root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
      return result
    ns = {
        "atom": "http://www.w3.org/2005/Atom",
    }
    for entry in root.findall("atom:entry", ns):
        title = (entry.findtext("atom:title", default="", namespaces=ns) or "").strip()
        if not title or title in seen:
            continue
        link = ""
        for link_node in entry.findall("atom:link", ns):
            href = (link_node.get("href") or "").strip()
            rel = (link_node.get("rel") or "").strip()
            if href and rel in {"alternate", "self", ""}:
                link = href
                if rel == "alternate":
                    break
        seen.add(title)
        result.append({"title": title, "url": link})
        if len(result) >= _REDDIT_POSTS_PER_SUB:
            break
    return result


# Keep old signature for tests
def _extract_reddit_titles(payload: Dict[str, Any]) -> List[str]:
    return [p["title"] for p in _extract_reddit_posts(payload)]


async def _fetch_subreddit_titles(http_client, sub_name: str) -> List[str]:
    return [p["title"] for p in await _fetch_subreddit_posts(http_client, sub_name)]


async def _fetch_subreddit_posts(http_client, sub_name: str) -> List[Dict[str, str]]:
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
            return _extract_reddit_posts(resp.json())
        last_error = f"{resp.status_code} from {url}"
        if resp.status_code not in {403, 429}:
            break
    for url in _reddit_rss_candidates(sub_name):
        try:
            resp = await http_client.get(
                url,
                headers={
                    "Referer": f"https://www.reddit.com/r/{sub_name}/",
                    "Accept": "application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
                },
            )
        except Exception as exc:
            last_error = str(exc)
            continue
        if resp.is_success:
            posts = _extract_reddit_rss_posts(resp.text)
            if posts:
                return posts
            last_error = f"RSS returned no posts from {url}"
            continue
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

    def sse(event: str, data: Dict[str, Any]) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def stream():
        all_posts: List[Dict[str, str]] = []
        failed_subs = []
        try:
            async with _httpx.AsyncClient(
                timeout=30,
                headers=_REDDIT_BASE_HEADERS,
                follow_redirects=True,
            ) as http:
                for sub_name in _REDDIT_SUBREDDITS:
                    yield sse("progress", {"message": f"Fetching r/{sub_name}..."})
                    try:
                        posts = await _fetch_subreddit_posts(http, sub_name)
                    except Exception as exc:
                        failed_subs.append((sub_name, str(exc)))
                        yield sse("progress", {"message": f"r/{sub_name} blocked, trying the remaining sources..."})
                        continue
                    all_posts.extend(posts)
                    yield sse("progress", {"message": f"r/{sub_name}: {len(posts)} posts collected"})
        except Exception as exc:
            yield sse("error", {"message": f"Reddit fetch failed: {exc}"})
            return

        if not all_posts:
            detail = "; ".join(f"r/{name}: {msg}" for name, msg in failed_subs) or "no posts returned"
            yield sse("error", {"message": f"No posts found. Reddit likely blocked the requests. {detail}"})
            return

        if failed_subs:
            yield sse("progress", {"message": "Partial Reddit fetch complete. Continuing with the posts that loaded."})

        capped = all_posts[:100]
        yield sse("progress", {"message": f"Analysing {len(capped)} posts with Claude..."})
        try:
            titles_text = "\n".join(f"{i+1}. {p['title']}" for i, p in enumerate(capped))
            site_context = await _build_adaptable_discipline_context(http)
            response = await run_in_threadpool(
                lambda: get_claude_client().messages.create(
                    model="claude-sonnet-4-5-20250929",
                    max_tokens=4096,
                    system=[{
                        "type": "text",
                        "text": _STRUGGLES_SYSTEM,
                        "cache_control": {"type": "ephemeral"},
                    }],
                    messages=[{
                        "role": "user",
                        "content": (
                            "Use the following cached editorial context from Adaptable Discipline and CDT "
                            "as grounding for how article angles should frame solutions.\n\n"
                            f"{site_context}\n\n"
                            f"Here are {len(capped)} post titles from r/Discipline and r/getdisciplined "
                            f"(top posts this week):\n\n{titles_text}\n\n"
                            "Identify and categorise the most common struggles. Return the JSON array."
                        ),
                    }],
                )
            )
            usage = response.usage
            _cw = getattr(usage, "cache_creation_input_tokens", 0) or 0
            _cr = getattr(usage, "cache_read_input_tokens", 0) or 0
            _cost = round(
                usage.input_tokens * _SONNET_PRICE_IN
                + usage.output_tokens * _SONNET_PRICE_OUT
                + _cw * _SONNET_PRICE_CACHE_W
                + _cr * _SONNET_PRICE_CACHE_R,
                6,
            )
            storage.record_image_cost("reddit_ideas", 1, _cost)
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            categories = json.loads(raw)
        except Exception as exc:
            yield sse("error", {"message": f"Analysis failed: {exc}"})
            return

        # Resolve post_indices back to URLs and attach sample_urls to each struggle
        filtered_categories = []
        for cat in categories:
            filtered_struggles = []
            for struggle in cat.get("struggles", []):
                indices = struggle.pop("post_indices", [])
                urls = []
                for idx in indices:
                    if isinstance(idx, int) and 1 <= idx <= len(capped):
                        url = capped[idx - 1].get("url", "")
                        if url:
                            urls.append(url)
                if urls:
                    struggle["sample_urls"] = urls
                    filtered_struggles.append(struggle)
            if filtered_struggles:
                filtered_categories.append({
                    **cat,
                    "struggles": filtered_struggles,
                })

        if not filtered_categories:
            yield sse("error", {"message": "Analysis returned ideas, but none included valid Reddit source links."})
            return

        try:
            storage.save_ideas_batch(filtered_categories, source="reddit")
        except Exception as exc:
            _logger.exception("Failed to persist Reddit-derived ideas")
            yield sse("error", {"message": f"Ideas saved in memory but not persisted: {exc}"})
            return

        yield sse("result", {"categories": filtered_categories, "total_posts": len(all_posts)})
        yield sse("done", {})

    return StreamingResponse(stream(), media_type="text/event-stream")
