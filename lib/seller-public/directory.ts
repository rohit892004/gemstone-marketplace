import type { Prisma } from "@/app/generated/prisma/client";
import type { SellerCardData } from "@/components/catalogue/seller-card";
import { prisma } from "@/lib/db/client";

/** Seller directory. Approved sellers only, always. Card fields only. */

export const DIRECTORY_PAGE_SIZE = 24;

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

export async function searchSellers(query: DirectoryQuery) {
  const where = buildDirectoryWhere(query);
  const skip = (query.page - 1) * DIRECTORY_PAGE_SIZE;
  const [rows, total] = await Promise.all([
    prisma.sellerProfile.findMany({
      where,
      orderBy: [{ ratingAverage: { sort: "desc", nulls: "last" } }, { reviewCount: "desc" }, { id: "asc" }],
      skip,
      take: DIRECTORY_PAGE_SIZE,
      select: {
        slug: true,
        businessName: true,
        city: true,
        state: true,
        country: true,
        specialties: true,
        ratingAverage: true,
        reviewCount: true,
        isDemo: true,
      },
    }),
    prisma.sellerProfile.count({ where }),
  ]);
  const items: SellerCardData[] = rows.map((r) => ({
    ...r,
    ratingAverage: r.ratingAverage ? r.ratingAverage.toString() : null,
  }));
  return { items, total, page: query.page, pageSize: DIRECTORY_PAGE_SIZE };
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
