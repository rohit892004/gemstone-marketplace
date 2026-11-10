# Gemstone Selections – Roadmap

Checked against `docs/client-brief.md` (the second brief, after M2) and the original Phase 1 spec.

## Done

| Milestone | Scope | Status |
|---|---|---|
| M0 Foundation | Next.js 16, Prisma 7, validated env, base layout, CI | Done |
| M1 Auth & roles | Roles, verification, OTP, password reset, seller onboarding with documents, admin review, audit, rate limits | Done |
| M2 Catalogue & portfolios | Public catalogue and search, seller portfolios and listings, media and documents, moderation, homepage carousels, wishlist, demo data | Done (end-to-end verified on a production build) |
| M3 Communication | Enquiries, offers, buyer requirements and requirements board, quotations (with PDF), in-platform chat with attachments, notifications and preferences, contact-detail moderation, admin flagged queue, reports and blocks, Resend and MSG91 providers | Done (`docs/milestones/m3-status.md`) |
| M4 Valuation | Three-step valuation, "Request valuation" from a product page, expert review, PDF reports with verification page, saved reports, admin valuation tools | Done (`docs/milestones/m4-status.md`) |
| M5 Analytics & membership | Privacy-safe event tracking and daily rollups, seller analytics with CSV export (Elite), followers, membership tiers Free / Premium / Elite (placeholder rules, pending client confirmation), referrals with fraud flags, admin memberships, tier rules and referrals queue, platform analytics with CSV export (moved here from M6) | Done (`docs/milestones/m5-status.md`) |

## Remaining

| Milestone | Scope |
|---|---|
| M6 Content & launch | Education, market news, newsletter (double opt-in, campaigns), admin content publishing, accessibility and polish, deployment preparation, hardening (see the M6 hardening list) |

## Coverage of the client brief

| Brief section | Where it is covered |
|---|---|
| 1. Buyer: top-rated and verified sellers carousel, featured carousel, categories, search and filters | M2 (done) |
| 1. Buyer: seller profile and portfolio, product detail page | M2 (done) |
| 1. Buyer: from product page, view portfolio, wishlist, **request valuation**, **chat or enquire** | Wishlist and portfolio: M2. Enquire and chat: M3. Request valuation: M4 |
| 1. Buyer: post gemstone requirements for sellers to respond to | M3 |
| 1. Buyer: dashboard for wishlists, enquiries, conversations, valuations, saved reports | Wishlist: M2. Enquiries and conversations: M3. Valuations and saved reports: M4 |
| 2. Seller: "Become a Seller", application with contact details, location, categories and documents | M1 (done). Categories on the application: **not yet**, to add in M3 |
| 2. Seller: admin approves or rejects; secure activation; seller dashboard | M1 (done). The approval email links to sign-in, which the client accepts as activation |
| 2. Seller: business profile and portfolio; products with images, videos, specs, pricing, availability | M2 (done) |
| 2. Seller: certificates, **SSL-related options**, valuation reports, lab documents | Certificates, valuation reports and lab documents: M2 (done). "Other lab document" with a label: M3 (added in M3). SSL-related options: **open**, treated as SSEF until confirmed |
| 2. Seller: admin reviews listings and documents, manages verification | M2 (done) |
| 2. Seller: manage buyer enquiries, quotations, conversations | M3 |
| 2. Seller: analytics (profile visits, product views, enquiries, performance) | M5 (done). Tracking, seller analytics and CSV export (Elite) |
| 3. Membership: Free live; Premium and Elite upcoming; progress and upcoming benefits in the dashboard; referrals and engagement | M5 (done). Free from M1; tiers, progress, referrals and the membership page in M5. Tier limits are placeholders pending client confirmation |
| 4. Admin: applications, approvals, products, categories, certificates, reports, document verification, memberships, referrals, buyer enquiries, platform activity | Applications, approvals, products, documents, categories and certificates: done (M1 and M2). Reports and buyer enquiries: M3. Memberships, referrals and platform analytics: M5 (done). Content and platform hardening: M6 |
| 5. Connected journeys (buyer and seller) | Built up across M1–M5; the full journey is covered by the end-to-end tests from M3 onward |
| Design: preserve the current direction; demo data labelled | Ongoing, every milestone |

## Gaps found against the brief

1. **Seller application lacks gemstone categories.** The application form (M1) does not ask which categories a seller deals in. Add to M3 with the requirements board, which filters by category.
2. **SSL-related options.** Unclear in the brief. Nothing is built beyond SSEF lab certificates. Needs client confirmation.
3. **Product views and profile visits were not tracked before M5.** Resolved in M5: tracking is live, with a daily rollup. Views from before M5 do not exist, so seller analytics starts from the M5 release date.
4. **Valuation report on the product page.** The brief asks for valuation reports on the product detail page. M2 shows verified public documents, which can include a valuation report if the seller uploads one. The "request valuation" flow is M4.

## M6 hardening list

(Platform analytics moved from M6 to M5.)

Work to do in the M6 pass, found during reviews and not urgent enough for the milestone that found it.

1. **Admin service functions check roles themselves (defence in depth).** The M4 valuation admin functions in `lib/valuation/admin-*.ts` (prices, valuators, settings, stats) take an `admin: { id }` and do not check the role. Every current caller goes through `requireRole(["ADMIN"])`, so there is no hole today. Add the role check inside each function so a future caller cannot skip it.
2. **Listing limit and featured slots are check-then-write (M5).** Two simultaneous saves could both pass the limit. Fix with a transaction or a row lock on the seller's profile.
3. **Listings awaiting review do not count toward the Free limit (M5).** A seller can queue more than 25. Depends on the open question below.
4. **Referral origin depends on `APP_URL` (M5).** Check the production value; the local `.env` uses port 3000 while the production build runs on 3200.

## Order

- Enquiries and requirements before valuation (M3 before M4). Valuation's expert review needs notifications and the conversation model.
- Analytics and membership stay together in M5, with the counting pipeline first.
- Content and launch last (M6). Its teaser sections already link to "coming soon" pages.

## External dependencies

- **Resend** (email) and **MSG91** (SMS). Implementations are built in M3 behind the existing interfaces. API keys are needed to go live; development uses the console providers.
- Payment gateway: not needed for Phase 1 (memberships are demo-only; no payments).
- Hosting, managed Postgres, object storage replacing local disk, and a reverse proxy that sets `X-Forwarded-For` (see README).

## Open questions

1. What do "SSL-related options" mean in the brief? (Currently treated as SSEF.)
2. Final limits for each membership tier (listing counts, featured slots). Placeholders are live in M5 and labelled "pending client confirmation".
3. Are expert valuators internal staff or external appraisers? (Answered in M4: internal staff.)
4. Should listings awaiting review count toward the Free listing limit? (Raised in M5.)
