# Gemstone Selections – Web App

Phase 1 core platform. See `../PHASE1_IMPLEMENTATION_PLAN.md` for scope and milestones.

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS v4, PostgreSQL with Prisma 7 (Postgres driver adapter), Zod for config validation, Vitest for tests.

## Setup

Requirements: Node 22+ and a PostgreSQL 16 database.

```bash
npm install                 # also runs prisma generate
cp .env.example .env        # then set DATABASE_URL
npm run db:migrate          # apply migrations (dev)
npm run db:seed             # seed categories (idempotent)
npm run dev                 # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript without emit |
| `npm test` | Vitest unit tests |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply committed migrations (CI and production) |
| `npm run db:seed` | Seed reference data |

## Layout

```
app/                 routes (public pages now; auth, buyer, seller, admin in later milestones)
components/layout/   site header and footer
lib/config/env.ts    validated environment (use getEnv())
lib/db/client.ts     shared Prisma client
prisma/schema.prisma data model v1
prisma/seed.ts       reference data seed
```

## Status (M0 – Foundation)

- [x] Project scaffold, TypeScript, lint, tests, CI workflow
- [x] Prisma schema v1 and initial migration
- [x] Validated environment config
- [x] Base layout, design tokens (placeholder brand), responsive header/footer
- [ ] Auth and roles (M1)
- Navigation links to pages not yet built (`/gemstones`, `/sellers`, `/valuation`, `/learn`, `/news`, `/login`, `/register`, legal pages) return 404 until their milestones.
