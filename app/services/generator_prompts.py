from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from app.services.generator_transport import get_tone_level, set_tone_level


COMPANION_VOICE_BRIEF = """
VOICE, TONE & STYLE — read before writing:

This is a paid companion for a self-discipline newsletter. It is practical, dense, and research-backed.
It is NOT motivational. It does not cheer the reader on. It gives them tools and explains why they work.

When using markdown, avoid using `_` for italics and `*` for horizontal lines.
Use `*` for italics and `-` for horizontal lines instead.

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

_KNOWN_GUIDE_URL_PATHS = {
    "https://www.adaptable-discipline.com/guides/foundations/understanding-your-context/context-overview",
    "https://www.adaptable-discipline.com/guides/foundations/understanding-your-context/executive-function",
    "https://www.adaptable-discipline.com/guides/foundations/building-your-foundation/designing-low-friction-routines",
    "https://www.adaptable-discipline.com/guides/getting-started/minimum-viable-day",
    "https://www.adaptable-discipline.com/guides/getting-started/reality-check",
    "https://www.adaptable-discipline.com/guides/es/foundations/understanding-your-context/context-overview",
    "https://www.adaptable-discipline.com/guides/es/foundations/understanding-your-context/executive-function",
    "https://www.adaptable-discipline.com/guides/es/foundations/building-your-foundation/designing-low-friction-routines",
    "https://www.adaptable-discipline.com/guides/es/getting-started/minimum-viable-day",
    "https://www.adaptable-discipline.com/guides/es/getting-started/reality-check",
}

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
- self-disciplined.com article links → Find the matching article in spanish for the original reflection. If you can't find one, it might be because it's a new, unpublished article, so calculate the slug for the translated reflection.
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

PLATFORM_PERSONAS: Dict[str, Any] = {
    "linkedin": {"audience": "Mid-career professionals (30–45) who perform well at work but struggle with consistency, parenting, or relationships outside it. They follow self-discipline content because the gap between professional performance and personal consistency bothers them. Skeptical of corporate speak and motivational fluff.", "funnel_stage": "Awareness → Consideration. Many are discovering the brand. Lead with professional-personal tension; the Adaptable Discipline framework is the payoff, not the hook."},
    "instagram": {"audience": "Parents, partners, and people who recognize executive dysfunction in themselves without needing a clinical label. They scroll for honesty, not aspiration. They know what it feels like to know better and still not do better.", "funnel_stage": "Top of funnel. First impression. The hook must feel like a quiet recognition or a close friend's observation — not a sales pitch. Build curiosity toward the newsletter."},
    "threads": {"audience": "A broad mix — some already follow the newsletter, many encountering the brand for the first time. They want sharp, standalone observations that make them pause mid-scroll. No patience for warm-up.", "funnel_stage": "Top of funnel. Awareness only. Max 280 characters. One complete thought. Make it worth stopping for — they'll find the newsletter if the thought lands."},
    "substack_note": {"audience": "Existing or near-subscribers who already read long-form content about self-discipline, behavior, and consistency. They're thoughtful, self-aware, and allergic to oversimplification. They know the brand and trust the author.", "funnel_stage": "Bottom of funnel. Retention and depth. Assume familiarity with the brand. Go deeper, not broader — surface a nuance or tension the article only touched. Drive them to read the full piece."},
}

PLATFORM_PROMPTS = {
    "linkedin": {"system": "You are a ghostwriter who captures this author's exact voice for LinkedIn. You write posts for an audience of professionals who are also parents, partners, or people navigating executive dysfunction — people who follow self-discipline content because it matters at work AND at home.", "instructions": "Write 4 LinkedIn posts based on this article. Each takes a completely different angle — a different insight, tension, rule, or moment from the article.\n\nYour audience: professionals who feel the friction between performing at work and struggling with consistency, parenting, or relationships. They're smart, self-aware, and allergic to corporate speak.\n\nFORMAT for each post:\n- A title line like: ## Post N — [Short descriptive name]\n- First line: a specific, bold claim — not a question, not \"I've been thinking about…\". Speaks to the professional-personal tension. No \"I\" as the first word.\n- 2-4 short paragraphs (1-3 sentences each). Concrete, sharp, no filler.\n- End with: 👉 [ARTICLE_LINK] on its own line.\n- No hashtags.\n\nSeparate posts with: ---", "max_tokens": 1500},
    "instagram": {"system": "You are a ghostwriter who captures this author's exact voice for Instagram captions. Hook-first. Emotional precision, not sentimentality.", "instructions": "Write 4 Instagram captions based on this article. Each should feel like a sharp realization someone would stop scrolling for.\n\nFORMAT for each caption:\n- A title line like: ## Caption N — [Short descriptive name]\n- One hook line that lands immediately.\n- 2-3 short paragraphs or line breaks of prose.\n- End with 5-8 relevant hashtags on a new line.\n- No bullet lists.\n- No link in the caption body.\n\nSeparate captions with: ---", "max_tokens": 1300},
    "threads": {"system": "You are a ghostwriter who captures this author's exact voice for Threads. You write concise standalone observations that stop a scroll.", "instructions": "Write 4 short Threads posts based on this article. Each post is one standalone thought.\n\nYour audience scrolls Threads for things that make them pause. They want insights that feel like something you'd say out loud at dinner — unfiltered, specific, human.\n\nFORMAT for each post:\n- A title line like: ## Thread N — [Short descriptive name]\n- The post itself: 150–280 characters. One complete thought. No bold. Short sentences or fragments.\n- NO hashtags. NO links. NO formatting beyond plain text.\n\nCOUNT YOUR CHARACTERS CAREFULLY. Hard limit: 280 characters per post.\n\nSeparate posts with: ---", "max_tokens": 700},
    "substack_note": {"system": "You are a ghostwriter who captures this author's exact voice for Substack Notes. You write tight, observational paragraphs for thoughtful readers who already know what motivational content looks like.", "instructions": "Write 4 Substack Notes based on this article. Each takes one specific idea and develops it in its own space — no referencing \"the article\" awkwardly. Each stands alone.\n\nYour audience reads long-form newsletters about self-discipline, behavior, and consistency. They're parents, partners, and people navigating executive dysfunction — but you never call them out. They recognize themselves.\n\nFORMAT for each note:\n- A title line: ## Note N — [Short descriptive name]\n- 3–4 short paragraphs (1–3 sentences each). Pure prose. No bullet points. No bold.\n- Observational, not instructional — watch something happen, name it, let it land. Don't tell the reader what to do.\n- The last paragraph is often the shortest: a reframe, a quiet conclusion, or a single punchy line.\n- 👉 [ARTICLE_LINK] on its own line after the last paragraph (plain URL, no extra text around it).\n- No hashtags.\n\nLENGTH: strictly 100 words maximum per note (not counting title or link line). Count your words. Hard limit: 100 words. Every word earns its place.\n\nSeparate notes with: ---", "max_tokens": 900},
}

PILLARS: Dict[str, str] = {
    "Mindset": "The mental framework that makes comeback speed possible. Covers awareness of drift, responsibility, adaptability, and self-compassion. Redefines discipline as a recoverable system — comeback speed over streaks, setbacks as data rather than failures.",
    "Purpose": "The compass of Adaptable Discipline. Covers the Why Stack (values → motivation → goals), North Star, near-term aims, keystone commitments, guardrails, quit criteria, and seasons (Build, Maintain, Recover). Aligns actions with meaningful direction.",
    "Tools": "The scaffolding that turns intention into reliable action. Covers environment design, protocols and playbooks, templates, automation, recovery kits, and systems thinking. Reduces friction and makes comeback paths simple and repeatable.",
    "Metrics": "The observability layer. Covers comeback speed measurement, detection latency, alignment rate, flexibility ratio, and tracking for clarity without shame. Makes invisible patterns visible to support system adjustment — not judgment.",
}


def validate_companion(content: str, template: str) -> list[str]:
    issues = []
    template_headers = re.findall(r'^#{1,4}\s+(.+)', template, re.MULTILINE)
    companion_headers_lower = {h.strip().lower() for h in re.findall(r'^#{1,4}\s+(.+)', content, re.MULTILINE)}
    for h in template_headers:
        h_text = h.strip()
        if '[' in h_text or not h_text:
            continue
        h_clean = re.sub(r'[\U00010000-\U0010ffff\u2600-\u27FF]+', '', h_text).strip().lower()
        if not any(h_clean in ch for ch in companion_headers_lower):
            issues.append(f'Missing section: "{h_text}"')
    ad_links = re.findall(r'https?://(?:www\.)?adaptable-discipline\.com/guides[^\s\)\]"\'>]+', content)
    for link in ad_links:
        link_clean = re.sub(r'[,;.!?]+$', '', link)
        link_path = link_clean.split('?')[0].rstrip('/')
        if link_path not in _KNOWN_GUIDE_URL_PATHS:
            issues.append(f'Unknown guide URL (not in approved list): {link_clean}')
    return issues


def build_related_prompt(reflection: str, articles: List[Dict[str, Any]]) -> tuple[str, list[dict[str, Any]]]:
    articles_list = "\n".join(f"{i+1}. {a['title']} — {a['summary'][:200]} ({a['url']})" for i, a in enumerate(articles))
    system = "You are an editorial assistant helping a newsletter author find related past articles."
    return system, [
        {"type": "text", "text": "Here is the full index of past articles:\n<articles>\n" + articles_list + "\n</articles>", "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": "Here is a new article the author just wrote:\n\n" + f"<reflection>\n{reflection[:3000]}\n</reflection>\n\n" + "Pick the 3 most thematically related articles from the index above.\nReturn ONLY a JSON array with this format, no other text:\n[\n  {\"title\": \"...\", \"url\": \"...\", \"reason\": \"one sentence why it's related\"},\n  {\"title\": \"...\", \"url\": \"...\", \"reason\": \"one sentence why it's related\"},\n  {\"title\": \"...\", \"url\": \"...\", \"reason\": \"one sentence why it's related\"}\n]"},
    ]


def build_companion_prompt(reflection: str, reflection_title: str, reflection_url: str, template: str, related_articles: List[Dict[str, Any]]) -> tuple[str, list[dict[str, Any]]]:
    related_str = "\n".join(f"- {a['title']}: {a['reason']} ({a['url']})" for a in related_articles)
    system = "You are a ghostwriter for Camilo Zambrano, founder of Self Disciplined — a self-discipline newsletter. You write paid companion pieces that are dense, practical, and research-backed."
    return system, [
        {"type": "text", "text": "Here is the template. YOU MUST FOLLOW IT EXACTLY:\n" + f"<template>\n{template}\n</template>\n\n" + "TEMPLATE RULES — read carefully before writing:\n- Reproduce every section header, emoji, and structural element exactly as they appear in the template.\n- Match the template's section order, nesting, and formatting to the letter.\n- If the template has a specific number of katas, that is the number you write — no more, no fewer.\n- Do not add, remove, or rename sections. Do not invent structure not present in the template.\n- Every section must be complete and fully written — no \"[insert X here]\", no placeholders.\n- The only creative latitude is the actual content within each section.\n\n" + f"{COMPANION_VOICE_BRIEF}\n\n{KNOWN_GUIDE_URLS}\n\n" + "The companion should make a paid subscriber feel they got something the free reflection didn't give them.\nMental models must cite real researchers with name and institution.", "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": "Here is the free reflection article that this companion accompanies:\n\n" + f"Reflection title: {reflection_title}\n" + f"Reflection URL: {reflection_url or '[no reflection URL provided]'}\n\n" + f"<reflection>\n{reflection}\n</reflection>\n\n" + "When the template references [Reflection Title](link) or the reflection elsewhere, use the exact title and URL provided above. Do not invent or guess either one.\n\n" + f"Here are 3 related past articles that can be linked or referenced:\n<related_articles>\n{related_str}\n</related_articles>"},
    ]


def build_translation_prompt(text: str, content_type: str = "article") -> tuple[str, list[dict[str, Any]]]:
    system = "You are a professional translator. Your job is to produce a complete, verbatim Spanish translation — faithful to every detail of the source, with no additions, omissions, or alterations. You follow link transformation rules exactly."
    return system, [
        {"type": "text", "text": f"Translate the following {content_type} to neutral Spanish.\n\n{SPANISH_STYLE_GUIDE}\n\nReturn ONLY the translated text. No preamble, no explanation, no translator notes.", "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": f"<content>\n{text}\n</content>"},
    ]


def build_platform_user(text: str, title: str, article_url: str, config: Dict[str, Any], language: str, tone: str, platform: str = "", repurpose_note: str = "") -> list[dict[str, Any]]:
    lang_instruction = "" if language == "english" else f"\nWrite everything in {language} — neutral, no regional variations. Preserve the same voice and tone."
    persona_block = ""
    if platform and platform in PLATFORM_PERSONAS:
        p = PLATFORM_PERSONAS[platform]
        persona_block = f"\nPLATFORM AUDIENCE: {p['audience']}\nFUNNEL STAGE: {p['funnel_stage']}"
    repurpose_block = f"\nREPURPOSE CONTEXT: {repurpose_note}" if repurpose_note else ""
    return [
        {"type": "text", "text": f"{VOICE_BRIEF}{persona_block}\n{config['instructions']}{lang_instruction}{tone}", "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": f"Article title: {title}\n\nArticle content:\n<article>\n{text[:5000]}\n</article>{repurpose_block}\n\nReplace [ARTICLE_LINK] with: {article_url if article_url else '[insert article URL]'}\n\nReturn only the posts, no preamble or explanation."},
    ]


def build_tagging_message(reflection: str, title: str) -> str:
    pillar_text = "\n".join(f"- {name}: {desc}" for name, desc in PILLARS.items())
    return "Tag this newsletter article with exactly 2 pillars from the Adaptable Discipline framework, in priority order (most relevant first).\n\n" + f"Pillars:\n{pillar_text}\n\n" + f"Article title: {title}\n\n" + f"Article excerpt:\n{reflection[:3000]}\n\n" + 'Respond with ONLY a JSON array of 2 names. Example: ["Mindset", "Purpose"]\n' + "Valid names (use exact casing): Mindset, Purpose, Tools, Metrics"


def build_quote_extraction_message(reflection: str, title: str) -> str:
    return "Extract 5 to 8 shareable quotes or standalone insights from this newsletter article. These should be the sharpest, most self-contained lines — the kind that land on social media without needing context: bold claims, counterintuitive observations, concrete rules, vivid analogies.\n\nAvoid anything that is a summary, a transition, or only makes sense in context.\n\n" + f"Article title: {title}\n\n" + f"Article:\n{reflection[:6000]}\n\n" + "Respond with ONLY a JSON array of objects. Each object must have:\n  \"quote\": the exact text (1–3 sentences, verbatim from the article)\n  \"context\": one sentence explaining why this quote stands alone\n  \"type\": one of: insight | rule | analogy | observation | question\n\nExample: [{\"quote\": \"...\", \"context\": \"...\", \"type\": \"insight\"}, ...]\nOutput ONLY the JSON array, no other text."


def parse_tag_response(raw: str) -> list[str]:
    try:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        tags = json.loads(raw[start:end])
        valid = [t for t in tags if t in PILLARS]
        return valid[:2]
    except Exception:
        return [p for p in PILLARS if p in raw][:2]


def parse_quote_response(raw: str) -> list[dict[str, Any]]:
    try:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        quotes = json.loads(raw[start:end])
        if isinstance(quotes, list):
            return [{"quote_text": q.get("quote", ""), "context": q.get("context", ""), "quote_type": q.get("type", "insight")} for q in quotes if isinstance(q, dict) and q.get("quote")][:8]
    except Exception:
        return []
    return []


def apply_config_overrides(config: Dict[str, Any]) -> None:
    global VOICE_BRIEF, COMPANION_VOICE_BRIEF, SPANISH_STYLE_GUIDE, PLATFORM_PERSONAS, PLATFORM_PROMPTS
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
    if "platform_prompts" in config and isinstance(config["platform_prompts"], dict):
        for platform, prompt_values in config["platform_prompts"].items():
            if platform in PLATFORM_PROMPTS and isinstance(prompt_values, dict):
                if "system" in prompt_values and isinstance(prompt_values["system"], str):
                    PLATFORM_PROMPTS[platform]["system"] = prompt_values["system"]
                if "instructions" in prompt_values and isinstance(prompt_values["instructions"], str):
                    PLATFORM_PROMPTS[platform]["instructions"] = prompt_values["instructions"]


def get_current_prompts() -> Dict[str, Any]:
    return {
        "voice_brief": VOICE_BRIEF,
        "companion_voice_brief": COMPANION_VOICE_BRIEF,
        "spanish_style_guide": SPANISH_STYLE_GUIDE,
        "tone_level": get_tone_level(),
        "platform_personas": PLATFORM_PERSONAS,
        "platform_prompts": PLATFORM_PROMPTS,
    }


def get_voice_brief() -> str:
    return VOICE_BRIEF
