from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.core.env import project_root


BASE_DIR = project_root()


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_env: str
    host: str
    port: int
    reload: bool
    auth_mode: str
    session_secret: str
    sqlite_db_path: Path
    config_path: Path
    checkpoint_path: Path
    companion_template_path: Path
    static_generated_dir: Path
    reflection_day: int
    reflection_time: str
    companion_day: int
    companion_time: str
    bootstrap_admin_email: str
    bootstrap_admin_password: str
    bootstrap_admin_name: str
    database_url: str
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    supabase_site_url: str
    invite_expiry_hours: int

    def validate(self) -> None:
        if self.auth_mode not in {"local", "supabase"}:
            raise RuntimeError(f"Unsupported AUTH_MODE={self.auth_mode!r}")
        if not self.database_url:
            raise RuntimeError("DATABASE_URL must be set. Legacy SQLite/JSON runtime mode has been removed.")
        if self.app_env == "production" and self.session_secret == "dev-session-secret":
            raise RuntimeError("SESSION_SECRET must be set for production")
        if self.auth_mode == "supabase" and not self.supabase_jwt_secret:
            raise RuntimeError("SUPABASE_JWT_SECRET must be set when AUTH_MODE=supabase")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "development").strip().lower() or "development"
    return Settings(
        app_env=app_env,
        host=os.getenv("APP_HOST", "127.0.0.1"),
        port=int(os.getenv("APP_PORT", "8000")),
        reload=_env_bool("APP_RELOAD", app_env != "production"),
        auth_mode=os.getenv("AUTH_MODE", "local").strip().lower() or "local",
        session_secret=os.getenv("SESSION_SECRET", "dev-session-secret"),
        sqlite_db_path=BASE_DIR / os.getenv("SQLITE_DB_PATH", "run_history.db"),
        config_path=BASE_DIR / os.getenv("CONFIG_PATH", "config_overrides.json"),
        checkpoint_path=BASE_DIR / os.getenv("CHECKPOINT_PATH", "pipeline_checkpoint.json"),
        companion_template_path=BASE_DIR / os.getenv("COMPANION_TEMPLATE_PATH", "templates/companion_template.md"),
        static_generated_dir=BASE_DIR / os.getenv("STATIC_GENERATED_DIR", "static/generated"),
        reflection_day=int(os.getenv("REFLECTION_DAY", "2")),
        reflection_time=os.getenv("REFLECTION_TIME", "07:00"),
        companion_day=int(os.getenv("COMPANION_DAY", "3")),
        companion_time=os.getenv("COMPANION_TIME", "08:00"),
        bootstrap_admin_email=os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip().lower(),
        bootstrap_admin_password=os.getenv("BOOTSTRAP_ADMIN_PASSWORD", ""),
        bootstrap_admin_name=os.getenv("BOOTSTRAP_ADMIN_NAME", "Epicurean Admin").strip() or "Epicurean Admin",
        database_url=os.getenv("DATABASE_URL", "").strip(),
        supabase_url=os.getenv("SUPABASE_URL", "").strip().rstrip("/"),
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY", "").strip(),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip(),
        supabase_jwt_secret=os.getenv("SUPABASE_JWT_SECRET", "").strip(),
        supabase_site_url=os.getenv("SUPABASE_SITE_URL", "").strip(),
        invite_expiry_hours=int(os.getenv("INVITE_EXPIRY_HOURS", "72")),
    )
