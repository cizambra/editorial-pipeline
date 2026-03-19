# Test package marker for unittest discovery/imports.
from __future__ import annotations

import sys


_MODULE_PREFIXES = [
    "main",
    "auth",
    "storage",
    "settings",
    "db",
    "app.main",
    "app.api.routes",
    "app.core",
    "app.persistence",
    "app.services",
    "app.workers",
    "scripts.import_legacy_data",
]


def clear_test_modules() -> None:
    for prefix in _MODULE_PREFIXES:
        for name in list(sys.modules):
            if name == prefix or name.startswith(prefix + "."):
                sys.modules.pop(name, None)
