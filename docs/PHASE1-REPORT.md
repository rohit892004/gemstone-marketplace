# Phase 1 completion report: Gemstone Selections

Status as of M6 (branch `m6-launch`). Checked against the original Phase 1 plan (`PHASE1_IMPLEMENTATION_PLAN.md` at the workspace root, sections 4 and 7) and the client brief (`docs/client-brief.md`). Milestone details: `docs/milestones/m0–m6`.

## Verification at close

| Check | Result |
|---|---|
| Unit tests (`npm test`) | 1164 passing, 115 files |
| Typecheck (`npm run typecheck`) | clean |
| Lint (`npm run lint`) | clean |
| Production build (`npm run build`) | passes |
| Playwright (`npm run test:e2e`) | 48 passing, 9 spec files, against a production build with the demo seed |
| axe (WCAG 2.1 A and AA) | zero serious or critical violations on the public M6 pages, the buyer and seller dashboards and the admin newsletter overview (after a contrast fix) |
| Screenshots | 390px and 1440px for the M6 pages, the homepage, product page and both dashboards in `screenshots/m6/` (git-ignored) |
| Docker image | **not built**: Docker is not installed in the build environment |

## Plan items (original Phase 1 plan, section 4)

The plan and the repo number their milestones differently, so this table maps plan milestones to the code that delivers them. Milestone-by-milestone detail is in `docs/milestones/`.

| Plan milestone | Where it is implemented | How it is tested |
|---|---|---|
| M0 Foundation: Next.js, Prisma, validated env, layout, CI | `app/`, `prisma/`, `lib/config/env.ts`, `.github/workflows/ci.yml` | env unit tests; CI workflow (see open items: CI result not read from this environment) |
| M1 Auth and roles | `lib/auth/`, `app/login`, `app/register`, `app/verify-email`, `app/reset-password`, `proxy.ts` | `lib/auth/*.test.ts`; `e2e/journey.spec.ts` |
| M2 Public site and catalogue | `app/gemstones`, `app/sellers`, `app/categories`, `lib/listings/`, `lib/media/` | `e2e/journey.spec.ts`, `e2e/mobile-overflow.spec.ts` |
| M3 Seller portfolio and inventory | `app/seller/portfolio`, `app/seller/listings`, `components/seller/` | `e2e/seller-portfolio-uploads.spec.ts`, `e2e/journey.spec.ts` |
| M4 Buyer journey | `app/buyer`, `app/gemstones/[slug]`, wishlist and enquiry flows | `e2e/journey.spec.ts`, `e2e/m3-journey.spec.ts` |
| M5 Chat, notifications, moderation | `lib/messaging/`, `lib/notifications/`, `lib/moderation/`, `app/admin/moderation`, `app/notifications` | `e2e/m3-journey.spec.ts`; unit tests in `lib/notifications` and `lib/moderation` |
| M6 Valuation | `lib/valuation/`, `app/valuation`, `app/valuator`, `app/admin/valuations` | `e2e/m4-valuation.spec.ts` |
| M7 Content and newsletter | `lib/content/`, `app/education`, `app/news`, `app/reference`, `app/admin/content`, `lib/newsletter/`, `app/newsletter`, `app/admin/newsletter` | `e2e/m6-content.spec.ts`; `lib/newsletter/*.test.ts`; `lib/content/*.test.ts` |
| M8 Admin dashboard | `app/admin/**` (sellers, listings, documents, reviews, moderation, reports, requirements, homepage, valuations, analytics, memberships, referrals, content, newsletter, settings) | `e2e/journey.spec.ts`, `e2e/m5-growth.spec.ts`, `e2e/m6-content.spec.ts` |
| M9 Hardening and release | Security headers and CSP (`next.config.ts`), `TRUSTED_PROXY_COUNT`, production env checks (`lib/config/env.ts`, `instrumentation.ts`), rate-limit cleanup, `/api/health`, Dockerfile, `docker-compose.prod.yml`, `docs/DEPLOYMENT.md` | unit tests for each; `e2e/m6-a11y.spec.ts` |

## Definition of done (plan section 7)

| Requirement | Status | Evidence |
|---|---|---|
| Buyer: register, verify, search, view seller and gemstone, wishlist, enquiry, chat, request valuation | Done | `e2e/journey.spec.ts`, `e2e/m3-journey.spec.ts`, `e2e/m4-valuation.spec.ts` |
| Seller: register with documents, get approved, portfolio, publish listings with media, respond to enquiries, quotations | Done | `e2e/journey.spec.ts`, `e2e/seller-portfolio-uploads.spec.ts`, `e2e/m3-journey.spec.ts` |
| Admin: approve sellers and listings, manage content and newsletters, moderate chats, handle valuations, audit logs | Done | `e2e/journey.spec.ts`, `e2e/m6-content.spec.ts`, `lib/audit/` |
| Role checks on every API route and page, with automated tests | Done for the paths reviewed. Admin valuation services check the role themselves (`assertActiveAdmin`). Admin read helpers that take no actor rely on their page guards (see limitations) | `lib/valuation/*.test.ts`, route tests |
| Responsive on desktop and mobile; basic accessibility audit | Done. No sideways scroll at 390px on every journey page; axe clean at serious and critical | `e2e/mobile-overflow.spec.ts`, `e2e/m6-a11y.spec.ts` |

## Client brief (`docs/client-brief.md`)

| Brief section | Where it is covered |
|---|---|
| 1. Buyer: top-rated and verified sellers carousel, featured gemstones, categories, search and filters | Homepage sections, `app/gemstones`, `app/categories` |
| 1. Buyer: seller profile and portfolio, product page with images, specs, pricing, certificates, valuation reports | `app/sellers/[slug]`, `app/gemstones/[slug]` |
| 1. Buyer: wishlist, request valuation, chat or enquire from the product page | Product page actions, `lib/messaging/`, `app/valuation` |
| 1. Buyer: post gemstone requirements | `app/buyer/requirements` |
| 1. Buyer: dashboard (wishlists, enquiries, conversations, valuations, saved reports) | `app/buyer/**` |
| 2. Seller: "Become a Seller", application with categories and documents | `app/register/seller`, `lib/seller/` |
| 2. Seller: admin approval, activation, seller dashboard | `app/admin/sellers`, `app/seller` |
| 2. Seller: profile, portfolio, products with images, videos, specs, pricing, availability | `app/seller/portfolio`, `app/seller/listings` |
| 2. Seller: certificates, lab documents, valuation reports; **SSL-related options** | Document uploads (`lib/seller-catalogue/`); SSL options **open**, see below |
| 2. Seller: manage enquiries, quotations, conversations | `app/seller/inbox`, `app/seller/quotations` |
| 2. Seller: analytics (profile visits, product views, enquiries) | `app/seller/analytics`, `lib/analytics/`, `e2e/m5-growth.spec.ts` |
| 3. Membership: Free live; Premium and Elite progress; referrals | `app/seller/membership`, `lib/membership/`, `e2e/m5-growth.spec.ts`. Tier numbers are placeholders |
| 4. Admin: applications, approvals, products, categories, certificates, reports, verification, memberships, referrals, enquiries, platform activity | `app/admin/**` |
| 5. Connected journeys | `e2e/journey.spec.ts`, `e2e/m3-journey.spec.ts`, `e2e/m4-valuation.spec.ts`, `e2e/m5-growth.spec.ts`, `e2e/m6-content.spec.ts` |

## Decisions made in M6

- **Newsletter consent:** no topic is pre-ticked. A subscriber must pick at least one topic. The sign-up gives the same answer for every address, so the form cannot be used to find subscribers.
- **Signed preference and unsubscribe links:** HMAC over the subscriber id, not stored tokens. Rotating `AUTH_SECRET` revokes every outstanding link.
- **Campaign and digest email:** plain text (markdown source, with each absolute link kept as "text (address)"). No HTML email in Phase 1.
- **Job runner:** a worker process (`npm run worker`) with Postgres advisory locks, not Redis or a queue service. The plan named BullMQ or Inngest; the worker avoids a new service.
- **HEIC photos:** refused with a message that explains the conversion step, not accepted. Accepting HEIC would need a decoder and metadata stripping that the current build does not have.
- **Markdown:** `markdown-it` with raw HTML and images disabled and a strict link allow-list, instead of a full sanitiser on top of raw HTML.
- **Content visibility:** public pages show only published items whose publish time has passed. Scheduled items are published by the worker.

## Known limitations

1. **Docker image not built or run** in this environment. The Dockerfile and compose file are written and reviewed, not tested.
2. **CSP uses `unsafe-inline` for scripts** because of Next.js bootstrap scripts. Nonces are not wired. The CSP was checked by review, not in a browser run.
3. **Campaign and digest sends are at least once.** A crash between the provider accepting a message and the status write can duplicate a message. The weekly digest creates its run record before sending, so a crash mid-run means that week is not retried.
4. **Seller-lock race** (listing limit and featured slot) is fixed with `SELECT … FOR UPDATE` but has no database-level test. Unit tests use mocks.
5. **Subscribe timing:** a suppressed address returns faster than other addresses. Accepted; a fake delay would not be worth it.
6. **Admin read helpers** that take no actor (for example `listValuators`) rely on their page guards. Mutating admin valuation functions check the role themselves.
7. **Webhook dedupe:** the event id is stored before suppression runs. A crash between the two writes can leave a bounce unsuppressed when the provider retries. Narrow window; documented.
8. **Client error reports** have no rate limit yet. They are off unless `SENTRY_DSN` is set.
9. **`ALLOW_NON_DELIVERING_PROVIDERS=true`** disables the production refusals for console email and SMS. It exists for the e2e run only and must never be set on a real host.
10. **Video photos** are stored without metadata stripping (carried from M2). Images are re-encoded and stripped.
11. **Accessibility** was checked with axe and by review, not with assistive technology.
12. **Seller uploads of more than 10 MB** need `proxyClientMaxBodySize` (set to 40 MB). Larger batches are capped by the server action limit (35 MB). A multi-photo listing upload above that size is refused.
13. **Tier limits, membership benefits and referral thresholds** are placeholders, labelled "pending client confirmation".
14. **Email and SMS** are tested with console providers and fake clients. Real delivery is not verified.

## Open items before go-live (client and operations)

- **MSG91 DLT registration** of the OTP and notification templates.
- **Resend domain verification** and the webhook registration at `/api/webhooks/resend` for `email.bounced` and `email.complained`.
- **Strong admin password**. Rotate the seeded `ADMIN_PASSWORD`.
- **No demo data.** `ALLOW_DEMO_SEED` must be `false`; never run `db:seed:demo`, `db:seed:m4`, `db:seed:m5` or `db:seed:m6` on a real host.
- **Legal review** of the Terms, Privacy Policy, Cookie Policy and Seller Agreement at `/legal/*`, which are marked draft.
- **Postal address** in the newsletter footer (`lib/newsletter/templates.ts`, placeholder).
- **Real reference prices** through the admin CSV import (the seeded prices are labelled demo).
- **Client-confirmed membership rules** (tier limits, benefits, referral and follower thresholds).
- **SSL-related options.** The brief's wording is unclear. Currently treated as SSEF lab certificates only, pending the client.
- **Repository CI.** The CI workflow exists; its result on the pushed branch was not read from this environment.
- **Backups and restore test** (see `docs/DEPLOYMENT.md`).
- **Hosting decision** (VPS with Docker and Nginx, or Vercel plus managed Postgres with the worker on a VM).

## Client handover checklist

- [ ] Admin account works; password rotated; 2FA considered
- [ ] Demo data absent (`ALLOW_DEMO_SEED=false`, no demo rows)
- [ ] Real reference prices loaded; membership rules confirmed or changed in the admin tier editor
- [ ] Legal pages reviewed by counsel and the placeholders replaced
- [ ] Email sender verified; webhook registered; test email received
- [ ] SMS templates approved (DLT); test OTP received
- [ ] Storage bucket set (S3-compatible), private, versioned; test upload and display
- [ ] Worker running and scheduled jobs visible in logs; `/api/health` returns ok
- [ ] Backup taken and restored once on a copy
- [ ] Support contact and process for disputed listings, reports and valuations agreed
