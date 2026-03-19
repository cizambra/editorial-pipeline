# Postgres Cutover Runbook

Use this when moving an existing local Editorial Pipeline workspace from legacy SQLite/JSON storage to the Postgres-backed path.

## Scope

This runbook covers the tables currently migrated behind `DATABASE_URL`:

- `app_users`
- `scheduled_posts`
- config overrides
- pipeline checkpoint
- runs
- image costs
- ideas
- thumbnails
- post feedback
- article quotes
- Substack subscribers
- Substack batches
- Substack notes

These are still outside the cutover scope:

- any remaining legacy-only tables not listed above

## Prerequisites

1. A reachable Postgres database
2. A valid `DATABASE_URL`
3. Your current local files still present:
   - `run_history.db`
   - `config_overrides.json`
   - `pipeline_checkpoint.json`
4. A backup copy of those files before import

## 1. Back up the current local state

```bash
mkdir -p backups
cp run_history.db "backups/run_history.$(date +%Y%m%d-%H%M%S).db"
cp config_overrides.json "backups/config_overrides.$(date +%Y%m%d-%H%M%S).json" 2>/dev/null || true
cp pipeline_checkpoint.json "backups/pipeline_checkpoint.$(date +%Y%m%d-%H%M%S).json" 2>/dev/null || true
```

## 2. Set the DB-backed environment

Minimum relevant env:

```env
AUTH_MODE=local
SESSION_SECRET=replace-with-a-real-secret
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
BOOTSTRAP_ADMIN_EMAIL=you@example.com
BOOTSTRAP_ADMIN_PASSWORD=choose-a-password
```

## 3. Apply migrations

```bash
alembic upgrade head
```

## 4. Import legacy data

Default paths:

```bash
python3 scripts/import_legacy_data.py
```

Custom paths:

```bash
python3 scripts/import_legacy_data.py \
  --sqlite /path/to/run_history.db \
  --config /path/to/config_overrides.json \
  --checkpoint /path/to/pipeline_checkpoint.json
```

The script prints per-table import counts as JSON.

## 5. Verify the cutover

Start the app with `DATABASE_URL` set:

```bash
python3 -m uvicorn app.main:app --reload
```

Then verify:

1. Login still works
2. Existing users are present
3. History loads
4. Marketing queue loads
5. Thumbnails load
6. Ideas load
7. Substack note batches load
8. Quotes load

## 6. Smoke-test write paths

Check at least one write in each area:

1. Create a test idea
2. Save a thumbnail
3. Queue a social post
4. Update note/quote metadata
5. Run a pipeline job and confirm a new history entry appears

## 7. Keep rollback simple

If the app behaves incorrectly after cutover:

1. Stop the app
2. Keep the legacy SQLite/JSON files untouched
3. Fix the DB-backed issue or temporarily run a pre-cutover git revision if you need the old runtime behavior
4. Re-run import only if you intentionally rebuild the Postgres state

Do not delete the legacy SQLite/JSON files until the DB-backed app has been stable for multiple real sessions.
