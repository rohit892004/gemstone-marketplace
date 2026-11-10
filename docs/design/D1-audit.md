# D1 design audit: why the site looks blank and flat

Screenshots: `screenshots/d1-audit/` (390px and 1440px, full page). Checked on the dev server at branch `d1-design` from `main`.

## Causes across the site

1. **No imagery.** Every gemstone "photo" is a flat colour block (blue, red, green). Catalogue, carousels, product page, and seller portfolio have nothing to look at.
2. **Text-only heroes.** The homepage hero is a headline, two buttons, and a search box. There is no visual and no sense of the product.
3. **Flat, uniform cards.** Grey borders, small type, one neutral palette. No gradients, accents, depth, icons, or highlights.
4. **No motion.** Nothing reveals, lifts, zooms, counts up, or responds to the cursor or to scroll.
5. **Placeholder copy left in place.** Homepage cards say "Coming soon" and the newsletter button is disabled.
6. **Footer dominates.** The newsletter form takes a large block of every page, including the dashboards.
7. **Empty dashboards.** The seller dashboard is a heading and one sentence. The admin dashboard is numbers in plain boxes, with no icons, colour, status badges, or charts.

## Page by page

| Page | 390px | 1440px |
|---|---|---|
| Homepage | Text-heavy; stacked grey cards | Hero has no visual; colour-block carousel cards; plain category rows; "Coming soon" cards and button |
| Catalogue | Dense list of colour blocks | 68 near-identical colour-block cards; plain sidebar form; no title treatment |
| Product page | Single colour block; actions stacked | One flat image, no gallery or zoom; plain spec table; four outline buttons; no sticky price panel |
| Seller portfolio | Pale gradient band for the banner; letter avatar | Banner is an empty gradient band; avatar is a letter circle; plain gallery grid; no tabs |
| Sellers directory | Stacked seller rows | Plain rows, no logos or banners |
| Valuation | Form-first, no visual | Form-first; no example, no gemstone visual |
| Education | Text cards | Text cards with no images |
| News | Text cards | Text cards with no images or source marks |
| Login / register | Plain forms | Plain forms; no brand moment |
| Become a Seller | Plain form | Plain form; no benefits or visuals |
| Buyer dashboard | Plain list | Plain list; no icons; empty states are text only |
| Seller dashboard | Heading and one sentence | Empty area; no KPI tiles, icons, or status badges |
| Admin dashboard | Numbers in boxes | Numbers in boxes; no icons, colour, charts, or status colours; sidebar has "coming later" items in grey |

## What the new design needs (from the brief)

- Real or illustrated gemstone imagery in every card, tile, and gallery.
- A hero with a visual, a bold headline, a big search bar, and category chips.
- Motion that is kind to phones and respects reduced motion.
- Dashboards with icons, colour, status badges, and friendly empty states.
- No placeholder copy on live pages.
