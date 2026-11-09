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

### Local database (development)

The dev database is a PostgreSQL server started from the binaries in the `embedded-postgres` package. No Docker or system install is needed.

```bash
npm run db:start     # create the data directory on first use, start the server, create database "gemstone"
npm run db:status    # is it running?
npm run db:stop      # stop the server; data is kept in .data/pg
```

- Port 54330 on 127.0.0.1, user `postgres`, password `postgres` (set `DB_PORT` to change the port). Match this in `DATABASE_URL`.
- Data lives in `.data/pg` (git-ignored). Server log: `.data/pg.log`.
- Refuses to run with `NODE_ENV=production`. It is a development tool only; production uses managed Postgres.
- Stop it before you shut down for the day, or when a test run is finished. Check with `npm run db:status` if a command cannot connect.

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
| `RESEND_API_KEY`, `EMAIL_FROM` | for `EMAIL_PROVIDER=resend` | Resend sending key and a verified sender. Live sending is not yet verified (no keys in development) |
| `MSG91_AUTH_KEY`, `MSG91_SENDER_ID`, `MSG91_TEMPLATE_ID` | for `SMS_PROVIDER=msg91` | MSG91 Flow API. The DLT template must take one variable carrying the full text. Not yet verified live |

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
| `npm run notify:flush` | Sends pending message digests. Run every 5 minutes from a scheduler (see below) |

## Scheduled jobs

- **Message digests:** `npm run notify:flush` every 5 minutes (cron, Task Scheduler or your host's scheduler). Message emails are batched: the first message in a 10 minute window is emailed at once, and later ones wait for the next flush. Without the schedule, digests after the first message never send. The flush takes a Postgres advisory lock, so overlapping runs are safe.

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
- [x] M2 – Catalogue and portfolios (verified: unit tests, production build, Playwright end-to-end journey on a production build with the demo seed, 16 screenshots at 390px and 1440px; not verified: real email/SMS, a real device)
- [x] M3 – Enquiries, requirements, chat, quotations, notifications, contact moderation, sellers acting as buyers (verified: unit tests, typecheck, lint, production build, Playwright M1–M3 journeys 17 of 17, M3 screenshots at 390px and 1440px reviewed and fixed; not verified: real email/SMS, a real device)

## M2 – catalogue, portfolios, moderation

- **Catalogue:** `/gemstones` (Postgres full-text search, filters, sort, pagination), `/categories/[slug]`, `/sellers` (approved only), `/sellers/[slug]` (portfolio with approved reviews), `/gemstones/[slug]` (gallery, specs, verified public documents, seller card, wishlist).
- **Seller:** `/seller/portfolio`, `/seller/listings` (create, edit, media, documents, submit), `/seller/inventory` (bulk availability).
- **Admin:** `/admin/listings` (queue), `/admin/listings/all` (filters, featured), `/admin/documents` (verification), `/admin/reviews`, `/admin/homepage` (block editor), `/admin/settings` (auto-publish, default off).
- **Buyer:** `/buyer` dashboard with wishlist, enquiries, conversations, valuations and reports tabs. Enquiry, chat and valuation are placeholders until M3/M4.
- **Homepage:** hero search, top-rated sellers carousel, featured gemstones carousel, category grid, teasers, "Become a Seller".
- **Demo data:** `npm run db:seed:demo` creates 6 demo sellers, 40 listings and 18 reviews. Every demo row is labelled "Demo" and the seed refuses to run when `NODE_ENV=production`. `DEMO_SELLER_PASSWORD`, when set, gives the demo sellers a known password for testing (unset, passwords are random). The end-to-end journey needs it: run `DEMO_SELLER_PASSWORD=Demo-Seller-Pass-1 npm run db:seed:demo` before `npm run test:e2e`.

### Money, media and documents

- Prices are integer minor units with an ISO currency (INR default, USD). "Price on request" is a separate flag.
- Images are re-encoded to WebP, which drops EXIF and GPS. Thumbnails are generated. HEIC/HEIF and AVIF are refused, because they would bypass that re-encode.
- Listing files are private. `/api/media/[id]/[variant]`, `/api/listing-documents/[id]` and `/api/sellers/[slug]/assets/[kind]` return 404 unless the item is visible to the requester.
- A listing document is public only when the seller marks it public **and** an admin verifies it **and** the listing is public.

### End-to-end tests

```bash
npm run build                 # production build
npm run db:seed:demo          # demo data (dev database only)
npm run test:e2e              # Playwright; starts the server on port 3200
```

`playwright.config.ts` sets `ALLOW_NON_DELIVERING_PROVIDERS=true` for the server, so the console email provider can print verification links to `e2e/.server.log`. Without that flag, console providers are refused in production. `e2e/global-setup.ts` clears the database rate-limit counters before each run; it refuses to run in production. Screenshots are written to `screenshots/` (git-ignored).

### Known limitations (M3)

- **Contact moderation is a filter, not a guarantee.** It masks phone numbers, emails, URLs, handles and app names, including spelled-out digits, Unicode digit scripts and bracketed forms. It does not catch these, and they are accepted gaps:
  - **A phone number split across messages.** Each message is checked on its own, so "98765" in one message and "43210" in the next is not joined.
  - **Letters used as digit separators.** "98765a43210" is not treated as one number.
- **Live Resend and MSG91 sending is untested.** Both are implemented behind the email and SMS interfaces and refuse to send without their keys. The MSG91 request body follows its public docs, not a live call.
- **Digest and email delivery is best effort.** A failed send releases its claim and is retried on the next flush.

## M3 status (Communication)

- Built: enquiries, general conversations, offers (send, accept, decline, counter), quotations (create, withdraw, accept, decline, PDF), requirements (post, edit, close, board, respond), seller inbox, notifications and preferences, contact moderation, admin moderation queues, reports, requirement list, audited conversation viewer, seller categories.
- Sellers as buyers: approved sellers can post requirements, make offers and enquire on other sellers' listings. Own listings and own requirements are refused on the server (`lib/messaging/guards.ts`) and never appear on the board to the poster. The seller inbox has Buying and Selling filters (`lib/messaging/side.ts`). Seller pages: `/seller/requirements/new` and `/seller/requirements/mine`.
- Public seller text is moderated on save. Business name (registration), portfolio tagline, about and specialties, listing title and description, and quotation titles and terms are refused when they contain contact details. Refusals are never masked and never stored. Each refusal is logged to the flagged queue, with the listing when there is one. A refused save does not count toward the messaging restriction. When one seller has 3 or more refusals in 24 hours, every admin gets an alert (in-app and email, once per seller per 24 hours). Registration refusals are not logged, because no account exists yet.
- Sellers can edit the requirements they post (`/seller/requirements/mine/[id]/edit`), with the same validation and moderation as buyers.
- Verified: 624 unit tests, typecheck, lint, production build, and the Playwright suite (`e2e/journey.spec.ts` 9 steps and `e2e/m3-journey.spec.ts` 8 steps, 17 of 17). The M3 journey covers enquiry, quote and accept; requirement posted and answered; seller-to-seller requirement and enquiry, with own-item refusals; masked phone in the flagged queue; and a refused portfolio save. Screenshots at 390px and 1440px are in `screenshots/` and were reviewed. Fixes made from them: admin shell stacks on phones, header logo does not wrap.
- Not verified: live Resend and MSG91 sending, and a real device.

### Running the browser journey

- Run `npm run db:start`, `npm run build`, then `DEMO_SELLER_PASSWORD=Demo-Seller-Pass-1 npm run db:seed:demo` before every run. Reseeding gives a clean flagged queue and a clean alert count for the demo sellers. Refused public-text saves no longer restrict messaging, so repeated runs do not block the demo sellers.
- `DEMO_SELLER_PASSWORD=Demo-Seller-Pass-1 npm run test:e2e` runs both journeys.

### Accepted M3 gaps

- Phone number split across messages is not joined. Letters used as digit separators are not treated as separators.
- Registration business name refusals are not written to the flagged queue, because no account exists yet.
- Flags from the M3 migration `20261110140000_m3_flag_listing` store the listing ID only from the listing save and later. Older rows have none.
- `moderateContactDetails` returns text exactly as typed when nothing is masked. Masked text is still normalised, so a flagged message can change letter-digit codes near a masked item.

## Known limitations (M2)

- **Video metadata is not stripped.** Videos are stored as uploaded, so GPS tags in a video container survive. Images are fine. Needs an ffmpeg step.
- **Logo and banner** are served through an authorised route, but the seller editor's upload and preview controls are minimal.
- **Review rejection has no reason field.** The brief asks for reasons on listing and document decisions; reviews need a schema change to match.
- **Media and document count caps are check-then-act.** Two parallel uploads can each pass the check and exceed the cap by one. A row lock would fix it.
- **Admin seller lists do not show Demo labels** yet, although the public surfaces do.
- **Audit writes are best-effort**, and catalogue audit runs after the decision.
- **Duplicate mobile numbers** on a new email trigger the "account already exists" email to that new address (carried over from M1).
- **Caching:** public media and documents are cached for 60 seconds. A rejection or unpublish can take up to a minute to reach shared caches.

## M4 status (Valuation)

- In progress on branch `m4-valuation`. Done: schema and migration, the rule-based valuation engine with tests, access rules, reference numbers, and the demo reference defaults. Not done: PDF and QR report, media upload and submission, the requester pages, the valuator and admin pages, the demo seed, the parallel build phases, and the browser journey. See `docs/milestones/m4-status.md`.
