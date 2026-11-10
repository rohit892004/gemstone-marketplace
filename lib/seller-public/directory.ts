import type { Prisma } from "@/app/generated/prisma/client";
import type { SellerCardData } from "@/components/catalogue/seller-card";
import { prisma } from "@/lib/db/client";
import { rankSellers } from "@/lib/membership/directory";
import { loadTierRules } from "@/lib/membership/service";
import { ruleFor, type Tier, type TierRule } from "@/lib/membership/tiers";
import { publicListingWhere } from "@/lib/listings/visibility";

/** Seller directory. Approved sellers only, always. Card fields only. */

export const DIRECTORY_PAGE_SIZE = 24;

/**
 * How many sellers the ranking looks at. Ranking happens in memory, so a page is sorted across this many candidates
 * (best rated first in the database). Above this size, a low-rated Premium seller can rank below the cut-off. Raise
 * it, or move the boost into SQL, if the directory grows past it.
 */
export const DIRECTORY_RANK_CANDIDATES = 2000;
/** The homepage carousel ranks the same way, over a smaller window. */
export const TOP_SELLER_RANK_CANDIDATES = 200;

export interface DirectoryQuery {
  q?: string;
  specialty?: string;
  page: number;
}

/** Exported for tests. APPROVED sits outside every user-controlled branch. */
export function buildDirectoryWhere(query: Omit<DirectoryQuery, "page">): Prisma.SellerProfileWhereInput {
  const and: Prisma.SellerProfileWhereInput[] = [];
  if (query.q) {
    and.push({
      OR: [
        { businessName: { contains: query.q, mode: "insensitive" } },
        { city: { contains: query.q, mode: "insensitive" } },
        { state: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  if (query.specialty) and.push({ specialties: { has: query.specialty } });
  return { approvalStatus: "APPROVED", AND: and };
}

export interface RankedSellerCard extends SellerCardData {
  tier: Tier;
  /** From the tier rule. The badge shows for Premium and Elite. */
  hasBadge: boolean;
}

const CARD_SELECT = {
  id: true,
  slug: true,
  businessName: true,
  city: true,
  state: true,
  country: true,
  specialties: true,
  ratingAverage: true,
  reviewCount: true,
  isDemo: true,
  membership: { select: { tier: true } },
} satisfies Prisma.SellerProfileSelect;

/**
 * Ranks the given where clause by rating plus the tier boost, then loads the cards for one page. The candidates are
 * read in the database's rating order first, so the existing order is the starting point the boost is added to.
 */
async function rankedPage(
  where: Prisma.SellerProfileWhereInput,
  options: { skip: number; take: number; candidateCap: number; orderBy: Prisma.SellerProfileOrderByWithRelationInput[] },
): Promise<{ items: RankedSellerCard[]; total: number }> {
  const [candidates, total] = await Promise.all([
    prisma.sellerProfile.findMany({
      where,
      orderBy: options.orderBy,
      take: options.candidateCap,
      select: { id: true, ratingAverage: true, reviewCount: true, membership: { select: { tier: true } } },
    }),
    prisma.sellerProfile.count({ where }),
  ]);
  if (candidates.length === 0) return { items: [], total };

  const rules: TierRule[] = await loadTierRules();
  const tierOf = (membership: { tier: string } | null): Tier => (membership?.tier as Tier | undefined) ?? "FREE";
  const ranked = rankSellers(
    candidates.map((c) => ({
      id: c.id,
      ratingAverage: c.ratingAverage === null ? null : Number(c.ratingAverage.toString()),
      reviewCount: c.reviewCount,
      rankingBoost: ruleFor(rules, tierOf(c.membership)).rankingBoost,
    })),
  );
  const pageIds = ranked.slice(options.skip, options.skip + options.take).map((r) => r.id);
  if (pageIds.length === 0) return { items: [], total };

  const rows = await prisma.sellerProfile.findMany({ where: { id: { in: pageIds } }, select: CARD_SELECT });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const items: RankedSellerCard[] = [];
  for (const id of pageIds) {
    const row = byId.get(id);
    if (!row) continue;
    const tier = tierOf(row.membership);
    items.push({
      slug: row.slug,
      businessName: row.businessName,
      city: row.city,
      state: row.state,
      country: row.country,
      specialties: row.specialties,
      ratingAverage: row.ratingAverage ? row.ratingAverage.toString() : null,
      reviewCount: row.reviewCount,
      // The sort never touches isDemo: a demo seller keeps its Demo label on every page.
      isDemo: row.isDemo,
      tier,
      hasBadge: ruleFor(rules, tier).hasBadge,
    });
  }
  return { items, total };
}

export async function searchSellers(query: DirectoryQuery) {
  const where = buildDirectoryWhere(query);
  const skip = (query.page - 1) * DIRECTORY_PAGE_SIZE;
  const result = await rankedPage(where, {
    skip,
    take: DIRECTORY_PAGE_SIZE,
    candidateCap: DIRECTORY_RANK_CANDIDATES,
    orderBy: [{ ratingAverage: { sort: "desc", nulls: "last" } }, { reviewCount: "desc" }, { id: "asc" }],
  });
  return { items: result.items, total: result.total, page: query.page, pageSize: DIRECTORY_PAGE_SIZE };
}

/** The homepage top-sellers carousel: approved sellers with at least one public listing, ranked with the boost. */
export async function topRankedSellers(limit: number): Promise<RankedSellerCard[]> {
  const where: Prisma.SellerProfileWhereInput = { approvalStatus: "APPROVED", gemstones: { some: publicListingWhere() } };
  const result = await rankedPage(where, {
    skip: 0,
    take: limit,
    candidateCap: TOP_SELLER_RANK_CANDIDATES,
    orderBy: [{ ratingAverage: { sort: "desc", nulls: "last" } }, { reviewCount: "desc" }, { id: "asc" }],
  });
  return result.items;
}

/** Distinct specialties across approved sellers, for the filter dropdown. */
export async function listSpecialties(): Promise<string[]> {
  const rows = await prisma.sellerProfile.findMany({
    where: { approvalStatus: "APPROVED" },
    select: { specialties: true },
    take: 500,
  });
  const set = new Set<string>();
  for (const r of rows) for (const s of r.specialties) set.add(s);
  return [...set].sort((a, b) => a.localeCompare(b)).slice(0, 100);
}
