#!/bin/bash
# ─────────────────────────────────────────────────────────────
# LIFEOS AI — Production Deploy Script (Free Tier)
# Deploys: Backend → Fly.io | Frontend → Vercel | DB → Supabase
# ─────────────────────────────────────────────────────────────

set -e
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}Deploying LIFEOS AI to production (free tier)...${NC}"
echo ""

# ─── 1. Push DB schema ─────────────────────────────────────
echo -e "${YELLOW}[1/3] Pushing database schema to Supabase...${NC}"
cd backend
npx prisma db push
echo -e "${GREEN}✓ Schema pushed${NC}"

# ─── 2. Deploy backend to Fly.io ───────────────────────────
echo -e "${YELLOW}[2/3] Deploying backend to Fly.io...${NC}"

if ! command -v flyctl &> /dev/null; then
  echo "Installing flyctl..."
  curl -L https://fly.io/install.sh | sh
fi

flyctl deploy --remote-only
echo -e "${GREEN}✓ Backend deployed to Fly.io${NC}"
cd ..

# ─── 3. Deploy frontend to Vercel ──────────────────────────
echo -e "${YELLOW}[3/3] Deploying frontend to Vercel...${NC}"

if ! command -v vercel &> /dev/null; then
  npm install -g vercel
fi

cd frontend
vercel --prod
echo -e "${GREEN}✓ Frontend deployed to Vercel${NC}"
cd ..

echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🚀 LIFEOS is live on free tier!${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""
echo "Set these secrets in GitHub repo settings:"
echo "  FLY_API_TOKEN               → flyctl auth token"
echo "  DATABASE_URL                → Supabase connection"
echo "  NEXT_PUBLIC_API_URL         → Your Fly.io backend URL"
echo "  BACKEND_URL                 → Same Fly.io URL (for keepalive)"
echo ""
