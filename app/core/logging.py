from __future__ import annotations

import contextvars
import json
import logging
import os
from contextlib import contextmanager
from typing import Any


_log_context: contextvars.ContextVar[dict[str, Any]] = contextvars.ContextVar("editorial_log_context", default={})


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }
        payload.update(_log_context.get())
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        extra_fields = getattr(record, "fields", None)
        if isinstance(extra_fields, dict):
            payload.update(extra_fields)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging() -> None:
    root = logging.getLogger()
    if getattr(configure_logging, "_configured", False):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.handlers = [handler]
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    configure_logging._configured = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def bind_log_context(**fields: Any):
    current = dict(_log_context.get())
    current.update({k: v for k, v in fields.items() if v not in (None, "")})
    return _log_context.set(current)


def reset_log_context(token) -> None:
    _log_context.reset(token)


@contextmanager
def log_context(**fields: Any):
    token = bind_log_context(**fields)
    try:
        yield
    finally:
        reset_log_context(token)
