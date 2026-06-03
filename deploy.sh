#!/bin/bash
# LIFEOS AI — Production Deploy Script
# Backend: any Node.js host (Railway, Render, VPS)
# Frontend: Vercel (auto-deploys via GitHub integration)
# DB: Supabase

set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}Deploying LIFEOS AI...${NC}"; echo ""

echo -e "${YELLOW}[1/2] Pushing database schema to Supabase...${NC}"
cd backend && npx prisma db push
echo -e "${GREEN}✓ Schema pushed${NC}"; cd ..

echo -e "${YELLOW}[2/2] Frontend deploys automatically via Vercel on git push.${NC}"
echo -e "${YELLOW}      Backend: push to your host (Railway/Render/VPS) manually.${NC}"
echo ""
echo -e "${CYAN}Required GitHub Secrets (Settings → Secrets → Actions):${NC}"
echo "  DATABASE_URL          → Supabase connection string"
echo "  DIRECT_URL            → Supabase direct URL"
echo "  AUTH_SECRET           → Same value as your backend AUTH_SECRET"
echo "  AUTH_GOOGLE_ID        → Google OAuth client ID"
echo "  AUTH_GOOGLE_SECRET    → Google OAuth client secret"
echo "  NEXT_PUBLIC_API_URL   → Your production backend URL + /api"
echo "  NEXTAUTH_URL          → Your production frontend URL"
echo "  BACKEND_URL           → Production backend URL (for keep-alive ping)"
echo ""
echo -e "${GREEN}Done!${NC}"
