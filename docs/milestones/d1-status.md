# D1 status: apply the luxury design to the whole site

Branch: `d1-design`. Instructions: `docs/milestones/d1.md`. The client approved the luxury direction; no changes were recorded (the placeholder in the message was not filled in).

## Done

- **Phase A (core):** design tokens (luxury palette, Cormorant Garamond and Inter, 4px radius, reduced-motion rule), a 22-part component library in `components/ui/` (documented in `docs/design/COMPONENTS.md`), the new header and footer, and the demo seed with real photos. Listings use the Pixabay photos for their stone type (sapphire, ruby, emerald, diamond). Demo sellers have monogram logos and banners, and articles have covers.
- **Phase B (parallel):** public pages (homepage matching the approved preview, catalogue, product, sellers, valuation, education, news, reference, legal, auth, newsletter, errors), buyer and seller dashboards (sidebar layout, tabs, KPI tiles, DataTable lists), and admin and valuator pages (sidebar, tables, status badges, forms on shared fields).
- **Phase C:** merged and checked: typecheck, lint, 1178 unit tests, production build. One Windows-1252 byte in `app/buyer/requirements/page.tsx` was fixed to UTF-8.
- **Phase D:** independent review. Fixed hover colours, hand-rolled button classes, the legal heading font, 44px mobile touch targets, and a star-rating accessibility label.
- **Phase E:** Playwright 48 of 48 passing in the final full run (one test added afterwards, checked by curl only). Selector changes were limited to copy and id changes (see commit `c34cb45`). Axe reports zero serious or critical issues on the main public pages, the buyer and seller dashboards and the admin newsletter. Two real product bugs were fixed: every `/admin` page crashed (Lucide icon components passed from a server layout into a client component), and the header logo had an axe label mismatch.
- **Screenshots:** 38 files in `screenshots/d1/` (`<slug>-390.png` and `<slug>-1440.png`) for the main pages. Folder is git-ignored.
- **`/design-preview` is 404 in production** (checked on a production server).

## Known gaps (not fixed in D1)

- **Hand-rolled empty states:** about 11 dashed empty-state blocks still use their own markup instead of `EmptyState` (admin prices, valuators, wishlist, seller analytics, admin UI, markdown editor, valuation empty states, photo uploader, valuator media gallery and thread list).
- **Hand-rolled form controls:** auth forms, listing documents, valuator form, admin content and membership admin forms still use their own input classes instead of `Field` and `Input`.
- **Duplicate carousel:** `components/catalogue/carousel.tsx` duplicates `components/ui/carousel.tsx`. It stays because it carries impression tracking.
- **Visual nits from the final review:** the seller dashboard's 10 workspace tiles leave an empty last cell at 1440px; the logged-in header logo sits tight against the nav at 1440px; listing cards without photos show a flat teal panel (test listings only).
- **Hex colours kept on purpose:** the uPlot chart colours and `app/global-error.tsx` (no stylesheet there).
- **Visible copy kept:** the admin membership rules page still says "Placeholder rules, pending client confirmation", as M5 specified.
- **Demo data:** the Phase E run added E2E sellers that push the demo seller past page 1 of the admin memberships list. The seed resets demo rows only. Consider cleaning up E2E sellers in the seed.
- **Line endings:** git warns about LF and CRLF on several edited files. Content is correct, but line endings are mixed.

## Close-out

- Worktrees removed (junctions removed with `rmdir`, no `/s`), registrations pruned. The branches `d1-b-public`, `d1-b-dash` and `d1-b-admin` are merged and kept locally.
- Dev server restarted on port 3000 with fresh demo data.
