import { cache } from "react";
import { prisma } from "@/lib/db/client";
import { publicListingWhere } from "@/lib/listings/visibility";

/** Public product page data. A listing that is not public resolves to null (rendered as notFound). */
export const getPublicGemstoneBySlug = cache(async (slug: string) => {
  return prisma.gemstone.findFirst({
    where: { slug, ...publicListingWhere() },
    select: {
      id: true,
      slug: true,
      title: true,
      species: true,
      variety: true,
      description: true,
      caratWeight: true,
      dimensions: true,
      colour: true,
      clarity: true,
      cut: true,
      shape: true,
      origin: true,
      treatment: true,
      certificateNo: true,
      quantity: true,
      priceMinor: true,
      priceOnRequest: true,
      currency: true,
      availability: true,
      isDemo: true,
      certificateLab: { select: { name: true } },
      media: {
        where: { status: "READY" },
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        select: { id: true, type: true, alt: true },
      },
      documents: {
        where: { isPublic: true, verificationStatus: "VERIFIED" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          title: true,
          fileName: true,
          isPublic: true,
          verificationStatus: true,
          certificateLab: { select: { name: true } },
        },
      },
      seller: {
        select: {
          userId: true,
          slug: true,
          businessName: true,
          city: true,
          state: true,
          country: true,
          specialties: true,
          ratingAverage: true,
          reviewCount: true,
          isDemo: true,
          bannerKey: true,
        },
      },
    },
  });
});

export type PublicGemstone = NonNullable<Awaited<ReturnType<typeof getPublicGemstoneBySlug>>>;
