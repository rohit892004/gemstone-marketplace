# D1 status: apply the luxury design to the whole site

Branch: `d1-design`. Instructions: `docs/milestones/d1.md`. The client approved the luxury direction; no changes were recorded (the placeholder in the message was not filled in).

## Done

- **Design tokens (Phase A, part 1):** colours moved to the luxury palette (warm ivory surface, near-black charcoal ink and brand, one muted gold accent, gold text kept at 4.5:1 or higher). Fonts: Cormorant Garamond for headings and Inter for body text, both self-hosted through `next/font`. Headings use the serif by default. Small radius token (4px). A global reduced-motion rule shortens every animation and transition to near zero.
- The three old cartoon directions and the first luxury preview were already removed in earlier commits.

## Not done (to do next, in order)

1. **Core component library (Phase A):** Button, Input, Select, Card, ProductCard, SellerCard, Badge/Tag, Tabs, Modal, Toast, Skeleton, EmptyState (photo or line icons only), Carousel, Gallery with zoom and lightbox, Reveal (never starts invisible), Counter, Sidebar, PageHeader, data Table.
2. **New header and footer** (Phase A).
3. **Demo seed with real photos (Phase A):** listings, categories, seller banners, articles and news use the processed photos in `public/design-preview/luxury/` (source files in `R:\Demo\demo-images\`) with matching names. Each demo seller gets a text monogram logo. Commit.
4. **Phase B:** three parallel worktree subagents (public pages; buyer and seller dashboards; admin and valuator), each using only the Phase A components.
5. **Phase C:** merge, typecheck, lint, unit tests, build.
6. **Phase D:** read-only review (cartoon check, consistency, 390px overflow, accessibility, reduced motion, performance), with fixes.
7. **Phase E:** all 48 Playwright tests still pass (selectors updated only where markup changed), axe zero serious or critical, screenshots at 390px and 1440px in `screenshots/d1/`, `/design-preview` returns 404 in production.
8. **Close-out:** worktree cleanup (rmdir junction without `/s`, then `git worktree remove`, then prune), commit, push, restart the dev server with fresh demo data.

## Known risks

- The existing pages use the old rounded-card and green-accent classes in many files. Phase B must replace them, not patch them.
- Scroll-reveal must never leave content hidden; the Reveal component should start visible and only offset slightly.
