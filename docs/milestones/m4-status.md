# M4 status (Valuation): handoff

Branch: `m4-valuation` (branched from `main`, which is now a fast-forward of `m3-communication`). The owner's full M4 instructions are saved in `docs/milestones/m4.md`.

## Done

### Step 0: M3 wrap-up (committed, verified)
- Refused public-text saves do not count toward the messaging restriction. They are logged as flags with their own 24-hour count. At 3 or more, every admin gets an alert (in-app, and always by email), at most once per seller per 24 hours. `lib/moderation/public-text.ts`, `lib/moderation/scan.ts`.
- Public-text flags store the listing ID when the save is for a listing the seller owns. Migration `20261110140000_m3_flag_listing`. The admin queue links to the listing.
- Quotation titles are refused like terms, not masked. Quotation titles and terms are logged as `PUBLIC_QUOTATION`.
- Sellers can edit their own requirements (`/seller/requirements/mine/[id]/edit`), with the same validation and moderation as buyers.
- Verified: 628 unit tests at that point, typecheck, lint, production build, Playwright 17 of 17.
- Not covered by an e2e test yet: the seller requirement edit. Add it in Phase E.

### Phase A (lead), partly done
- **Schema and migration** `20261110150000_m4_valuation` (applied to the dev database). Adds `VALUATOR` to `Role`. Replaces the M0 `Valuation` stub, which had 0 rows. Adds `Valuation` (reference, requester, source, status, stone details in milli-carats, auto result, expert result, assignment, rejection and withdrawal fields, publish-on-listing flag), `ValuationMedia`, `ValuationNote` (the requester and valuator thread), `ReferencePrice` (type × grade × band × currency) and `ValuationMultiplier` (origin, treatment, lab, in basis points). The expert threshold goes in the existing `AppSetting` table, so there is no settings model. The migration SQL was generated from a diff, and the unrelated `Gemstone.searchText` drift was removed, as in M3.
- **Valuation engine** `lib/valuation/engine.ts`, pure. Price per carat from the reference table, times the carat weight (integer milli-carats), times origin, treatment and lab multipliers (basis points). Range ±10% for HIGH, ±20% for MEDIUM, ±35% for LOW. Confidence from a 9-point completeness score. HIGH needs 7 points and a lab certificate. Routing: `INCOMPLETE`, `NO_REFERENCE`, `LOW_CONFIDENCE`, `ABOVE_THRESHOLD` (`applyExpertThreshold`), and `REQUESTED` (the requester's choice, set by the caller). The engine never reads images.
- **Demo defaults** `lib/valuation/defaults.ts`: 112 reference rows for the seven categories (INR and USD, four grades, four bands) and demo multipliers. Labelled "Demo — indicative" in the seed, which is not yet written.
- **Access rules** `lib/valuation/access.ts`, pure: who may view (requester, assigned valuator, admin), valuator actions (only on their own assigned requests, only while actionable), who may request (buyers and approved sellers), who may publish on a listing (the owner, of their own completed report), and the verification view. The verification view is an allow-list of five fields: reference, date, gemstone type, status and method. It never includes price, range, requester or listing.
- **Reference numbers** `lib/valuation/reference.ts`: `GSV-YY-XXXXXX`, no look-alike characters, strict format check.
- **Tests:** 52 valuation tests (engine 34, access and references 18). Full suite 680 passing. Typecheck and lint clean.

## Not done (in order)

1. **PDF report with a QR code.** The existing `lib/quotations/pdf.ts` is a dependency-free text writer. A QR code needs either a library (none is installed; `qrcode` is the usual choice, and adding it is a decision for the owner) or an encoder written here. Reuse the writer for layout. Include the disclaimer on every page, and the reference, date and verification URL.
2. **Media storage and submission.** Upload through `StorageProvider` with the existing validation and EXIF stripping (`processMedia`). Images required (at least one), video optional. Draft save and submit. Rate limits on submission (the `RateLimit` table exists). Moderation of notes with `moderateContactDetails`. These are service and server-action layers with tests.
3. **Valuation service.** Create, submit (runs the engine and routes to expert or sets `AUTO_VALUED`), needs-info, sign-off, reject with reason, withdraw. Each status change writes an audit row and a notification (new types `valuation.*`, email as for other types). Notes and requests are owned by the valuation thread.
4. **Requester pages.** Product-page "Request valuation" (prefilled from the listing, including its images), `/valuation` standalone wizard (three steps), results page with the disclaimer and "who valued it", buyer and seller-buying-side Valuations and Saved reports tabs, PDF download, `/valuation/verify/[ref]`, and the seller's "publish on my listing" option. Shared wizard step components go first.
5. **Valuator and admin.** Admin creates and deactivates valuator accounts (no public signup). Valuator queue (assigned only), view media and details, request more info (`NEEDS_INFO`, requester notified), adjust value, range and confidence with notes, sign off. Admin queue with filters, assignment and reassignment, reference-table editor with CSV import and export, threshold setting, withdraw, and basic stats.
6. **Demo seed.** Reference rows for the seven categories, labelled "Demo — indicative", one demo valuator, and a few demo valuations in different statuses. Respect the existing `assertDemoAllowed` guard (`ALLOW_DEMO_SEED=true`).
7. **Phase B and D.** The owner asked for two parallel worktree agents (requester; expert and admin) and a read-only reviewer. None has been started. Phase B needs the Phase A services above committed first. Phase D is the review (IDOR on valuations, media and reports; seller cannot see a buyer's valuation; verification page leaks nothing; valuators see only assigned requests; engine edge cases; disclaimer on the page and the PDF).
8. **Phase E.** Playwright: the four journeys in the owner's list. Screenshots at 390px and 1440px of the wizard steps, results, PDF first page, verify page, valuator queue and reference table. Review and fix. Remove any Phase B worktrees (rmdir the `node_modules` link first, no `/s`), then `git worktree remove` and `prune`.
9. **README** M4 section and final commit. Stop the database and servers.

## Decisions taken in this session

- Refused public text does not count toward messaging restrictions (owner decision 1). Admin alerts are always emailed, because they are operational.
- Quotation titles are refused, not masked (owner).
- The engine's reference data and multipliers are demo placeholders. The client has not confirmed any of them.
- The old `Valuation` stub was replaced, not extended. It had 0 rows.
- BigInt literals are not used (the project targets below ES2020). `BigInt(n)` calls are used.
- Migration timestamps are chosen to sort after the last applied migration. `prisma migrate dev` does not run non-interactively here, so SQL was generated with `prisma migrate diff --from-config-datasource`.

## Open questions

1. QR code: may I add the `qrcode` package, or should the encoder be written here?
2. Are the multiplier and reference values to be replaced by the client's own figures before any demo, and who owns them?
3. Is the expert threshold a single value, or per category?
4. The brief lists valuation reports under the seller's documents as well. Confirm that the seller's own uploaded reports stay separate from platform reports, as the owner's note implies.
5. Valuators: internal staff or external appraisers? This affects whether a valuator sees the requester's name (the spec says private to assigned valuators and admins; keep it that way unless told otherwise).
