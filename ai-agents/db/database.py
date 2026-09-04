import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)

_ROOT = Path(__file__).resolve().parent.parent

load_dotenv(_ROOT / ".env")
load_dotenv(_ROOT.parent / ".env")
load_dotenv()

_raw_url = os.getenv("DATABASE_URL", "").strip()
if not _raw_url:
    _sqlite_path = _ROOT / "ai_agents_local.db"
    DATABASE_URL = f"sqlite:///{_sqlite_path}"
    logger.info("DATABASE_URL not set — using SQLite at %s", _sqlite_path)
else:
    DATABASE_URL = _raw_url

IS_POSTGRES = "postgresql" in DATABASE_URL.lower()
IS_SQLITE = DATABASE_URL.startswith("sqlite")

connect_args: dict = {}
if IS_SQLITE:
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db() -> None:
    """Create SQLite tables when using the bundled local DB (no manual schema run)."""
    if not IS_SQLITE:
        return
    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS soap_drafts (
            id TEXT PRIMARY KEY,
            patient_uuid TEXT NOT NULL,
            encounter_uuid TEXT,
            doctor_uuid TEXT,
            raw_transcript TEXT,
            soap_json TEXT,
            status TEXT DEFAULT 'draft',
            created_at TEXT,
            accepted_at TEXT
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS differential_suggestions (
            id TEXT PRIMARY KEY,
            patient_uuid TEXT NOT NULL,
            encounter_uuid TEXT,
            input_snapshot TEXT,
            suggestions TEXT,
            selected_diagnosis TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS agent_alerts (
            id TEXT PRIMARY KEY,
            patient_uuid TEXT NOT NULL,
            encounter_uuid TEXT,
            agent_name TEXT NOT NULL,
            severity TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            rule_fired TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            override_reason TEXT,
            doctor_uuid TEXT,
            created_at TEXT,
            resolved_at TEXT,
            detailed_reasoning TEXT,
            specific_concerns TEXT,
            recommended_alternatives TEXT,
            monitoring_required TEXT,
            safe_dose TEXT,
            decision TEXT,
            reasoning_trace TEXT
        );
        """
    ]
    with engine.begin() as conn:
        for stmt in ddl_statements:
            conn.execute(text(stmt))
    logger.info("SQLite schema ensured for AI agents")


def get_db():
    # #region agent log
    try:
        from debug_agent_log import agent_log as _al

        _al("H_S4", "database.py:get_db", "before SessionLocal", {})
    except Exception:
        pass
    # #endregion
    db = SessionLocal()
    # #region agent log
    try:
        from debug_agent_log import agent_log as _al

        _al("H_S4", "database.py:get_db", "session created", {})
    except Exception:
        pass
    # #endregion
    try:
        yield db
    finally:
        db.close()
