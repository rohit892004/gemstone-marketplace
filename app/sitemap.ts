import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { appUrl } from "@/lib/config/app-url";
import { prisma } from "@/lib/db/client";
import { publicListingWhere } from "@/lib/listings/visibility";

/**
 * Sitemap: public listings, approved sellers, categories and public static pages. Listings are
 * selected with the same publicListingWhere() filter the site uses, so drafts, pending, rejected,
 * hidden and unapproved-seller listings never appear. connection() keeps this request-time under
 * Cache Components, so it always reflects the current database.
 */

const STATIC_PATHS = ["/", "/gemstones", "/sellers", "/valuation", "/learn", "/news", "/newsletter", "/register/seller"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();

  const [listings, sellers, categories] = await Promise.all([
    prisma.gemstone.findMany({
      where: publicListingWhere(),
      select: { slug: true, updatedAt: true },
      orderBy: { id: "asc" },
    }),
    prisma.sellerProfile.findMany({
      where: { approvalStatus: "APPROVED" },
      select: { slug: true, updatedAt: true },
      orderBy: { id: "asc" },
    }),
    prisma.category.findMany({ select: { slug: true }, orderBy: { slug: "asc" } }),
  ]);

  return [
    ...STATIC_PATHS.map((path) => ({ url: appUrl(path) })),
    ...categories.map((c) => ({ url: appUrl(`/categories/${encodeURIComponent(c.slug)}`) })),
    ...sellers.map((s) => ({ url: appUrl(`/sellers/${encodeURIComponent(s.slug)}`), lastModified: s.updatedAt })),
    ...listings.map((l) => ({ url: appUrl(`/gemstones/${encodeURIComponent(l.slug)}`), lastModified: l.updatedAt })),
  ];
}
