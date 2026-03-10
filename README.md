# Editorial Pipeline

Internal editorial operations app for Epicurean Media.

Upload a reflection, generate the companion piece, translations, social derivatives, thumbnails, and scheduling outputs from one interface.

## Current state

- The app is now protected by login.
- Local development uses `AUTH_MODE=local`.
- The first local `superadmin` is created from `.env` on first startup.
- `DATABASE_URL` now backs:
  - `app_users`
  - `scheduled_posts`
  - app config overrides
  - pipeline checkpoint state
  - run history
  - image cost tracking
  - ideas
  - thumbnails
  - post feedback
  - quotes
  - Substack subscribers
  - Substack note batches
  - Substack notes
- Legacy SQLite/JSON runtime mode has been removed; those files are now import sources only.
- A local Postgres container is included because Postgres is now the active target for the app's core operational state, with the remaining domain tables to follow.

## Quick start

### 1. Install dependencies

```bash
python3 -m pip install -r requirements.txt
```

### 2. Create your `.env`

```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

### 3. Fill the minimum required values

For a normal local setup, you only need these values first:

```env
APP_ENV=development
AUTH_MODE=local
SESSION_SECRET=replace-with-a-long-random-secret
BOOTSTRAP_ADMIN_EMAIL=you@example.com
BOOTSTRAP_ADMIN_PASSWORD=choose-a-password
BOOTSTRAP_ADMIN_NAME=Your Name
ANTHROPIC_API_KEY=...
```

All other variables are optional unless you are actively using those integrations.

## What `SESSION_SECRET` is and why it exists

The app uses a browser session cookie after you log in.

That cookie must be signed so the server can detect if someone tampers with it. `SESSION_SECRET` is the secret key used to sign that cookie.

Without it:
- the app cannot safely trust the login session
- a weak secret makes session forgery easier

### For local development

Any long random string is fine.

Example:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output into:

```env
SESSION_SECRET=that-generated-value
```

### For production

Use a strong random secret and keep it private. Do not commit it to git.

## First login flow

When you start the app with:

```env
AUTH_MODE=local
BOOTSTRAP_ADMIN_EMAIL=...
BOOTSTRAP_ADMIN_PASSWORD=...
```

the app creates the first `superadmin` automatically on startup if that user does not already exist.

Then:
1. run the app
2. open `http://localhost:8000`
3. sign in with the bootstrap admin email/password
4. go to `Settings`
5. create additional internal accounts there

### Supabase production login

When `AUTH_MODE=supabase`, the app still uses the same `/api/auth/login` route and the same login form shape, but the backend authenticates the email/password against Supabase and then maps the authenticated identity to your app user role.

In this mode:
- direct password-based app user creation is disabled
- onboarding should go through the invite endpoints
- password reset uses the Supabase recovery-link flow

## Pipeline queueing

The Pipeline can now send generated social posts into the same scheduling queue used by the Marketing section.

Use the `Queue social posts` toggle in the Pipeline run options when you want:
- reflection posts queued for the configured reflection day/time
- companion posts queued for the configured companion day/time
- the queued items to appear in the shared publishing queue

Current behavior:
- the queue is shared between Pipeline and Marketing
- the background scheduler publishes due queued posts
- Instagram is skipped by the pipeline queue path unless an image URL exists

## Run the app

```bash
python3 main.py
```

Then open:

```text
http://localhost:8000
```

## Local Postgres

The repo now includes a local Postgres container:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Use it for local development.

When `DATABASE_URL` is set, these features already use the DB-backed path:

- internal users / auth accounts
- scheduled publishing queue
- config overrides
- pipeline checkpoint
- run history
- image cost records
- ideas
- thumbnails
- post feedback
- quotes
- Substack subscribers
- Substack note batches
- Substack notes

Postgres is now the required runtime store for the app.

## Import existing local data into Postgres

Once `DATABASE_URL` is configured, you can import your current local files into the DB-backed tables:

```bash
python3 scripts/import_legacy_data.py
```

Defaults:
- SQLite source: `run_history.db`
- config source: `config_overrides.json`
- checkpoint source: `pipeline_checkpoint.json`

Custom paths:

```bash
python3 scripts/import_legacy_data.py \
  --sqlite /path/to/run_history.db \
  --config /path/to/config_overrides.json \
  --checkpoint /path/to/pipeline_checkpoint.json
```

The importer currently migrates:
- users
- scheduled posts
- config overrides
- pipeline checkpoint
- runs/history
- image costs
- thumbnails
- post feedback
- ideas
- quotes
- Substack subscribers
- Substack note batches
- Substack notes

For the full cutover procedure, see [docs/postgres-cutover.md](./docs/postgres-cutover.md).

## Environment variable guide

The detailed comments live in [.env.example](./.env.example). This section explains the important groups.

### Runtime

- `APP_ENV`
  - `development` for local use
  - `production` for deployed use
- `APP_HOST`
  - host to bind the FastAPI app to
- `APP_PORT`
  - local port
- `APP_RELOAD`
  - enable auto-reload during development

### Authentication

- `AUTH_MODE`
  - `local` for app-managed login
  - `supabase` for production identity with app-managed roles
- `SESSION_SECRET`
  - signs the browser session cookie
- `BOOTSTRAP_ADMIN_EMAIL`
  - first local superadmin login
- `BOOTSTRAP_ADMIN_PASSWORD`
  - first local superadmin password
- `BOOTSTRAP_ADMIN_NAME`
  - display name for that account
- roles currently used by the app:
  - `operator`: normal content workflow
  - `admin`: publishing, queueing, external sync/test actions
  - `superadmin`: user management, config, diagnostics, hard deletes
- Supabase production auth variables:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_JWT_SECRET`
  - `SUPABASE_SITE_URL`
  - `INVITE_EXPIRY_HOURS`

### Legacy import sources

- `SQLITE_DB_PATH`
  - path to the legacy SQLite database used only as an import source now
- `CONFIG_PATH`
  - path to the legacy config JSON used only as an import source now
- `CHECKPOINT_PATH`
  - path to the legacy checkpoint JSON used only as an import source now
- `STATIC_GENERATED_DIR`
  - generated assets directory
- `COMPANION_TEMPLATE_PATH`
  - companion template file path

### Runtime database

- `DATABASE_URL`
  - required Postgres connection string for the live app
  - the live runtime no longer supports SQLite/JSON mode

### Scheduling

- `REFLECTION_DAY` / `REFLECTION_TIME`
- `COMPANION_DAY` / `COMPANION_TIME`

Day mapping:
- `0=Monday`
- `1=Tuesday`
- `2=Wednesday`
- `3=Thursday`
- `4=Friday`
- `5=Saturday`
- `6=Sunday`

### AI/image providers

- `ANTHROPIC_API_KEY`
  - required for the text pipeline
- `OPENAI_API_KEY`
  - required for OpenAI thumbnail features
- `GOOGLE_API_KEY`
  - required for Imagen generation

### Publishing integrations

- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_PERSON_URN`
- `THREADS_ACCESS_TOKEN`
- `THREADS_USER_ID`
- `THREADS_SESSION_ID`
- `THREADS_CSRF_TOKEN`
- `META_ACCESS_TOKEN`
- `INSTAGRAM_USER_ID`
- `SUBSTACK_SESSION_COOKIE`

Only fill the platform-specific values for the integrations you actually plan to use.

## Companion template

Put your companion template at:

```text
templates/companion_template.md
```

or upload it from the Settings page in the UI.

## What the app does

1. Finds related articles from your Substack archive
2. Generates the paid companion article
3. Translates both pieces to Spanish
4. Generates LinkedIn, Instagram, Threads, and Substack-note variants
5. Schedules or publishes supported social outputs
6. Stores history, notes, quotes, thumbnails, and related operational data locally

## What changed recently

- Added login and local superadmin bootstrapping
- Added internal account creation through the UI
- Added `.env.example` with explained variables
- Added local Postgres dev compose file

## Next planned infrastructure step

Move the app's canonical persistence from local SQLite/JSON to Postgres while preserving the new auth flow.
