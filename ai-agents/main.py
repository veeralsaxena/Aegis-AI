import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure package root on path when running as script
_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

load_dotenv()

from db.database import init_db
from routers import alerts, differential, scribe

app = FastAPI(title="Bahmni AI Agent Service", version="1.0.0")


def _module_installed(name: str) -> bool:
    try:
        import importlib.util

        return importlib.util.find_spec(name) is not None
    except ModuleNotFoundError:
        return False


@app.on_event("startup")
async def _startup():
    init_db()

_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(scribe.router, prefix="/api/scribe", tags=["scribe"])
app.include_router(
    differential.router, prefix="/api/differential", tags=["differential"]
)


@app.get("/health")
async def health():
    """Lightweight checks so you know if scribe (Whisper) and LLM are likely to work."""
    import shutil

    from services.gemini_support import gemini_api_key

    mode = os.getenv("WHISPER_MODE", "local").strip().lower()
    ffmpeg = shutil.which("ffmpeg")
    return {
        "status": "ok",
        "llm": {
            "gemini_configured": bool(gemini_api_key()),
            "openai_configured": bool(os.getenv("OPENAI_API_KEY", "").strip()),
            "anthropic_configured": bool(os.getenv("ANTHROPIC_API_KEY", "").strip()),
        },
        "whisper": {
            "mode": mode,
            # faster-whisper decodes many browser formats via ffmpeg; without it, webm often fails
            "ffmpeg_on_path": bool(ffmpeg),
            "whisperx_installed": _module_installed("whisperx"),
            "pyannote_installed": _module_installed("pyannote.audio"),
            "pyannote_token_configured": bool(
                os.getenv("PYANNOTE_AUTH_TOKEN")
                or os.getenv("HF_TOKEN")
                or os.getenv("HUGGINGFACE_TOKEN")
            ),
            "hint": (
                "Install ffmpeg (e.g. brew install ffmpeg) for local Whisper + Chrome webm recordings."
                if mode == "local" and not ffmpeg
                else None
            ),
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8001")),
        reload=True,
    )
