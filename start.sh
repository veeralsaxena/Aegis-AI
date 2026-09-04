#!/usr/bin/env bash
#
# One command: Bahmni (Docker) + AI sidecar (FastAPI) + Next.js
# Usage: ./start.sh
#   SKIP_BAHMNI=1 ./start.sh   — only AI agents + frontend (Bahmni already running elsewhere)
#

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

AI_PORT="${AI_AGENTS_PORT:-8001}"

cleanup() {
  if [[ -n "${AI_AGENTS_PID:-}" ]] && kill -0 "$AI_AGENTS_PID" 2>/dev/null; then
    echo -e "\n${YELLOW}Stopping AI agents (pid $AI_AGENTS_PID)...${NC}"
    kill "$AI_AGENTS_PID" 2>/dev/null || true
    wait "$AI_AGENTS_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo -e "${BLUE}=== Aegis AI — full stack ===${NC}"

if [[ "${SKIP_BAHMNI:-}" != "1" ]]; then
  echo -e "${BLUE}=== Bahmni Lite (Docker) ===${NC}"
  cd "$ROOT/backend"
  echo -e "${GREEN}Starting Docker Compose...${NC}"
  COMPOSE_PROJECT_NAME=bahmni-lite docker compose up -d
  cd "$ROOT"
else
  echo -e "${YELLOW}SKIP_BAHMNI=1 — not starting Docker${NC}"
fi

echo -e "\n${BLUE}=== AI agents (FastAPI on 127.0.0.1:${AI_PORT}) ===${NC}"
if [[ ! -f "$ROOT/ai-agents/.env" ]]; then
  echo -e "${YELLOW}Missing ai-agents/.env — copy from ai-agents/.env.example (GOOGLE_API_KEY, DATABASE_URL, BAHMNI_*)${NC}"
fi

if [[ ! -x "$ROOT/ai-agents/.venv/bin/python" ]]; then
  echo -e "${GREEN}Creating Python venv in ai-agents/.venv ...${NC}"
  python3 -m venv "$ROOT/ai-agents/.venv"
fi

echo -e "${GREEN}Installing Python dependencies (quiet)...${NC}"
"$ROOT/ai-agents/.venv/bin/pip" install -q -r "$ROOT/ai-agents/requirements.txt"

echo -e "${GREEN}Verifying ai-agents can import (needs python-multipart for scribe forms, etc.)...${NC}"
if ! ( cd "$ROOT/ai-agents" && ./.venv/bin/python -c "from main import app" ); then
  echo -e "${RED}Import failed. Run:${NC} cd ai-agents && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

echo -e "${GREEN}Applying DB schema (optional, needs PostgreSQL + DATABASE_URL)...${NC}"
(
  cd "$ROOT/ai-agents"
  ./.venv/bin/python scripts/init_db.py
) || echo -e "${YELLOW}init_db skipped or failed — fix DATABASE_URL and Postgres if you need persistence.${NC}"

(
  cd "$ROOT/ai-agents"
  exec ./.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port "$AI_PORT"
) &
AI_AGENTS_PID=$!

echo -e "${GREEN}AI agents PID ${AI_AGENTS_PID}${NC}"
sleep 1

if curl -sf "http://127.0.0.1:${AI_PORT}/health" >/dev/null; then
  echo -e "${GREEN}AI health OK at http://127.0.0.1:${AI_PORT}/health${NC}"
else
  echo -e "${YELLOW}AI service did not respond on /health yet — check ai-agents logs / .env${NC}"
fi

echo -e "\n${BLUE}=== Next.js frontend ===${NC}"
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  echo -e "${GREEN}npm install...${NC}"
  npm install
fi

echo -e "${GREEN}Starting dev server (proxies /ai-service → http://127.0.0.1:${AI_PORT})${NC}"
echo -e "${BLUE}Open the app in the browser — AI calls use the same origin.${NC}"
npm run dev
