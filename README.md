# LIFEOS AI 🚀
### Personal Life Operating System

AI-powered coach for fitness, career, language learning, and discipline transformation.

---

## What's Built

| Module | Status | Description |
|--------|--------|-------------|
| Auth | ✅ | Clerk sign-in/sign-up |
| Dashboard | ✅ | 8 life scores + AI insights |
| AI Coach | ✅ | Chat with memory context |
| Fitness | ✅ | Weight tracking + workout logs |
| Diet | ✅ | Indian meal plans + macro tracking |
| Sleep | ✅ | Sleep scoring + recovery |
| Habits | ✅ | Daily check-in + streaks + discipline score |
| English Coach | ✅ | Grammar correction + mistake memory |
| Kannada Coach | ✅ | Daily lessons + vocabulary tracking |
| Career | ✅ | Docker→AI Agents roadmap + study logs |
| Analytics | ✅ | Recharts trend visualization |
| Reports | ✅ | Auto weekly AI reports |
| Telegram Bot | ✅ | /weight /workout /sleep /study /english /kannada /report /plan |

---

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, TailwindCSS, Shadcn, Framer Motion
- **Backend**: NestJS, TypeScript
- **Database**: Supabase PostgreSQL + Prisma ORM
- **Auth**: Clerk
- **AI**: Claude API (Sonnet for complex, Haiku for simple)
- **Bot**: Telegram Bot API
- **Hosting**: Vercel (free) + Fly.io (free) + Supabase (free)
- **Cost**: ~₹700–1000/month (API only)

---

## Quick Start

### 1. Clone and setup
```bash
git clone <your-repo>
cd lifeos
chmod +x setup.sh && ./setup.sh
```

### 2. Create accounts (all free)

| Service | URL | What to get |
|---------|-----|-------------|
| Supabase | supabase.com | `DATABASE_URL` and `DIRECT_URL` |
| Clerk | clerk.com | `PUBLISHABLE_KEY` and `SECRET_KEY` |
| Anthropic | console.anthropic.com | `ANTHROPIC_API_KEY` |
| Telegram | @BotFather on Telegram | `BOT_TOKEN` (optional) |

### 3. Fill in environment variables

**backend/.env**
```env
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
CLERK_SECRET_KEY="sk_test_..."
ANTHROPIC_API_KEY="sk-ant-..."
TELEGRAM_BOT_TOKEN="123456:AAF..."   # optional
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

**frontend/.env.local**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 4. Initialize database
```bash
cd backend
npx prisma db push
```

### 5. Run locally
```bash
# Terminal 1 - Backend
cd backend && npm run start:dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

App: http://localhost:3000  
API: http://localhost:3001  
Docs: http://localhost:3001/docs

---

## Deploy to Production (Free Tier)

### Backend → Fly.io
```bash
cd backend
flyctl auth login
flyctl launch          # creates fly.toml
flyctl secrets set DATABASE_URL="..." ANTHROPIC_API_KEY="..." CLERK_SECRET_KEY="..."
flyctl deploy
```

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
# Set env vars in Vercel dashboard
```

### Clerk Webhook
In Clerk dashboard → Webhooks → Add endpoint:
- URL: `https://your-fly-app.fly.dev/api/auth/webhook`
- Events: `user.created`, `user.updated`

---

## Telegram Bot Commands

```
/weight 63.5          → Log weight
/workout push 60      → Log workout (type + minutes)
/sleep 23:00 07:00    → Log sleep (bedtime + waketime)
/study Docker 45      → Log study (topic + minutes)
/english <sentence>   → Correct grammar
/kannada              → Get today's Kannada lesson
/report               → Generate weekly report
/plan                 → Get today's full plan
/coach <question>     → Chat with AI coach
```

---

## Supabase Free Tier Note

Free tier pauses after 7 days of no activity.  
The `.github/workflows/keepalive.yml` pings every 4 days automatically — **add your `BACKEND_URL` to GitHub Secrets**.

---

## AI Cost Control

The system uses:
- `claude-haiku-4-5` for grammar corrections, simple tasks (cheap)
- `claude-sonnet-4` for coaching, weekly reports, complex tasks

Estimated usage: ~₹700–1000/month at personal scale.

To reduce further — cache the daily workout/diet plan (same response for 24hrs).

---

## Folder Structure

```
lifeos/
├── backend/          NestJS API
│   ├── src/
│   │   ├── ai/       AI service + memory + prompts
│   │   ├── fitness/  Weight + workout
│   │   ├── diet/     Diet logging + AI meal plans
│   │   ├── sleep/    Sleep scoring
│   │   ├── habits/   Daily check-in + discipline score
│   │   ├── english/  Grammar correction
│   │   ├── kannada/  Language learning
│   │   ├── career/   Roadmap + study logs
│   │   ├── analytics/Dashboard scores + trends
│   │   ├── reports/  Weekly auto-reports
│   │   └── telegram/ Bot commands
│   └── prisma/       Database schema
│
├── frontend/         Next.js 15 app
│   ├── app/          Pages (dashboard, coach, fitness...)
│   ├── components/   Sidebar, ScoreCard, Charts
│   └── lib/          API client + hooks
│
├── .github/
│   └── workflows/    CI/CD + Supabase keep-alive
│
├── setup.sh          Local development setup
└── deploy.sh         Production deployment
```
