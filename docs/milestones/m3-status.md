# M3 status (Communication) – handoff

Branch: `m3-communication`. Last merge and fix commits: `06cb3f7` (review fixes), `ac20f0c`/`b5661c2` (merges).

## Done and verified
- Schema and migrations: `20261110120000_m3_communication`, `20261110130000_m3_flag_requirement` (applied to the dev DB).
- Contact moderation: 64 unit tests in `lib/messaging/moderation.test.ts`, including the bypasses from the fresh review.
- Enquiries, general conversations, offers (send, accept, decline, counter), quotations (create, withdraw, accept, decline, PDF), requirements (post, edit, close, board, respond), inbox, notifications and preferences, admin moderation queues, reports, requirements list, audited conversation viewer, seller categories.
- Whole-suite checks at the last run: 595 unit tests pass, `npm run typecheck` clean, eslint clean, `npm run build` passes.
- Playwright: the existing M1 and M2 journey passes (9 of 9) after `DEMO_SELLER_PASSWORD=Demo-Seller-Pass-1 npm run db:seed:demo`.

## Not done
1. **M3 browser journey** (Phase E): buyer enquires, seller replies and quotes, buyer accepts; buyer posts a requirement and a matching seller responds; a message with a phone number is masked and appears in the admin flagged queue; a seller enquires with another seller. Not written yet. Needs buyer accounts with known passwords (the seeded buyers have random ones).
2. **M3 screenshots** at 390px and 1440px: inbox, chat thread, requirement form, requirements board, quotation, notification centre, admin flagged queue. Not taken.
3. **M2 visual review**: 8 of 16 screenshots reviewed at 390px. Catalogue cards are one column and long on phones (image ratio shortened; still long). The header "Log out" wrap in the screenshot predates the nowrap fix in code. Not re-shot. 1440px shots not reviewed.
4. **Live providers**: Resend and MSG91 are implemented behind the interfaces but untested (no keys). The MSG91 body shape is from search results, not confirmed docs.
5. **Digest scheduling**: `npm run notify:flush` must run every 5 minutes in production. Without it, message digests after the first message in a window never send.
6. **Worktrees**: the Phase B worktrees under `.claude/worktrees/m3-*` are merged. They contain `node_modules` junctions to the main install. Remove them with `git worktree remove` only after checking the junctions, so nothing is deleted through a link.

## Known gaps (documented, not fixed)
- A phone number split across two separate messages is not joined.
- Letters used as digit separators ("98765a43210") are not treated as separators.
- Seller-entered business names are not run through moderation.
- `flushMessageDigests` has no lock, so two concurrent runs could double-send.
- Sellers cannot open the buyer Enquiries and Conversations tabs (`/buyer/*` is buyer-only). Sellers use `/seller/inbox`.
- Demo sellers still use `demo.gemstone.local`.

## Decisions to review
- Only buyers post requirements and send offers. Sellers enquire, contact sellers, quote, and respond to requirements.
- Requirement matching: approved, active, verified sellers whose categories include the requirement's category. Capped at 200 notifications.
- Offers: one pending offer per buyer per conversation. Currency is the buyer's choice.
- Quotations: only in enquiry and requirement threads. Expiry is end of the chosen UTC day.
- Requirement response cap: 50 sellers per requirement.
- Admin conversation viewer: the reason is stored in a 30-minute cookie; every load writes an audit row.

## Next steps
1. Write `e2e/m3-journey.spec.ts` (buyer and seller accounts with known passwords, using the M1 helpers for verification), then run `npm run test:e2e`.
2. Take the M3 screenshots at 390px and 1440px and fix obvious visual problems.
3. Re-shoot the M2 pages and finish the visual review.
4. Stop the database (`npm run db:stop`) when finished.
