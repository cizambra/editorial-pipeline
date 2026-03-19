# Staff Refactor Roadmap

## Current Status

Completed:

- runtime modules moved under `app/` with domain-oriented package boundaries:
  - `app/api/routes`
  - `app/core`
  - `app/persistence`
  - `app/services`
  - `app/workers`
- root-level modules retained as compatibility shims during the transition
- pipeline runtime extracted:
  - `app/api/routes/pipeline.py`
  - `app/services/pipeline.py`
- runtime-hardening pass completed:
  - blocking scraper/Supabase/Substack/Anthropic work moved behind FastAPI threadpool boundaries on the main async routes
  - remaining lower-traffic route storage/file/provider calls moved behind threadpool boundaries in auth, settings, operations, and pipeline routes
  - structured logging introduced via `app/core/logging.py` and expanded across scheduler and route failure paths
  - frontend browser code split into `static/js/state.js`, `static/js/auth.js`, `static/js/pipeline.js`, `static/js/marketing.js`, `static/js/notes.js`, `static/js/quotes.js`, `static/js/workspace.js`, `static/js/ops.js`, and `static/js/bootstrap.js`
  - the old global frontend click router was reduced to smaller action-group listeners and page-scoped bindings in `static/js/bootstrap.js`; only the truly cross-page handlers remain document-scoped
  - `.env` loading moved out of `settings.py` into explicit entrypoints via `app/core/env.py`
  - persistence internals split into `app/persistence/db_schema.py`, `app/persistence/db_auth.py`, `app/persistence/db_runtime.py`, `app/persistence/db_content.py`, `app/persistence/storage_auth.py`, `app/persistence/storage_history.py`, `app/persistence/storage_reports.py`, and `app/persistence/storage_content.py` behind stable `db.py` and `storage.py` facades
  - Claude client construction is centralized via `app/core/ai_clients.py`, and `generator.py` now uses that shared path
  - remaining provider client setup is standardized via `app/core/provider_clients.py`:
    - LinkedIn credentials
    - Google API key access for Imagen
    - shared HTTP backend selection for Threads/Substack
    - shared Instagram client session/bootstrap for Meta publishing
  - generation transport concerns are separated from prompt orchestration via `app/services/generator_transport.py`
  - prompt-building and editable prompt state are separated from pipeline orchestration via `app/services/generator_prompts.py`
  - pure content/pipeline helper functions are being pulled out of `generator.py` into `app/services/generator_helpers.py`
  - the full pipeline stream orchestration in `generator.py` is now split across smaller internal stage helpers instead of one monolithic event loop body
  - the pipeline stream runtime is now extracted into `app/services/pipeline_runtime.py`, with `generator.py` delegating to it
  - structured logging now carries request context automatically via middleware:
    - `request_id`
    - `method`
    - `path`
    - `user_id`
    - `user_role`
  - pipeline persistence logs now include run-level context when a completed run is saved
  - mutation route logs now include domain IDs on high-value actions:
    - `run_id`
    - `thumbnail_id`
    - `scheduled_post_id`
    - `note_id`
    - `quote_id`
    - `idea_id`
  - frontend `data-a` dispatch in `static/js/bootstrap.js` is now split across domain handlers:
    - core
    - ideas
    - thumbnails
    - audience
    - notes
    - quotes
    - publishing
  - those frontend action handlers now live in separate loaded files:
    - `static/js/actions-core.js`
    - `static/js/actions-marketing.js`
    - `static/js/actions-dispatch.js`
  - remaining non-action UI helpers are now split out of `static/js/bootstrap.js` into:
    - `static/js/ui-core.js`
    - `static/js/ui-marketing.js`
  - `static/js/bootstrap.js` is now reduced to startup wiring and boot-time page initialization
  - the real browser entrypoint is template-based:
    - `templates/index.html`
    - `templates/partials/scripts.html`
  - a root template smoke test now verifies `/` renders the template shell and includes the split script files:
    - `tests/test_root_template.py`
  - an authenticated shell smoke test now verifies shell boot plus `/api/auth/me` session state:
    - `tests/test_shell_boot.py`
  - auth-flow coverage now includes:
    - invite creation
    - invite resend / revoke
    - Supabase password reset link generation contract
    - `tests/test_auth_flows.py`
  - a DB-backed audit trail now records auth, queue, and config mutations:
    - `app/persistence/db_audit.py`
    - `app/persistence/storage_audit.py`
    - `alembic/versions/0006_audit_log.py`
  - audit events are exposed via a superadmin-only endpoint:
    - `/api/audit`
    - covered by `tests/test_audit_log.py`
  - the `Settings` page now surfaces:
    - direct local account creation
    - pending invite management with resend / revoke
    - audit history for auth, queue, and config mutations
    - audit filters for `all`, `auth`, `queue`, and `config`
  - invite acceptance now has a dedicated entrypoint instead of relying on raw links alone:
    - `GET /invite`
    - `templates/invite.html`
    - `static/js/invite.js`
    - covered by `tests/test_invite_page.py`
- `workers/scheduler.py` extracted from `main.py`
- `routes/auth.py` extracted
- `routes/settings.py` extracted
- `routes/operations.py` extracted for history, marketing, queueing, thumbnails, feedback, and ideas
- `routes/media.py` extracted for thumbnail generation and Reddit research
- `routes/content.py` extracted for Substack notes, audience/subscribers, social compose repurpose, and quotes
- `prompt_state.py` introduced for shared prompt/template runtime state
- `ai_clients.py` introduced for the shared Claude client
- `provider_clients.py` introduced for shared non-Claude provider construction
- `generator_transport.py` introduced for Claude transport, token accounting, and tone control

Still intentionally in `main.py`:

- app wiring and middleware
- health/readiness endpoints
- Imagen endpoint
- compatibility exports for tests and transitional imports

Next refactor target:

- continue shrinking the remaining shared UI helpers in `static/js/bootstrap.js`
- add broader route/template integration coverage where the UI shell or script load order matters
- keep pushing domain logic down out of service facades where orchestration is still too deep

## Scope

This roadmap assumes:

- frontend remains plain HTML/CSS/JS for now
- deployment remains single-instance for now
- Postgres remains the live runtime store
- the goal is maintainability and operational clarity, not feature expansion

## Manual Test Checklist

Use separate browser sessions so cookies do not overlap:

- normal window: `superadmin`
- incognito window 1: `admin`
- incognito window 2: `operator`

Recommended local test accounts:

- `superadmin`: your bootstrap admin account
- `admin`: `admin-test@epicurean.local` / `AdminTest123!`
- `operator`: `operator-test@epicurean.local` / `OperatorTest123!`

### Health and Runtime

1. Open `/healthz`
2. Confirm:
   - `status` is `ok`
   - `service` is `editorial-pipeline`
3. Open `/readyz`
4. Confirm:
   - `status` is `ready`
   - `database` is `ok`

### Role Checks

#### Operator

1. Sign in as `operator`
2. Open `Audience`
3. Confirm `Sync` is greyed out and shows the admin-required tooltip on hover
4. Open `Settings`
5. Confirm:
   - `Access control` is hidden
   - prompt/rules editors are read-only
   - `Save overrides`, template upload, and article indexing actions are disabled
6. Open `Marketing`
7. Confirm publish/schedule actions are disabled

#### Admin

1. Sign in as `admin`
2. Open `Marketing`
3. Confirm:
   - publish works
   - schedule works
   - cancel on queued posts works
4. Open `Audience`
5. Confirm subscriber sync works
6. Open `Settings`
7. Confirm:
   - `Access control` is still hidden
   - superadmin-only settings actions remain disabled

#### Superadmin

1. Sign in as `superadmin`
2. Open `Settings`
3. Confirm:
   - `Access control` is visible
   - direct account creation works
   - invite creation works
   - audit panel is visible
4. Open `History`
5. Confirm delete run works
6. Open `Thumbnail`
7. Confirm delete thumbnail works

### Invite Flow

1. Sign in as `superadmin`
2. Open `Settings`
3. In `Access control`, create an invite
4. Confirm the accept link is copied to your clipboard
5. Open the copied `/invite?token=...` link
6. On the invite page:
   - enter a display name
   - in local auth mode, set a password
   - in Supabase mode, paste the authenticated access token
7. Submit `Accept invite`
8. Confirm you are redirected back to `/`
9. Return to `Settings`
10. Confirm the invite is no longer pending
11. Confirm an `auth.invite_accepted` event appears in the audit log

### Invite Resend and Revoke

1. Create another invite from `Settings`
2. Click `Resend`
3. Confirm a fresh accept link is copied to your clipboard
4. Click `Revoke`
5. Confirm the invite disappears from the pending list
6. Confirm audit entries appear for:
   - `auth.invite_created`
   - `auth.invite_resent`
   - `auth.invite_revoked`

### Queue and Pipeline

1. Open `Pipeline`
2. Enable `Queue social posts`
3. Run the pipeline on a test article
4. Confirm the result card reports queued posts
5. Use the link into `Marketing -> Publishing`
6. Confirm the queued posts appear in the shared publishing queue
7. From `Marketing`, cancel one queued post
8. Confirm the queue count updates
9. Confirm the audit log shows:
   - `queue.scheduled`
   - `queue.cancelled`

### Audit Filters

1. Open `Settings`
2. In the audit panel, click `Auth`
3. Confirm only `auth.*` events remain
4. Click `Queue`
5. Confirm only `queue.*` events remain
6. Click `Config`
7. Confirm only `config.*` events remain
8. Click `All`
9. Confirm all recent event types return

### Config and Template Mutations

1. Sign in as `superadmin`
2. Open `Settings`
3. Change one prompt field and save overrides
4. Upload a template file
5. Confirm the audit log shows:
   - `config.updated`
   - `config.template_uploaded`

## Priorities

### Phase 1: Untangle Runtime Boundaries

Goal: reduce the blast radius of changes and make the app easier to reason about.

1. Split `main.py` into:
   - `app.py`
   - `routes/auth.py`
   - `routes/content.py`
   - `routes/marketing.py`
   - `routes/settings.py`
   - `workers/scheduler.py`
2. Move startup/lifespan concerns out of route modules.
3. Move route-local orchestration helpers into service modules.
4. Keep API contracts stable while changing internals.

Exit criteria:

- `main.py` becomes a thin entrypoint
- route modules are grouped by domain
- scheduler startup is isolated behind a dedicated module

### Phase 2: Fix Blocking I/O on Async Paths

Goal: stop stalling the FastAPI event loop with synchronous network operations.

1. Inventory blocking calls on request paths:
   - Supabase auth HTTP calls
   - Substack scraping/fetching
   - article indexing and fetch
2. Either:
   - convert those code paths to async clients, or
   - make the affected endpoints sync handlers deliberately
3. Centralize HTTP client configuration:
   - timeout policy
   - retry policy where safe
   - consistent error translation
4. Standardize provider client construction:
   - shared HTTP backend selection
   - shared credential lookup
   - shared session/bootstrap logic where providers need local state

Exit criteria:

- no request handler performs unbounded blocking network I/O accidentally
- external client behavior is consistent and explicit
- provider-specific setup is not reimplemented ad hoc across service modules

### Phase 3: Split the Frontend Script

Goal: make the UI maintainable without introducing a framework prematurely.

1. Extract the inline script in `static/index.html` into:
   - `static/js/state.js`
   - `static/js/auth.js`
   - `static/js/pipeline.js`
   - `static/js/marketing.js`
   - `static/js/settings.js`
   - `static/js/ui-core.js`
2. Move the global `S` store into a single exported module.
3. Replace the giant document click router with smaller delegated handlers per area.
4. Keep the existing HTML structure unless cleanup is needed for module boundaries.

Exit criteria:

- no single frontend file owns all state and behavior
- role gating, auth, and marketing scheduling are isolated modules
- document-scoped handlers are limited to genuinely cross-page concerns

### Phase 4: Observability and Failure Discipline

Goal: make failures visible and diagnosable.

1. Replace `print()` with structured logging.
2. Remove silent `except Exception: pass` paths unless they are explicitly justified.
3. Add correlation-friendly context to logs:
   - route name
   - user id
   - run id
   - scheduled post id
4. Standardize error handling for external provider failures.

Exit criteria:

- scheduler failures are visible
- scraper/provider failures are logged consistently
- silent failure is exceptional, not normal

### Phase 5: Simplify Settings and Runtime Configuration

Goal: align configuration with the real architecture.

1. Move `.env` loading to the entrypoint instead of `settings.py`.
2. Remove legacy runtime-only settings that are no longer used live.
3. Separate:
   - runtime settings
   - import/migration settings
4. Add startup diagnostics for missing critical config.

Exit criteria:

- runtime config matches the actual app architecture
- import-only settings are not mixed into normal app startup

### Phase 6: Clean Up the Data Layer

Goal: make persistence easier to evolve.

1. Split:
   - schema definitions
   - repositories
   - import utilities
2. Reduce use of opaque JSON blobs for stable operational fields.
3. Add clearer repository interfaces around:
   - auth/users/invites
   - scheduled posts
   - runs/history
   - notes/quotes/ideas

Exit criteria:

- DB module boundaries map to actual domains
- stable data is queryable without decoding application blobs everywhere

## Issue Backlog

### P0

1. Refactor: split `main.py` into route, service, and worker modules
   - Why: largest maintainability bottleneck
   - Risk reduced: merge conflicts, hidden coupling, weak testability

2. Runtime: eliminate blocking network I/O from async request paths
   - Why: correctness and latency risk
   - Risk reduced: event loop stalls, slow requests, unpredictable concurrency

3. Frontend: extract inline SPA script into plain JS modules
   - Why: frontend maintainability bottleneck
   - Risk reduced: accidental regressions, unreadable UI state flows

### P1

4. Observability: replace `print` and silent catch-all handlers with structured logging
   - Why: current failure modes are too opaque
   - Risk reduced: debugging time, silent operational drift

5. Config: move `.env` loading out of `settings.py`
   - Why: portability and test hygiene
   - Risk reduced: hidden side effects during import

6. Persistence: split schema definitions from repository logic
   - Why: current DB layer is doing too much in one file
   - Risk reduced: hard-to-review persistence changes

7. Providers: standardize client/session bootstrap across external integrations
   - Why: provider setup drift creates hidden auth/session bugs
   - Risk reduced: inconsistent credential handling, duplicated session logic

### P2

8. Data model: normalize stable fields currently buried in JSON blobs
   - Why: future querying and reporting will get harder otherwise
   - Risk reduced: app-only data access patterns

9. UI architecture: finish replacing the remaining global click router branches with area-scoped handlers
   - Why: incremental UI work is getting too risky
   - Risk reduced: unrelated feature collisions

10. Scheduler: formalize single-instance assumptions in code and docs
   - Why: single-instance is fine, but it should be explicit
   - Risk reduced: accidental bad deployment topology later

## Recommended Execution Order

1. Split `main.py` first, without changing behavior.
2. Fix blocking I/O next, while the backend boundaries are clearer.
3. Split the frontend script after the backend modules are stable.
4. Add structured logging once module boundaries exist.
5. Simplify settings and DB internals after the runtime surface is cleaner.
6. Standardize provider construction and continue shrinking the remaining frontend/global orchestration hotspots.

## What I Would Start With In Code

### First refactor pass

1. Create `routes/auth.py` and move auth endpoints there.
2. Create `routes/settings.py` and move template/config/article-index endpoints there.
3. Create `workers/scheduler.py` and move APScheduler setup plus job functions there.
4. Leave all business logic and storage calls unchanged initially.

### Success condition for the first pass

- no user-visible behavior changes
- tests still pass
- `main.py` loses most route definitions and scheduler code
