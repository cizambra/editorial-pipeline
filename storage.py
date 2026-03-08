"""
storage.py - Persistence helpers for the editorial pipeline.

Owns SQLite access plus small JSON-backed config/checkpoint files so the API
layer can stay focused on HTTP orchestration.
"""

from __future__ import annotations

import json
import sqlite3
import hashlib
from datetime import datetime, timedelta
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
            ("tags", "TEXT DEFAULT ''"),
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

        conn.execute("""
            CREATE TABLE IF NOT EXISTS article_quotes (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id         INTEGER DEFAULT 0,
                timestamp      TEXT NOT NULL,
                article_title  TEXT DEFAULT '',
                article_url    TEXT DEFAULT '',
                quote_text     TEXT NOT NULL,
                context        TEXT DEFAULT '',
                quote_type     TEXT DEFAULT 'insight',
                shared         INTEGER DEFAULT 0,
                signal         TEXT DEFAULT 'none',
                linkedin_post  TEXT DEFAULT '',
                threads_post   TEXT DEFAULT '',
                instagram_post TEXT DEFAULT ''
            )
        """)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_quotes_run ON article_quotes(run_id)")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS substack_subscribers (
                id                      INTEGER PRIMARY KEY,
                email                   TEXT UNIQUE NOT NULL,
                name                    TEXT DEFAULT '',
                photo_url               TEXT DEFAULT '',
                subscription_interval   TEXT DEFAULT 'free',
                is_subscribed           INTEGER DEFAULT 0,
                is_comp                 INTEGER DEFAULT 0,
                activity_rating         INTEGER DEFAULT 0,
                subscription_created_at TEXT DEFAULT '',
                total_revenue_generated INTEGER DEFAULT 0,
                subscription_country    TEXT DEFAULT '',
                detail_json             TEXT DEFAULT '',
                synced_at               TEXT DEFAULT '',
                detail_synced_at        TEXT DEFAULT ''
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sub_activity ON substack_subscribers(activity_rating DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sub_interval ON substack_subscribers(subscription_interval)")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS substack_batches (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp  TEXT NOT NULL,
                note_count INTEGER DEFAULT 0
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS substack_notes (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id       INTEGER NOT NULL,
                timestamp      TEXT NOT NULL,
                issue          TEXT NOT NULL,
                intent         TEXT NOT NULL,
                note_text      TEXT NOT NULL,
                shared         INTEGER DEFAULT 0,
                signal         TEXT DEFAULT 'none',
                linkedin_post  TEXT DEFAULT '',
                threads_post   TEXT DEFAULT '',
                instagram_post TEXT DEFAULT ''
            )
        """)

        for col, coltype in [
            ("linkedin_post",  "TEXT DEFAULT ''"),
            ("threads_post",   "TEXT DEFAULT ''"),
            ("instagram_post", "TEXT DEFAULT ''"),
        ]:
            try:
                conn.execute(f"ALTER TABLE substack_notes ADD COLUMN {col} {coltype}")
            except Exception:
                pass

        conn.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_posts (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                platform     TEXT NOT NULL,
                text         TEXT NOT NULL,
                image_url    TEXT DEFAULT '',
                scheduled_at TEXT NOT NULL,
                status       TEXT DEFAULT 'pending',
                source_label TEXT DEFAULT '',
                created_at   TEXT NOT NULL,
                published_at TEXT DEFAULT '',
                post_id      TEXT DEFAULT '',
                error        TEXT DEFAULT ''
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sched_status_time ON scheduled_posts(status, scheduled_at)")
        try:
            conn.execute("ALTER TABLE scheduled_posts ADD COLUMN timezone TEXT DEFAULT ''")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE scheduled_posts ADD COLUMN note_id INTEGER DEFAULT NULL")
        except Exception:
            pass

        conn.execute("CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON runs(timestamp DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_runs_article_url ON runs(article_url)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_thumbnails_timestamp ON thumbnails(timestamp DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_thumbnails_lookup ON thumbnails(article_title, article_url, concept_name, image_hash)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_image_costs_source ON image_costs(source)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_feedback_platform ON post_feedback(platform)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ideas_status_source_updated ON ideas(status, source, updated_at DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sn_batch ON substack_notes(batch_id)")


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


def save_run(title: str, article_url: str, data: Dict[str, Any], token_summary: Optional[Dict[str, Any]] = None) -> int:
    ts = token_summary or {}
    tags_list = data.get("tags", [])
    tags_str = ",".join(str(t) for t in tags_list) if isinstance(tags_list, list) else ""
    with _connect() as conn:
        cursor = conn.execute(
            "INSERT INTO runs (timestamp, title, article_url, data_json, tokens_in, tokens_out, cost_usd, tags) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                datetime.now().isoformat(),
                title,
                article_url,
                json.dumps(data, ensure_ascii=False),
                ts.get("input_tokens", 0),
                ts.get("output_tokens", 0),
                ts.get("estimated_cost_usd", 0),
                tags_str,
            ),
        )
        return int(cursor.lastrowid)


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
    return sum(1 for v in payload.values() if v and isinstance(v, str) and v.strip())


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
                "SELECT id, timestamp, title, article_url, tokens_in, tokens_out, cost_usd, data_json, tags "
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

    # Tag distribution — count by primary tag (first) and total appearances
    tag_primary: Dict[str, int] = {}
    tag_total: Dict[str, int] = {}
    for run in runs:
        tags_str = run.get("tags", "") or ""
        if not tags_str:
            # Fall back to data_json for older runs without tags column populated
            try:
                d = json.loads(run.get("data_json") or "{}")
                tags_list = d.get("tags", [])
                if isinstance(tags_list, list):
                    tags_str = ",".join(str(t) for t in tags_list)
            except Exception:
                pass
        if tags_str:
            parts = [t.strip() for t in tags_str.split(",") if t.strip()]
            for i, tag in enumerate(parts[:2]):
                tag_total[tag] = tag_total.get(tag, 0) + 1
                if i == 0:
                    tag_primary[tag] = tag_primary.get(tag, 0) + 1

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
        "tag_primary_counts": tag_primary,
        "tag_total_counts": tag_total,
        "repurpose_queue": repurpose_queue[:20],
        "recent_runs": [
            {
                "id": r["id"],
                "title": r["title"],
                "timestamp": r["timestamp"],
                "article_url": r["article_url"],
                "cost_usd": r["cost_usd"],
                "tags": r.get("tags", "") or "",
            }
            for r in runs[:5]
        ],
    }
    _dashboard_cache["key"] = cache_key
    _dashboard_cache["value"] = result
    _dashboard_cache["expires_at"] = now + _DASHBOARD_CACHE_TTL_SECONDS
    return result


def list_history_runs(limit: int = 50) -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, timestamp, title, article_url, tokens_in, tokens_out, cost_usd, tags "
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
            "tags": r["tags"] or "",
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


def save_quotes(run_id: int, article_title: str, article_url: str, quotes: List[Dict[str, Any]]) -> List[int]:
    """Save extracted quotes for a run. Returns list of inserted IDs."""
    now = datetime.now().isoformat()
    ids = []
    with _connect() as conn:
        for q in quotes:
            cursor = conn.execute(
                "INSERT INTO article_quotes (run_id, timestamp, article_title, article_url, quote_text, context, quote_type) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (run_id, now, article_title, article_url, q.get("quote_text") or q.get("quote", ""), q.get("context", ""), q.get("quote_type") or q.get("type", "insight")),
            )
            ids.append(int(cursor.lastrowid))
    return ids


def list_quote_runs(limit: int = 50) -> List[Dict[str, Any]]:
    """Return distinct runs that have quotes, with count."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT run_id, article_title, article_url, MIN(timestamp) as timestamp, COUNT(*) as quote_count "
            "FROM article_quotes GROUP BY run_id ORDER BY MIN(timestamp) DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_quotes_for_run(run_id: int) -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM article_quotes WHERE run_id=? ORDER BY id ASC", (run_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def update_quote(quote_id: int, shared: Optional[bool] = None, signal: Optional[str] = None,
                 linkedin: Optional[str] = None, threads: Optional[str] = None, instagram: Optional[str] = None) -> None:
    fields, vals = [], []
    if shared is not None:
        fields.append("shared=?"); vals.append(1 if shared else 0)
    if signal is not None:
        fields.append("signal=?"); vals.append(signal)
    if linkedin is not None:
        fields.append("linkedin_post=?"); vals.append(linkedin)
    if threads is not None:
        fields.append("threads_post=?"); vals.append(threads)
    if instagram is not None:
        fields.append("instagram_post=?"); vals.append(instagram)
    if not fields:
        return
    vals.append(quote_id)
    with _connect() as conn:
        conn.execute(f"UPDATE article_quotes SET {', '.join(fields)} WHERE id=?", vals)


def delete_quote(quote_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM article_quotes WHERE id=?", (quote_id,))


def upsert_subscribers(subscribers: List[Dict[str, Any]]) -> int:
    """Bulk upsert subscribers from the Substack bulk API. Returns count inserted/updated."""
    now = datetime.now().isoformat()
    with _connect() as conn:
        for s in subscribers:
            conn.execute(
                """
                INSERT INTO substack_subscribers
                    (id, email, name, photo_url, subscription_interval, is_subscribed,
                     is_comp, activity_rating, subscription_created_at,
                     total_revenue_generated, subscription_country, synced_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    name=excluded.name,
                    photo_url=excluded.photo_url,
                    subscription_interval=excluded.subscription_interval,
                    is_subscribed=excluded.is_subscribed,
                    is_comp=excluded.is_comp,
                    activity_rating=excluded.activity_rating,
                    subscription_created_at=excluded.subscription_created_at,
                    total_revenue_generated=excluded.total_revenue_generated,
                    subscription_country=CASE WHEN excluded.subscription_country != ''
                        THEN excluded.subscription_country ELSE substack_subscribers.subscription_country END,
                    synced_at=excluded.synced_at
                """,
                (
                    s.get("user_id"),
                    s.get("user_email_address", ""),
                    s.get("user_name") or "",
                    s.get("user_photo_url") or "",
                    s.get("subscription_interval") or "free",
                    1 if s.get("is_subscribed") else 0,
                    1 if s.get("is_comp") else 0,
                    int(s.get("activity_rating") or 0),
                    s.get("subscription_created_at") or "",
                    int(s.get("total_revenue_generated") or 0),
                    s.get("subscription_country") or "",
                    now,
                ),
            )
    return len(subscribers)


def get_subscribers(
    search: str = "",
    activity: Optional[int] = None,
    interval: str = "",
    offset: int = 0,
    limit: int = 50,
) -> Dict[str, Any]:
    conditions: List[str] = []
    params: List[Any] = []
    if search:
        conditions.append("(name LIKE ? OR email LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])
    if activity is not None:
        conditions.append("activity_rating=?")
        params.append(activity)
    if interval:
        conditions.append("subscription_interval=?")
        params.append(interval)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    with _connect() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM substack_subscribers {where}", params
        ).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM substack_subscribers {where} ORDER BY activity_rating DESC, subscription_created_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()
    return {"total": total, "subscribers": [dict(r) for r in rows]}


def get_subscriber(email: str) -> Optional[Dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM substack_subscribers WHERE email=?", (email,)
        ).fetchone()
    return dict(row) if row else None


def save_subscriber_detail(email: str, detail: Dict[str, Any]) -> None:
    import json as _json
    now = datetime.now().isoformat()
    crm = detail.get("crmData") or {}
    country = crm.get("subscription_country") or crm.get("country") or \
              detail.get("subscription_country") or detail.get("country") or ""
    with _connect() as conn:
        conn.execute(
            """UPDATE substack_subscribers
               SET detail_json=?, detail_synced_at=?,
                   subscription_country=CASE WHEN ? != '' THEN ? ELSE subscription_country END
               WHERE email=?""",
            (_json.dumps(detail), now, country, country, email),
        )


def get_audience_stats() -> Dict[str, Any]:
    """Aggregate audience data from the locally cached subscribers table."""
    import json as _json
    with _connect() as conn:
        total = conn.execute("SELECT COUNT(*) FROM substack_subscribers").fetchone()[0]
        if total == 0:
            return {"total": 0, "paid": 0, "comp": 0, "synced_at": None}

        paid = conn.execute(
            "SELECT COUNT(*) FROM substack_subscribers WHERE is_comp=0 AND subscription_interval NOT IN ('free','') AND subscription_interval IS NOT NULL"
        ).fetchone()[0]
        comp = conn.execute(
            "SELECT COUNT(*) FROM substack_subscribers WHERE is_comp=1"
        ).fetchone()[0]

        act_rows = conn.execute(
            "SELECT activity_rating, COUNT(*) FROM substack_subscribers GROUP BY activity_rating"
        ).fetchall()
        activity_dist = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for rating, cnt in act_rows:
            activity_dist[int(rating or 0)] = cnt

        country_rows = conn.execute(
            "SELECT subscription_country, COUNT(*) as c FROM substack_subscribers "
            "WHERE subscription_country != '' GROUP BY subscription_country ORDER BY c DESC LIMIT 15"
        ).fetchall()
        top_countries = [(r[0], r[1]) for r in country_rows]
        country_coverage = conn.execute(
            "SELECT COUNT(*) FROM substack_subscribers WHERE subscription_country != ''"
        ).fetchone()[0]

        growth_rows = conn.execute(
            "SELECT strftime('%Y-%m', subscription_created_at) as m, COUNT(*) as c "
            "FROM substack_subscribers WHERE subscription_created_at != '' "
            "GROUP BY m ORDER BY m DESC LIMIT 12"
        ).fetchall()
        monthly_growth = dict(reversed([(r[0], r[1]) for r in growth_rows if r[0]]))

        synced_at = conn.execute(
            "SELECT MAX(synced_at) FROM substack_subscribers"
        ).fetchone()[0]

    return {
        "total": total,
        "paid": paid,
        "comp": comp,
        "activity_distribution": activity_dist,
        "top_countries": top_countries,
        "country_coverage": country_coverage,
        "monthly_growth": monthly_growth,
        "synced_at": synced_at,
    }


def get_insights_data() -> Dict[str, Any]:
    """Compute audience insights from all enriched subscriber profiles."""
    import json as _json
    from collections import Counter

    with _connect() as conn:
        total = conn.execute("SELECT COUNT(*) FROM substack_subscribers").fetchone()[0]
        rows = conn.execute(
            "SELECT * FROM substack_subscribers WHERE detail_json != '' AND detail_json IS NOT NULL"
        ).fetchall()

    enriched = []
    for row in rows:
        d = dict(row)
        try:
            crm = (_json.loads(d["detail_json"]) or {}).get("crmData") or {}
            if crm:
                d["crm"] = crm
                enriched.append(d)
        except Exception:
            pass

    if not enriched:
        return {"enriched_count": 0, "total_count": total}

    # Engagement funnel
    open_rates, click_rates, reopen_rates = [], [], []
    for d in enriched:
        crm = d["crm"]
        sent = crm.get("num_emails_received") or 0
        opened = crm.get("num_emails_opened") or 0
        opens = crm.get("num_email_opens") or 0
        clicks = crm.get("links_clicked") or 0
        if sent > 0:
            open_rates.append(opened / sent)
            click_rates.append(clicks / sent)
        if opened > 0:
            reopen_rates.append(opens / opened)

    def avg(lst):
        return sum(lst) / len(lst) if lst else 0

    # Open rate distribution: five 20% buckets
    buckets = [0, 0, 0, 0, 0]
    for r in open_rates:
        buckets[min(4, int(r * 5))] += 1

    # Top segment (activity 4-5)
    top = [d for d in enriched if int(d.get("activity_rating") or 0) >= 4]
    def _country(d):
        return d["crm"].get("subscription_country") or d["crm"].get("country") or ""

    top_countries = Counter(_country(d) for d in top if _country(d))
    creator_count = sum(1 for d in top if d["crm"].get("user_has_publication"))
    paid_count = sum(1 for d in top if d.get("subscription_interval") not in ("free", "", None))
    top_attribution = Counter(
        (d["crm"].get("free_attribution") or "unknown") for d in top
    )

    # At-risk: activity >= 3 but last opened > 45 days ago
    cutoff_45 = (datetime.utcnow() - timedelta(days=45)).strftime("%Y-%m-%d")
    at_risk = [
        d for d in enriched
        if int(d.get("activity_rating") or 0) >= 3
        and (d["crm"].get("last_opened_at") or "")[:10] < cutoff_45
        and (d["crm"].get("last_opened_at") or "") != ""
    ]

    # Web readers, commenters, sharers
    web_readers = sum(1 for d in enriched if (d["crm"].get("num_web_post_views") or 0) > 0)
    commenters  = sum(1 for d in enriched if (d["crm"].get("num_comments") or 0) > 0)
    sharers     = sum(1 for d in enriched if (d["crm"].get("num_shares") or 0) > 0)

    # Cohort quality: avg activity_rating per signup month (last 12 months)
    cohort: Dict[str, List] = {}
    for d in enriched:
        month = (d.get("subscription_created_at") or "")[:7]
        if month:
            cohort.setdefault(month, []).append(int(d.get("activity_rating") or 0))
    cohort_quality = {
        m: round(sum(v) / len(v), 2)
        for m, v in sorted(cohort.items())[-12:]
    }

    # Best cohort month
    best_cohort = max(cohort_quality, key=cohort_quality.get) if cohort_quality else None

    return {
        "enriched_count": len(enriched),
        "total_count": total,
        "avg_open_rate": round(avg(open_rates) * 100, 1),
        "avg_click_rate": round(avg(click_rates) * 100, 1),
        "avg_reopen_rate": round(avg(reopen_rates), 2),
        "open_rate_buckets": buckets,
        "top_segment": {
            "count": len(top),
            "pct": round(len(top) / len(enriched) * 100) if enriched else 0,
            "creator_pct": round(creator_count / len(top) * 100) if top else 0,
            "paid_pct": round(paid_count / len(top) * 100) if top else 0,
            "top_countries": top_countries.most_common(5),
            "top_attribution": top_attribution.most_common(5),
        },
        "at_risk_count": len(at_risk),
        "at_risk_emails": [d["email"] for d in at_risk[:5]],
        "web_reader_pct": round(web_readers / len(enriched) * 100) if enriched else 0,
        "commenters_count": commenters,
        "sharers_count": sharers,
        "cohort_quality": cohort_quality,
        "best_cohort": best_cohort,
    }


def get_next_subscriber_for_enrichment() -> Optional[Dict[str, Any]]:
    """Return the next subscriber that needs a detail fetch.

    Priority: never-fetched first, then stale (> 7 days), both ordered by
    activity_rating DESC so the most engaged readers are enriched first.
    """
    cutoff = (datetime.now() - timedelta(days=7)).isoformat()
    with _connect() as conn:
        row = conn.execute(
            """SELECT * FROM substack_subscribers
               WHERE detail_synced_at IS NULL OR detail_synced_at = '' OR detail_synced_at < ?
               ORDER BY (CASE WHEN detail_synced_at IS NULL OR detail_synced_at = '' THEN 1 ELSE 0 END) DESC,
                        activity_rating DESC
               LIMIT 1""",
            (cutoff,),
        ).fetchone()
    return dict(row) if row else None


def save_substack_batch(notes: List[Dict[str, Any]]) -> int:
    """Save a generated batch of notes. Returns the batch id."""
    now = datetime.now().isoformat()
    with _connect() as conn:
        cursor = conn.execute(
            "INSERT INTO substack_batches (timestamp, note_count) VALUES (?, ?)",
            (now, len(notes)),
        )
        batch_id = int(cursor.lastrowid)
        for note in notes:
            conn.execute(
                "INSERT INTO substack_notes (batch_id, timestamp, issue, intent, note_text) VALUES (?, ?, ?, ?, ?)",
                (batch_id, now, note.get("issue", ""), note.get("intent", ""), note.get("note_text", "")),
            )
    return batch_id


def list_substack_batches() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT b.id, b.timestamp, b.note_count, "
            "SUM(CASE WHEN n.shared=1 THEN 1 ELSE 0 END) as shared_count, "
            "SUM(CASE WHEN n.signal='positive' THEN 1 ELSE 0 END) as positive_count "
            "FROM substack_batches b "
            "LEFT JOIN substack_notes n ON n.batch_id = b.id "
            "GROUP BY b.id ORDER BY b.id DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_substack_notes(batch_id: int) -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM substack_notes WHERE batch_id=? ORDER BY id ASC",
            (batch_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def search_substack_notes(
    q: str = "",
    shared: bool = False,
    repurposed: bool = False,
    signal: Optional[str] = None,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    conditions: List[str] = []
    params: List[Any] = []
    if q:
        conditions.append("(note_text LIKE ? OR issue LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%"])
    if shared:
        conditions.append("shared=1")
    if repurposed:
        conditions.append("(linkedin_post != '' OR threads_post != '' OR instagram_post != '')")
    if signal:
        conditions.append("signal=?")
        params.append(signal)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    with _connect() as conn:
        rows = conn.execute(
            f"SELECT * FROM substack_notes {where} ORDER BY id DESC LIMIT ?",
            params + [limit],
        ).fetchall()
    return [dict(r) for r in rows]


def update_substack_note(note_id: int, shared: Optional[bool] = None, signal: Optional[str] = None, note_text: Optional[str] = None) -> None:
    fields, vals = [], []
    if shared is not None:
        fields.append("shared=?")
        vals.append(1 if shared else 0)
    if signal is not None:
        fields.append("signal=?")
        vals.append(signal)
    if note_text is not None:
        fields.append("note_text=?")
        vals.append(note_text)
    if not fields:
        return
    vals.append(note_id)
    with _connect() as conn:
        conn.execute(f"UPDATE substack_notes SET {', '.join(fields)} WHERE id=?", vals)


def save_substack_repurpose(note_id: int, linkedin: str, threads: str, instagram: str) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE substack_notes SET linkedin_post=?, threads_post=?, instagram_post=? WHERE id=?",
            (linkedin, threads, instagram, note_id),
        )


def delete_substack_note(note_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM substack_notes WHERE id=?", (note_id,))


def delete_substack_batch(batch_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM substack_notes WHERE batch_id=?", (batch_id,))
        conn.execute("DELETE FROM substack_batches WHERE id=?", (batch_id,))


def _parse_article_date(value: str):
    try:
        return parsedate_to_datetime(value)
    except Exception:
        return datetime.min


def _dashboard_cache_key(articles: List[Dict[str, Any]]) -> Tuple[Any, ...]:
    db_mtime = HISTORY_DB_PATH.stat().st_mtime if HISTORY_DB_PATH.exists() else 0.0
    article_fingerprint = tuple((a.get("url", ""), a.get("published", "")) for a in articles[:50])
    return (db_mtime, len(articles), article_fingerprint)


# ── Scheduled posts ────────────────────────────────────────────────────────────

def create_scheduled_post(
    platform: str,
    text: str,
    scheduled_at: str,
    image_url: str = "",
    source_label: str = "",
    timezone: str = "",
    note_id: Optional[int] = None,
) -> int:
    """Store a post to be published at scheduled_at (UTC ISO string). Returns the id."""
    now = datetime.utcnow().isoformat()
    with _connect() as conn:
        cursor = conn.execute(
            "INSERT INTO scheduled_posts (platform, text, image_url, scheduled_at, source_label, timezone, note_id, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (platform, text, image_url, scheduled_at, source_label, timezone, note_id, now),
        )
        return int(cursor.lastrowid)


def list_scheduled_posts(status: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """List scheduled posts, optionally filtered by status, newest scheduled_at first."""
    sql = """
        SELECT sp.*, sn.signal AS note_signal
        FROM scheduled_posts sp
        LEFT JOIN substack_notes sn ON sp.note_id = sn.id
        {where}
        ORDER BY sp.scheduled_at ASC LIMIT ?
    """
    with _connect() as conn:
        if status:
            rows = conn.execute(
                sql.format(where="WHERE sp.status=?"), (status, limit)
            ).fetchall()
        else:
            rows = conn.execute(
                sql.format(where=""), (limit,)
            ).fetchall()
    return [dict(r) for r in rows]


def record_published_post(platform: str, text: str, image_url: str = "", source_label: str = "") -> None:
    """Record an immediately-published post (no prior scheduling) for history."""
    now = datetime.utcnow().isoformat()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO scheduled_posts "
            "(platform, text, image_url, scheduled_at, status, source_label, timezone, created_at, published_at) "
            "VALUES (?, ?, ?, ?, 'published', ?, '', ?, ?)",
            (platform, text, image_url, now, source_label, now, now),
        )


def get_due_scheduled_posts() -> List[Dict[str, Any]]:
    """Return pending posts whose scheduled_at (UTC) has passed."""
    now = datetime.utcnow().isoformat()
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM scheduled_posts WHERE status='pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC",
            (now,),
        ).fetchall()
    return [dict(r) for r in rows]


def update_scheduled_post_status(
    post_id: int,
    status: str,
    post_id_result: str = "",
    error: str = "",
) -> None:
    published_at = datetime.now().isoformat() if status == "published" else ""
    with _connect() as conn:
        conn.execute(
            "UPDATE scheduled_posts SET status=?, post_id=?, error=?, published_at=? WHERE id=?",
            (status, post_id_result, error, published_at, post_id),
        )


def cancel_scheduled_post(post_id: int) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE scheduled_posts SET status='cancelled' WHERE id=? AND status='pending'",
            (post_id,),
        )


def delete_scheduled_post(post_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM scheduled_posts WHERE id=?", (post_id,))
