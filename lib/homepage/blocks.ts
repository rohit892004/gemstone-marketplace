import { z } from "zod";
import { prisma } from "@/lib/db/client";

/**
 * Homepage copy, stored as HomepageBlock rows (one per key) and validated here.
 * Only the keys below exist; unknown keys are rejected. Every object is strict, so unknown
 * fields are rejected too. Hrefs must be relative paths. Text is rendered as React text only.
 */

const text = (max: number) => z.string().trim().min(1, "Required").max(max, `Use at most ${max} characters`);
const optionalText = (max: number) => z.string().trim().max(max, `Use at most ${max} characters`);

const relativeHref = z
  .string()
  .trim()
  .min(1, "Required")
  .max(300, "Use at most 300 characters")
  .refine((v) => v.startsWith("/") && !v.startsWith("//") && !v.includes("\\"), {
    message: "Use a relative path that starts with /",
  })
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), { message: "Control characters are not allowed" });

const heroSchema = z
  .object({
    headline: text(300),
    subheadline: text(300),
    primaryCtaLabel: text(300),
    primaryCtaHref: relativeHref,
    secondaryCtaLabel: text(300),
    secondaryCtaHref: relativeHref,
  })
  .strict();

const categoriesHeadingSchema = z.object({ heading: text(300), intro: optionalText(300) }).strict();

const teaserWithCta = z
  .object({
    heading: text(300),
    body: text(300),
    ctaLabel: text(300),
    ctaHref: relativeHref,
  })
  .strict();

const newsletterTeaserSchema = z
  .object({
    heading: text(300),
    body: text(300),
  })
  .strict();

export const homepageBlockSchemas = {
  hero: heroSchema,
  categoriesHeading: categoriesHeadingSchema,
  valuationTeaser: teaserWithCta,
  educationTeaser: teaserWithCta,
  newsTeaser: teaserWithCta,
  newsletterTeaser: newsletterTeaserSchema,
} as const;

export type HomepageBlockKey = keyof typeof homepageBlockSchemas;
export type HomepageBlockContent<K extends HomepageBlockKey> = z.infer<(typeof homepageBlockSchemas)[K]>;

export const HOMEPAGE_BLOCK_KEYS = Object.keys(homepageBlockSchemas) as HomepageBlockKey[];

export function isHomepageBlockKey(value: string): value is HomepageBlockKey {
  return (HOMEPAGE_BLOCK_KEYS as string[]).includes(value);
}

/** Defaults used when no row exists or the stored row fails validation. */
export const HOMEPAGE_DEFAULTS: { [K in HomepageBlockKey]: HomepageBlockContent<K> } = {
  hero: {
    headline: "Discover, compare and value gemstones from verified sellers.",
    subheadline:
      "Browse listings by category, speak directly with sellers on the platform, and request an indicative valuation for your stone.",
    primaryCtaLabel: "Browse gemstones",
    primaryCtaHref: "/gemstones",
    secondaryCtaLabel: "Get a valuation",
    secondaryCtaHref: "/valuation",
  },
  categoriesHeading: { heading: "Shop by category", intro: "Browse every gemstone family on the platform." },
  valuationTeaser: {
    heading: "Get a valuation",
    body: "Send details of your stone and receive an indicative estimate. Coming soon.",
    ctaLabel: "Get a valuation",
    ctaHref: "/valuation",
  },
  educationTeaser: {
    heading: "Learn about gemstones",
    body: "Guides on grading, treatments and buying with confidence. Coming soon.",
    ctaLabel: "Visit Learn",
    ctaHref: "/education",
  },
  newsTeaser: {
    heading: "Market news",
    body: "Price movements and trade news from the gemstone market. Coming soon.",
    ctaLabel: "Read market news",
    ctaHref: "/news",
  },
  newsletterTeaser: {
    heading: "Newsletter",
    body: "A monthly digest of new listings and market notes. Sign-ups open soon.",
  },
};

/**
 * Parses stored content for a key. Returns the default when the value is invalid, so a bad row
 * can never break the homepage.
 */
export function parseHomepageBlock<K extends HomepageBlockKey>(key: K, content: unknown): HomepageBlockContent<K> {
  const result = homepageBlockSchemas[key].safeParse(content);
  return result.success ? (result.data as HomepageBlockContent<K>) : HOMEPAGE_DEFAULTS[key];
}

/** Loads every block (active rows only) and fills gaps with defaults. */
export async function loadHomepageBlocks(): Promise<typeof HOMEPAGE_DEFAULTS> {
  const rows = await prisma.homepageBlock.findMany({
    where: { active: true, key: { in: HOMEPAGE_BLOCK_KEYS } },
    select: { key: true, content: true },
  });
  const result = { ...HOMEPAGE_DEFAULTS };
  for (const row of rows) {
    if (!isHomepageBlockKey(row.key)) continue;
    // Each key is parsed with its own schema; the cast keeps the mapped type.
    (result as Record<string, unknown>)[row.key] = parseHomepageBlock(row.key, row.content);
  }
  return result;
}
