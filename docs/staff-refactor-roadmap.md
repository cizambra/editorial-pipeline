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

- add route/request context to structured logs consistently
- simplify `generator.py` further by separating content assembly helpers from streaming orchestration
- keep shrinking the remaining cross-page frontend handlers where module-local bindings are clearly better

## Scope

This roadmap assumes:

- frontend remains plain HTML/CSS/JS for now
- deployment remains single-instance for now
- Postgres remains the live runtime store
- the goal is maintainability and operational clarity, not feature expansion

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
