from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


@lru_cache(maxsize=1)
def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


@lru_cache(maxsize=1)
def load_environment() -> Path:
    env_path = project_root() / ".env"
    load_dotenv(env_path, override=False)
    return env_path
