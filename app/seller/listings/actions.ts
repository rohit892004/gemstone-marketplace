"use server";

import { Prisma } from "@/app/generated/prisma/client";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { MEDIA_ERROR_TEXT, processMedia, type ProcessedMedia } from "@/lib/media/pipeline";
import { MEDIA_LIMITS } from "@/lib/listings/schema";
import { getBooleanSetting } from "@/lib/settings/app-settings";
import { loadActiveCertificateLabs } from "@/lib/seller/labs";
import { sanitizeFileName } from "@/lib/seller/sanitize-filename";
import { checkMediaBatch, coverPromotionAfterRemoval, applyCover, moveItem, sortMedia, sortOrderAssignments, type IncomingFile, type MediaItem } from "@/lib/seller-catalogue/media-rules";
import { canAddDocument, canSellerDeleteDocument } from "@/lib/seller-catalogue/documents";
import { parseListingForm, type ListingFormField } from "@/lib/seller-catalogue/listing-form";
import { recordBlockedPublicText } from "@/lib/moderation/public-text";
import { publicTextBlockedMessage, scanPublicText } from "@/lib/moderation/scan";
import { findOwnedDocument, findOwnedListing, findOwnedMedia } from "@/lib/seller-catalogue/ownership";
import { generateListingSlug, listingDocumentKey, listingMediaKey } from "@/lib/seller-catalogue/keys";
import { resolveSaveStatus } from "@/lib/seller-catalogue/transitions";
import { changedKeyStoneFields } from "@/lib/valuation/stone-changes";
import { unpublishValuationsOnStoneChange } from "@/lib/valuation/service";
import { getStorageProvider } from "@/lib/storage/storage";
import { uploadErrorMessage, validateUpload } from "@/lib/storage/upload-validation";
import { getEnv } from "@/lib/config/env";
import { assertCanPublishListing, assertFeaturedSlot, MembershipError, withSellerLock } from "@/lib/membership/service";
import { notifyFollowersOfNewListing } from "@/lib/membership/notify-followers";

/** Server actions for the seller listing editor. Every write is scoped to the signed-in seller. */

export interface ListingFormState {
  fieldErrors?: Partial<Record<ListingFormField, string>>;
  formError?: string;
  values?: Record<string, string>;
  saved?: "draft" | "submit";
}

export interface MediaUploadState {
  error?: string;
  message?: string;
}

export interface DocumentUploadState {
  error?: string;
  message?: string;
}

const idSchema = z.string().min(1).max(64);
const DOCUMENT_TYPES = ["CERTIFICATE", "VALUATION_REPORT", "LAB_DOCUMENT"] as const;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function listingPath(id: string) {
  return `/seller/listings/${id}/edit`;
}

function revalidateListing(id: string) {
  revalidatePath("/seller/listings");
  revalidatePath(listingPath(id));
  revalidatePath("/seller/inventory");
}

function isSlugCollision(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Writes are best-effort cleanup: a failed delete leaves an orphan file, never a broken listing. */
async function deleteObjects(keys: (string | null | undefined)[]): Promise<void> {
  const storage = getStorageProvider();
  await Promise.all(
    keys
      .filter((k): k is string => Boolean(k))
      .map((k) => storage.delete(k).catch((error) => console.error("[seller-catalogue] storage delete failed", error))),
  );
}

// ---------- Listing create / edit ----------

export async function saveListingAction(_previous: ListingFormState, formData: FormData): Promise<ListingFormState> {
  const user = await requireRole(["SELLER"], { sellerApproved: true });

  const parsed = parseListingForm(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: parsed.values, formError: "Please correct the highlighted fields." };
  const { input, priceMinor, priceOnRequest, intent, values } = parsed.value;

  const listingIdRaw = text(formData, "listingId");
  const listingId = listingIdRaw ? idSchema.safeParse(listingIdRaw) : null;
  if (listingId && !listingId.success) return { formError: "Listing not found." };

  const seller = await prisma.sellerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!seller) return { formError: "Your seller profile could not be found." };

  // Lookups for foreign keys. The database would also reject unknown ids, but the form needs field errors.
  const [category, labs] = await Promise.all([
    prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
    loadActiveCertificateLabs(),
  ]);
  if (!category) {
    return { fieldErrors: { categoryId: "Select a valid category." }, values, formError: "Please correct the highlighted fields." };
  }
  if (input.certificateLabId && !labs.some((lab) => lab.id === input.certificateLabId)) {
    return { fieldErrors: { certificateLabId: "Select a certificate lab from the list." }, values, formError: "Please correct the highlighted fields." };
  }

  const current = listingId?.success ? await findOwnedListing(listingId.data, user.id) : null;
  if (listingId?.success && !current) return { formError: "Listing not found." };

  // Listing titles and descriptions are public. Contact details are refused, not masked.
  const scan = scanPublicText([
    { field: "title", label: "Title", value: input.title },
    { field: "description", label: "Description", value: input.description },
  ]);
  if (scan.flagged) {
    await recordBlockedPublicText({ senderId: user.id, source: "PUBLIC_LISTING", kinds: scan.kinds, gemstoneId: current?.id ?? null });
    const fieldErrors: Partial<Record<ListingFormField, string>> = {};
    for (const field of scan.flaggedFields) fieldErrors[field as ListingFormField] = "Contact details are not allowed here.";
    return { fieldErrors, values, formError: publicTextBlockedMessage(scan.flaggedLabels) };
  }

  const autoPublish = await getBooleanSetting("autoPublishApprovedSellers");
  const resolved = resolveSaveStatus({
    current: current?.status ?? null,
    intent,
    sellerApproved: true,
    autoPublish,
  });
  if (!resolved.ok) {
    return {
      formError: resolved.reason === "archived" ? "Archived listings cannot be edited." : "This listing is already awaiting review.",
    };
  }

  // Membership limits, checked on the server before anything is written. A listing that is already published is
  // not a new publish, so editing it never counts against the limit. Downgrades never remove a listing.
  const becomesLive = (resolved.status === "PUBLISHED" || resolved.status === "PENDING_REVIEW") && current?.status !== "PUBLISHED";
  const wantsFeatured = formData.get("sellerFeatured") === "on";
  const featuredSent = text(formData, "sellerFeaturedSet") === "1";
  // The checks and the write run in one transaction under the seller's row lock (see withSellerLock).
  const checkFeatured = featuredSent && wantsFeatured;
  const limitError = (error: MembershipError) => ({ formError: error.message, values: { ...values, sellerFeatured: wantsFeatured ? "true" : "false" } });
  const publishedNow = resolved.status === "PUBLISHED" && current?.status !== "PUBLISHED";

  const now = new Date();
  const fields = {
    ...(featuredSent ? { sellerFeatured: wantsFeatured } : {}),
    title: input.title,
    categoryId: input.categoryId,
    species: input.species,
    variety: input.variety ?? null,
    shape: input.shape ?? null,
    cut: input.cut ?? null,
    caratWeight: input.caratWeight ?? null,
    dimensions: input.dimensions ?? null,
    colour: input.colour ?? null,
    clarity: input.clarity ?? null,
    origin: input.origin ?? null,
    treatment: input.treatment ?? null,
    certificateLabId: input.certificateLabId ?? null,
    certificateNo: input.certificateNo ?? null,
    quantity: input.quantity,
    priceMinor,
    priceOnRequest,
    currency: input.currency,
    availability: input.availability,
    description: input.description ?? null,
    status: resolved.status,
    submittedAt: resolved.setSubmittedAt ? now : undefined,
    publishedAt: resolved.setPublishedAt ? now : undefined,
  };

  if (current) {
    // Read the key stone details first, so a change can take any published valuation off the listing.
    const before = await prisma.gemstone.findFirst({
      where: { id: current.id, seller: { userId: user.id } },
      select: { species: true, caratWeight: true, treatment: true, certificateLabId: true, certificateNo: true },
    });
    // Ownership is repeated in the where clause so a race cannot write another seller's row.
    let result: { count: number };
    try {
      result = await withSellerLock(seller.id, async (tx) => {
        if (becomesLive) await assertCanPublishListing(seller.id, current.id, tx);
        if (checkFeatured) await assertFeaturedSlot(seller.id, current.id, tx);
        return tx.gemstone.updateMany({
          where: { id: current.id, seller: { userId: user.id } },
          data: fields,
        });
      });
    } catch (error) {
      if (error instanceof MembershipError) return limitError(error);
      throw error;
    }
    if (result.count !== 1) return { formError: "Listing not found." };
    if (before) {
      const changed = changedKeyStoneFields(before, fields);
      await unpublishValuationsOnStoneChange({ gemstoneId: current.id, changed, actorId: user.id });
    }
    if (publishedNow) {
      const live = await prisma.gemstone.findUnique({ where: { id: current.id }, select: { slug: true } });
      if (live) await notifyFollowersOfNewListing({ sellerId: seller.id, listingSlug: live.slug });
    }
    revalidateListing(current.id);
    return { saved: intent, values: undefined };
  }

  // Create with a unique slug. Retry only on a slug collision.
  let created: { id: string; slug: string } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      created = await withSellerLock(seller.id, async (tx) => {
        if (becomesLive) await assertCanPublishListing(seller.id, undefined, tx);
        if (checkFeatured) await assertFeaturedSlot(seller.id, "new-listing", tx);
        return tx.gemstone.create({
          data: { ...fields, sellerId: seller.id, slug: generateListingSlug(input.title) },
          select: { id: true, slug: true },
        });
      });
    } catch (error) {
      if (error instanceof MembershipError) return limitError(error);
      if (!isSlugCollision(error)) throw error;
    }
  }
  if (!created) return { formError: "Could not save the listing. Try again." };

  if (publishedNow) await notifyFollowersOfNewListing({ sellerId: seller.id, listingSlug: created.slug });
  revalidatePath("/seller/listings");
  revalidatePath("/seller/inventory");
  redirect(`${listingPath(created.id)}?saved=${intent}`);
}

// ---------- Media ----------

export async function uploadMediaAction(_previous: MediaUploadState, formData: FormData): Promise<MediaUploadState> {
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const listingId = idSchema.safeParse(text(formData, "listingId"));
  if (!listingId.success) return { error: "Listing not found." };
  const owned = await findOwnedListing(listingId.data, user.id);
  if (!owned) return { error: "Listing not found." };

  const files = formData.getAll("media").filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length === 0) return { error: "Choose at least one image or video." };
  if (files.length > MEDIA_LIMITS.maxImages + MEDIA_LIMITS.maxVideos) return { error: "Too many files in one upload." };

  const existing = await prisma.gemstoneMedia.findMany({
    where: { gemstoneId: owned.id },
    select: { type: true },
  });
  const existingCounts = {
    images: existing.filter((m) => m.type === "IMAGE").length,
    videos: existing.filter((m) => m.type === "VIDEO").length,
  };

  // Process one file at a time so memory stays bounded and the limits can stop the batch early.
  const processed: ProcessedMedia[] = [];
  const incoming: IncomingFile[] = [];
  for (const [index, file] of files.entries()) {
    if (file.size > MEDIA_LIMITS.maxVideoBytes) return { error: `File ${index + 1} is too large.` };
    const processedFile = await processMedia(Buffer.from(await file.arrayBuffer()));
    if (!processedFile.ok) return { error: `File ${index + 1}: ${MEDIA_ERROR_TEXT[processedFile.reason]}` };
    processed.push(processedFile.media);
    incoming.push({ kind: processedFile.media.kind, sizeBytes: processedFile.media.sizeBytes });
    const check = checkMediaBatch(existingCounts, incoming);
    if (!check.ok) return { error: mediaBatchMessage(check.reason) };
  }

  const storage = getStorageProvider();
  const writtenKeys: string[] = [];
  try {
    const rows: Prisma.GemstoneMediaCreateManyInput[] = [];
    for (const media of processed) {
      if (media.kind === "IMAGE") {
        const mainKey = listingMediaKey(owned.id, "webp");
        const thumbKey = listingMediaKey(owned.id, "webp", "thumb");
        await storage.put(mainKey, media.main.data);
        writtenKeys.push(mainKey);
        await storage.put(thumbKey, media.thumb.data);
        writtenKeys.push(thumbKey);
        rows.push({
          gemstoneId: owned.id,
          type: "IMAGE",
          fileKey: mainKey,
          thumbKey,
          mimeType: "image/webp",
          sizeBytes: media.main.data.length,
          width: media.main.width,
          height: media.main.height,
          status: "READY",
          sortOrder: 0,
        });
      } else {
        const key = listingMediaKey(owned.id, media.ext);
        await storage.put(key, media.data);
        writtenKeys.push(key);
        rows.push({
          gemstoneId: owned.id,
          type: "VIDEO",
          fileKey: key,
          thumbKey: null,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          status: "READY",
          sortOrder: 0,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      // Serialise media writes per listing: the row lock makes the limit check and the insert one step.
      await tx.$queryRaw`SELECT "id" FROM "Gemstone" WHERE "id" = ${owned.id} FOR UPDATE`;
      const current = await tx.gemstoneMedia.findMany({
        where: { gemstoneId: owned.id },
        select: { type: true, isCover: true, sortOrder: true },
      });
      const check = checkMediaBatch(
        { images: current.filter((m) => m.type === "IMAGE").length, videos: current.filter((m) => m.type === "VIDEO").length },
        incoming,
      );
      if (!check.ok) throw new MediaLimitError(check.reason);

      let nextOrder = current.reduce((max, m) => Math.max(max, m.sortOrder + 1), 0);
      const hasCover = current.some((m) => m.type === "IMAGE" && m.isCover);
      let coverAssigned = hasCover;
      for (const row of rows) {
        row.sortOrder = nextOrder++;
        if (row.type === "IMAGE" && !coverAssigned) {
          row.isCover = true;
          coverAssigned = true;
        }
      }
      await tx.gemstoneMedia.createMany({ data: rows });
    });
  } catch (error) {
    await deleteObjects(writtenKeys);
    if (error instanceof MediaLimitError) return { error: mediaBatchMessage(error.reason) };
    console.error("[seller-catalogue] media upload failed", error);
    return { error: "The upload could not be saved. Try again." };
  }

  revalidateListing(owned.id);
  return { message: `Added ${processed.length} file${processed.length === 1 ? "" : "s"}.` };
}

class MediaLimitError extends Error {
  constructor(readonly reason: "too_many_images" | "too_many_videos" | "image_too_large" | "video_too_large" | "empty_batch") {
    super(reason);
  }
}

function mediaBatchMessage(reason: string): string {
  switch (reason) {
    case "too_many_images":
      return `A listing can have up to ${MEDIA_LIMITS.maxImages} images.`;
    case "too_many_videos":
      return `A listing can have up to ${MEDIA_LIMITS.maxVideos} videos.`;
    case "image_too_large":
      return `Images must be ${MEDIA_LIMITS.maxImageBytes / (1024 * 1024)} MB or smaller.`;
    case "video_too_large":
      return `Videos must be ${MEDIA_LIMITS.maxVideoBytes / (1024 * 1024)} MB or smaller.`;
    default:
      return "Choose at least one image or video.";
  }
}

async function loadMediaItems(tx: Prisma.TransactionClient, gemstoneId: string): Promise<MediaItem[]> {
  return tx.gemstoneMedia.findMany({
    where: { gemstoneId },
    select: { id: true, type: true, sortOrder: true, isCover: true },
  });
}

export async function moveMediaAction(formData: FormData): Promise<void> {
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const listingId = idSchema.parse(text(formData, "listingId"));
  const mediaId = idSchema.parse(text(formData, "mediaId"));
  const direction = text(formData, "direction") === "up" ? "up" : "down";
  const owned = await findOwnedListing(listingId, user.id);
  const media = await findOwnedMedia(mediaId, user.id);
  if (!owned || !media || media.gemstoneId !== owned.id) notFound();

  await prisma.$transaction(async (tx) => {
    const items = await loadMediaItems(tx, owned.id);
    const next = moveItem(sortMedia(items).map((m) => m.id), mediaId, direction);
    if (!next) return;
    for (const { id, sortOrder } of sortOrderAssignments(next)) {
      await tx.gemstoneMedia.update({ where: { id }, data: { sortOrder } });
    }
  });
  revalidateListing(owned.id);
}

export async function setCoverAction(formData: FormData): Promise<void> {
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const listingId = idSchema.parse(text(formData, "listingId"));
  const mediaId = idSchema.parse(text(formData, "mediaId"));
  const owned = await findOwnedListing(listingId, user.id);
  const media = await findOwnedMedia(mediaId, user.id);
  if (!owned || !media || media.gemstoneId !== owned.id) notFound();

  await prisma.$transaction(async (tx) => {
    const items = await loadMediaItems(tx, owned.id);
    const plan = applyCover(items, mediaId);
    if (!plan) return;
    // Clear every cover first, then set the target. Both writes are in one transaction.
    await tx.gemstoneMedia.updateMany({ where: { gemstoneId: owned.id, isCover: true }, data: { isCover: false } });
    await tx.gemstoneMedia.update({ where: { id: mediaId }, data: { isCover: true } });
  });
  revalidateListing(owned.id);
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const listingId = idSchema.parse(text(formData, "listingId"));
  const mediaId = idSchema.parse(text(formData, "mediaId"));
  const owned = await findOwnedListing(listingId, user.id);
  const media = await findOwnedMedia(mediaId, user.id);
  if (!owned || !media || media.gemstoneId !== owned.id) notFound();

  await prisma.$transaction(async (tx) => {
    const items = await loadMediaItems(tx, owned.id);
    const promote = coverPromotionAfterRemoval(items, mediaId);
    await tx.gemstoneMedia.delete({ where: { id: mediaId } });
    if (promote) await tx.gemstoneMedia.update({ where: { id: promote }, data: { isCover: true } });
  });
  await deleteObjects([media.fileKey, media.thumbKey]);
  revalidateListing(owned.id);
}

// ---------- Documents ----------

export async function uploadDocumentAction(_previous: DocumentUploadState, formData: FormData): Promise<DocumentUploadState> {
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const listingId = idSchema.safeParse(text(formData, "listingId"));
  if (!listingId.success) return { error: "Listing not found." };
  const owned = await findOwnedListing(listingId.data, user.id);
  if (!owned) return { error: "Listing not found." };

  const type = z.enum(DOCUMENT_TYPES).safeParse(text(formData, "type"));
  if (!type.success) return { error: "Choose the document type." };
  const title = z.string().trim().min(2, "Enter a title.").max(120).safeParse(text(formData, "title"));
  if (!title.success) return { error: "Enter a title of 2 to 120 characters." };
  const labRaw = text(formData, "certificateLabId");
  let certificateLabId: string | null = null;
  if (labRaw) {
    const labs = await loadActiveCertificateLabs();
    if (!labs.some((lab) => lab.id === labRaw)) return { error: "Choose a certificate lab from the list." };
    certificateLabId = labRaw;
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF, JPEG or PNG file." };
  if (file.size > getEnv().UPLOAD_MAX_MB * 1024 * 1024) return { error: uploadErrorMessage("too_large") };
  const bytes = Buffer.from(await file.arrayBuffer());
  const checked = validateUpload(bytes);
  if (!checked.ok) return { error: uploadErrorMessage(checked.reason) };

  const key = listingDocumentKey(owned.id, checked.ext);
  await getStorageProvider().put(key, bytes);
  try {
    // Count and insert under a row lock on the listing, so parallel uploads cannot exceed the cap.
    const saved = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Gemstone" WHERE "id" = ${owned.id} FOR UPDATE`;
      const count = await tx.listingDocument.count({ where: { gemstoneId: owned.id } });
      if (!canAddDocument(count)) return false;
      await tx.listingDocument.create({
        data: {
          gemstoneId: owned.id,
          type: type.data,
          title: title.data,
          fileKey: key,
          // Display name only. It never reaches a storage key.
          fileName: sanitizeFileName(file.name),
          mimeType: checked.mimeType,
          sizeBytes: checked.sizeBytes,
          certificateLabId,
          isPublic: false,
          verificationStatus: "PENDING",
        },
      });
      return true;
    });
    if (!saved) {
      await deleteObjects([key]);
      return { error: "A listing can have up to 10 documents." };
    }
  } catch (error) {
    await deleteObjects([key]);
    console.error("[seller-catalogue] document save failed", error);
    return { error: "The document could not be saved. Try again." };
  }

  revalidateListing(owned.id);
  return { message: "Document uploaded. It stays private until an administrator verifies it." };
}

export async function toggleDocumentPublicAction(formData: FormData): Promise<void> {
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const listingId = idSchema.parse(text(formData, "listingId"));
  const documentId = idSchema.parse(text(formData, "documentId"));
  const owned = await findOwnedListing(listingId, user.id);
  const doc = await findOwnedDocument(documentId, user.id);
  if (!owned || !doc || doc.gemstoneId !== owned.id) notFound();

  await prisma.listingDocument.updateMany({
    where: { id: doc.id, gemstone: { seller: { userId: user.id } } },
    data: { isPublic: text(formData, "isPublic") === "true" },
  });
  revalidateListing(owned.id);
}

export async function deleteDocumentAction(formData: FormData): Promise<void> {
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const listingId = idSchema.parse(text(formData, "listingId"));
  const documentId = idSchema.parse(text(formData, "documentId"));
  const owned = await findOwnedListing(listingId, user.id);
  const doc = await findOwnedDocument(documentId, user.id);
  if (!owned || !doc || doc.gemstoneId !== owned.id) notFound();
  if (!canSellerDeleteDocument(doc)) return;

  const removed = await prisma.listingDocument.deleteMany({
    where: { id: doc.id, verificationStatus: { not: "VERIFIED" }, gemstone: { seller: { userId: user.id } } },
  });
  // Remove the file only when the row was actually deleted (an admin may have verified it meanwhile).
  if (removed.count === 1) await deleteObjects([doc.fileKey]);
  revalidateListing(owned.id);
}
