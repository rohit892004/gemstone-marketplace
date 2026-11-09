import { z } from "zod";

/**
 * Shared listing validation. Seller CRUD and the catalogue query both use these,
 * so the rules are defined once.
 */

export const AVAILABILITY_VALUES = ["AVAILABLE", "RESERVED", "SOLD", "HIDDEN"] as const;
export const PUBLIC_AVAILABILITY_VALUES = ["AVAILABLE", "RESERVED", "SOLD"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

const optionalNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number({ message }).min(min).max(max).optional());

/** Form input for creating or editing a listing. Price is a major-unit string, e.g. "12,500.50". */
export const listingInputSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a title of at least 3 characters").max(140),
    categoryId: z.string().trim().min(1, "Select a category"),
    /** Gemstone type, e.g. "Sapphire". */
    species: z.string().trim().min(2, "Enter the gemstone type").max(60),
    variety: optionalText(60),
    shape: optionalText(60),
    cut: optionalText(60),
    caratWeight: optionalNumber(0.01, 100000, "Enter a carat weight between 0.01 and 100000")
      .refine((v) => v !== undefined, "Enter the carat weight"),
    dimensions: optionalText(80),
    colour: optionalText(60),
    clarity: optionalText(60),
    origin: optionalText(80),
    treatment: optionalText(120),
    certificateLabId: optionalText(40),
    certificateNo: optionalText(60),
    quantity: z.coerce.number().int().min(1).max(10000),
    priceMode: z.enum(["PRICE", "ON_REQUEST"]),
    price: z.string().trim().max(20).optional().or(z.literal("")),
    currency: z.enum(["INR", "USD"]),
    availability: z.enum(AVAILABILITY_VALUES),
    description: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    if (v.priceMode === "PRICE" && !v.price) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price or choose 'Price on request'" });
    }
  });

export type ListingInput = z.infer<typeof listingInputSchema>;

/** Public catalogue query parameters. Unknown or invalid values are dropped, not errors. */
export const catalogueQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  type: z.string().trim().max(60).optional(),
  shape: z.string().trim().max(60).optional(),
  origin: z.string().trim().max(80).optional(),
  treatment: z.string().trim().max(120).optional(),
  certified: z.enum(["yes"]).optional(),
  currency: z.enum(["INR", "USD"]).optional(),
  minCarat: z.coerce.number().min(0).max(100000).optional(),
  maxCarat: z.coerce.number().min(0).max(100000).optional(),
  /** Price bounds in MAJOR units; converted to minor units by the query builder. */
  minPrice: z.coerce.number().min(0).max(1e10).optional(),
  maxPrice: z.coerce.number().min(0).max(1e10).optional(),
  availability: z.enum(["AVAILABLE", "RESERVED", "SOLD"]).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "carat_desc", "relevance"]).default("newest"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;

export const PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 48;

export const MEDIA_LIMITS = {
  maxImages: 10,
  maxVideos: 2,
  maxImageBytes: 15 * 1024 * 1024,
  maxVideoBytes: 60 * 1024 * 1024,
} as const;
