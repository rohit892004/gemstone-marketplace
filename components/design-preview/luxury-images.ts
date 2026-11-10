/**
 * Photo slots for the luxury preview. Files live in public/design-preview/luxury/, produced from the Pixabay
 * photos listed in docs/design/IMAGE-CREDITS.md. Until a file exists the preview shows a plain charcoal panel.
 */
const DIR = "/design-preview/luxury";

export const LUXURY_PHOTOS = {
  hero: `${DIR}/hero-stone-closeup.webp`,
  banners: [1, 2, 3, 4].map((n) => `${DIR}/seller-banner-${n}.webp`),
  logos: [1, 2, 3, 4].map((n) => `${DIR}/seller-logo-${n}.webp`),
  stones: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${DIR}/stone-${n}.webp`),
  stoneDetail: [1, 2, 3].map((n) => `${DIR}/stone-detail-${n}.webp`),
  categories: {
    diamond: `${DIR}/category-diamond.webp`,
    emerald: `${DIR}/category-emerald.webp`,
    ruby: `${DIR}/category-ruby.webp`,
    sapphire: `${DIR}/category-sapphire.webp`,
    amethyst: `${DIR}/category-amethyst.webp`,
    opal: `${DIR}/category-opal.webp`,
    spinel: `${DIR}/category-other-coloured-stones.webp`,
    tourmaline: `${DIR}/category-tourmaline.webp`,
    "other-coloured-stones": `${DIR}/category-other-coloured-stones.webp`,
  },
} as const;
