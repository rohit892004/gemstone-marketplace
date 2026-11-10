# M5 status: seller analytics, membership and referrals, platform analytics

Branch: `m5-growth`. The owner's M5 instructions are in `docs/milestones/m5.md`. M4 was merged into `main` at the start of M5.

## Done

- **Step 0 (M4 wrap-up):** no page scrolls sideways at 390px (checked by Playwright on every page the journeys use, plus the M5 screens). Deactivating a valuer returns open requests to the admin queue, unassigned. One disclaimer constant for the PDF and the pages.
- **Phase A (lead):** schema and migrations `20261110170000_m5_growth` and `20261110180000_m5_notification_membership`. Tier engine, referral rules, analytics rules, tracking endpoint, rollup job, membership service. Shared chart: uPlot.
- **Phase B:** analytics agent (tracking calls, seller analytics, platform analytics, CSV) and membership agent (follow, membership page, referrals, limits, ranking and badges, admin memberships and referrals, demo seed). Both merged.
- **Phase D (review):** nine findings. Fixed: admin approval now checks the listing limit; the analytics endpoint records nothing on the request that starts the cookie; views, impressions and wishlist adds are deduplicated; contact-like search terms are never stored; platform top terms need two or more visitors; demo flags survive rollup re-runs; demo labels on the membership page and referrals queue; featured slots count published listings only; referral attribution uses the new account's id.
- **Phase E (journeys):** four journeys in `e2e/m5-growth.spec.ts`: a buyer follows a seller and the seller sees the follower; a referral qualifies after registration, approval and publishing; a Free seller hits the listing limit; an admin overrides a tier. Overflow check extended to the M5 screens. Screenshots at 390px and 1440px in `screenshots/m5/`.
- **Seed:** listing views and impressions are kept per listing, as the rollup writes them, so the top-listings table has data.
- **Checks on the final tree:** 972 unit tests across 98 files pass. Typecheck and lint are clean. Production build passes. Full Playwright suite: 34 of 34 pass.

## Not done, and why

- **Worktrees not removed.** `m5-wt-analytics` and `m5-wt-membership` (with their `node_modules` junctions) are still in place. A removal command was denied by the permission classifier, because it included `--force`. Their work is merged, so removal can be done without `--force` once you confirm. The `m5-analytics` and `m5-membership` branches stay until then.
- **Seller views KPI not checked in the UI.** The rollup marker is already on today's date, so today's views only appear after tomorrow's rollup. The journey checks the raw events instead.
- **Concurrency.** The listing-limit and featured-slot checks are check-then-write. Two simultaneous saves could both pass. Noted for hardening.
- **Pending review.** Listings awaiting review do not count toward a Free seller's 25-listing limit, so a seller can queue more than 25. Open decision.
- **Screenshots** were reviewed as images only, not in a live browser at other widths.

## Open questions

- Should listings awaiting review count toward the listing limit?
- Should the membership rules, the placeholders, be confirmed by the client before any real seller sees them?
- The referral link uses `APP_URL`. In this environment `APP_URL` says port 3000 while the production build runs on 3200. Check the production value.

## Next milestone

M6: education, news, newsletter, admin content, hardening (including the role-check and concurrency items), and deployment preparation.
