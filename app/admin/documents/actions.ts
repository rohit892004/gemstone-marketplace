"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { CATALOGUE_AUDIT, recordCatalogueAudit } from "@/lib/admin-catalogue/audit";
import { catalogueTemplates } from "@/lib/admin-catalogue/templates";
import { documentIdSchema, documentRejectSchema } from "@/lib/admin-catalogue/schemas";
import type { AdminActionState } from "@/lib/admin/action-state";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { getEmailProvider } from "@/lib/notify/email";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Listing document verification. Verifying sets verificationStatus ONLY. It never changes isPublic:
 * the seller decides whether a document is shown on the listing. The update below never names isPublic.
 */

const STALE_DOCUMENT_ERROR = "This document was already decided. Reload the page and try again.";

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function documentContext(documentId: string) {
  return prisma.listingDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      title: true,
      gemstone: {
        select: {
          title: true,
          seller: { select: { businessName: true, user: { select: { email: true, name: true } } } },
        },
      },
    },
  });
}

export async function verifyListingDocument(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = documentIdSchema.safeParse({ documentId: formValue(formData, "documentId") });
  if (!parsed.success) return { ok: false, error: "Invalid document." };
  const { documentId } = parsed.data;

  const doc = await documentContext(documentId);
  if (!doc) return { ok: false, error: "Document not found." };

  const result = await prisma.listingDocument.updateMany({
    where: { id: documentId, verificationStatus: "PENDING" },
    data: { verificationStatus: "VERIFIED", verifiedById: admin.id, verifiedAt: new Date(), verificationReason: null },
  });
  if (result.count === 0) return { ok: false, error: STALE_DOCUMENT_ERROR };

  await recordCatalogueAudit({
    action: CATALOGUE_AUDIT.DOCUMENT_VERIFIED,
    actorId: admin.id,
    entityType: "ListingDocument",
    entityId: documentId,
    ip: getClientIp(await headers()),
  });

  try {
    const mail = catalogueTemplates.documentVerified(
      doc.gemstone.seller.user.name ?? doc.gemstone.seller.businessName,
      doc.title,
      doc.gemstone.title,
    );
    await getEmailProvider().send({ to: doc.gemstone.seller.user.email, subject: mail.subject, text: mail.text });
  } catch (error) {
    console.error("[admin] document verified email failed", documentId, error);
  }

  revalidatePath("/admin/documents");
  return { ok: true, message: "Document verified. The seller has been emailed. It stays private until the seller shows it." };
}

export async function rejectListingDocument(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = documentRejectSchema.safeParse({
    documentId: formValue(formData, "documentId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { documentId, reason } = parsed.data;

  const doc = await documentContext(documentId);
  if (!doc) return { ok: false, error: "Document not found." };

  const result = await prisma.listingDocument.updateMany({
    where: { id: documentId, verificationStatus: "PENDING" },
    data: {
      verificationStatus: "REJECTED",
      verificationReason: reason,
      verifiedById: admin.id,
      verifiedAt: new Date(),
    },
  });
  if (result.count === 0) return { ok: false, error: STALE_DOCUMENT_ERROR };

  await recordCatalogueAudit({
    action: CATALOGUE_AUDIT.DOCUMENT_REJECTED,
    actorId: admin.id,
    entityType: "ListingDocument",
    entityId: documentId,
    ip: getClientIp(await headers()),
  });

  try {
    const mail = catalogueTemplates.documentRejected(
      doc.gemstone.seller.user.name ?? doc.gemstone.seller.businessName,
      doc.title,
      doc.gemstone.title,
      reason,
    );
    await getEmailProvider().send({ to: doc.gemstone.seller.user.email, subject: mail.subject, text: mail.text });
  } catch (error) {
    console.error("[admin] document rejected email failed", documentId, error);
  }

  revalidatePath("/admin/documents");
  return { ok: true, message: "Document rejected. The seller has been emailed the reason." };
}
