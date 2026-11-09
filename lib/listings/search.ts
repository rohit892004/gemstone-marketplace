import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { formatMoney } from "@/lib/money/money";
import { mediaUrl } from "@/lib/media/urls";
import { type CatalogueQuery, MAX_PAGE_SIZE, PAGE_SIZE } from "./schema";

/**
 * Public catalogue search. One SQL statement finds matching ids, ranks them, and returns the
 * total (COUNT(*) OVER ()). A second query loads the cards for those ids in a single batch, so
 * there are no per-row queries.
 *
 * Default visibility: PUBLISHED, not HIDDEN, seller APPROVED, availability AVAILABLE or RESERVED.
 * SOLD listings are reachable by direct link but not in search results unless filtered for.
 */

export interface ListingCard {
  id: string;
  slug: string;
  title: string;
  species: string | null;
  shape: string | null;
  caratWeight: string | null;
  priceLabel: string | null;
  priceOnRequest: boolean;
  availability: "AVAILABLE" | "RESERVED" | "SOLD";
  coverUrl: string | null;
  seller: {
    slug: string;
    businessName: string;
    city: string;
    state: string;
    ratingAverage: string | null;
    reviewCount: number;
    isDemo: boolean;
  };
  hasVerifiedDocument: boolean;
  isDemo: boolean;
  featured: boolean;
}

export interface CatalogueResult {
  items: ListingCard[];
  total: number;
  page: number;
  pageSize: number;
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function searchCatalogue(query: CatalogueQuery): Promise<CatalogueResult> {
  const pageSize = Math.min(PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = (query.page - 1) * pageSize;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`g."status" = 'PUBLISHED'`,
    Prisma.sql`g."availability" <> 'HIDDEN'`,
    Prisma.sql`s."approvalStatus" = 'APPROVED'`,
  ];

  if (query.availability) {
    conditions.push(Prisma.sql`g."availability"::text = ${query.availability}`);
  } else {
    conditions.push(Prisma.sql`g."availability"::text IN ('AVAILABLE', 'RESERVED')`);
  }
  if (query.category) {
    conditions.push(Prisma.sql`g."categoryId" IN (SELECT c."id" FROM "Category" c WHERE c."slug" = ${query.category})`);
  }
  if (query.type) conditions.push(Prisma.sql`lower(g."species") = lower(${query.type})`);
  if (query.shape) conditions.push(Prisma.sql`lower(g."shape") = lower(${query.shape})`);
  if (query.origin) conditions.push(Prisma.sql`g."origin" ILIKE ${"%" + escapeLike(query.origin) + "%"}`);
  if (query.treatment) conditions.push(Prisma.sql`g."treatment" ILIKE ${"%" + escapeLike(query.treatment) + "%"}`);
  if (query.certified === "yes") conditions.push(Prisma.sql`g."certificateLabId" IS NOT NULL`);
  if (query.currency) conditions.push(Prisma.sql`g."currency" = ${query.currency}`);
  if (query.minCarat !== undefined) conditions.push(Prisma.sql`g."caratWeight" >= ${query.minCarat}`);
  if (query.maxCarat !== undefined) conditions.push(Prisma.sql`g."caratWeight" <= ${query.maxCarat}`);
  if (query.minPrice !== undefined) conditions.push(Prisma.sql`g."priceMinor" >= ${BigInt(Math.round(query.minPrice * 100))}`);
  if (query.maxPrice !== undefined) conditions.push(Prisma.sql`g."priceMinor" <= ${BigInt(Math.round(query.maxPrice * 100))}`);

  const tsQuery = query.q ? Prisma.sql`websearch_to_tsquery('english', ${query.q})` : null;
  if (tsQuery) conditions.push(Prisma.sql`g."searchText" @@ ${tsQuery}`);

  const orderBy = buildOrder(query.sort, tsQuery);
  const where = Prisma.join(conditions, " AND ");

  const rows = await prisma.$queryRaw<{ id: string; total: bigint | number }[]>`
    SELECT g."id", COUNT(*) OVER () AS total
    FROM "Gemstone" g
    JOIN "SellerProfile" s ON s."id" = g."sellerId"
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  const items = await loadCards(rows.map((r) => r.id));
  return { items, total, page: query.page, pageSize };
}

function buildOrder(sort: CatalogueQuery["sort"], tsQuery: Prisma.Sql | null): Prisma.Sql {
  switch (sort) {
    case "price_asc":
      return Prisma.sql`g."priceMinor" ASC NULLS LAST, g."id" ASC`;
    case "price_desc":
      return Prisma.sql`g."priceMinor" DESC NULLS LAST, g."id" ASC`;
    case "carat_desc":
      return Prisma.sql`g."caratWeight" DESC NULLS LAST, g."id" ASC`;
    case "relevance":
      if (tsQuery) return Prisma.sql`ts_rank(g."searchText", ${tsQuery}) DESC, g."publishedAt" DESC NULLS LAST, g."id" ASC`;
      return Prisma.sql`g."publishedAt" DESC NULLS LAST, g."id" ASC`;
    case "newest":
    default:
      return Prisma.sql`g."publishedAt" DESC NULLS LAST, g."id" ASC`;
  }
}

/** Loads card data for a set of listing ids in one batch and keeps the given order. */
export async function loadCards(ids: string[]): Promise<ListingCard[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.gemstone.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      slug: true,
      title: true,
      species: true,
      shape: true,
      caratWeight: true,
      priceMinor: true,
      priceOnRequest: true,
      currency: true,
      availability: true,
      featured: true,
      isDemo: true,
      media: {
        where: { status: "READY", type: "IMAGE" },
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        take: 1,
        select: { id: true },
      },
      documents: {
        where: { isPublic: true, verificationStatus: "VERIFIED" },
        take: 1,
        select: { id: true },
      },
      seller: {
        select: {
          slug: true,
          businessName: true,
          city: true,
          state: true,
          ratingAverage: true,
          reviewCount: true,
          isDemo: true,
        },
      },
    },
  });

  const byId = new Map(rows.map((r) => [r.id, r]));
  const cards: ListingCard[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) continue;
    cards.push({
      id: r.id,
      slug: r.slug,
      title: r.title,
      species: r.species,
      shape: r.shape,
      caratWeight: r.caratWeight ? r.caratWeight.toString() : null,
      priceLabel: r.priceOnRequest ? null : formatMoney(r.priceMinor, r.currency),
      priceOnRequest: r.priceOnRequest,
      availability: r.availability === "HIDDEN" ? "SOLD" : (r.availability as "AVAILABLE" | "RESERVED" | "SOLD"),
      coverUrl: r.media[0] ? mediaUrl(r.media[0].id, "thumb") : null,
      seller: {
        slug: r.seller.slug,
        businessName: r.seller.businessName,
        city: r.seller.city,
        state: r.seller.state,
        ratingAverage: r.seller.ratingAverage ? r.seller.ratingAverage.toString() : null,
        reviewCount: r.seller.reviewCount,
        isDemo: r.seller.isDemo,
      },
      hasVerifiedDocument: r.documents.length > 0,
      isDemo: r.isDemo,
      featured: r.featured,
    });
  }
  return cards;
}
