from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.core import auth
from app.core.ai_clients import get_claude_client
from app.core.logging import get_logger
from app.persistence import storage
from app.services import generator, substack_client


router = APIRouter()
_logger = get_logger("editorial.routes.content")

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


class SubstackNoteUpdate(BaseModel):
    shared: Optional[bool] = None
    signal: Optional[str] = None
    note_text: Optional[str] = None


class ComposeRepurposeRequest(BaseModel):
    text: str
    platform: str


class QuoteUpdate(BaseModel):
    shared: Optional[bool] = None
    signal: Optional[str] = None


class QuoteRepurposeRequest(BaseModel):
    quote_text: str
    context: str = ""
    article_title: str = ""
    article_url: str = ""


def _parse_substack_notes(raw: str) -> List[Dict[str, Any]]:
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
    results = []
    for i, note in enumerate(notes):
        block_match = re.search(rf"NOTE\s+{i + 1}\s*:\s*\n([\s\S]*?)(?=NOTE\s+\d+\s*:|$)", raw, re.IGNORECASE)
        block = block_match.group(1) if block_match else ""

        def extract(label: str) -> str:
            match = re.search(
                rf"{label}\s*:\s*\n([\s\S]*?)(?=\n(?:LINKEDIN|THREADS|INSTAGRAM):|$)",
                block,
                re.IGNORECASE,
            )
            return match.group(1).strip() if match else ""

        results.append(
            {
                "id": note.get("id"),
                "linkedin": extract("LINKEDIN"),
                "threads": extract("THREADS"),
                "instagram": extract("INSTAGRAM"),
            }
        )
    return results


@router.post("/api/substack-notes/generate")
async def generate_substack_notes(request: Request = None):
    if request is not None:
        auth.require_admin(request)
    try:
        def build_batch():
            response = get_claude_client().messages.create(
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
            saved_notes = storage.get_substack_notes(batch_id)
            note_blocks = "\n\n".join(f"NOTE {i + 1}:\n{note['note_text']}" for i, note in enumerate(saved_notes))
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
                rep_response = get_claude_client().messages.create(
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
                _logger.exception("Substack batch repurpose failed", extra={"fields": {"batch_id": batch_id}})
            return batch_id, notes, repurposed

        batch_id, notes, repurposed = await run_in_threadpool(build_batch)
        return {"ok": True, "batch_id": batch_id, "note_count": len(notes), "repurposed": repurposed}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/substack-notes/search")
async def search_substack_notes(q: str = "", shared: str = "", repurposed: str = "", signal: str = ""):
    notes = storage.search_substack_notes(
        q=q,
        shared=shared == "1",
        repurposed=repurposed == "1",
        signal=signal or None,
    )
    return {"notes": notes}


@router.get("/api/substack-notes/batches")
async def list_substack_batches():
    return {"batches": storage.list_substack_batches()}


@router.get("/api/substack-notes/batches/{batch_id}")
async def get_substack_notes(batch_id: int):
    return {"notes": storage.get_substack_notes(batch_id)}


@router.patch("/api/substack-notes/{note_id}")
async def update_substack_note(note_id: int, body: SubstackNoteUpdate, request: Request = None):
    if request is not None:
        auth.require_admin(request)
    storage.update_substack_note(note_id, shared=body.shared, signal=body.signal, note_text=body.note_text)
    _logger.info("Substack note updated", extra={"fields": {"note_id": note_id}})
    return {"ok": True}


@router.delete("/api/substack-notes/{note_id}")
async def delete_substack_note(note_id: int, request: Request = None):
    if request is not None:
        auth.require_admin(request)
    storage.delete_substack_note(note_id)
    _logger.info("Substack note deleted", extra={"fields": {"note_id": note_id}})
    return {"ok": True}


@router.delete("/api/substack-notes/batches/{batch_id}")
async def delete_substack_batch(batch_id: int, request: Request = None):
    if request is not None:
        auth.require_superadmin(request)
    storage.delete_substack_batch(batch_id)
    _logger.info("Substack batch deleted", extra={"fields": {"batch_id": batch_id}})
    return {"ok": True}


@router.post("/api/substack-notes/{note_id}/repurpose")
async def repurpose_substack_note(note_id: int, request: Request = None):
    if request is not None:
        auth.require_admin(request)
    note = storage.get_substack_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

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
        response = await run_in_threadpool(
            lambda: get_claude_client().messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
        )
        raw = response.content[0].text if response.content else ""

        def extract(label: str) -> str:
            match = re.search(
                rf"{label}:\s*\n([\s\S]*?)(?=\n(?:LINKEDIN|THREADS|INSTAGRAM):|$)",
                raw,
                re.IGNORECASE,
            )
            return match.group(1).strip() if match else ""

        linkedin = extract("LINKEDIN")
        threads = extract("THREADS")
        instagram = extract("INSTAGRAM")
        await run_in_threadpool(storage.save_substack_repurpose, note_id, linkedin, threads, instagram)
        _logger.info("Substack note repurposed", extra={"fields": {"note_id": note_id}})
        return {"ok": True, "linkedin": linkedin, "threads": threads, "instagram": instagram}
    except Exception as exc:
        _logger.exception("Substack note repurpose failed", extra={"fields": {"note_id": note_id}})
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/substack-notes/{note_id}/promote")
async def promote_substack_note_to_idea(note_id: int, request: Request = None):
    if request is not None:
        auth.require_admin(request)
    note = storage.get_substack_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    idea_id = storage.create_idea(
        theme=note["issue"],
        category="Substack Note",
        emoji="📝",
        article_angle=f"[{note['intent']}] {note['note_text'][:120]}",
        source="substack_note",
    )
    _logger.info("Substack note promoted to idea", extra={"fields": {"note_id": note_id, "idea_id": idea_id}})
    return {"ok": True, "idea_id": idea_id}


@router.post("/api/social/compose/repurpose")
async def compose_repurpose(body: ComposeRepurposeRequest):
    plat_labels = {
        "substack_note": "Substack Note",
        "linkedin": "LinkedIn",
        "threads": "Threads",
        "instagram": "Instagram",
    }
    prompt = f"""You are adapting a social media post into 3 platform variants.

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
        response = await run_in_threadpool(
            lambda: get_claude_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
            )
        )
        raw = response.content[0].text if response.content else ""

        def extract(label: str) -> str:
            match = re.search(
                rf"{label}\s*:\s*\n([\s\S]*?)(?=\n(?:LINKEDIN|THREADS|INSTAGRAM|SUBSTACK_NOTE)\s*:|$)",
                raw,
                re.IGNORECASE,
            )
            return match.group(1).strip() if match else ""

        return {
            "linkedin": extract("LINKEDIN") if body.platform != "linkedin" else "",
            "threads": extract("THREADS") if body.platform != "threads" else "",
            "instagram": extract("INSTAGRAM") if body.platform != "instagram" else "",
            "substack_note": extract("SUBSTACK_NOTE") if body.platform != "substack_note" else "",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/substack/test")
async def test_substack_connection(request: Request = None):
    if request is not None:
        auth.require_admin(request)
    try:
        return await run_in_threadpool(substack_client.test_connection)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/api/substack/insights")
async def get_audience_insights():
    try:
        stats = await run_in_threadpool(storage.get_insights_data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if stats.get("enriched_count", 0) < 10:
        stats["recommendations"] = []
        return stats

    top = stats.get("top_segment", {})
    top_countries = ", ".join(f"{country} ({count})" for country, count in top.get("top_countries", [])[:3]) or "unknown"
    top_attr = ", ".join(f"{attr} ({count})" for attr, count in top.get("top_attribution", [])[:3]) or "unknown"
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
        response = await run_in_threadpool(
            lambda: get_claude_client().messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1200,
                messages=[{"role": "user", "content": prompt}],
            )
        )
        raw = response.content[0].text.strip()
        start, end = raw.find("["), raw.rfind("]") + 1
        recommendations = json.loads(raw[start:end])
    except Exception:
        recommendations = []

    stats["recommendations"] = recommendations
    return stats


@router.get("/api/substack/audience")
async def get_substack_audience():
    try:
        return await run_in_threadpool(storage.get_audience_stats)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/substack/subscribers/sync")
async def sync_subscribers(request: Request = None):
    if request is not None:
        auth.require_admin(request)
    try:
        def run_sync():
            all_subscribers: List[Dict[str, Any]] = []
            offset, limit = 0, 100
            total = None
            while True:
                page = substack_client.get_subscriber_page(offset=offset, limit=limit)
                if total is None:
                    total = page.get("count", 0)
                batch = page.get("subscribers", [])
                all_subscribers.extend(batch)
                offset += limit
                if not batch or offset >= (total or 0):
                    break
            saved = storage.upsert_subscribers(all_subscribers)
            backfilled = storage.backfill_subscriber_countries()
            return saved, total, backfilled
        saved, total, backfilled = await run_in_threadpool(run_sync)
        return {"ok": True, "synced": saved, "total": total, "countries_backfilled": backfilled}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/substack/subscribers")
async def list_subscribers(q: str = "", activity: Optional[int] = None, interval: str = "", offset: int = 0, limit: int = 50):
    try:
        return await run_in_threadpool(storage.get_subscribers, q, activity, interval, offset, limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/substack/subscribers/{email}/detail")
async def subscriber_detail(email: str, request: Request = None):
    import datetime as _dt
    import json as _json
    import urllib.parse as _up

    if request is not None:
        auth.require_admin(request)
    email = _up.unquote(email)
    try:
        row = await run_in_threadpool(storage.get_subscriber, email)
        if row and row.get("detail_synced_at"):
            age = (_dt.datetime.utcnow() - _dt.datetime.fromisoformat(row["detail_synced_at"].rstrip("Z"))).days
            if age < 7:
                detail = _json.loads(row["detail_json"]) if row.get("detail_json") else {}
                return {"ok": True, "cached": True, "subscriber": row, "detail": detail}
        detail = await run_in_threadpool(substack_client.get_subscriber_detail, email)
        if detail:
            await run_in_threadpool(storage.save_subscriber_detail, email, detail)
            row = await run_in_threadpool(storage.get_subscriber, email)
        return {"ok": True, "cached": False, "subscriber": row or {}, "detail": detail}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/quotes")
async def list_quote_runs():
    return {"runs": storage.list_quote_runs()}


@router.get("/api/quotes/{run_id}")
async def get_quotes_for_run(run_id: int):
    return {"quotes": storage.get_quotes_for_run(run_id)}


@router.patch("/api/quotes/{quote_id}")
async def update_quote(quote_id: int, body: QuoteUpdate, request: Request = None):
    if request is not None:
        auth.require_admin(request)
    updates = {}
    if body.shared is not None:
        updates["shared"] = 1 if body.shared else 0
    if body.signal is not None:
        updates["signal"] = body.signal
    if updates:
        storage.update_quote(quote_id, **updates)
    return {"ok": True}


@router.post("/api/quotes/{quote_id}/repurpose")
async def repurpose_quote(quote_id: int, body: QuoteRepurposeRequest, request: Request = None):
    if request is not None:
        auth.require_admin(request)
    try:
        prompt = (
            f"Turn this quote into short social media posts.\n\n"
            f"Quote: \"{body.quote_text}\"\n"
            f"Context: {body.context}\n"
            f"Article: {body.article_title}\n\n"
            + generator.get_voice_brief()
            + "\nWrite three posts:\n\n"
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
        response = await run_in_threadpool(
            lambda: get_claude_client().messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1200,
                messages=[{"role": "user", "content": prompt}],
            )
        )
        raw = response.content[0].text

        def extract(label: str) -> str:
            match = re.search(
                rf"{label}:\s*\n([\s\S]*?)(?=\n(?:LINKEDIN|THREADS|INSTAGRAM):|$)",
                raw,
                re.IGNORECASE,
            )
            return match.group(1).strip() if match else ""

        linkedin = extract("LINKEDIN")
        threads = extract("THREADS")
        instagram = extract("INSTAGRAM")
        await run_in_threadpool(storage.update_quote, quote_id, linkedin=linkedin, threads=threads, instagram=instagram)
        _logger.info("Quote repurposed", extra={"fields": {"quote_id": quote_id}})
        return {"ok": True, "linkedin": linkedin, "threads": threads, "instagram": instagram}
    except Exception as exc:
        _logger.exception("Quote repurpose failed", extra={"fields": {"quote_id": quote_id}})
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/quotes/{quote_id}/promote")
async def promote_quote_to_idea(quote_id: int, request: Request = None):
    if request is not None:
        auth.require_admin(request)
    quote = storage.get_quote(quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    idea_id = storage.create_idea(
        theme=quote["article_title"] or "Quote",
        category="Quote",
        emoji="💬",
        article_angle=quote["quote_text"][:200],
        source="quote",
    )
    _logger.info("Quote promoted to idea", extra={"fields": {"quote_id": quote_id, "idea_id": idea_id}})
    return {"ok": True, "idea_id": idea_id}
