# D1 component library

The shared UI for the luxury design. Phase B pages and dashboards must use these components and the tokens in `app/globals.css`. Do not add new colours, fonts or card styles in page files.

Tokens (Tailwind classes): `bg-surface` (ivory), `bg-surface-raised` (white), `bg-brand` / `text-brand-strong` (charcoal), `bg-night` (near-black), `bg-panel` (photo fallback), `text-ink`, `text-ink-soft`, `border-line`, `text-accent` / `text-accent-text` (gold), `bg-accent-soft`, `bg-champagne`, `text-ivory`, `text-danger`, `text-success`, `font-heading` (Cormorant Garamond), `shadow-soft`.

| Component | File | Notes |
|---|---|---|
| `cx` | `components/ui/cx.ts` | Joins class names |
| `Button`, `ButtonLink`, `buttonClasses` | `components/ui/button.tsx` | Variants: primary, secondary, ghost, gold. Sizes md, lg |
| `Field`, `Input`, `Textarea`, `Select` | `components/ui/field.tsx` | Label, hint and error wired to the control |
| `Card`, `StatTile` | `components/ui/card.tsx` | KPI tiles for dashboards |
| `Badge`, `DemoTag` | `components/ui/badge.tsx` | Tones: neutral, accent, verified, success, warning, danger |
| `Tabs` | `components/ui/tabs.tsx` | Route tabs (links with aria-current) |
| `Modal` | `components/ui/modal.tsx` | Client. Focus trap, Escape, focus return |
| `ToastProvider`, `useToast` | `components/ui/toast.tsx` | Client. Mount once in a layout |
| `Skeleton`, `CardSkeletonGrid` | `components/ui/skeleton.tsx` | Loading placeholders |
| `EmptyState` | `components/ui/empty-state.tsx` | Photo or line icon. Always an action |
| `Photo` | `components/ui/photo.tsx` | Client. Fixed ratio box, lazy, fallback panel |
| `Reveal` | `components/ui/reveal.tsx` | Client. Starts visible, slight lift |
| `Counter` | `components/ui/counter.tsx` | Client. Shows the final value first |
| `Carousel` | `components/ui/carousel.tsx` | Client. Native scroll-snap, arrows and keys. Pass items as children |
| `Gallery` | `components/ui/gallery.tsx` | Client. Thumbnails, zoom, lightbox |
| `ProductCard` | `components/ui/product-card.tsx` | Photo, name, spec, price. `corner` for a wishlist button |
| `SellerCard` | `components/ui/seller-card.tsx` | Banner, logo or initials, place, rating |
| `Sidebar` | `components/ui/sidebar.tsx` | Dashboard nav. Horizontal on phones |
| `PageHeader`, `SectionHeading` | `components/ui/page-header.tsx` | Eyebrow, serif title, lead, actions |
| `DataTable` | `components/ui/data-table.tsx` | Caption, scroll area, empty text |
| `SiteHeader`, `SiteFooter` | `components/layout/` | Already in the root layout |

Rules for pages:
- Photos come from listing media or `public/design-preview/luxury/` (stand-ins). Every photo has real alt text. Decorative images use `alt=""`.
- No illustrations, cartoons or emoji as imagery. Icons are thin line icons from lucide-react.
- Placeholder copy such as "Coming soon" is not allowed on live pages.
- Motion uses `Reveal`, `Counter` or the CSS transitions above. Never hide content until it animates in.
