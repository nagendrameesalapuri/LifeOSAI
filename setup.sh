#!/bin/bash
# ─────────────────────────────────────────────────────────────
# LIFEOS AI — One-Command Setup Script
# Run: chmod +x setup.sh && ./setup.sh
# ─────────────────────────────────────────────────────────────

set -e
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        LIFEOS AI — Setup             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── Check prerequisites ───────────────────────────────────
echo -e "${YELLOW}Checking prerequisites...${NC}"

command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js not found. Install from nodejs.org${NC}"; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo -e "${RED}npm not found.${NC}"; exit 1; }

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}Node.js 18+ required. Current: $(node -v)${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
echo ""

# ─── Backend setup ─────────────────────────────────────────
echo -e "${YELLOW}Setting up backend...${NC}"
cd backend
npm install
npx prisma generate

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo -e "${YELLOW}⚠  backend/.env created from .env.example${NC}"
  echo -e "${YELLOW}   Fill in your keys before starting!${NC}"
fi

echo -e "${GREEN}✓ Backend dependencies installed${NC}"
cd ..

# ─── Frontend setup ────────────────────────────────────────
echo -e "${YELLOW}Setting up frontend...${NC}"
cd frontend
npm install

if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo -e "${YELLOW}⚠  frontend/.env.local created from .env.example${NC}"
  echo -e "${YELLOW}   Fill in your Clerk keys before starting!${NC}"
fi

echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
cd ..

# ─── Summary ───────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅  Setup complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Before starting, fill in these .env values:${NC}"
echo ""
echo "backend/.env:"
echo "  DATABASE_URL        → Supabase connection string"
echo "  DIRECT_URL          → Supabase direct URL"
echo "  CLERK_SECRET_KEY    → From clerk.com dashboard"
echo "  ANTHROPIC_API_KEY   → From console.anthropic.com"
echo "  TELEGRAM_BOT_TOKEN  → From @BotFather (optional)"
echo ""
echo "frontend/.env.local:"
echo "  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY → From clerk.com"
echo "  CLERK_SECRET_KEY                  → From clerk.com"
echo ""
echo -e "${CYAN}Then run:${NC}"
echo ""
echo "  Terminal 1 — Backend:"
echo "    cd backend"
echo "    npx prisma db push"
echo "    npm run start:dev"
echo ""
echo "  Terminal 2 — Frontend:"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo -e "${GREEN}App runs at: http://localhost:3000${NC}"
echo -e "${GREEN}API runs at: http://localhost:3001${NC}"
echo -e "${GREEN}API docs at: http://localhost:3001/docs${NC}"
echo ""
