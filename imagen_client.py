"""
imagen_client.py — Google Imagen 3 image generation via REST API.

Calls the Google AI Studio generativelanguage.googleapis.com REST endpoint
directly using `requests` — no google-genai SDK required.

Setup:
  1. Get a free key at https://aistudio.google.com
  2. Add to .env:  GOOGLE_API_KEY=AIza...

Aspect ratios supported by Imagen 3:
  "1:1"   — square (Instagram standard)
  "9:16"  — portrait / Stories
  "16:9"  — landscape
  "4:3"   — horizontal
  "3:4"   — vertical
"""

from __future__ import annotations

import base64
import os
from typing import Literal

import requests

AspectRatio = Literal["1:1", "9:16", "16:9", "4:3", "3:4"]

_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
_MODEL = "imagen-3.0-generate-002"


def generate_image(prompt: str, aspect_ratio: AspectRatio = "1:1") -> bytes:
    """
    Generate a single image with Imagen 3 and return the raw JPEG bytes.
    Raises RuntimeError if GOOGLE_API_KEY is missing or the API call fails.
    """
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set in .env")

    url = f"{_BASE}/{_MODEL}:predict?key={api_key}"
    payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": aspect_ratio,
            "safetySetting": "block_only_high",
        },
    }

    resp = requests.post(url, json=payload, timeout=60)
    if not resp.ok:
        raise RuntimeError(
            f"Imagen API {resp.status_code} — {resp.text[:400]}"
        )

    data = resp.json()
    predictions = data.get("predictions") or []
    if not predictions:
        raise RuntimeError(f"Imagen returned no predictions: {resp.text[:300]}")

    b64 = predictions[0].get("bytesBase64Encoded", "")
    if not b64:
        raise RuntimeError(f"Imagen prediction missing image bytes: {predictions[0]}")

    return base64.b64decode(b64)


def is_configured() -> bool:
    return bool(os.getenv("GOOGLE_API_KEY", "").strip())
