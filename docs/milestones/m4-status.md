# M4 status (Valuation): handoff

Branch: `m4-valuation`. The owner's full M4 instructions are in `docs/milestones/m4.md`.

## Owner decisions (answers to the open questions)

1. **QR code:** the `qrcode` npm package is used (`qrcode` and `@types/qrcode`). No encoder was written. The QR is drawn as vector squares in the PDF.
2. **Reference prices:** placeholders, labelled "Demo — indicative". The client supplies the real figures later. The admin CSV import must work so they can be replaced without code changes (Phase B, expert and admin agent).
3. **Expert threshold:** one global value in admin settings, plus an optional per-category override. Stored in `AppSetting` (`valuation.expertThreshold` and `valuation.expertThreshold.<categoryId>`).
4. **Seller-uploaded reports stay separate** from platform reports. The M2 seller documents are not touched. Platform reports are `Valuation` rows.
5. **Valuators are internal staff.** The requester is private from them. They see the reference, the stone and the media, and never the requester, the listing or the seller. Contact goes through the NEEDS_INFO thread. Admins see the requester.

## Done

### Step 0: M3 wrap-up (committed, verified)
- Refused public-text saves do not count toward the messaging restriction. They are logged as flags with their own 24-hour count. At 3 or more, every admin gets an alert (in-app, and always by email), at most once per seller per 24 hours.
- Public-text flags store the listing ID. Migration `20261110140000_m3_flag_listing`.
- Quotation titles are refused like terms, not masked.
- Sellers can edit their own requirements (`/seller/requirements/mine/[id]/edit`).
- Not yet covered by an e2e test: the seller requirement edit. Phase E adds it.

### Phase A (lead), committed
- Schema and migration `20261110150000_m4_valuation`. `VALUATOR` role. `Valuation`, `ValuationMedia`, `ValuationNote`, `ReferencePrice`, `ValuationMultiplier`. The expert threshold is in `AppSetting`.
- Migration `20261110160000_m4_notification_valuations`: `NotificationPreference.valuations` (the "Valuations" checkbox on the preferences page).
- Engine `lib/valuation/engine.ts` (pure) and demo defaults `lib/valuation/defaults.ts`.
- Access rules `lib/valuation/access.ts` (`isResultReady`: AUTO_VALUED and COMPLETED both count as a result).
- View builder `lib/valuation/view.ts`: the single place where the privacy rules are applied, per viewer (ADMIN, REQUESTER, VALUATOR).
- Service `lib/valuation/service.ts`: create draft (listing prefill and image copy), details, media upload through `processMedia`, submit (rate limit 10 per 24 h, engine routing, `REQUESTED` reason), needs-info thread, sign-off, reject, assign, withdraw, publish on own listing, published-report query for listings.
- Validation `lib/valuation/validate.ts`: details, thread text, sign-off amounts. Notes and thread text that carry contact details are refused, not masked.
- Thresholds `lib/valuation/thresholds.ts` (global plus per-category override).
- PDF `lib/valuation/pdf.ts`: A4, QR code, disclaimer and reference on every page, no requester field.
- Shared routes `lib/valuation/documents.ts`, `GET /api/valuation/media/[id]/[variant]` and `GET /api/valuation/[id]/pdf`. Private, no-store.
- Route paths `lib/valuation/routes.ts`.
- Tests: 93 valuation unit tests. The full suite passed at phase A.

### Phase B (in progress at the time of writing)
- Requester agent: worktree `R:\Demo\m4-wt-requester`, branch `m4-requester`.
- Expert and admin agent: worktree `R:\Demo\m4-wt-expert`, branch `m4-expert`.

## Phase B, D and E (done)

- Phase B: requester pages and dashboards (`m4-requester`), and valuator, admin, prices, CSV, settings, stats and demo seed (`m4-expert`). Both merged. Worktrees removed and pruned.
- Phase D: read-only review. Findings fixed in `1e120fc`: demo labelling of results, prototype-key lookups in the engine, zero estimates, money precision above 2^53, contact moderation on all free-text fields, rate limits on drafts and uploads. Deferred: the admin service functions do not re-check the role themselves (all callers go through `requireRole`).
- Phase E: Playwright journeys in `e2e/m4-valuation.spec.ts`: buyer automatic result, PDF and verify; low-confidence, assign, needs-info, sign-off, notifications; seller publishes own listing; listing seller cannot see a buyer's valuation; seller requirement edit. Full Playwright set 27 of 27. Screenshots at 390px and 1440px in `screenshots/m4/`. Fixed: details form selects reset after Save draft, PDF rupee sign, queue and table overflow at 390px.
- Requirement notes are masked, not refused, as in the buyer flow (the M3 decision). The brief had assumed refusal.

## Not verified

- Visual review of the 1440px set and of the verify, expert-review result and valuator detail screenshots. Only the 390px set for upload, result, queue and prices was checked by eye.
- The PDF first page was not rendered (no PDF renderer installed). The PDF was checked as bytes and text.
- Some screenshots are 413px wide. Likely a full-page capture artifact (the homepage document width is 390px), not proven.
- Headless Chromium only.
- The default Turbopack build fails only inside a worktree with a `node_modules` junction. The main repo builds.

## Next milestone

M5: seller analytics and membership.

## Notes for the next session

- Pre-existing worktrees under `.claude/worktrees/agent-*` were not created in M4. They are not touched by M4 cleanup.
- Known limitation carried over: video containers are not EXIF-stripped (the existing pipeline stores videos as-is).
- Known gap: the expert threshold per category uses the `Category` id. The admin page lists categories by name.

## Open questions

- Should a published listing report show the estimate and range, or only the reference, date and method? Currently the estimate and range are shown, because the seller chose to publish the report.
- Client-supplied reference figures: who owns them and when do they arrive?
- Reactivated valuers: confirm they should keep their open assignments.
- Should the PDF disclaimer match the on-page wording exactly?
