# M3 status (Communication) – handoff

Branch: `m3-communication`. Latest commits: `acea0a7` (digest lock, README), `82db8dc` (handoff, build fix), `06cb3f7` (review fixes).

## Done and verified
- Schema and migrations: `20261110120000_m3_communication`, `20261110130000_m3_flag_requirement` (applied to the dev DB).
- Enquiries, general conversations, offers (send, accept, decline, counter), quotations (create, withdraw, accept, decline, PDF), requirements (post, edit, close, board, respond), seller inbox, notifications and preferences, contact moderation, admin moderation queues, reports, requirement list, audited conversation viewer, seller categories.
- Unit tests: 595 pass at `06cb3f7`. Typecheck and eslint clean. `npm run build` passes.
- Playwright: the M1 and M2 journey passes, 9 of 9, after `DEMO_SELLER_PASSWORD=Demo-Seller-Pass-1 npm run db:seed:demo`.
- Digest double-send (item 3): the flush takes a transaction-scoped Postgres advisory lock, and each digest claims its rows before sending, releasing the claim if the send fails. Typecheck and notification tests pass. Caveat: a concurrent run in the dev DB printed 0 because no digests were pending, so the lock has not been exercised against real rows.
- README (items 4 and 5): env variable table (Resend, MSG91), digest schedule (`npm run notify:flush` every 5 minutes), accepted M3 gaps (phone split across messages; letters used as digit separators), and an M3 status section.
- Demo sellers keep `demo.gemstone.local` (item 5).

## Not started (from the latest request, in order)
1. **Sellers as buyers (item 1).** Not started. Needed:
   - Sellers may post requirements and send offers on other sellers' listings, never on their own. A seller's own requirements must not appear on the board to them.
   - Keep one seller inbox with "Buying" and "Selling" filters.
   - Journey step: seller posts a requirement, another seller responds.
   - The `/buyer/*` routes are buyer-only in `proxy.ts`. Sellers need access to the buying parts (requirement posting, offers) without the buyer tabs being reachable as a separate area.
2. **Moderation of public seller text (item 2).** Not started. Run `moderateContactDetails` on seller business name, portfolio about and specialties, listing titles and descriptions, and quotation terms, in the save actions. Block the save with a clear message when contact details are found, and record the attempt as a `ModerationFlag` so it appears in the admin queue.
3. **Browser journey** (`e2e/m3-journey.spec.ts`): enquiry, quote and accept; requirement posted and answered; masked phone number in the flagged queue; seller enquires with another seller; seller posts a requirement and another seller responds (item 1). Needs buyer and seller accounts with known passwords. Not written.
4. **M3 screenshots** at 390px and 1440px: inbox, chat thread, requirement form, requirements board, quotation, notification centre, admin flagged queue. Not taken.
5. **M2 visual review:** 8 of 16 screenshots reviewed at 390px. Catalogue cards are long on phones. The header "Log out" wrap in the saved screenshot predates the nowrap fix in code. Re-shoot, then review the 1440px images.
6. **Worktree cleanup (item 6), at the very end.** Not done. For each of the four `.claude/worktrees/m3-*` directories: `cmd /c rmdir <path>\node_modules` (no `/s`, which removes only the link), confirm the main `node_modules` is intact, then `git worktree remove` and `git worktree prune`. Older `agent-*` worktrees from earlier sessions are not touched.

## Known gaps (documented in the README, accepted)
- A phone number split across messages is not joined.
- Letters used as digit separators ("98765a43210") are not treated as separators.
- Live Resend and MSG91 sending is untested (no keys). The MSG91 body follows its docs, not a live call.
- Seller-entered public text is not yet moderated (item 2 above).
- Sellers cannot open the buyer Enquiries and Conversations tabs (`/buyer/*` is buyer-only). They use `/seller/inbox`.

## Decisions to review
- Only buyers post requirements and send offers today. Item 1 changes this for sellers, on other sellers' listings only.
- Requirement matching: approved, active, verified sellers whose categories include the requirement's category. Capped at 200 notifications.
- Offers: one pending offer per buyer per conversation. Currency is the buyer's choice.
- Quotations: only in enquiry and requirement threads. Expiry is the end of the chosen UTC day.
- Requirement response cap: 50 sellers per requirement.
- Admin conversation viewer: the reason is held in a 30-minute cookie, and every load writes an audit row.

## Next steps
1. Item 1 (sellers as buyers), then item 2 (public text moderation). Each with unit tests, then `npx vitest run`, typecheck, and lint.
2. Journey (`e2e/m3-journey.spec.ts`), run `npm run build`, `npm run db:seed:demo` with `DEMO_SELLER_PASSWORD`, then `npm run test:e2e`.
3. Screenshots at 390px and 1440px, fix obvious problems, re-shoot M2.
4. Worktree cleanup (item 6).
5. `npm run db:stop`. Start with `npm run db:start` before any e2e run.
