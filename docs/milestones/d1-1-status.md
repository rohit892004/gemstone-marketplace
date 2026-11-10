# D1.1 status: polish round

Instructions: `docs/milestones/d1-1.md`. Branch `d1-design`.

## Done

- **Layouts (not just tokens):** valuation landing, upload, review, result and verify pages (split layouts, wizard rail, stat tiles, DataTable lists); login, register (chooser, buyer, seller), forgot and reset password, verify email and mobile, check email (split layout with a stone photo on large screens); legal pages (document layout with sticky contents); newsletter pages (split layout on `/newsletter`, focused cards on the others).
- **Empty states:** about 17 hand-rolled empty states now use `EmptyState` with thin line icons and a next action where one exists.
- **Forms:** about 8 forms now wrap their controls in `Field`, and about 25 files swap hand-rolled control classes for `Input`, `Select` or `Textarea`. Error messages keep `role="alert"`.
- **Seller dashboard:** the ten workspace tiles are in two columns, so there is no empty last cell at any width from `sm` up.
- **Header:** the desktop nav starts at `xl` (1280px). The logo text is smaller at `xl` and the nav gap is tighter, so the logo and nav no longer collide when signed in at 1440px. On phones the logo wraps instead of pushing the page wider than the viewport.
- **Crypto prerender error:** `SessionLinks` now calls `connection()` before reading the session, the same pattern `lib/auth/require-role.ts` already uses. The dev log showed no new `crypto.getRandomValues()` errors after the change.
- **Demo buyer login:** `DEMO_BUYER_PASSWORD` (dev-only, read only by the M3 seed, which refuses production). It is set in the local `.env` alongside `DEMO_SELLER_PASSWORD`.
- **Accessibility:** the analytics table wrapper is keyboard-focusable (axe `scrollable-region-focusable`).

## Verification

- `npx tsc --noEmit`, `npx eslint` (app, components, lib, prisma, e2e, scripts) and `npx vitest run` (116 files, 1178 tests): pass.
- `npm run build`: pass (run twice, once after the review fixes).
- Full Playwright suite on `gemstone_test` (database reset and reseeded first): see the final run in the commit log and `.data/e2e-d1-1-final.log`.
- axe (WCAG 2.0/2.1 A and AA) on 21 pages at 390px and 1440px: zero serious or critical violations after the analytics fix. Results in `screenshots/d1-1/` (git-ignored).

## Not done or not fully verified

- **Forms migration is partial.** Many label-and-control pairs still use hand-written `<label htmlFor>` markup in messaging composers, seller listing and portfolio forms, notifications preferences, and membership controls. Hand-rolled button classes remain in seller listing media and documents, notifications and membership. The seller form's own fieldsets (`components/seller/seller-register-form.tsx`) were outside the auth agent's ownership and were not restyled.
- **Visual review is partial.** The review agent looked at three screenshots in full (valuator queue at 390px, seller dashboard at 1440px, and the newsletter photo) and checked the other captures by automated checks only (overflow and axe). The header fix at 1440px and the 390px valuator-queue overflow fix were made from class changes and are verified by the rebuild and the test run, not by a visual check of every page.
- **Newsletter caption:** "Sapphire, set in silver" matches the stand-in photo (`stone-detail-2.webp`).
- **Seed copy:** new body copy in empty states, for example "Every valuer is clear for now." and "The seller has not attached any documents to this listing." Review before release.

## Known gaps carried over

- Duplicate carousel `components/catalogue/carousel.tsx` (kept for impression tracking).
- Admin membership rules page still says "Placeholder rules, pending client confirmation" (M5 copy, intentional).
- E2E sellers accumulate in the test database between runs (reset with `npm run test:e2e:db` after dropping `gemstone_test`).

## Final state (round 2)

- Full Playwright suite on a freshly reset `gemstone_test`: 55 of 55 passed.
- Featured carousel: the stale homepage was not reproduced on a production build (fresh at every probe; no cache header on `/`). Root cause not established. The journey test now uses a 5-second check, not a retry loop. If it fails again, investigate with the server log.
- Contact form: moderated (contact details refused, not masked), rate-limited per hashed IP, audited (`contact.submitted`, no body, name or email), with two Playwright tests.
- Newsletter confirm page is request-time (fixes a prerender error on build).
- Spinel tile uses the mixed coloured-stones photo; no real spinel photo is in the library. The client should supply one (see IMAGE-CREDITS.md).
- Open for the owner: the confirmation email contains "[Registered business address: to be confirmed before launch]", a placeholder in outgoing mail.
