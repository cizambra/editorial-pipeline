"""
storage.py - Persistence helpers for the editorial pipeline.

Owns SQLite access plus small JSON-backed config/checkpoint files so the API
layer can stay focused on HTTP orchestration.
"""

from __future__ import annotations

import json
import sqlite3
import hashlib
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Tuple

HISTORY_DB_PATH = Path("run_history.db")
CONFIG_PATH = Path("config_overrides.json")
CHECKPOINT_PATH = Path("pipeline_checkpoint.json")
_DASHBOARD_CACHE_TTL_SECONDS = 30
_dashboard_cache: Dict[str, Any] = {
    "key": None,
    "value": None,
    "expires_at": 0.0,
}


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(HISTORY_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _load_json_file(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_json_file(path: Path, data: Dict[str, Any]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def init_db() -> None:
    """Create / migrate the SQLite schema."""
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS runs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp   TEXT NOT NULL,
                title       TEXT NOT NULL,
                article_url TEXT DEFAULT '',
                data_json   TEXT NOT NULL,
                tokens_in   INTEGER DEFAULT 0,
                tokens_out  INTEGER DEFAULT 0,
                cost_usd    REAL DEFAULT 0
            )
        """)

        for col, coltype in [
            ("tokens_in", "INTEGER DEFAULT 0"),
            ("tokens_out", "INTEGER DEFAULT 0"),
            ("cost_usd", "REAL DEFAULT 0"),
        ]:
            try:
                conn.execute(f"ALTER TABLE runs ADD COLUMN {col} {coltype}")
            except Exception:
                pass

        conn.execute("""
            CREATE TABLE IF NOT EXISTS thumbnails (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp     TEXT NOT NULL,
                article_title TEXT NOT NULL,
                article_url   TEXT DEFAULT '',
                concept_name  TEXT DEFAULT '',
                image_hash    TEXT DEFAULT '',
                image_b64     TEXT NOT NULL
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS image_costs (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp  TEXT NOT NULL,
                source     TEXT NOT NULL,
                count      INTEGER NOT NULL DEFAULT 1,
                cost_usd   REAL NOT NULL
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS post_feedback (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp   TEXT NOT NULL,
                run_title   TEXT DEFAULT '',
                platform    TEXT NOT NULL,
                source      TEXT NOT NULL,
                language    TEXT NOT NULL,
                post_index  INTEGER NOT NULL,
                rating      INTEGER NOT NULL,
                preview     TEXT DEFAULT ''
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS ideas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                theme TEXT NOT NULL,
                category TEXT DEFAULT '',
                emoji TEXT DEFAULT '',
                frequency INTEGER DEFAULT 1,
                article_angle TEXT DEFAULT '',
                example TEXT DEFAULT '',
                source TEXT DEFAULT 'reddit',
                status TEXT DEFAULT 'new',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        for col, coltype in [
            ("image_hash", "TEXT DEFAULT ''"),
        ]:
            try:
                conn.execute(f"ALTER TABLE thumbnails ADD COLUMN {col} {coltype}")
            except Exception:
                pass

        conn.execute("CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON runs(timestamp DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_runs_article_url ON runs(article_url)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_thumbnails_timestamp ON thumbnails(timestamp DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_thumbnails_lookup ON thumbnails(article_title, article_url, concept_name, image_hash)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_image_costs_source ON image_costs(source)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_feedback_platform ON post_feedback(platform)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ideas_status_source_updated ON ideas(status, source, updated_at DESC)")


def load_config() -> Dict[str, Any]:
    return _load_json_file(CONFIG_PATH)


def save_config(config: Dict[str, Any]) -> None:
    _save_json_file(CONFIG_PATH, config)


def load_checkpoint() -> Dict[str, Any]:
    data = _load_json_file(CHECKPOINT_PATH)
    return data or None


def save_checkpoint(data: Dict[str, Any]) -> None:
    _save_json_file(CHECKPOINT_PATH, data)


def clear_checkpoint() -> None:
    if CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()


def save_run(title: str, article_url: str, data: Dict[str, Any], token_summary: Optional[Dict[str, Any]] = None) -> None:
    ts = token_summary or {}
    with _connect() as conn:
        conn.execute(
            "INSERT INTO runs (timestamp, title, article_url, data_json, tokens_in, tokens_out, cost_usd) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                datetime.now().isoformat(),
                title,
                article_url,
                json.dumps(data, ensure_ascii=False),
                ts.get("input_tokens", 0),
                ts.get("output_tokens", 0),
                ts.get("estimated_cost_usd", 0),
            ),
        )


def _get_social_payload(source_data: Dict[str, Any], lang: str) -> Dict[str, Any]:
    if not isinstance(source_data, dict):
        return {}
    value = source_data.get(f"repurposed_{lang}")
    if isinstance(value, dict) and any(value.values()):
        return value
    legacy = source_data.get(f"social_{lang}")
    if isinstance(legacy, dict) and any(legacy.values()):
        return legacy
    return {}


def _count_social_posts(payload: Dict[str, Any]) -> int:
    total = 0
    for value in payload.values():
        if not value or not isinstance(value, str):
            continue
        total += len([part for part in value.split("\n---\n") if part.strip()])
    return total


def _marketing_summary(data: Dict[str, Any]) -> Dict[str, Any]:
    assets = []
    total_posts = 0
    for source, source_label in (("reflection", "Reflection"), ("companion", "Companion")):
        source_data = data.get(source, {})
        for lang, lang_label in (("en", "EN"), ("es", "ES")):
            payload = _get_social_payload(source_data, lang)
            if not payload:
                continue
            posts = _count_social_posts(payload)
            platforms = [name for name, content in payload.items() if content]
            assets.append({
                "key": f"{source}_{lang}",
                "label": f"{source_label} {lang_label}",
                "posts": posts,
                "platforms": platforms,
            })
            total_posts += posts
    return {
        "asset_count": len(assets),
        "post_count": total_posts,
        "assets": assets,
    }


def record_image_cost(source: str, count: int, price_per_image: float) -> float:
    total = round(count * price_per_image, 6)
    with _connect() as conn:
        conn.execute(
            "INSERT INTO image_costs (timestamp, source, count, cost_usd) VALUES (?, ?, ?, ?)",
            (datetime.now().isoformat(), source, count, total),
        )
    return total


def get_dashboard_data(articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    cache_key = _dashboard_cache_key(articles)
    now = time.time()
    if (
        _dashboard_cache["value"] is not None
        and _dashboard_cache["key"] == cache_key
        and now < _dashboard_cache["expires_at"]
    ):
        return _dashboard_cache["value"]

    with _connect() as conn:
        runs = [
            dict(r)
            for r in conn.execute(
                "SELECT id, timestamp, title, article_url, tokens_in, tokens_out, cost_usd, data_json "
                "FROM runs ORDER BY timestamp DESC"
            ).fetchall()
        ]
        img_rows = conn.execute(
            "SELECT source, SUM(count) as cnt, SUM(cost_usd) as total FROM image_costs GROUP BY source"
        ).fetchall()

    img_by_source = {
        r["source"]: {"count": r["cnt"], "cost_usd": round(r["total"], 4)}
        for r in img_rows
    }
    total_image_cost = round(sum(r["total"] for r in img_rows), 4) if img_rows else 0.0
    total_image_count = sum(r["cnt"] for r in img_rows) if img_rows else 0

    processed_urls = {r["article_url"] for r in runs if r["article_url"]}
    covered = [a for a in articles if a["url"] in processed_urls]
    not_covered = [a for a in articles if a["url"] not in processed_urls]
    repurpose_queue = sorted(not_covered, key=lambda a: _parse_article_date(a["published"]))

    total_tokens_in = sum(r["tokens_in"] or 0 for r in runs)
    total_tokens_out = sum(r["tokens_out"] or 0 for r in runs)
    total_cost = sum(r["cost_usd"] or 0 for r in runs)

    platforms = {"linkedin": 0, "instagram": 0, "threads": 0, "substack_note": 0}
    for run in runs:
        try:
            data = json.loads(run["data_json"])
        except Exception:
            continue
        social = data.get("social", {})
        if isinstance(social, dict):
            for platform in platforms:
                if social.get(platform):
                    platforms[platform] += 1
        for source in ("reflection", "companion"):
            source_data = data.get(source, {})
            if not isinstance(source_data, dict):
                continue
            for lang_key in ("repurposed_en", "repurposed_es", "social_en", "social_es"):
                social_data = source_data.get(lang_key, {})
                if not isinstance(social_data, dict):
                    continue
                for platform in platforms:
                    if social_data.get(platform):
                        platforms[platform] += 1

    this_month = datetime.now().strftime("%Y-%m")
    monthly_runs = [r for r in runs if r["timestamp"].startswith(this_month)]

    result = {
        "articles_total": len(articles),
        "articles_covered": len(covered),
        "articles_remaining": len(not_covered),
        "total_runs": len(runs),
        "monthly_runs": len(monthly_runs),
        "total_tokens_in": total_tokens_in,
        "total_tokens_out": total_tokens_out,
        "total_cost_usd": round(total_cost, 4),
        "total_image_cost_usd": total_image_cost,
        "total_image_count": total_image_count,
        "image_cost_by_source": img_by_source,
        "platform_counts": platforms,
        "repurpose_queue": repurpose_queue[:20],
        "recent_runs": [
            {
                "id": r["id"],
                "title": r["title"],
                "timestamp": r["timestamp"],
                "article_url": r["article_url"],
                "cost_usd": r["cost_usd"],
            }
            for r in runs[:15]
        ],
    }
    _dashboard_cache["key"] = cache_key
    _dashboard_cache["value"] = result
    _dashboard_cache["expires_at"] = now + _DASHBOARD_CACHE_TTL_SECONDS
    return result


def list_history_runs(limit: int = 50) -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, timestamp, title, article_url, tokens_in, tokens_out, cost_usd "
            "FROM runs ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "timestamp": r["timestamp"],
            "title": r["title"],
            "article_url": r["article_url"],
            "tokens_in": r["tokens_in"] or 0,
            "tokens_out": r["tokens_out"] or 0,
            "cost_usd": r["cost_usd"] or 0,
        }
        for r in rows
    ]


def list_marketing_runs(limit: int = 100) -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, timestamp, title, article_url, data_json, cost_usd "
            "FROM runs ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()

    results = []
    for row in rows:
        try:
            data = json.loads(row["data_json"])
        except Exception:
            continue
        summary = _marketing_summary(data)
        if not summary["asset_count"]:
            continue
        results.append({
            "id": row["id"],
            "timestamp": row["timestamp"],
            "title": row["title"],
            "article_url": row["article_url"],
            "cost_usd": row["cost_usd"] or 0,
            **summary,
        })
    return results


def get_history_run(run_id: int) -> Optional[Dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, timestamp, title, article_url, data_json, tokens_in, tokens_out, cost_usd "
            "FROM runs WHERE id = ?",
            (run_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "timestamp": row["timestamp"],
        "title": row["title"],
        "article_url": row["article_url"],
        "data": json.loads(row["data_json"]),
        "tokens_in": row["tokens_in"] or 0,
        "tokens_out": row["tokens_out"] or 0,
        "cost_usd": row["cost_usd"] or 0,
    }


def delete_history_run(run_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM runs WHERE id = ?", (run_id,))


def save_thumbnail(article_title: str, article_url: str, concept_name: str, image_b64: str) -> Dict[str, Any]:
    image_hash = hashlib.sha1((image_b64 or "").encode("utf-8")).hexdigest()
    with _connect() as conn:
        existing = conn.execute(
            "SELECT id FROM thumbnails WHERE article_title = ? AND article_url = ? AND concept_name = ? AND image_hash = ? LIMIT 1",
            (article_title, article_url, concept_name, image_hash),
        ).fetchone()
        if existing:
            return {"id": int(existing["id"]), "created": False}
        cursor = conn.execute(
            "INSERT INTO thumbnails (timestamp, article_title, article_url, concept_name, image_hash, image_b64) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (datetime.now().isoformat(), article_title, article_url, concept_name, image_hash, image_b64),
        )
        return {"id": int(cursor.lastrowid), "created": True}


def list_thumbnails(query: str = "", limit: int = 100) -> List[Dict[str, Any]]:
    params: List[Any] = []
    sql = (
        "SELECT id, timestamp, article_title, article_url, concept_name "
        "FROM thumbnails"
    )
    if query:
        sql += (
            " WHERE LOWER(article_title) LIKE ?"
            " OR LOWER(article_url) LIKE ?"
            " OR LOWER(concept_name) LIKE ?"
        )
        needle = f"%{query.lower()}%"
        params.extend([needle, needle, needle])
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(max(1, min(limit, 250)))
    with _connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def get_thumbnail(thumb_id: int) -> Optional[Dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, timestamp, article_title, article_url, concept_name, image_b64 FROM thumbnails WHERE id = ?",
            (thumb_id,),
        ).fetchone()
    return dict(row) if row else None


def delete_thumbnail(thumb_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM thumbnails WHERE id = ?", (thumb_id,))


def save_feedback(
    run_title: str,
    platform: str,
    source: str,
    language: str,
    post_index: int,
    rating: int,
    preview: str,
) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO post_feedback "
            "(timestamp, run_title, platform, source, language, post_index, rating, preview) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                datetime.now().isoformat(),
                run_title,
                platform,
                source,
                language,
                post_index,
                rating,
                preview[:200],
            ),
        )


def get_feedback_summary() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT platform, SUM(CASE WHEN rating=1 THEN 1 ELSE 0 END) as up, "
            "SUM(CASE WHEN rating=-1 THEN 1 ELSE 0 END) as down "
            "FROM post_feedback GROUP BY platform"
        ).fetchall()
    return [{"platform": r["platform"], "thumbs_up": r["up"], "thumbs_down": r["down"]} for r in rows]


def list_ideas(status: Optional[str] = None, source: Optional[str] = None) -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ideas ORDER BY status ASC, frequency DESC, created_at DESC"
        ).fetchall()
    ideas = [dict(r) for r in rows]
    if status:
        ideas = [idea for idea in ideas if idea["status"] == status]
    if source:
        ideas = [idea for idea in ideas if idea["source"] == source]
    return ideas


def create_idea(theme: str, category: str, emoji: str, article_angle: str, source: str) -> int:
    now = datetime.now().isoformat()
    with _connect() as conn:
        cursor = conn.execute(
            "INSERT INTO ideas (theme, category, emoji, article_angle, source, status, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, 'new', ?, ?)",
            (theme, category, emoji, article_angle, source, now, now),
        )
        return int(cursor.lastrowid)


def update_idea_status(idea_id: int, status: str) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE ideas SET status=?, updated_at=? WHERE id=?",
            (status, datetime.now().isoformat(), idea_id),
        )


def delete_idea(idea_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM ideas WHERE id=?", (idea_id,))


def save_ideas_batch(categories: List[Dict[str, Any]], source: str = "reddit") -> Dict[str, Any]:
    now = datetime.now().isoformat()
    saved = updated = 0

    with _connect() as conn:
        existing = conn.execute("SELECT id, theme FROM ideas").fetchall()
        existing_themes = {row["theme"].lower()[:60]: row["id"] for row in existing}

        for category in categories:
            cat_label = category.get("category", "")
            cat_emoji = category.get("emoji", "")
            for struggle in category.get("struggles", []):
                theme = struggle.get("theme", "").strip()
                if not theme:
                    continue
                match_id = _find_duplicate_idea_id(existing_themes, theme)
                if match_id is not None:
                    conn.execute(
                        "UPDATE ideas SET frequency = frequency + ?, updated_at=? WHERE id=?",
                        (struggle.get("frequency", 1), now, match_id),
                    )
                    updated += 1
                    continue

                cursor = conn.execute(
                    """INSERT INTO ideas
                       (theme, category, emoji, frequency, article_angle, example, source, status, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)""",
                    (
                        theme,
                        cat_label,
                        cat_emoji,
                        struggle.get("frequency", 1),
                        struggle.get("article_angle", ""),
                        struggle.get("example", ""),
                        source,
                        now,
                        now,
                    ),
                )
                existing_themes[theme.lower()[:60]] = int(cursor.lastrowid)
                saved += 1

    return {"saved": saved, "updated": updated}


def _find_duplicate_idea_id(existing_themes: Dict[str, int], theme: str) -> Optional[int]:
    key = theme.lower()[:60]
    for existing_key, idea_id in existing_themes.items():
        if existing_key[:50] == key[:50]:
            return idea_id
    return None


def _parse_article_date(value: str):
    try:
        return parsedate_to_datetime(value)
    except Exception:
        return datetime.min


def _dashboard_cache_key(articles: List[Dict[str, Any]]) -> Tuple[Any, ...]:
    db_mtime = HISTORY_DB_PATH.stat().st_mtime if HISTORY_DB_PATH.exists() else 0.0
    article_fingerprint = tuple((a.get("url", ""), a.get("published", "")) for a in articles[:50])
    return (db_mtime, len(articles), article_fingerprint)
