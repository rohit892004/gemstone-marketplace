# M6 status: content, newsletter, polish, hardening, deployment prep

Branch: `m6-launch`. The owner's instructions are in `docs/milestones/m6.md`. The Phase 1 completion report is `docs/PHASE1-REPORT.md`.

## Done

- **Schema and migrations:** `20261110200000_m6_content_newsletter`, `20261110210000_m6_newsletter_tokens`, `20261110220000_m6_ratelimit_index`.
- **Content:** education and guides, research, the Gemstone Reference Library (one page per category), market news with source attribution, search, tags, reading time, related items, SEO metadata. Admin CMS with a Markdown editor and live preview, cover images, DRAFT / SCHEDULED / PUBLISHED / ARCHIVED, scheduled publishing by the worker, audit on publish and unpublish. Demo content is labelled and refused in production.
- **Newsletter:** double opt-in with consent records, topics (nothing pre-ticked), signed preference and unsubscribe links, `List-Unsubscribe` headers, account settings, admin campaigns (test send, schedule, batched sending, stats), weekly digest, Resend webhook with signature verification and suppression.
- **Legal and basics:** Terms, Privacy, Cookies, Seller Agreement (marked draft), cookie notice, 404 and 500 pages, footer and nav links fixed.
- **Hardening:** production env checks at startup, `APP_URL` required in production, `TRUSTED_PROXY_COUNT`, security headers and CSP, admin valuation mutators check the role, listing limit and featured checks inside a seller row lock, rate-limit cleanup, optional error reporting (off unless `SENTRY_DSN`), npm audit fixes.
- **Deployment prep:** Dockerfile (standalone, non-root), `docker-compose.prod.yml` (app, worker, migrate, db), `npm run worker` with advisory-locked jobs, S3-compatible storage, `/api/health`, `docs/DEPLOYMENT.md`.
- **Portfolio uploads (bug report):** the logo and banner upload failed for large files. The proxy buffer limit (10 MB) cut off the request, and the form then failed with "Unexpected end of form". Fixed with `proxyClientMaxBodySize: 40mb`. iPhone HEIC photos are refused with a message that explains the conversion, and every upload message now names the accepted formats and sizes.
- **Review:** the read-only review found 12 issues. Nine were fixed; three were accepted and documented (see the Phase 1 report).

- **Newsletter consent change (owner decision):** the footer has a compact signup with no topic boxes. Subscribe is consent to all topics, and the exact consent text is stored with the record (`NewsletterConsent.scope` and `consentText`, migration `20261110230000_newsletter_consent_text`). Confirmation copies the scope and text onto the confirmed record. The preferences page shows the saved topics only, with the sentence "You're subscribed to all topics. Untick any you don't want." when all are subscribed. Nothing is pre-ticked. The legal review section is in `docs/PHASE1-REPORT.md`.

## Verification

- Unit tests: 1164 passing (115 files). Typecheck and lint clean. Production build passes.
- Playwright: 48 passing (9 spec files), against a production build with the demo seed. Servers stopped after the run.
- axe: no serious or critical violations on the M6 public pages and the dashboards, after the accent-text contrast fix.

## Not done or not verified

- Prisma's diff still reports a drift on `Gemstone.searchText` (a generated tsvector column from the M2 migration). The drift line is not in the new migration; a future `migrate dev` will try to create one again and should be trimmed by hand.
- The footer's Subscribe path is not covered by a Playwright test; the footer's /contact link resolves only once that page exists.

- Docker image not built (Docker is not installed in this environment).
- CSP not checked in a browser beyond the e2e run; `unsafe-inline` for scripts is a known trade-off.
- Seller-lock race has no database-level test.
- Worker not run against a live database for a full day.
- Real email, SMS and S3 delivery not verified.
- Screenshots exist in `screenshots/m6/` and were not all reviewed visually in detail.

## Test data note

The journeys send contact details on purpose to test masking, and that adds strikes to the demo sellers. Reseed before every run (`ALLOW_DEMO_SEED=true`, `DEMO_SELLER_PASSWORD=Demo-Seller-Pass-1`, then the demo, m4, m5, m6 and base seeds). Without a reseed, later runs fail with "Messaging is temporarily restricted".

## Next steps

See the open items and the client handover checklist in `docs/PHASE1-REPORT.md`.
