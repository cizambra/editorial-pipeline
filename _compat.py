from __future__ import annotations

import importlib
import sys


def alias_module(name: str, target: str):
    module = importlib.import_module(target)
    module = importlib.reload(module)
    sys.modules[name] = module
    return module
