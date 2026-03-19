from __future__ import annotations

import json
import queue
import threading
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from typing import Any, Callable, Dict, List, Optional


def _submit_companion_derivatives(
    pool,
    add,
    emit,
    prog,
    vals: Dict[str, Any],
    cp: Dict[str, Any],
    include_spanish: bool,
    article_url: str,
    generate_repurposed_content: Callable[..., Dict[str, Any]],
    translate_to_spanish: Callable[[str, str], str],
) -> None:
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


def _enqueue_wave_one(
    pool,
    add,
    push,
    prog,
    emit,
    vals: Dict[str, Any],
    cp: Dict[str, Any],
    reflection: str,
    reflection_title: str,
    article_url: str,
    template: str,
    articles: List[Dict[str, Any]],
    include_spanish: bool,
    *,
    find_related_articles: Callable[[str, List[Dict[str, Any]]], List[Dict[str, Any]]],
    translate_to_spanish: Callable[[str, str], str],
    generate_repurposed_content: Callable[..., Dict[str, Any]],
    generate_companion: Callable[..., str],
    tag_reflection: Callable[[str, str], List[str]],
    extract_quotes: Callable[[str, str], List[Dict[str, Any]]],
    ensure_spanish_reflection_context: Callable[[Dict[str, Any], str, str], None],
    extract_title: Callable[[str], str],
) -> None:
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
            ensure_spanish_reflection_context(vals, reflection_title, article_url)
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

    if vals["companion"]:
        push("companion_en", cp["companion_en"])
        _submit_companion_derivatives(
            pool,
            add,
            emit,
            prog,
            vals,
            cp,
            include_spanish,
            article_url,
            generate_repurposed_content,
            translate_to_spanish,
        )
    else:
        prog("Generating paid companion…")
        related_snap = vals["related"] or []

        def _do_companion(r=related_snap):
            text = generate_companion(reflection, reflection_title, article_url, template, r)
            title = extract_title(text) or f"{reflection_title} — Companion"
            prog("Paid companion generated", done=True)
            emit("companion_en", {"content": text, "title": title})
            return text, title

        add(pool.submit(_do_companion), "companion")

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


def _handle_completed_task(
    name: str,
    result: Any,
    pool,
    add,
    push,
    prog,
    emit,
    vals: Dict[str, Any],
    cp: Dict[str, Any],
    reflection_title: str,
    article_url: str,
    include_spanish: bool,
    *,
    translate_to_spanish: Callable[[str, str], str],
    generate_repurposed_content: Callable[..., Dict[str, Any]],
    ensure_spanish_reflection_context: Callable[[Dict[str, Any], str, str], None],
    extract_title: Callable[[str], str],
) -> None:
    if name == "related":
        vals["related"] = result
        return

    if name == "refl_es":
        vals["reflection_es"] = result
        ensure_spanish_reflection_context(vals, reflection_title, article_url)
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
        return

    if name == "companion":
        comp_text, comp_title = result
        vals["companion"] = comp_text
        vals["companion_title"] = comp_title
        _submit_companion_derivatives(
            pool,
            add,
            emit,
            prog,
            vals,
            cp,
            include_spanish,
            article_url,
            generate_repurposed_content,
            translate_to_spanish,
        )
        return

    if name == "companion_es":
        vals["companion_es"] = result
        vals["companion_es_title"] = (
            extract_title(result)
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
        return

    if name == "tagging":
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


def _build_pipeline_result(reflection: str, vals: Dict[str, Any]) -> Dict[str, Any]:
    return {
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


def run_full_pipeline_stream(
    reflection: str,
    reflection_title: str,
    template: str,
    articles: List[Dict[str, Any]],
    article_url: str = "",
    include_spanish: bool = True,
    checkpoint: Optional[Dict[str, Any]] = None,
    on_step_complete=None,
    cancel_event: Optional[threading.Event] = None,
    *,
    initial_pipeline_values: Callable[[Dict[str, Any]], Dict[str, Any]],
    find_related_articles: Callable[[str, List[Dict[str, Any]]], List[Dict[str, Any]]],
    translate_to_spanish: Callable[[str, str], str],
    generate_repurposed_content: Callable[..., Dict[str, Any]],
    generate_companion: Callable[..., str],
    tag_reflection: Callable[[str, str], List[str]],
    extract_quotes: Callable[[str, str], List[Dict[str, Any]]],
    ensure_spanish_reflection_context: Callable[[Dict[str, Any], str, str], None],
    extract_title: Callable[[str], str],
):
    done_marker = object()
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

                vals = initial_pipeline_values(cp)
                pending: Dict[str, Any] = {}

                def add(fut, name: str) -> None:
                    pending[fut] = name

                _enqueue_wave_one(
                    pool,
                    add,
                    push,
                    prog,
                    emit,
                    vals,
                    cp,
                    reflection,
                    reflection_title,
                    article_url,
                    template,
                    articles,
                    include_spanish,
                    find_related_articles=find_related_articles,
                    translate_to_spanish=translate_to_spanish,
                    generate_repurposed_content=generate_repurposed_content,
                    generate_companion=generate_companion,
                    tag_reflection=tag_reflection,
                    extract_quotes=extract_quotes,
                    ensure_spanish_reflection_context=ensure_spanish_reflection_context,
                    extract_title=extract_title,
                )

                while pending:
                    if is_cancelled():
                        push("error", {"message": "Cancelled."})
                        return

                    done_futs, _ = wait(pending.keys(), return_when=FIRST_COMPLETED)
                    for fut in done_futs:
                        name = pending.pop(fut)
                        result = fut.result()
                        _handle_completed_task(
                            name,
                            result,
                            pool,
                            add,
                            push,
                            prog,
                            emit,
                            vals,
                            cp,
                            reflection_title,
                            article_url,
                            include_spanish,
                            translate_to_spanish=translate_to_spanish,
                            generate_repurposed_content=generate_repurposed_content,
                            ensure_spanish_reflection_context=ensure_spanish_reflection_context,
                            extract_title=extract_title,
                        )

                if is_cancelled():
                    push("error", {"message": "Cancelled."})
                    return

                push("result", _build_pipeline_result(reflection, vals))
        except Exception as exc:
            push("error", {"message": str(exc)})
        finally:
            q.put(done_marker)

    t = threading.Thread(target=pipeline, daemon=True)
    t.start()

    while True:
        try:
            item = q.get(timeout=0.5)
        except queue.Empty:
            if is_cancelled() and not t.is_alive():
                break
            continue
        if item is done_marker:
            break
        yield item
