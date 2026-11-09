import { prisma } from "@/lib/db/client";

/**
 * Every seller write starts here. A row is found only when it belongs to the signed-in
 * seller's account, so another seller's id resolves to null (rendered as "not found").
 */
export function findOwnedListing(listingId: string, userId: string) {
  return prisma.gemstone.findFirst({
    where: { id: listingId, seller: { userId } },
    select: { id: true, status: true, sellerId: true, publishedAt: true, submittedAt: true },
  });
}

export function findOwnedMedia(mediaId: string, userId: string) {
  return prisma.gemstoneMedia.findFirst({
    where: { id: mediaId, gemstone: { seller: { userId } } },
    select: { id: true, gemstoneId: true, type: true, fileKey: true, thumbKey: true, isCover: true },
  });
}

export function findOwnedDocument(documentId: string, userId: string) {
  return prisma.listingDocument.findFirst({
    where: { id: documentId, gemstone: { seller: { userId } } },
    select: { id: true, gemstoneId: true, fileKey: true, verificationStatus: true },
  });
}
