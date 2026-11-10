import { prisma } from "@/lib/db/client";
import { pageWindow, type ListingStatusFilter } from "@/lib/seller-catalogue/listings-query";

/** Read-only queries for the seller catalogue pages. Every query is scoped to the signed-in seller. */

export function loadSellerListings(userId: string, query: { status: ListingStatusFilter; page: number }) {
  const where = {
    seller: { userId },
    ...(query.status === "ALL" ? {} : { status: query.status }),
  } as const;

  return prisma.gemstone.count({ where }).then(async (total) => {
    const window = pageWindow(query.page, total);
    const rows = await prisma.gemstone.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: window.skip,
      take: window.take,
      select: {
        id: true,
        title: true,
        status: true,
        availability: true,
        priceMinor: true,
        priceOnRequest: true,
        currency: true,
        quantity: true,
        _count: { select: { media: true, documents: true } },
      },
    });
    return { total, page: window.page, pages: window.pages, rows };
  });
}

export async function loadOwnedListingForEdit(userId: string, listingId: string) {
  return prisma.gemstone.findFirst({
    where: { id: listingId, seller: { userId } },
    select: {
      id: true,
      status: true,
      sellerFeatured: true,
      title: true,
      categoryId: true,
      species: true,
      variety: true,
      shape: true,
      cut: true,
      caratWeight: true,
      dimensions: true,
      colour: true,
      clarity: true,
      origin: true,
      treatment: true,
      certificateLabId: true,
      certificateNo: true,
      quantity: true,
      priceMinor: true,
      priceOnRequest: true,
      currency: true,
      availability: true,
      description: true,
      rejectionReason: true,
      media: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, type: true, sortOrder: true, isCover: true, status: true, mimeType: true },
      },
      documents: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          type: true,
          title: true,
          fileName: true,
          isPublic: true,
          verificationStatus: true,
          verificationReason: true,
        },
      },
    },
  });
}

export function loadCategoryOptions() {
  return prisma.category.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
  });
}

export function loadSellerInventory(userId: string, query: { page: number }) {
  const where = { seller: { userId } } as const;
  return prisma.gemstone.count({ where }).then(async (total) => {
    const window = pageWindow(query.page, total);
    const rows = await prisma.gemstone.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: window.skip,
      take: window.take,
      select: { id: true, title: true, status: true, availability: true, quantity: true },
    });
    return { total, page: window.page, pages: window.pages, rows };
  });
}

export function loadSellerPortfolio(userId: string) {
  return prisma.sellerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      slug: true,
      approvalStatus: true,
      businessName: true,
      businessType: true,
      gstNumber: true,
      addressLine: true,
      city: true,
      state: true,
      country: true,
      pincode: true,
      tagline: true,
      description: true,
      specialties: true,
      logoKey: true,
      bannerKey: true,
    },
  });
}
