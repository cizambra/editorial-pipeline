from __future__ import annotations

import os
from functools import lru_cache

import anthropic as _anthropic


CLAUDE_SONNET_MODEL = "claude-sonnet-4-5-20250929"


@lru_cache(maxsize=1)
def get_claude_client() -> _anthropic.Anthropic:
    return _anthropic.Anthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        default_headers={"anthropic-beta": "prompt-caching-2024-07-31"},
    )
