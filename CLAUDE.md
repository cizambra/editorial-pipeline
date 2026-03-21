# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Editorial Pipeline** is an internal content operations app for Epicurean Media. It takes a reflection/article and generates: a paid companion piece, Spanish translations, social media derivatives (LinkedIn, Instagram, Threads, Substack Notes), and thumbnails. A React SPA frontend communicates with a FastAPI backend via REST and SSE streams.

## Development Commands

### Backend
```bash
# Install dependencies
python3 -m pip install -r requirements.txt

# Run dev server (with hot reload)
python3 -m uvicorn app.main:app --reload
# Accessible at http://localhost:8000

# Run tests
pytest
pytest tests/test_auth.py  # run a single test file
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # Vite dev server at http://localhost:5173
npm run build   # Outputs to static/dist/
```

### Database
```bash
# Start Postgres via Docker
docker compose -f docker-compose.dev.yml up -d

# Or native setup
bash scripts/setup_db.sh

# Run Alembic migrations
alembic upgrade head
```

### Health Endpoints
- `GET /healthz` — scheduler + auth mode status
- `GET /readyz` — database connectivity check (used by Railway)

## Architecture

### Backend Structure
- `app/main.py` — FastAPI app, middleware registration, lifespan (starts APScheduler)
- `app/core/` — auth logic, settings (env validation), logging, AI client factories
- `app/api/routes/` — 6 routers: `auth`, `pipeline`, `content`, `operations`, `settings`, `media`
- `app/services/` — business logic (see pipeline flow below)
- `app/persistence/` — SQLAlchemy ORM; `db_schema.py` defines all tables; `storage.py` re-exports all CRUD from `storage_*.py` modules
- `app/workers/` — APScheduler background jobs for publishing scheduled social posts

### Frontend Structure
- `frontend/src/app/Root.tsx` — app shell with layout (mobile bottom nav / desktop sidebar)
- `frontend/src/lib/api.ts` — single typed HTTP client for all backend endpoints
- `frontend/src/lib/auth-context.tsx` — React auth context (`useAuth()` hook)
- `frontend/src/app/components/` — page views (Pipeline, Marketing, Companion, Thumbnail, Dashboard, Settings, History, Ideas, Audience)

### Core Pipeline Flow

1. User uploads a reflection file via `POST /api/pipeline/run`
2. `app/services/pipeline.py` → `build_pipeline_stream()` reserves a run ID in DB and yields SSE events
3. `app/services/pipeline_runtime.py` → `run_full_pipeline_stream()` orchestrates parallel generation using `concurrent.futures.ThreadPoolExecutor`
4. `app/services/generator.py` makes Claude/OpenAI API calls; prompts live in `app/services/generator_prompts.py`
5. On completion: run data + token usage saved to DB; social posts optionally queued to `scheduled_posts` table
6. APScheduler (runs inside the FastAPI process) picks up scheduled posts and publishes via `app/services/social_client.py`

The pipeline uses **checkpointing** — intermediate state is saved to `pipeline_state` table, allowing `POST /api/pipeline/resume` to continue from a failed step.

### Auth Modes
- **Local mode**: in-app user management, PBKDF2-SHA256 passwords, signed session cookies
- **Supabase mode**: JWT-based with app-role mapping
- Roles: `operator` (content creation), `admin` (publishing/sync), `superadmin` (user management/config)

### Key Patterns
- **SSE streaming** for long-running ops (pipeline runs, Substack generation) — avoid HTTP timeout issues
- **Checkpointing** — `pipeline_state` table for save/resume on failure
- **Parallel generation** — `ThreadPoolExecutor` for concurrent Claude API calls (reduces ~200s → ~60-80s)
- **Storage facade** — always import storage functions from `app/persistence/storage.py`, not individual `storage_*.py` modules
- **Token tracking** — all Claude API calls tracked for cost reporting via `image_costs` and run metadata

### Deployment
- Railway with Nixpacks builder (builds both Python + Node in one step)
- **Single replica only** — APScheduler runs inside the FastAPI process; multiple replicas would cause duplicate job execution
- Frontend is built and served as static files from FastAPI (`static/dist/`)
