# FinanceApp

Personal finance platform — **React (Vite + PWA)** · **Expo mobile** · **Fastify API** · **Supabase Postgres**.

Repo: https://github.com/dasariabhiram/FinanceApp

## Architecture

Monorepo, single public origin on **Netlify**:

| Piece | Where | Host |
|-------|--------|------|
| Web SPA/PWA | `apps/web` | Netlify CDN |
| API | `apps/api` → `netlify/functions/api` | Netlify Functions at `/api/*` |
| Mobile | `apps/mobile` | Expo (calls same `/api` base URL) |
| DB / Auth | `supabase/` | Supabase |
| Worker | `apps/worker` | Deferred (stub) |

Same URL for web + API (`https://YOUR_SITE.netlify.app` and `…/api/v1/...`). Mobile sets `EXPO_PUBLIC_API_URL` to that `/api` origin.

## Structure

```
apps/web              Vite React + PWA
apps/mobile           Expo
apps/api              Fastify (local) + shared buildApp()
apps/worker           Background jobs stub
packages/*            Shared contracts, db, api-client, domain
netlify/functions     Serverless adapter → Fastify inject
supabase/             SQL migrations + RLS
```

## Prerequisites

- Node 22+, pnpm 8+
- Supabase project
- Expo account (`npx expo login`) for mobile
- Netlify site connected to this repo (base = repo root)

## Setup

```bash
cp .env.example .env
# fill SUPABASE_* and DATABASE_URL / DIRECT_URL

pnpm install

# Apply SQL in Supabase SQL Editor:
#   supabase/migrations/20260502000000_init.sql

pnpm dev:api      # http://localhost:3001/health
pnpm dev:web      # http://localhost:5173  (proxies /api → :3001)
pnpm dev:mobile   # Expo; scan QR with Expo Go
```

Local web uses `VITE_API_URL=/api` (Vite proxy). API routes remain `/health`, `/v1/...` on the Fastify process.

## Netlify deploy

1. Connect the GitHub repo; **base directory = repository root** (uses root `netlify.toml`).
2. Set env vars in Netlify UI (same as API):
   - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - `CORS_ORIGINS` = your Netlify URL + Expo origins as needed
   - `NODE_ENV=production`
3. Build publishes `apps/web/dist` and deploys `netlify/functions/api` on `/api/*`.
4. Smoke: `GET https://YOUR_SITE.netlify.app/api/health`
5. Mobile: `EXPO_PUBLIC_API_URL=https://YOUR_SITE.netlify.app/api`

Optional local: `npx netlify dev` (serves SPA + functions on one port).

## Expo

```bash
cd apps/mobile
npx expo login
npx expo start
```

Do not put `service_role` or DB passwords in `EXPO_PUBLIC_*` / `VITE_*` vars.

## Deferred

- Gemini receipt / insights
- Resend email alerts
- Full pg-boss worker jobs

## Security notes

- Money stored as integer minor units (`balance_minor`)
- API verifies Supabase JWT via JWKS
- RLS enabled on `app.*`; keep `app` off Data API exposed schemas
- Transaction pooler (`:6543`) uses `prepare: false`
- Serverless DB pool size is `1` per function instance
