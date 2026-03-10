from __future__ import annotations

import threading
from typing import Any, Dict

from app.core.ai_clients import CLAUDE_SONNET_MODEL, get_claude_client

MODEL = CLAUDE_SONNET_MODEL

_run_tokens: Dict[str, int] = {"input": 0, "output": 0, "cache_write": 0, "cache_read": 0}
_token_lock = threading.Lock()

_PRICE_IN = 3.0 / 1_000_000
_PRICE_CACHE_W = 3.75 / 1_000_000
_PRICE_CACHE_R = 0.30 / 1_000_000
_PRICE_OUT = 15.0 / 1_000_000

TONE_LEVEL: int = 5


def reset_token_log() -> None:
    global _run_tokens
    with _token_lock:
        _run_tokens = {"input": 0, "output": 0, "cache_write": 0, "cache_read": 0}


def get_token_summary() -> Dict[str, Any]:
    with _token_lock:
        inp = _run_tokens["input"]
        out = _run_tokens["output"]
        cw = _run_tokens["cache_write"]
        cr = _run_tokens["cache_read"]
    cost = inp * _PRICE_IN + out * _PRICE_OUT + cw * _PRICE_CACHE_W + cr * _PRICE_CACHE_R
    return {
        "input_tokens": inp,
        "output_tokens": out,
        "cache_write_tokens": cw,
        "cache_read_tokens": cr,
        "estimated_cost_usd": round(cost, 4),
    }


def set_tone_level(level: int) -> None:
    global TONE_LEVEL
    TONE_LEVEL = max(0, min(10, level))


def get_tone_level() -> int:
    return TONE_LEVEL


def tone_instruction() -> str:
    if TONE_LEVEL <= 3:
        return "\nTONE CALIBRATION: Lean warmer and more empathetic than your default. Softer edges. Let the insight arrive quietly."
    if TONE_LEVEL >= 7:
        return "\nTONE CALIBRATION: Be more direct and less hedging than your default. If an observation is uncomfortable, say it plainly. No softening."
    return ""


def _track_usage(usage: Any) -> None:
    with _token_lock:
        _run_tokens["input"] += usage.input_tokens
        _run_tokens["output"] += usage.output_tokens
        _run_tokens["cache_write"] += getattr(usage, "cache_creation_input_tokens", 0)
        _run_tokens["cache_read"] += getattr(usage, "cache_read_input_tokens", 0)


def call_claude(system: "str | list", user: "str | list", max_tokens: int = 4096) -> str:
    message = get_claude_client().messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": user}],
        system=system,
    )
    _track_usage(message.usage)
    return message.content[0].text.strip()


def call_platform(config: Dict[str, Any], user: "str | list") -> str:
    message = get_claude_client().messages.create(
        model=MODEL,
        max_tokens=config["max_tokens"],
        messages=[{"role": "user", "content": user}],
        system=config["system"],
    )
    _track_usage(message.usage)
    return message.content[0].text.strip()
