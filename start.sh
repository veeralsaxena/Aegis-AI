#!/bin/bash

# Aegis AI Startup Script
# This script starts both the Bahmni backend and the Next.js frontend

set -e

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Starting Aegis AI Backend (Bahmni) ===${NC}"
cd backend

# Start the docker containers in detached mode
echo -e "${GREEN}Pulling and starting Docker containers...${NC}"
docker compose up -d

# Go back to root
cd ..

echo -e "\n${BLUE}=== Starting Aegis AI Frontend (Next.js) ===${NC}"
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${GREEN}Installing npm dependencies...${NC}"
    npm install
fi

echo -e "${GREEN}Starting development server...${NC}"
npm run dev
