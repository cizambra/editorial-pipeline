from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable, List

from app.core.env import load_environment

load_environment()

from app.persistence import db, db_import


TABLE_IMPORTERS = {
    "app_users": db_import.import_user,
    "scheduled_posts": db_import.import_scheduled_post,
    "runs": db_import.import_run,
    "image_costs": db_import.import_image_cost,
    "thumbnails": db_import.import_thumbnail,
    "post_feedback": db_import.import_feedback,
    "ideas": db_import.import_idea,
    "article_quotes": db_import.import_quote,
    "substack_subscribers": db_import.import_subscriber,
    "substack_batches": db_import.import_substack_batch,
    "substack_notes": db_import.import_substack_note,
}

SEQUENCE_TABLES = (
    db.app_users,
    db.scheduled_posts,
    db.runs,
    db.image_costs,
    db.thumbnails,
    db.post_feedback,
    db.ideas,
    db.article_quotes,
    db.substack_batches,
    db.substack_notes,
)


def _read_rows(conn: sqlite3.Connection, table_name: str) -> List[Dict[str, Any]]:
    try:
        rows = conn.execute(f"SELECT * FROM {table_name}").fetchall()
    except sqlite3.OperationalError:
        return []
    return [dict(row) for row in rows]


def import_sqlite(sqlite_path: Path) -> Dict[str, int]:
    conn = sqlite3.connect(str(sqlite_path))
    conn.row_factory = sqlite3.Row
    try:
        counts: Dict[str, int] = {}
        for table_name, importer in TABLE_IMPORTERS.items():
            rows = _read_rows(conn, table_name)
            for row in rows:
                importer(row)
            counts[table_name] = len(rows)
        for table in SEQUENCE_TABLES:
            db.reset_identity_sequence(table)
        return counts
    finally:
        conn.close()


def import_json_file(path: Path, importer) -> int:
    if not path.exists():
        return 0
    data = json.loads(path.read_text(encoding="utf-8"))
    if not data:
        return 0
    importer(data)
    return 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import legacy SQLite and JSON editorial-pipeline data into DATABASE_URL."
    )
    parser.add_argument(
        "--sqlite",
        type=Path,
        default=Path("run_history.db"),
        help="Path to the legacy SQLite database",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("config_overrides.json"),
        help="Path to the legacy config JSON file",
    )
    parser.add_argument(
        "--checkpoint",
        type=Path,
        default=Path("pipeline_checkpoint.json"),
        help="Path to the legacy checkpoint JSON file",
    )
    args = parser.parse_args()

    if not db.has_database_url():
        raise SystemExit("DATABASE_URL must be set before importing legacy data.")

    db.ensure_schema()

    summary = {
        "config": import_json_file(args.config, db_import.import_config),
        "checkpoint": import_json_file(args.checkpoint, db_import.import_checkpoint),
    }
    summary.update(import_sqlite(args.sqlite))

    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
