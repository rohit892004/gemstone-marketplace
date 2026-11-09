# M3 status (Communication): final handoff

Branch: `m3-communication`. This session's commits, oldest first: `5c745de` (sellers as buyers), `48300fd` (public text moderation), `4c706b6` (unflagged text unchanged), `cf84e64` (M3 browser journey), `9937319` (admin shell, header, flag copy). The M3 screenshot test is in `e2e/m3-journey.spec.ts`.

## Done and verified

- Sellers as buyers: approved sellers post requirements, make offers and enquire on other sellers' listings. Own listings and own requirements are refused on the server (`lib/messaging/guards.ts`, tested). The board and match notifications exclude the poster. The requirement detail page refuses a seller's own requirement.
- Seller inbox: Buying and Selling filters beside the kind filters (`lib/messaging/side.ts`, tested). The conversation view derives the viewer role from the side, so a buying-side seller gets the offer composer and no quote controls.
- Public seller text: portfolio tagline, about and specialties, listing title and description, quotation terms, and business name at registration are refused on save when they contain contact details (`lib/moderation/`, tested). Refusals are logged to the flagged queue with the usual strike policy, except registration.
- Moderation fix: unflagged text is returned exactly as typed, so codes such as `GIA-l2345` are no longer rewritten (tested).
- Checks: 624 unit tests, typecheck, lint, production build. Playwright 17 of 17 (`e2e/journey.spec.ts` 9, `e2e/m3-journey.spec.ts` 8).
- Screenshots at 390px and 1440px for the M2 and M3 pages, reviewed. Fixed: admin shell stacked on phones (the queue was 410px wide), and the header logo no longer wraps.
- Worktree cleanup: the four `m3-*` worktrees were clean and merged. Each `node_modules` link was removed with `rmdir` (no `/s`), the main `node_modules` was checked after each, then `git worktree remove` and `prune`. The `agent-*` worktrees were not touched.

## Not verified

- Live Resend and MSG91 sending (no keys). The MSG91 body follows its docs.
- A real device. The screenshots come from headless Chromium.

## Decisions to review

- Quotation terms with contact details are now refused, not masked. This changes the chat rule for quotations. Quotation titles are still masked.
- Sellers post and close their own requirements under `/seller/requirements/new` and `/seller/requirements/mine`. They have no edit page. The buyer `/buyer/*` area stays buyer-only.
- Registration business name refusals are not logged, because no account exists yet.
- A flag on public text records the seller and the source, not the listing ID. Adding a column would need a migration.
- The demo seller's contact strikes accumulate across e2e runs. Reseed before each run (see README).

## Next steps

1. M4: valuation.
2. Open question: should a seller's flagged public text strike count toward messaging restriction? Current behaviour: yes, the same two-strike rule as chat.
3. Open question: should the listing ID be stored on public-text flags? That needs a migration.
