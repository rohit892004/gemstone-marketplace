# Gemstone Selections – Web App

Phase 1 core platform. Scope and milestones: `../PHASE1_IMPLEMENTATION_PLAN.md`.

## Stack

Next.js 16 (App Router, Cache Components, TypeScript), Tailwind CSS v4, PostgreSQL with Prisma 7 (Postgres driver adapter), Auth.js v5 beta (Credentials + JWT), Zod validation, Vitest.

## Setup

Requirements: Node 22+ and PostgreSQL 16.

```bash
npm install                 # also runs prisma generate
cp .env.example .env        # fill in values (see below)
npm run db:deploy           # apply committed migrations (use db:migrate to create new ones)
npm run db:seed             # categories, certificate labs, and the admin account from ADMIN_*
npm run dev                 # http://localhost:3000
```

`npm run build` imports route modules, so `DATABASE_URL` must be set at build time too.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `APP_URL` | yes | Absolute base URL used in email links |
| `AUTH_SECRET` | production | 32+ chars. Generate with `openssl rand -base64 32` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | for seeding admin | Seed is idempotent; an existing admin's password is not changed |
| `EMAIL_PROVIDER`, `SMS_PROVIDER` | yes | Only `console` exists. It is refused at send time in production |
| `STORAGE_DIR` | yes | Private file storage root (default `./.data/uploads`). Never inside `public/` |
| `UPLOAD_MAX_MB` | no | Per-file upload limit (default 10) |

Production must set `AUTH_URL` (or `trustHost` handling) for the real domain and must replace the console email and SMS providers. Those are not implemented yet, so production sends fail on purpose.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript without emit |
| `npm test` | Vitest unit tests |
| `npm run db:migrate` | Create and apply a dev migration |
| `npm run db:deploy` | Apply committed migrations (CI, production) |
| `npm run db:seed` | Reference data and admin seed |

## Roles and access

Roles: `BUYER`, `SELLER`, `ADMIN`. Seller approval is tracked separately: `PENDING → APPROVED | REJECTED`, and `APPROVED ↔ SUSPENDED`.

**Access control has one evaluator:** `lib/auth/require-role.ts`. Every protected server action, page and route handler calls one of its adapters:

- `requireRole(roles, { sellerApproved? })` – throws `AuthzError`; for server actions
- `checkRole(...)` – returns a result; for actions that report errors to a form
- `requirePageRole(...)` – redirects; for pages
- `requireApiRole(...)` – returns 401/403; for route handlers

It re-reads the user from the database on every call, so suspension, approval and password resets take effect immediately. Sessions issued before a password change are rejected.

`proxy.ts` is a fast first gate (redirects to `/login?next=…`). It is not authoritative.

**Protected-page pattern (Cache Components):** put the session check in an async child wrapped in `<Suspense>`, so the static shell can still prerender.

## Auth flows

- **Buyer registration:** `/register/buyer` → verification email (24 h, single use) → `/verify-email` shows a confirm button. The token is consumed only on POST, so mail scanners cannot burn it.
- **Seller registration:** `/register/seller` creates the account, the profile and the documents in one transaction. Files are stored privately, keys are opaque, and files are removed if registration fails.
- **Duplicate email:** the same generic "check your email" result. The owner of the address receives an "account already exists" notice.
- **Login:** `/login`. Wrong password and unknown email look identical. Unverified email is reported only after the correct password.
- **Mobile OTP:** `/verify-mobile` (signed-in users). 6 digits, 10 minutes, 5 attempts, one code at a time.
- **Forgot / reset password:** `/forgot-password` always gives the same message. Reset links last 30 minutes and are single use.
- **Rate limits** (database-backed, `lib/security/rate-limit.ts`): login per IP and per email; registration per IP; forgot-password per IP and per email; resend verification per email; OTP send and verify per user; seller registration per IP.

## Admin

- `/admin` dashboard, `/admin/sellers` (status filter, paging), `/admin/sellers/[id]` (details, documents, decisions).
- Approve (from PENDING or REJECTED), reject with a reason (from PENDING), suspend with a reason (from APPROVED), reactivate (from SUSPENDED). Each decision is audited and emailed. Each decision is atomic against its expected status.
- Documents are served only by `/api/admin/documents/[id]`: admin-only, `private, no-store`, `nosniff`, attachment disposition. Nothing is under `public/`.

## Audit log

`AuditLog` records: registrations (including duplicate attempts), email and mobile verification, OTP sends, login success and failure (with IP), login blocks, logout, reset requests and completions, access denials, seller approve/reject/suspend/reactivate, and document downloads.

## Money

All amounts are integer minor units (paise for INR) stored as `BigInt`, with an ISO currency code. INR is the default. No live conversion in Phase 1.

## Layout

```
app/                  routes: public, auth flows, /buyer, /seller, /admin, /api/admin/documents
components/           layout (header/footer), auth, seller, admin UI
lib/auth/             Auth.js config, require-role, registration, tokens, password hashing, flows/
lib/admin/            seed-admin, seller list, document download helpers
lib/seller/           seller registration, form parsing, slugs, labs
lib/audit/            audit actions and writer
lib/security/         rate limiter, client IP
lib/notify/           email/SMS providers and templates (console providers for dev)
lib/storage/          private storage provider and upload validation
lib/validation/       shared Zod schemas
prisma/               schema, migrations, seed
proxy.ts              coarse route gate
```

## Known limitations (Phase 1, M1)

- **No real email or SMS provider.** Console providers only; they refuse to run in production.
- **Sessions are stateless JWTs** (7 days). Logout does not revoke a copied cookie early. Requests re-check the database, and password resets revoke sessions.
- **Per-address limits can be used to flood an inbox** (5 reset or verification emails per address per hour), and failed logins can lock out an email for 15 minutes. A global cap and CAPTCHA are planned.
- **Timing:** forgot-password and resend are not timing-equalised for known versus unknown addresses. Mail is sent inline.
- **Audit writes are best-effort.** A failed audit insert is logged but does not roll back the action.
- **Client IP** trusts the rightmost `X-Forwarded-For` entry, which assumes exactly one trusted proxy. Without a proxy, per-IP limits can be spoofed.
- **Duplicate mobile numbers** on a new email address also trigger the "account already exists" notice, which goes to the new address.
- **Seller document review** is per seller, not per document. Individual document approval is not implemented.
- **Admin password** is set from `ADMIN_PASSWORD` at creation only. Changing it later requires a manual update.

## Status

- [x] M0 – Foundation
- [x] M1 – Auth, roles, seller onboarding, admin review, audit (verified: unit tests, production build, database-level flows, live HTTP gating and sign-in; not verified: browser click-through, real email/SMS)
- [ ] M2 – Public site and catalogue
