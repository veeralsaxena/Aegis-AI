"""Shared Gemini (Google AI) configuration — free tier friendly."""

import os

from dotenv import load_dotenv

load_dotenv()


def gemini_api_key() -> str | None:
    return (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or "").strip() or None


def gemini_model_id() -> str:
    # gemini-2.0-flash: fast; use gemini-1.5-flash if your key/region errors on 2.0
    return os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip()
