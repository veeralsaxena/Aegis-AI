"""NDJSON debug log for Cursor debug mode (session 0e071d). Do not log secrets."""
import json
import time
from pathlib import Path

_LOG_CURSOR = Path("/Users/veeralsaxena/Hackthon/smart horizon/Aegis-AI/.cursor/debug-0e071d.log")
_LOG_REPO = Path(__file__).resolve().parent / ".debug-session-0e071d.ndjson"


def agent_log(hypothesis_id: str, location: str, message: str, data: dict | None = None) -> None:
    line = json.dumps(
        {
            "sessionId": "0e071d",
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data or {},
            "timestamp": int(time.time() * 1000),
            "runId": "post-fix",
        },
        default=str,
    )
    for path in (_LOG_CURSOR, _LOG_REPO):
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8") as f:
                f.write(line + "\n")
        except OSError:
            pass
