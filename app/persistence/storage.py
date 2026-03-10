"""
storage.py - Runtime persistence facade for the editorial pipeline.

The live application is Postgres-only. Legacy SQLite/JSON files are import
sources handled by scripts/import_legacy_data.py, not runtime backends.
"""

from __future__ import annotations

import importlib

from . import storage_auth as _storage_auth
from . import storage_content as _storage_content
from . import storage_history as _storage_history
from . import storage_reports as _storage_reports

_storage_auth = importlib.reload(_storage_auth)
_storage_history = importlib.reload(_storage_history)
_storage_reports = importlib.reload(_storage_reports)
_storage_content = importlib.reload(_storage_content)

from .storage_auth import *  # noqa: F401,F403
from .storage_history import *  # noqa: F401,F403
from .storage_reports import *  # noqa: F401,F403
from .storage_content import *  # noqa: F401,F403
