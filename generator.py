"""
generator.py — All Claude API calls for the editorial pipeline.
Handles: related articles, companion generation, translation, repurposed content.

Parallelism strategy
────────────────────
Wave 1 (start immediately — only need reflection text):
  • find_related_articles
  • translate_to_spanish(reflection)      [if spanish enabled]
  • generate_repurposed_content(refl, EN) [each platform call in its own thread]

Orchestrated via FIRST_COMPLETED wait loop — each task submits its
downstream work the instant it finishes, regardless of what else is running:

  related done     → submit companion
  refl_es done     → submit refl_social_es
  companion done   → submit companion_es + comp_social_en  (both in parallel)
  companion_es done→ submit comp_social_es

Each generate_repurposed_content call also parallelises its 4 platform API calls.

Effective concurrency: related / refl_es / refl_social_en / companion all
overlap as much as possible. Companion derivatives start the moment companion
finishes — no waiting for unrelated tasks like refl_es to complete first.

Estimated wall time: ~60-80s vs ~200s sequential.
"""

from __future__ import annotations

import os
import re
import json
import queue
import threading
import unicodedata
from urllib.parse import urlsplit, urlunsplit
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed, wait, FIRST_COMPLETED
from typing import Any, Dict, List, Optional, Tuple

import anthropic
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    default_headers={"anthropic-beta": "prompt-caching-2024-07-31"},
)
MODEL = "claude-sonnet-4-5-20250929"


# ─── Token tracking ──────────────────────────────────────────────────────────

_run_tokens: Dict[str, int] = {"input": 0, "output": 0, "cache_write": 0, "cache_read": 0}
_token_lock = threading.Lock()

_PRICE_IN       = 3.0   / 1_000_000   # $3/MTok    input (cache miss)
_PRICE_CACHE_W  = 3.75  / 1_000_000   # $3.75/MTok cache write (5 min TTL)
_PRICE_CACHE_R  = 0.30  / 1_000_000   # $0.30/MTok cache read  (90% saving)
_PRICE_OUT      = 15.0  / 1_000_000   # $15/MTok   output


def reset_token_log() -> None:
    global _run_tokens
    with _token_lock:
        _run_tokens = {"input": 0, "output": 0, "cache_write": 0, "cache_read": 0}


def get_token_summary() -> Dict[str, Any]:
    with _token_lock:
        inp = _run_tokens["input"]
        out = _run_tokens["output"]
        cw  = _run_tokens["cache_write"]
        cr  = _run_tokens["cache_read"]
    cost = inp * _PRICE_IN + out * _PRICE_OUT + cw * _PRICE_CACHE_W + cr * _PRICE_CACHE_R
    return {
        "input_tokens":       inp,
        "output_tokens":      out,
        "cache_write_tokens": cw,
        "cache_read_tokens":  cr,
        "estimated_cost_usd": round(cost, 4),
    }


def _track_usage(usage) -> None:
    """Thread-safe token accounting including cache hits/misses."""
    with _token_lock:
        _run_tokens["input"]       += usage.input_tokens
        _run_tokens["output"]      += usage.output_tokens
        _run_tokens["cache_write"] += getattr(usage, "cache_creation_input_tokens", 0)
        _run_tokens["cache_read"]  += getattr(usage, "cache_read_input_tokens", 0)


def _call_claude(
    system: "str | list",
    user:   "str | list",
    max_tokens: int = 4096,
) -> str:
    """Base function for all Claude API calls. Thread-safe. Tracks token usage.
    Both `system` and `user` accept either a plain string or a list of content
    blocks (dicts with 'type', 'text', and optionally 'cache_control').
    """
    message = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": user}],
        system=system,
    )
    _track_usage(message.usage)
    return message.content[0].text.strip()


# ─── 1. Related Articles ─────────────────────────────────────────────────────

def find_related_articles(reflection: str, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    articles_list = "\n".join(
        f"{i+1}. {a['title']} — {a['summary'][:200]} ({a['url']})"
        for i, a in enumerate(articles)
    )
    system = "You are an editorial assistant helping a newsletter author find related past articles."

    # ── Block 1: the article index (stable within a day) → cached ─────────────
    # The index only changes when a new article is published (weekly). Caching it
    # means every pipeline run on the same day reads this block at ~10% cost.
    # The index grows over time — once it exceeds 1024 tokens it starts caching.
    articles_block = {
        "type": "text",
        "text": (
            "Here is the full index of past articles:\n"
            f"<articles>\n{articles_list}\n</articles>"
        ),
        "cache_control": {"type": "ephemeral"},
    }

    # ── Block 2: the new reflection (changes every run) → not cached ──────────
    reflection_block = {
        "type": "text",
        "text": (
            f"Here is a new article the author just wrote:\n\n"
            f"<reflection>\n{reflection[:3000]}\n</reflection>\n\n"
            "Pick the 3 most thematically related articles from the index above.\n"
            "Return ONLY a JSON array with this format, no other text:\n"
            "[\n"
            '  {"title": "...", "url": "...", "reason": "one sentence why it\'s related"},\n'
            '  {"title": "...", "url": "...", "reason": "one sentence why it\'s related"},\n'
            '  {"title": "...", "url": "...", "reason": "one sentence why it\'s related"}\n'
            "]"
        ),
    }

    response = _call_claude(system, [articles_block, reflection_block])
    start = response.find("[")
    end = response.rfind("]") + 1
    return json.loads(response[start:end])


# ─── 2. Paid Companion ────────────────────────────────────────────────────────

COMPANION_VOICE_BRIEF = """
VOICE, TONE & STYLE — read before writing:

This is a paid companion for a self-discipline newsletter. It is practical, dense, and research-backed.
It is NOT motivational. It does not cheer the reader on. It gives them tools and explains why they work.

Voice characteristics:
- Speaks directly to the reader as "you" — from their experience, not the author's perspective
- Clinical but warm. Like a sharp coach who explains the mechanism, not the feeling.
- Short sentences. Specific nouns. Active verbs. No filler.
- Names things concretely: katas have names, mental models cite actual researchers (name + institution), sequences have rationale
- The "Struggle" section must feel like the reader's own interior monologue — not an explanation of a problem, but a recognition
- "What You're Training" frames ONE specific meta-skill, not a list
- Each kata includes: a specific use case ("Use it when..."), numbered practice steps, a "Why it works" paragraph, and a Moment → Action → Effect example
- The sequence section explains WHY the katas go in that order — one paragraph per kata, with logic
- Mental models cite real research (Bandura, Gollwitzer, Neff, Cialdini, Marlatt, etc.) — actual names, actual institutions
- "Close & Return" ends with ONE word to carry forward — not a sentence, one word — and a closing line

What the writing never does:
- No hollow affirmations ("You've got this", "Believe in yourself", "You are capable")
- No vague abstractions ("mindset shift", "transformation", "journey", "level up")
- No self-help clichés ("unlock", "game-changer", "show up as your best self")
- No summarizing the reflection — the companion deepens it, it doesn't recap it
- No bullet points in prose sections (Struggle, What You're Training, Sequence rationale, Close & Return)
- The "Struggle" section never starts with "Most people..." — it starts inside the reader's experience

Sign-off is always:
---
Keep showing up.

— **Camilo Zambrano**
*Founder, Self Disciplined*
"""


# Known valid guide URLs on adaptable-discipline.com.
# Claude must ONLY use URLs from this list or URLs already present in the template.
# Never fabricate or guess guide URLs — a broken link is worse than no link.
KNOWN_GUIDE_URLS = """
KNOWN VALID GUIDE URLS (use only these, or URLs already in the template):
https://www.adaptable-discipline.com/guides/foundations/understanding-your-context/context-overview?utm_source=paid_companion
https://www.adaptable-discipline.com/guides/foundations/understanding-your-context/executive-function?utm_source=paid_companion
https://www.adaptable-discipline.com/guides/foundations/building-your-foundation/designing-low-friction-routines?utm_source=paid_companion
https://www.adaptable-discipline.com/guides/getting-started/minimum-viable-day?utm_source=paid_companion
https://www.adaptable-discipline.com/guides/getting-started/reality-check?utm_source=paid_companion

All guide links must include ?utm_source=paid_companion at the end.
Format: 👉 [Descriptive anchor text](URL)
NEVER invent a guide URL that is not in the list above or in the template. If uncertain, omit the link.
"""

# Approved URL paths (no query params) for validation — includes EN + ES variants
_KNOWN_GUIDE_URL_PATHS = {
    "https://www.adaptable-discipline.com/guides/foundations/understanding-your-context/context-overview",
    "https://www.adaptable-discipline.com/guides/foundations/understanding-your-context/executive-function",
    "https://www.adaptable-discipline.com/guides/foundations/building-your-foundation/designing-low-friction-routines",
    "https://www.adaptable-discipline.com/guides/getting-started/minimum-viable-day",
    "https://www.adaptable-discipline.com/guides/getting-started/reality-check",
    # Spanish versions
    "https://www.adaptable-discipline.com/guides/es/foundations/understanding-your-context/context-overview",
    "https://www.adaptable-discipline.com/guides/es/foundations/understanding-your-context/executive-function",
    "https://www.adaptable-discipline.com/guides/es/foundations/building-your-foundation/designing-low-friction-routines",
    "https://www.adaptable-discipline.com/guides/es/getting-started/minimum-viable-day",
    "https://www.adaptable-discipline.com/guides/es/getting-started/reality-check",
}


def validate_companion(content: str, template: str) -> list[str]:
    """
    Validates companion output against the template structure and known URLs.
    Returns a list of issue descriptions. Empty list = valid.
    """
    issues = []

    # ── 1. Check required section headers ────────────────────────────────────
    template_headers = re.findall(r'^#{1,4}\s+(.+)', template, re.MULTILINE)
    companion_headers_lower = {
        h.strip().lower()
        for h in re.findall(r'^#{1,4}\s+(.+)', content, re.MULTILINE)
    }

    for h in template_headers:
        h_text = h.strip()
        if '[' in h_text or not h_text:
            continue
        h_clean = re.sub(r'[\U00010000-\U0010ffff\u2600-\u27FF]+', '', h_text).strip().lower()
        matched = any(h_clean in ch for ch in companion_headers_lower)
        if not matched:
            issues.append(f'Missing section: "{h_text}"')

    # ── 2. Check adaptable-discipline.com links ───────────────────────────────
    ad_links = re.findall(
        r'https?://(?:www\.)?adaptable-discipline\.com/guides[^\s\)\]"\'>]+',
        content,
    )
    for link in ad_links:
        link_clean = re.sub(r'[,;.!?]+$', '', link)
        link_path = link_clean.split('?')[0].rstrip('/')
        if link_path not in _KNOWN_GUIDE_URL_PATHS:
            issues.append(f'Unknown guide URL (not in approved list): {link_clean}')

    return issues


def _slugify_title(title: str) -> str:
    """Build an ASCII Substack-style slug from a title."""
    normalized = unicodedata.normalize("NFKD", title or "")
    ascii_title = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9\s-]", " ", ascii_title.lower()).strip()
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def localize_article_url(article_url: str, localized_title: str) -> str:
    """Swap the article slug for a localized one while preserving host/query/fragment."""
    if not article_url.strip() or not localized_title.strip():
        return article_url

    parts = urlsplit(article_url)
    slug = _slugify_title(localized_title)
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


def generate_companion(
    reflection: str,
    reflection_title: str,
    reflection_url: str,
    template: str,
    related_articles: List[Dict[str, Any]],
) -> str:
    related_str = "\n".join(
        f"- {a['title']}: {a['reason']} ({a['url']})"
        for a in related_articles
    )
    system = "You are a ghostwriter for Camilo Zambrano, founder of Self Disciplined — a self-discipline newsletter. You write paid companion pieces that are dense, practical, and research-backed."

    # ── Stable prefix (template + style guides) → cached ─────────────────────
    # This block rarely changes between runs and is >1024 tokens, so it qualifies
    # for prompt caching (written once, read cheaply on retries and subsequent runs).
    static_block = {
        "type": "text",
        "text": (
            f"Here is the template. YOU MUST FOLLOW IT EXACTLY:\n"
            f"<template>\n{template}\n</template>\n\n"
            "TEMPLATE RULES — read carefully before writing:\n"
            "- Reproduce every section header, emoji, and structural element exactly as they appear in the template.\n"
            "- Match the template's section order, nesting, and formatting to the letter.\n"
            "- If the template has a specific number of katas, that is the number you write — no more, no fewer.\n"
            "- Do not add, remove, or rename sections. Do not invent structure not present in the template.\n"
            "- Every section must be complete and fully written — no \"[insert X here]\", no placeholders.\n"
            "- The only creative latitude is the actual content within each section.\n\n"
            f"{COMPANION_VOICE_BRIEF}\n\n"
            f"{KNOWN_GUIDE_URLS}\n\n"
            "The companion should make a paid subscriber feel they got something the free reflection didn't give them.\n"
            "Mental models must cite real researchers with name and institution."
        ),
        "cache_control": {"type": "ephemeral"},
    }

    # ── Dynamic suffix (reflection + related articles) → never cached ─────────
    dynamic_block = {
        "type": "text",
        "text": (
            f"Here is the free reflection article that this companion accompanies:\n\n"
            f"Reflection title: {reflection_title}\n"
            f"Reflection URL: {reflection_url or '[no reflection URL provided]'}\n\n"
            f"<reflection>\n{reflection}\n</reflection>\n\n"
            "When the template references [Reflection Title](link) or the reflection elsewhere, use the exact title and URL provided above. Do not invent or guess either one.\n\n"
            f"Here are 3 related past articles that can be linked or referenced:\n"
            f"<related_articles>\n{related_str}\n</related_articles>"
        ),
    }

    user = [static_block, dynamic_block]
    result = _call_claude(system, user, max_tokens=8000)

    # ── Validate and retry once if needed ─────────────────────────────────────
    issues = validate_companion(result, template)
    if issues:
        issue_list = "\n".join(f"- {i}" for i in issues)
        # On retry the static block is already cached — only pay for dynamic + fix note
        retry_dynamic = {
            "type": "text",
            "text": (
                dynamic_block["text"]
                + f"\n\n───\nYour previous output had the following issues that MUST be fixed:\n{issue_list}\n\n"
                "Return the complete corrected companion fixing ONLY these issues. Do not change anything else."
            ),
        }
        result = _call_claude(system, [static_block, retry_dynamic], max_tokens=8000)

    return result


# ─── 3. Translation ──────────────────────────────────────────────────────────

SPANISH_STYLE_GUIDE = """
TRANSLATION RULES — follow every rule exactly:

ACCURACY:
- Translate VERBATIM. Render every sentence, every idea, every detail faithfully.
- Do NOT add content that is not in the original.
- Do NOT remove or omit any content from the original.
- Do NOT paraphrase, summarize, or reorder ideas.
- Do NOT alter facts, names of concepts, researchers, or practices.
- The translation must be a complete, faithful mirror of the source.

SECTION HEADERS — translate these exactly:
- 🧭 The Struggle → 🧭 La Lucha
- 🎯 What You're Training → 🎯 Lo Que Estás Entrenando
- ⚡ The Katas → ⚡ Los Katas
- 🔄 The Sequence → 🔄 La Secuencia
- 🥋 Daily Dojo → 🥋 Dojo Diario
- 💭 Food for Thought → 💭 Para Reflexionar
- 🧠 Mental Models → 🧠 Modelos Mentales
- 🔑 Actionable Insights → 🔑 Perspectivas Accionables
- 🏁 Weekly Challenge → 🏁 Desafío Semanal
- 🔄 Close & Return → 🔄 Cierre y Retorno
- 📚 Suggested Reads → 📚 Lecturas Sugeridas
- 📬 Quick Announcements → 📬 Anuncios Rápidos
- 🛍 Member Perks → 🛍 Beneficios para Miembros
- 🤝 Community Notes → 🤝 Notas de la Comunidad

SPECIFIC TERMS:
- "companion" (referring to this document type) → "compañero"
- "paid companion" → "compañero de pago"
- "katas" → "katas" (never translate; use article: "los katas", "este kata", "el kata")
- "kata" (singular) → "kata"
- "Keep showing up." → "Sigue así."
- "Founder, Self Disciplined" → keep exactly as-is (brand)
- Brand names unchanged: Self Disciplined, Adaptable Discipline, Camilo Zambrano

LINKS — critical rules:
- Translate the link anchor text (the [text] part of markdown links) into Spanish.
- Translate any descriptive text accompanying a link.
- For adaptable-discipline.com guide URLs: insert /es/ after /guides/ in the path.
  Example: https://www.adaptable-discipline.com/guides/foundations/understanding-your-context/executive-function
       →   https://www.adaptable-discipline.com/guides/es/foundations/understanding-your-context/executive-function
  Example: https://www.adaptable-discipline.com/guides/getting-started/minimum-viable-day?utm_source=paid_companion
       →   https://www.adaptable-discipline.com/guides/es/getting-started/minimum-viable-day?utm_source=paid_companion
- self-disciplined.com article links → Find the matching article in spanish for the original reflection. 
  If you can't find one, it might be because it's a new, unpublished article, so calculate the slug for the 
  translated reflection.
  Example: https://www.self-disciplined.com/p/does-your-word-still-mean-something 
       →   https://www.self-disciplined.com/p/tu-palabra-todavia-vale-algo
- All other URLs → keep exactly as-is.
- Preserve the full markdown link structure: [translated anchor text](transformed URL)

STYLE:
- Use "tú" (informal direct address), never "usted"
- Latin American neutral Spanish — no vosotros, no regional slang
- Aim for natural phrasing while remaining faithful to the source meaning
- Preserve ALL markdown formatting exactly: headings, bold, italic, emoji, lists, horizontal rules
- Do not add translator notes or any extra text
- Return only the translated content, nothing else
"""


def translate_to_spanish(text: str, content_type: str = "article") -> str:
    system = "You are a professional translator. Your job is to produce a complete, verbatim Spanish translation — faithful to every detail of the source, with no additions, omissions, or alterations. You follow link transformation rules exactly."

    # ── Stable prefix: translation rules → cached ─────────────────────────────
    static_block = {
        "type": "text",
        "text": (
            f"Translate the following {content_type} to neutral Spanish.\n\n"
            f"{SPANISH_STYLE_GUIDE}\n\n"
            "Return ONLY the translated text. No preamble, no explanation, no translator notes."
        ),
        "cache_control": {"type": "ephemeral"},
    }

    # ── Dynamic: actual content → not cached ─────────────────────────────────
    dynamic_block = {
        "type": "text",
        "text": f"<content>\n{text}\n</content>",
    }

    return _call_claude(system, [static_block, dynamic_block], max_tokens=8000)


def build_spanish_reflection_context(
    reflection_title: str,
    article_url: str,
    translated_reflection: str = "",
) -> Dict[str, Any]:
    """Derive the Spanish title from the translated reflection when possible."""
    translated_title = _extract_title(translated_reflection).strip()
    if not translated_title:
        translated_title = translate_to_spanish(reflection_title, "newsletter article title").strip()
    return {
        "title": translated_title,
        "url": localize_article_url(article_url, translated_title),
    }


def _initial_pipeline_values(checkpoint: Dict[str, Any]) -> Dict[str, Any]:
    """Build the mutable pipeline state from a checkpoint payload."""
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


def _ensure_spanish_reflection_context(vals: Dict[str, Any], reflection_title: str, article_url: str) -> None:
    """Populate Spanish title/URL once and reuse them across derivative tasks."""
    if vals["reflection_es_title"]:
        return
    ctx = build_spanish_reflection_context(reflection_title, article_url, vals["reflection_es"])
    vals["reflection_es_title"] = ctx["title"]
    vals["reflection_es_url"] = ctx["url"]


# ─── 4. Repurposed Content (with internal parallelism) ───────────────────────

VOICE_BRIEF = """
VOICE & STYLE — read this carefully before writing:

This author writes for three overlapping audiences:
1. Parents trying to model better behavior for their kids and become better partners in relationships.
2. People in the AuDHD space who relate to executive dysfunction — the gap between knowing what to do and actually doing it.
3. Professionals who feel the tension between performing at work and struggling at home, in relationships, or with their own brain wiring.

The writing speaks to that tension without being preachy, clinical, or motivational. It sounds like a smart, honest friend explaining something at dinner.

What the writing does:
- Opens with a bold, counterintuitive claim or a sharp observation. No wind-up, no preamble.
- Uses short paragraphs. Often 1-3 sentences. Sometimes a single sentence on its own line for weight.
- Names things concretely — specific rules, analogies, mechanisms ("The Two-Day Rule", "the thermostat vs. the on/off switch"). Not vague concepts.
- Shows the contrast between the common approach and the better one — without lecturing.
- Trusts the reader. Doesn't over-explain. Doesn't repeat the same point in three ways.
- Ends with one clean takeaway or a question that earns itself — not a generic CTA.

What the writing never does:
- No hollow affirmations ("You've got this", "Believe in yourself")
- No motivational clichés ("game-changer", "unlock your potential", "journey", "transform", "level up")
- No filler openers ("In today's fast-paced world...", "Have you ever wondered...", "I'm excited to share...")
- No bullet lists of tips — ideas live in prose
- No summarizing the article — pick one angle and develop it fully
- No manufactured urgency or false intimacy
- No explicitly naming diagnoses or demographics — the reader should recognize themselves, not be labeled
"""

# ─── Platform Personas ────────────────────────────────────────────────────────

PLATFORM_PERSONAS: Dict[str, Any] = {
    "linkedin": {
        "audience": "Mid-career professionals (30–45) who perform well at work but struggle with consistency, parenting, or relationships outside it. They follow self-discipline content because the gap between professional performance and personal consistency bothers them. Skeptical of corporate speak and motivational fluff.",
        "funnel_stage": "Awareness → Consideration. Many are discovering the brand. Lead with professional-personal tension; the Adaptable Discipline framework is the payoff, not the hook.",
    },
    "instagram": {
        "audience": "Parents, partners, and people who recognize executive dysfunction in themselves without needing a clinical label. They scroll for honesty, not aspiration. They know what it feels like to know better and still not do better.",
        "funnel_stage": "Top of funnel. First impression. The hook must feel like a quiet recognition or a close friend's observation — not a sales pitch. Build curiosity toward the newsletter.",
    },
    "threads": {
        "audience": "A broad mix — some already follow the newsletter, many encountering the brand for the first time. They want sharp, standalone observations that make them pause mid-scroll. No patience for warm-up.",
        "funnel_stage": "Top of funnel. Awareness only. Max 280 characters. One complete thought. Make it worth stopping for — they'll find the newsletter if the thought lands.",
    },
    "substack_note": {
        "audience": "Existing or near-subscribers who already read long-form content about self-discipline, behavior, and consistency. They're thoughtful, self-aware, and allergic to oversimplification. They know the brand and trust the author.",
        "funnel_stage": "Bottom of funnel. Retention and depth. Assume familiarity with the brand. Go deeper, not broader — surface a nuance or tension the article only touched. Drive them to read the full piece.",
    },
}

THUMBNAIL_PROMPT = ""


PLATFORM_PROMPTS = {
    "linkedin": {
        "system": "You are a ghostwriter who captures this author's exact voice for LinkedIn. You write posts for an audience of professionals who are also parents, partners, or people navigating executive dysfunction — people who follow self-discipline content because it matters at work AND at home.",
        "instructions": """Write 4 LinkedIn posts based on this article. Each takes a completely different angle — a different insight, tension, rule, or moment from the article.

Your audience: professionals who feel the friction between performing at work and struggling with consistency, parenting, or relationships. They're smart, self-aware, and allergic to corporate speak.

FORMAT for each post:
- A title line like: ## Post N — [Short descriptive name]
- First line: a specific, bold claim — not a question, not "I've been thinking about…". Speaks to the professional-personal tension. No "I" as the first word.
- 2-4 short paragraphs (1-3 sentences each). Concrete. Sounds like a conversation at dinner, not a LinkedIn thought leader post.
- One closing line or reflection question that earns itself.
- Article link on its own line: [ARTICLE_LINK]
- 3-4 hashtags on the last line. Pick from: #parenting #ADHD #executivefunction #selfleadership #discipline #performance #habits #relationships

LENGTH: 150–250 words per post. No padding. Every sentence must earn its place.

Separate posts with: ---""",
        "max_tokens": 2000,
    },
    "instagram": {
        "system": "You are a ghostwriter who captures this author's exact voice for Instagram. You write captions for an audience of parents, people in the AuDHD space, and partners trying to grow — people who follow self-improvement content because they feel the gap between who they are and who they want to be.",
        "instructions": """Write 3 Instagram captions based on this article. Each takes a different emotional angle.

Your audience: parents trying to show up better for their kids, people who know what executive dysfunction feels like without needing a label, partners working on themselves. They respond to honesty, relatable moments, and insights that feel like something a close friend would say at 11pm.

FORMAT for each caption:
- A title line like: ## Caption N — [Short descriptive name]
- First line: a raw, honest hook. Under 15 words. Must feel like the opening of a confession or a quiet realization — not a motivational poster. This line is shown before "more" in the feed; make it count.
- 3-5 short paragraphs. Conversational. Like you're talking to one specific person who gets it. No fluff, no performance.
- A closing question or observation that lands. Invites reflection, not engagement-bait.
- 👉 Link in bio (on its own line)
- 8-10 hashtags on the last line. Mix niche and broad. Choose from: #parenting #audhd #adhdparenting #selfregulation #neurodiversity #discipline #relationships #habitbuilding #reallife #executivefunction #parentinglife

LENGTH: 150–220 words per caption (not counting hashtags). No hollow affirmations.

Separate captions with: ---""",
        "max_tokens": 1400,
    },
    "threads": {
        "system": "You are a ghostwriter who captures this author's exact voice for Threads. You write short, standalone observations for people who follow self-discipline, parenting, neurodiversity, and relationship content — people who appreciate sharp, honest insights over lectures.",
        "instructions": """Write 5 Threads posts based on this article. Each is a single, complete thought — not a thread, not a list. One post at a time.

Your audience scrolls Threads for things that make them pause. They want insights that feel like something you'd say out loud at dinner — unfiltered, specific, human.

FORMAT for each post:
- A title line like: ## Thread N — [Short descriptive name]
- The post itself: 150–280 characters. One complete thought. No bold. Short sentences or fragments.
  Style options: a reframe ("We call it laziness. It's usually overwhelm."), a small uncomfortable truth, a question worth sitting with, or a concrete observation from the article.
- NO hashtags. NO links. NO formatting beyond plain text.

COUNT YOUR CHARACTERS CAREFULLY. Hard limit: 280 characters per post.

Separate posts with: ---""",
        "max_tokens": 700,
    },
    "substack_note": {
        "system": "You are a ghostwriter who captures this author's exact voice for Substack Notes. You write tight, observational paragraphs for thoughtful readers who already know what motivational content looks like.",
        "instructions": """Write 4 Substack Notes based on this article. Each takes one specific idea and develops it in its own space — no referencing "the article" awkwardly. Each stands alone.

Your audience reads long-form newsletters about self-discipline, behavior, and consistency. They're parents, partners, and people navigating executive dysfunction — but you never call them out. They recognize themselves.

FORMAT for each note:
- A title line: ## Note N — [Short descriptive name]
- 3–4 short paragraphs (1–3 sentences each). Pure prose. No bullet points. No bold.
- Observational, not instructional — watch something happen, name it, let it land. Don't tell the reader what to do.
- The last paragraph is often the shortest: a reframe, a quiet conclusion, or a single punchy line.
- 👉 [ARTICLE_LINK] on its own line after the last paragraph (plain URL, no extra text around it).
- No hashtags.

LENGTH: strictly 100 words maximum per note (not counting title or link line). Count your words. Hard limit: 100 words. Every word earns its place.

Separate notes with: ---""",
        "max_tokens": 900,
    },
}


# ─── Tone calibration ─────────────────────────────────────────────────────────

TONE_LEVEL: int = 5   # 0 = warmest / most empathetic, 10 = most direct / blunt


def set_tone_level(level: int) -> None:
    global TONE_LEVEL
    TONE_LEVEL = max(0, min(10, level))


def _tone_instruction() -> str:
    if TONE_LEVEL <= 3:
        return "\nTONE CALIBRATION: Lean warmer and more empathetic than your default. Softer edges. Let the insight arrive quietly."
    if TONE_LEVEL >= 7:
        return "\nTONE CALIBRATION: Be more direct and less hedging than your default. If an observation is uncomfortable, say it plainly. No softening."
    return ""


# ─── Hook diversity check ─────────────────────────────────────────────────────

def _extract_hooks(raw_text: str) -> list[str]:
    """Extract first meaningful sentence from each post section (skip titles and links)."""
    hooks = []
    for section in re.split(r'\n---\n', raw_text):
        lines = [
            l.strip() for l in section.splitlines()
            if l.strip()
            and not l.strip().startswith('#')
            and not l.strip().startswith('👉')
            and not l.strip().startswith('http')
        ]
        if lines:
            words = lines[0].split()[:8]
            hooks.append(' '.join(words).lower())
    return hooks


def check_hook_diversity(results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check if any platform has posts with too-similar opening hooks.
    Returns {platform: True/False} where True = diversity issue detected.
    """
    issues = {}
    for platform, content in results.items():
        hooks = _extract_hooks(content)
        flagged = False
        if len(hooks) >= 2:
            for i in range(len(hooks)):
                for j in range(i + 1, len(hooks)):
                    words_i = set(hooks[i].split())
                    words_j = set(hooks[j].split())
                    if len(words_i & words_j) >= 5:
                        flagged = True
                        break
                if flagged:
                    break
        issues[platform] = flagged
    return issues


# ─── Repurposed Content ───────────────────────────────────────────────────────

def _call_platform_raw(config: dict, user: "str | list") -> str:
    """Single platform Claude call with token tracking. Shared by both generate functions."""
    message = client.messages.create(
        model=MODEL,
        max_tokens=config["max_tokens"],
        messages=[{"role": "user", "content": user}],
        system=config["system"],
    )
    _track_usage(message.usage)
    return message.content[0].text.strip()


def _build_platform_user(
    text: str,
    title: str,
    article_url: str,
    config: Dict[str, Any],
    language: str,
    tone: str,
    platform: str = "",
    repurpose_note: str = "",
) -> list:
    """Returns a two-block content list for prompt caching.

    Block 1 (cached): VOICE_BRIEF + persona + platform instructions.
      This content is identical across every article for a given platform, so it
      gets written to the cache once and read cheaply on subsequent calls.

    Block 2 (dynamic): article text + language + URL + repurpose context.
      Changes every run, so it is never cached.
    """
    lang_instruction = (
        "" if language == "english"
        else f"\nWrite everything in {language} — neutral, no regional variations. Preserve the same voice and tone."
    )

    # Persona block (stable per platform)
    persona_block = ""
    if platform and platform in PLATFORM_PERSONAS:
        p = PLATFORM_PERSONAS[platform]
        persona_block = (
            f"\nPLATFORM AUDIENCE: {p['audience']}"
            f"\nFUNNEL STAGE: {p['funnel_stage']}"
        )

    # ── Block 1: stable per-platform content → cached ─────────────────────────
    static_block = {
        "type": "text",
        "text": f"{VOICE_BRIEF}{persona_block}\n{config['instructions']}{lang_instruction}{tone}",
        "cache_control": {"type": "ephemeral"},
    }

    # ── Block 2: per-article content → not cached ─────────────────────────────
    repurpose_block = f"\nREPURPOSE CONTEXT: {repurpose_note}" if repurpose_note else ""
    dynamic_block = {
        "type": "text",
        "text": (
            f"Article title: {title}\n\n"
            f"Article content:\n<article>\n{text[:5000]}\n</article>"
            f"{repurpose_block}\n\n"
            f"Replace [ARTICLE_LINK] with: {article_url if article_url else '[insert article URL]'}\n\n"
            "Return only the posts, no preamble or explanation."
        ),
    }

    return [static_block, dynamic_block]


def generate_repurposed_content(
    text: str,
    title: str,
    article_url: str = "",
    language: str = "english",
    repurpose_note: str = "",
) -> Dict[str, Any]:
    """
    Generates repurposed content for all 4 platforms IN PARALLEL.
    All 4 Claude API calls run simultaneously in a thread pool.
    Returns a dict with keys: linkedin, instagram, threads, substack_note.
    """
    tone = _tone_instruction()

    def call_platform(platform: str, config: Dict[str, Any]) -> Tuple[str, str]:
        user = _build_platform_user(
            text, title, article_url, config, language, tone,
            platform=platform, repurpose_note=repurpose_note,
        )
        return platform, _call_platform_raw(config, user)

    results = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            pool.submit(call_platform, p, c): p
            for p, c in PLATFORM_PROMPTS.items()
        }
        for future in as_completed(futures):
            platform, content = future.result()
            results[platform] = content

    return results


def generate_single_platform(
    text: str,
    title: str,
    article_url: str,
    platform: str,
    language: str = "english",
    repurpose_note: str = "",
) -> str:
    """Regenerate social posts for a single platform (used by the regenerate endpoint)."""
    if platform not in PLATFORM_PROMPTS:
        raise ValueError(f"Unknown platform: {platform}")
    config = PLATFORM_PROMPTS[platform]
    tone = _tone_instruction()
    user = _build_platform_user(
        text, title, article_url, config, language, tone,
        platform=platform, repurpose_note=repurpose_note,
    )
    return _call_platform_raw(config, user)


PILLARS: Dict[str, str] = {
    "Mindset": (
        "The mental framework that makes comeback speed possible. Covers awareness of drift, "
        "responsibility, adaptability, and self-compassion. Redefines discipline as a recoverable "
        "system — comeback speed over streaks, setbacks as data rather than failures."
    ),
    "Purpose": (
        "The compass of Adaptable Discipline. Covers the Why Stack (values → motivation → goals), "
        "North Star, near-term aims, keystone commitments, guardrails, quit criteria, and seasons "
        "(Build, Maintain, Recover). Aligns actions with meaningful direction."
    ),
    "Tools": (
        "The scaffolding that turns intention into reliable action. Covers environment design, "
        "protocols and playbooks, templates, automation, recovery kits, and systems thinking. "
        "Reduces friction and makes comeback paths simple and repeatable."
    ),
    "Metrics": (
        "The observability layer. Covers comeback speed measurement, detection latency, alignment "
        "rate, flexibility ratio, and tracking for clarity without shame. Makes invisible patterns "
        "visible to support system adjustment — not judgment."
    ),
}


def tag_reflection(reflection: str, title: str) -> List[str]:
    """Return the 2 most relevant Adaptable Discipline pillars, in priority order."""
    pillar_text = "\n".join(f"- {name}: {desc}" for name, desc in PILLARS.items())
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=60,
        messages=[{
            "role": "user",
            "content": (
                "Tag this newsletter article with exactly 2 pillars from the Adaptable Discipline "
                "framework, in priority order (most relevant first).\n\n"
                f"Pillars:\n{pillar_text}\n\n"
                f"Article title: {title}\n\n"
                f"Article excerpt:\n{reflection[:3000]}\n\n"
                'Respond with ONLY a JSON array of 2 names. Example: ["Mindset", "Purpose"]\n'
                "Valid names (use exact casing): Mindset, Purpose, Tools, Metrics"
            )
        }],
    )
    raw = response.content[0].text.strip()
    try:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        tags = json.loads(raw[start:end])
        valid = [t for t in tags if t in PILLARS]
        return valid[:2]
    except Exception:
        found = [p for p in PILLARS if p in raw]
        return found[:2]


def extract_quotes(reflection: str, title: str) -> List[Dict[str, Any]]:
    """Extract 5–8 shareable quotes/insights from an article using Claude Haiku."""
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200,
        messages=[{
            "role": "user",
            "content": (
                "Extract 5 to 8 shareable quotes or standalone insights from this newsletter article. "
                "These should be the sharpest, most self-contained lines — the kind that land on social media "
                "without needing context: bold claims, counterintuitive observations, concrete rules, vivid analogies.\n\n"
                "Avoid anything that is a summary, a transition, or only makes sense in context.\n\n"
                f"Article title: {title}\n\n"
                f"Article:\n{reflection[:6000]}\n\n"
                "Respond with ONLY a JSON array of objects. Each object must have:\n"
                '  "quote": the exact text (1–3 sentences, verbatim from the article)\n'
                '  "context": one sentence explaining why this quote stands alone\n'
                '  "type": one of: insight | rule | analogy | observation | question\n\n'
                'Example: [{"quote": "...", "context": "...", "type": "insight"}, ...]\n'
                "Output ONLY the JSON array, no other text."
            )
        }],
    )
    raw = response.content[0].text.strip()
    try:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        quotes = json.loads(raw[start:end])
        if isinstance(quotes, list):
            return [
                {
                    "quote_text": q.get("quote", ""),
                    "context": q.get("context", ""),
                    "quote_type": q.get("type", "insight"),
                }
                for q in quotes
                if isinstance(q, dict) and q.get("quote")
            ][:8]
    except Exception:
        pass
    return []


def generate_repurposed_from_archive(
    text: str,
    title: str,
    article_url: str = "",
    original_date: str = "",
    angle_note: str = "",
    language: str = "english",
) -> Dict[str, Any]:
    """
    Generate fresh social posts from an archived / previously published article.
    Adds a repurpose framing note so Claude understands the context:
    this is evergreen content being resurfaced, not a new piece.
    Optionally focuses on a specific angle.
    """
    framing_parts = ["This content is from a previously published article being resurfaced."]
    if original_date:
        framing_parts.append(f"Originally published: {original_date}.")
    framing_parts.append(
        "Generate posts that feel fresh and current — do NOT use 'throwback', 'flashback', or 'originally published' framing. "
        "The insight is timeless. Write as if discovering it today."
    )
    if angle_note:
        framing_parts.append(f"Focus specifically on this angle: {angle_note}")

    repurpose_note = " ".join(framing_parts)
    return generate_repurposed_content(
        text=text,
        title=title,
        article_url=article_url,
        language=language,
        repurpose_note=repurpose_note,
    )


def generate_companion_only(
    reflection: str,
    reflection_title: str,
    template: str,
    article_url: str = "",
    include_spanish: bool = True,
) -> Dict[str, Any]:
    """
    Generate only the paid companion flow:
    companion EN, and optionally companion ES.
    """
    companion_en = generate_companion(
        reflection,
        reflection_title,
        article_url,
        template,
        [],
    )
    companion_title = _extract_title(companion_en) or f"{reflection_title} — Companion"

    companion_es = ""
    companion_es_title = ""
    if include_spanish:
        companion_es = translate_to_spanish(companion_en, "newsletter companion piece")
        companion_es_title = _extract_title(companion_es)

    return {
        "companion": {
            "title": companion_title,
            "title_es": companion_es_title,
            "en": companion_en,
            "es": companion_es,
        },
    }


# ─── 5. Config overrides ─────────────────────────────────────────────────────

def apply_config_overrides(config: Dict[str, Any]) -> None:
    """
    Update module-level prompt constants from a config dict.
    Called at startup (from saved config file) and after a UI save.
    Keys: "voice_brief", "companion_voice_brief", "spanish_style_guide",
          "tone_level", "platform_personas"
    """
    global VOICE_BRIEF, COMPANION_VOICE_BRIEF, SPANISH_STYLE_GUIDE, PLATFORM_PERSONAS
    if "voice_brief" in config:
        VOICE_BRIEF = config["voice_brief"]
    if "companion_voice_brief" in config:
        COMPANION_VOICE_BRIEF = config["companion_voice_brief"]
    if "spanish_style_guide" in config:
        SPANISH_STYLE_GUIDE = config["spanish_style_guide"]
    if "tone_level" in config:
        set_tone_level(int(config["tone_level"]))
    if "platform_personas" in config and isinstance(config["platform_personas"], dict):
        for platform, persona in config["platform_personas"].items():
            if platform in PLATFORM_PERSONAS and isinstance(persona, dict):
                PLATFORM_PERSONAS[platform].update(persona)


def get_current_prompts() -> Dict[str, Any]:
    """Return current effective values of the editable prompt constants."""
    return {
        "voice_brief": VOICE_BRIEF,
        "companion_voice_brief": COMPANION_VOICE_BRIEF,
        "spanish_style_guide": SPANISH_STYLE_GUIDE,
        "tone_level": TONE_LEVEL,
        "platform_personas": PLATFORM_PERSONAS,
    }


# ─── 6. Full Pipeline (streaming with parallelism) ───────────────────────────

def _submit_companion_derivatives(
    pool, add, emit, prog, vals: Dict[str, Any], cp: Dict[str, Any],
    include_spanish: bool, article_url: str,
) -> None:
    """
    Submit companion_es (if spanish) and comp_social_en immediately after
    companion text is available. Called from the FIRST_COMPLETED loop both
    when companion finishes live and when it's restored from checkpoint.
    """
    comp = vals["companion"]
    ctitle = vals["companion_title"]

    if vals["comp_social_en"]:
        emit("companion_social_en", vals["comp_social_en"])
    else:
        prog("Generating social content — Companion (EN)…")
        def _do_comp_social_en(c=comp, ct=ctitle):
            r = generate_repurposed_content(c, ct, article_url, "english")
            prog("Companion social (EN) done", done=True)
            emit("companion_social_en", r)
            return r
        add(pool.submit(_do_comp_social_en), "comp_social_en")

    if include_spanish:
        if vals["companion_es"]:
            emit("companion_es", cp["companion_es"])
        else:
            prog("Translating companion to Spanish…")
            def _do_companion_es(c=comp):
                t = translate_to_spanish(c, "newsletter companion piece")
                prog("Companion translated", done=True)
                emit("companion_es", {"content": t})
                return t
            add(pool.submit(_do_companion_es), "companion_es")


def run_full_pipeline_stream(
    reflection: str,
    reflection_title: str,
    template: str,
    articles: List[Dict[str, Any]],
    article_url: str = "",
    include_spanish: bool = True,
    checkpoint: Optional[Dict[str, Any]] = None,
    on_step_complete=None,
    cancel_event: threading.Event = None,
):
    """
    Runs the full editorial pipeline with maximum parallelism.

    Uses a background thread + ThreadPoolExecutor for parallel API calls,
    pushing SSE events to a queue as each task completes.
    The generator yields from the queue so the HTTP response streams live.

    Dependency graph:
      [related] ──────────────────────────────→ [companion_en]
      [reflection] ──→ [refl_es] ─────────────→ [refl_social_es]
      [reflection] ──→ [refl_social_en]
      [companion_en] → [companion_es] ─────────→ [comp_social_es]
      [companion_en] → [comp_social_en]

    Orchestration uses FIRST_COMPLETED wait so each downstream task is
    submitted the instant its dependency finishes — companion derivatives
    start as soon as companion is ready, without waiting for refl_es.
    """
    DONE = object()
    q: queue.Queue = queue.Queue()
    cp = checkpoint or {}
    lock = threading.Lock()

    def is_cancelled() -> bool:
        return cancel_event is not None and cancel_event.is_set()

    def push(event: str, data) -> None:
        q.put(f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n")

    def prog(msg: str, done: bool = False) -> None:
        push("progress", {"message": msg, "done": done})

    def emit(key: str, data) -> None:
        """Push content event and save checkpoint (thread-safe)."""
        if on_step_complete:
            with lock:
                on_step_complete(key, data)
        push(key, data)

    def pipeline() -> None:
        try:
            with ThreadPoolExecutor(max_workers=12) as pool:

                if is_cancelled():
                    push("error", {"message": "Cancelled."})
                    return

                # ── Accumulated results ───────────────────────────────────
                vals = _initial_pipeline_values(cp)

                # pending maps Future → task-name string
                pending: Dict[str, Any] = {}

                def add(fut, name: str) -> None:
                    pending[fut] = name

                # ── Wave 1: replay checkpointed results, submit missing ────

                if vals["related"] is not None:
                    push("related_articles", vals["related"])
                else:
                    prog("Finding related articles…")
                    def _do_related():
                        r = find_related_articles(reflection, articles)
                        prog("Found 3 related articles", done=True)
                        emit("related_articles", r)
                        return r
                    add(pool.submit(_do_related), "related")

                if include_spanish:
                    if vals["reflection_es"]:
                        push("reflection_es", cp["reflection_es"])
                        _ensure_spanish_reflection_context(vals, reflection_title, article_url)
                    else:
                        prog("Translating reflection to Spanish…")
                        def _do_refl_es():
                            t = translate_to_spanish(reflection, "newsletter article")
                            prog("Reflection translated", done=True)
                            emit("reflection_es", {"content": t})
                            return t
                        add(pool.submit(_do_refl_es), "refl_es")

                if vals["refl_social_en"]:
                    push("reflection_social_en", vals["refl_social_en"])
                else:
                    prog("Generating social content — Reflection (EN)…")
                    def _do_refl_social_en():
                        r = generate_repurposed_content(reflection, reflection_title, article_url, "english")
                        prog("Reflection social (EN) done", done=True)
                        emit("reflection_social_en", r)
                        return r
                    add(pool.submit(_do_refl_social_en), "refl_social_en")

                # If companion was checkpointed, replay it and immediately
                # submit its derivatives.
                if vals["companion"]:
                    push("companion_en", cp["companion_en"])
                    _submit_companion_derivatives(
                        pool, add, emit, prog, vals, cp,
                        include_spanish, article_url,
                    )
                else:
                    prog("Generating paid companion…")
                    related_snap = vals["related"] or []
                    def _do_companion(r=related_snap):
                        text = generate_companion(reflection, reflection_title, article_url, template, r)
                        title = _extract_title(text) or f"{reflection_title} — Companion"
                        prog("Paid companion generated", done=True)
                        emit("companion_en", {"content": text, "title": title})
                        return text, title
                    add(pool.submit(_do_companion), "companion")

                # ── Tagging (runs in parallel with everything else) ────────
                if vals["tags"]:
                    push("tags", vals["tags"])
                else:
                    prog("Tagging reflection…")
                    def _do_tagging():
                        tags = tag_reflection(reflection, reflection_title)
                        prog("Reflection tagged", done=True)
                        emit("tags", tags)
                        return tags
                    add(pool.submit(_do_tagging), "tagging")

                # ── Quote extraction (runs in parallel) ───────────────────
                if vals["quotes"]:
                    push("quotes", vals["quotes"])
                else:
                    prog("Extracting shareable quotes…")
                    def _do_quotes():
                        quotes = extract_quotes(reflection, reflection_title)
                        prog("Quotes extracted", done=True)
                        emit("quotes", quotes)
                        return quotes
                    add(pool.submit(_do_quotes), "quotes")

                # ── FIRST_COMPLETED event loop ────────────────────────────
                while pending:
                    if is_cancelled():
                        push("error", {"message": "Cancelled."})
                        return

                    done_futs, _ = wait(pending.keys(), return_when=FIRST_COMPLETED)

                    for fut in done_futs:
                        name = pending.pop(fut)
                        result = fut.result()   # re-raises worker exceptions

                        if name == "related":
                            vals["related"] = result
                            pass

                        elif name == "refl_es":
                            vals["reflection_es"] = result
                            _ensure_spanish_reflection_context(vals, reflection_title, article_url)
                            if vals["refl_social_es"]:
                                push("reflection_social_es", vals["refl_social_es"])
                            else:
                                prog("Generating social content — Reflection (ES)…")
                                refl_es_snap = result
                                def _do_refl_social_es(t=refl_es_snap):
                                    r = generate_repurposed_content(
                                        t,
                                        vals["reflection_es_title"],
                                        vals["reflection_es_url"],
                                        "Spanish",
                                    )
                                    prog("Reflection social (ES) done", done=True)
                                    emit("reflection_social_es", r)
                                    return r
                                add(pool.submit(_do_refl_social_es), "refl_social_es")

                        elif name == "companion":
                            comp_text, comp_title = result
                            vals["companion"] = comp_text
                            vals["companion_title"] = comp_title
                            _submit_companion_derivatives(
                                pool, add, emit, prog, vals, cp,
                                include_spanish, article_url,
                            )

                        elif name == "companion_es":
                            vals["companion_es"] = result
                            vals["companion_es_title"] = (
                                _extract_title(result)
                                or translate_to_spanish(vals["companion_title"], "newsletter companion title")
                            )
                            ctitle_snap = vals["companion_es_title"]
                            comp_es_snap = result
                            if vals["comp_social_es"]:
                                push("companion_social_es", vals["comp_social_es"])
                            else:
                                prog("Generating social content — Companion (ES)…")
                                def _do_comp_social_es(t=comp_es_snap, ct=ctitle_snap):
                                    r = generate_repurposed_content(
                                        t,
                                        ct,
                                        vals["reflection_es_url"],
                                        "Spanish",
                                    )
                                    prog("Companion social (ES) done", done=True)
                                    emit("companion_social_es", r)
                                    return r
                                add(pool.submit(_do_comp_social_es), "comp_social_es")

                        elif name == "tagging":
                            vals["tags"] = result
                        elif name == "quotes":
                            vals["quotes"] = result
                        elif name == "refl_social_en":
                            vals["refl_social_en"] = result
                        elif name == "refl_social_es":
                            vals["refl_social_es"] = result
                        elif name == "comp_social_en":
                            vals["comp_social_en"] = result
                        elif name == "comp_social_es":
                            vals["comp_social_es"] = result

                if is_cancelled():
                    push("error", {"message": "Cancelled."})
                    return

                # ── Final result event ─────────────────────────────────────
                result = {
                    "related_articles": vals["related"],
                    "tags": vals["tags"],
                    "quotes": vals["quotes"],
                    "reflection": {
                        "en": reflection,
                        "es": vals["reflection_es"],
                        "repurposed_en": vals["refl_social_en"],
                        "repurposed_es": vals["refl_social_es"],
                    },
                    "companion": {
                        "title": vals["companion_title"],
                        "en": vals["companion"],
                        "es": vals["companion_es"],
                        "repurposed_en": vals["comp_social_en"],
                        "repurposed_es": vals["comp_social_es"],
                    },
                }
                push("result", result)

        except Exception as e:
            push("error", {"message": str(e)})
        finally:
            q.put(DONE)

    # Run pipeline in background thread, yield from queue in the generator
    t = threading.Thread(target=pipeline, daemon=True)
    t.start()

    while True:
        item = q.get()
        if item is DONE:
            break
        yield item


def _extract_title(text: str) -> str:
    """Extract the first markdown heading or first line as a title."""
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#"):
            return line.lstrip("#").strip()
        if line:
            return line[:80]
    return ""
