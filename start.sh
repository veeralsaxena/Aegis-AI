#!/usr/bin/env bash
#
# One command: Bahmni (Docker) + AI sidecar (FastAPI + Groq) + Next.js Frontend
# Usage: ./start.sh
#

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

AI_PORT="${AI_AGENTS_PORT:-8001}"
FRONT_PORT="${PORT:-3000}"

cleanup() {
  if [[ -n "${AI_AGENTS_PID:-}" ]] && kill -0 "$AI_AGENTS_PID" 2>/dev/null; then
    echo -e "\n${YELLOW}Stopping AI agents (pid $AI_AGENTS_PID)...${NC}"
    kill "$AI_AGENTS_PID" 2>/dev/null || true
    wait "$AI_AGENTS_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}        🛡️ Aegis AI — Full Stack         ${NC}"
echo -e "${BLUE}=========================================${NC}"

# Free up ports if lingering
echo -e "${GREEN}1. Checking ports :${AI_PORT} and :${FRONT_PORT}...${NC}"
lsof -ti :$AI_PORT -ti :$FRONT_PORT | xargs kill -9 2>/dev/null || true

# 2. Docker & Bahmni Lite
if [[ "${SKIP_BAHMNI:-}" != "1" ]]; then
  echo -e "\n${BLUE}=== Bahmni Lite (Docker) ===${NC}"
  if ! docker info >/dev/null 2>&1; then
    echo -e "${YELLOW}Docker daemon not responding. Launching Docker Desktop...${NC}"
    open -a "/Applications/Docker.app" 2>/dev/null || open -a "Docker" 2>/dev/null || true
    echo -n "Waiting for Docker daemon to become ready..."
    for i in {1..30}; do
      if docker info >/dev/null 2>&1; then
        echo -e " ${GREEN}Ready!${NC}"
        break
      fi
      echo -n "."
      sleep 2
    done
  fi

  cd "$ROOT/backend"
  echo -e "${GREEN}Starting Bahmni EMR containers (COMPOSE_PROJECT_NAME=bahmni-lite)...${NC}"
  COMPOSE_PROJECT_NAME=bahmni-lite docker compose up -d
  cd "$ROOT"
else
  echo -e "${YELLOW}SKIP_BAHMNI=1 — skipping Docker startup${NC}"
fi

# 3. AI Agents Sidecar (FastAPI + Groq)
echo -e "\n${BLUE}=== AI Agents Sidecar (FastAPI on 127.0.0.1:${AI_PORT}) ===${NC}"
if [[ ! -d "$ROOT/ai-agents/.venv" ]]; then
  echo -e "${GREEN}Creating Python virtual environment in ai-agents/.venv...${NC}"
  python3 -m venv "$ROOT/ai-agents/.venv"
fi

if [[ ! -f "$ROOT/ai-agents/.venv/bin/uvicorn" ]]; then
  echo -e "${GREEN}Installing Python dependencies...${NC}"
  "$ROOT/ai-agents/.venv/bin/pip" install -q -r "$ROOT/ai-agents/requirements.txt"
fi

echo -e "${GREEN}Verifying AI agent imports...${NC}"
if ! ( cd "$ROOT/ai-agents" && ./.venv/bin/python -c "from main import app" ); then
  echo -e "${RED}AI agent import failed. Check dependencies.${NC}"
  exit 1
fi

(
  cd "$ROOT/ai-agents"
  exec ./.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port "$AI_PORT"
) &
AI_AGENTS_PID=$!
echo -e "${GREEN}AI Agents running on PID ${AI_AGENTS_PID}${NC}"

sleep 1
if curl -sf "http://127.0.0.1:${AI_PORT}/health" >/dev/null; then
  echo -e "${GREEN}✓ AI agents health check passed (http://127.0.0.1:${AI_PORT}/health)${NC}"
else
  echo -e "${YELLOW}Notice: AI service starting up...${NC}"
fi

# 4. Next.js Frontend
echo -e "\n${BLUE}=== Next.js Frontend (Port ${FRONT_PORT}) ===${NC}"
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  echo -e "${GREEN}Installing frontend node_modules...${NC}"
  npm install
fi

echo -e "${GREEN}Compiling and verifying TypeScript...${NC}"
npx tsc --noEmit
echo -e "${GREEN}✓ TypeScript compilation verified with 0 errors!${NC}"

echo -e "\n${BLUE}=========================================${NC}"
echo -e "${GREEN}🚀 Application is LIVE:${NC}"
echo -e "   • Frontend:     ${BLUE}http://localhost:${FRONT_PORT}${NC}"
echo -e "   • Bahmni EMR:   ${BLUE}http://localhost:8080/openmrs${NC}"
echo -e "   • AI Sidecar:   ${BLUE}http://127.0.0.1:${AI_PORT}${NC}"
echo -e "${BLUE}=========================================${NC}\n"

npm run dev
