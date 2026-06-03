#!/bin/bash
# LIFEOS AI — One-Command Setup Script
# Run: chmod +x setup.sh && ./setup.sh

set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'

echo ""; echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        LIFEOS AI — Setup             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"; echo ""

command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js not found. Install from nodejs.org${NC}"; exit 1; }
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
[ "$NODE_VER" -lt 18 ] && { echo -e "${RED}Node.js 18+ required.${NC}"; exit 1; }
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"; echo ""

echo -e "${YELLOW}Setting up backend...${NC}"
cd backend && npm install && npx prisma generate
[ ! -f ".env.local" ] && cp .env.example .env.local && echo -e "${YELLOW}⚠  Fill in backend/.env.local${NC}"
echo -e "${GREEN}✓ Backend ready (Express — port 5000)${NC}"; cd ..

echo -e "${YELLOW}Setting up frontend...${NC}"
cd frontend && npm install
[ ! -f ".env.local" ] && cp .env.example .env.local && echo -e "${YELLOW}⚠  Fill in frontend/.env.local${NC}"
echo -e "${GREEN}✓ Frontend ready (Next.js — port 3000)${NC}"; cd ..

echo ""; echo -e "${CYAN}══════════════════════════════════════${NC}"
echo -e "${GREEN}✅  Setup complete!${NC}"
echo -e "${CYAN}══════════════════════════════════════${NC}"; echo ""
echo -e "${YELLOW}Required env values:${NC}"
echo ""
echo "backend/.env.local:"
echo "  DATABASE_URL        → Supabase connection string"
echo "  DIRECT_URL          → Supabase direct URL"
echo "  AUTH_SECRET         → Must match frontend AUTH_SECRET"
echo "  ANTHROPIC_API_KEY   → console.anthropic.com"
echo "  TELEGRAM_BOT_TOKEN  → @BotFather (optional)"
echo ""
echo "frontend/.env.local:"
echo "  AUTH_SECRET         → openssl rand -hex 32"
echo "  AUTH_GOOGLE_ID      → Google Cloud Console OAuth client"
echo "  AUTH_GOOGLE_SECRET  → Google Cloud Console OAuth client"
echo "  NEXT_PUBLIC_API_URL → http://localhost:5000/api"
echo ""
echo -e "${CYAN}Start:${NC}"
echo "  Terminal 1: cd backend  && npx prisma db push && npm run dev"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo -e "${GREEN}App: http://localhost:3000  |  API: http://localhost:5000/api/health${NC}"
