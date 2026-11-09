# Gemstone Selections – Roadmap

Status as of M2 start. Source of scope: the Phase 1 spec and the client brief (M2 onward).

## Done

| Milestone | Scope | Status |
|---|---|---|
| M0 Foundation | Next.js 16, Prisma 7 schema v1, validated env, base layout, CI | Done (`63a4db2`) |
| M1 Auth & roles | Buyer/seller/admin roles, verification, OTP, password reset, seller onboarding with documents, admin review, audit log, rate limits | Done (`40d9c4e`, on `main`) |

## Remaining

| Milestone | Scope | Depends on |
|---|---|---|
| **M2 Catalogue & portfolios** (current) | Seller portfolio and listings (CRUD, media, documents), listing moderation and document verification, public catalogue (search, filters, categories, product page), homepage carousels, demo reviews, wishlist, buyer dashboard shell, demo seed, SEO | M1 |
| M3 Enquiries & chat | Enquiries and requirement posts (buyers post requirements, relevant sellers respond), quotations, in-platform chat, notifications, contact-detail moderation, "Chat / Enquire" buttons go live | M2 (listings, sellers) |
| M4 Valuation | Three-step valuation (upload, analysis, results), "Request valuation" from a product page, downloadable PDF reports, saved reports | M2 (media pipeline); M3 for expert-review routing and notifications |
| M5 Analytics & membership | Seller analytics (profile visits, product views, enquiries), membership tiers (Free / Premium / Elite, demo-only upgrades), referrals and progress, admin for memberships and referrals | M2 (view tracking), M3 (enquiry counts) |
| M6 Content & launch | Education library, market news, newsletter with double opt-in and campaigns, admin content publishing, platform analytics, accessibility and polish, deployment preparation | M2 (homepage blocks, admin shell) |

## Order: what changed and why

- **Enquiries moved to M3, ahead of valuation.** Valuation's expert-review path and report delivery need notifications and the conversation model. Building chat and enquiries first means valuation can reuse them.
- **Analytics and membership stay together in M5, analytics first.** Membership tiers need view and enquiry counts to mean anything, so the counting pipeline is built first within M5.
- **Education, news and newsletter stay last (M6).** They have no dependencies on the commerce flow. Their M2 teaser sections link to "coming soon" pages, so the homepage is complete without them.
- **Reviews are modelled in M2 but eligibility is enforced in M3.** A review requires a prior enquiry with that seller, so the rule can only be enforced once enquiries exist. M2 shows labelled demo ratings only.

## Decisions carried across milestones

- One role per user. Buyer-feature checks accept `SELLER` as well. Sellers cannot enquire about, wishlist, or review their own listings or business.
- Seller approval email links to sign-in; that is the account activation step.
- All demo data (ratings, reviews, verification badges, sample sellers) is labelled "Demo" and is refused in production.
- Design direction stays as set in M0/M1: premium, minimal, professional tokens.

## External dependencies (block production, not development)

- Real email provider (Resend or similar) and SMS provider (for OTP). Console providers refuse to run in production.
- Payment gateway. Not needed for Phase 1 (membership upgrades are demo-only); needed before real payments.
- Hosting, managed Postgres, object storage for uploads (replacing local disk), and a reverse proxy that sets `X-Forwarded-For` (see README).

## Open questions

1. **"SSL-related options" in the brief.** The brief text was not available in full when this was written. Possibly this refers to the SSEF lab already in the lab list. Nothing has been built for it. Needs clarification.
2. Are the membership tiers' feature limits final (for example listing counts per tier)?
3. Which email and SMS providers does the client want?
4. Are the expert valuators internal staff or external appraisers?
