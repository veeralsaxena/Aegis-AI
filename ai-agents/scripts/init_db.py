"""
Apply db/schema.sql to the database in DATABASE_URL (PostgreSQL).
Usage: from ai-agents directory: python scripts/init_db.py
"""
import os
import pathlib

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "db" / "schema.sql"


def main():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set")
    engine = create_engine(url)
    sql = SCHEMA.read_text()
    with engine.begin() as conn:
        for stmt in sql.split(";"):
            s = stmt.strip()
            if s:
                conn.execute(text(s))
    print("Schema applied.")


if __name__ == "__main__":
    main()
