import { randomBytes } from "node:crypto";
import type { Prisma } from "@/app/generated/prisma/client";
import { registerAccount } from "@/lib/auth/register";
import { loadSellerCategories } from "@/lib/seller/categories";
import { loadActiveCertificateLabs } from "@/lib/seller/labs";
import { generateSellerSlug } from "@/lib/seller/slug";
import type { FieldErrors, SellerRegistrationInput, ValidatedFile } from "@/lib/seller/types";
import { validateSellerRegistration } from "@/lib/seller/validate";
import { getStorageProvider } from "@/lib/storage/storage";
import { consumeRateLimit } from "@/lib/security/rate-limit";

/**
 * Seller registration: validate, create the account + SellerProfile + SellerDocument rows in
 * one transaction, and store the private files inside that transaction. Files are not
 * transactional, so every key written is tracked and deleted if the registration fails or the
 * email already exists.
 */

export const REGISTER_IP_LIMIT = 10;
export const REGISTER_WINDOW_SECONDS = 60 * 60;

export type RegisterSellerResult =
  | { ok: true; /** The new account's id. Null when the email already had an account (nothing was created). */ userId: string | null }
  | { ok: false; reason: "validation"; fieldErrors: FieldErrors }
  | { ok: false; reason: "rate_limited" }
  | { ok: false; reason: "failed" };

type DocumentKind = "ID_PROOF" | "BUSINESS_PROOF" | "CERTIFICATE";

const KIND_SLUG: Record<DocumentKind, string> = {
  ID_PROOF: "id-proof",
  BUSINESS_PROOF: "business-proof",
  CERTIFICATE: "certificate",
};

/** Opaque key: never derived from the user's file name. */
export function buildDocumentKey(kind: DocumentKind, ext: string): string {
  return `sellers/${randomBytes(12).toString("hex")}/${KIND_SLUG[kind]}-${randomBytes(8).toString("hex")}.${ext}`;
}

async function deleteKeys(keys: readonly string[]): Promise<void> {
  const storage = getStorageProvider();
  for (const key of keys) {
    try {
      await storage.delete(key);
    } catch (error) {
      console.error("[seller] failed to clean up stored file", error);
    }
  }
}

export async function registerSeller(
  input: SellerRegistrationInput,
  options: { ip: string | null },
): Promise<RegisterSellerResult> {
  const ip = options.ip ?? "unknown";
  const limit = await consumeRateLimit({
    key: `register:ip:${ip}`,
    limit: REGISTER_IP_LIMIT,
    windowSeconds: REGISTER_WINDOW_SECONDS,
  });
  if (!limit.allowed) return { ok: false, reason: "rate_limited" };

  const [labs, categories] = await Promise.all([loadActiveCertificateLabs(), loadSellerCategories()]);
  const validated = validateSellerRegistration(input, labs, categories);
  if (!validated.ok) return { ok: false, reason: "validation", fieldErrors: validated.fieldErrors };
  const { account, business, categoryIds, idProof, businessProof, certificates } = validated.value;

  // Keys written so far, across the callback and any retry. Deleted on failure or EXISTING.
  const writtenKeys: string[] = [];

  const storeDocument = async (
    tx: Prisma.TransactionClient,
    sellerId: string,
    kind: DocumentKind,
    file: ValidatedFile,
    certificate: { labId: string | null; labOther: string | null },
  ) => {
    const key = buildDocumentKey(kind, file.ext);
    writtenKeys.push(key); // tracked before the write so a partial write is also cleaned up
    await getStorageProvider().put(key, file.data);
    await tx.sellerDocument.create({
      data: {
        sellerId,
        type: kind,
        fileKey: key,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        certificateLabId: certificate.labId,
        certificateLabOther: certificate.labOther,
      },
    });
  };

  const findFreeSlug = async (tx: Prisma.TransactionClient): Promise<string> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = generateSellerSlug(business.businessName);
      const taken = await tx.sellerProfile.findUnique({ where: { slug }, select: { id: true } });
      if (!taken) return slug;
    }
    return generateSellerSlug(business.businessName, randomBytes(6).toString("hex"));
  };

  let outcome: "CREATED" | "EXISTING";
  let createdUserId: string | null = null;
  try {
    const result = await registerAccount({
      role: "SELLER",
      email: account.email,
      mobile: account.mobile,
      name: account.name,
      password: account.password,
      country: account.country,
      ip: options.ip,
      createProfile: async (tx, user) => {
        createdUserId = user.id;
        const profile = await tx.sellerProfile.create({
          data: {
            userId: user.id,
            businessName: business.businessName,
            businessType: business.businessType,
            gstNumber: business.gstNumber ?? null,
            addressLine: business.addressLine,
            city: business.city,
            state: business.state,
            country: business.country,
            pincode: business.pincode ?? null,
            yearsInBusiness: business.yearsInBusiness,
            specialties: business.specialties,
            // Kept on every status: pending and rejected applications keep their categories.
            categories: { connect: categoryIds.map((id) => ({ id })) },
            slug: await findFreeSlug(tx),
            // approvalStatus defaults to PENDING in the schema.
          },
          select: { id: true },
        });

        await storeDocument(tx, profile.id, "ID_PROOF", idProof, { labId: null, labOther: null });
        await storeDocument(tx, profile.id, "BUSINESS_PROOF", businessProof, { labId: null, labOther: null });
        for (const certificate of certificates) {
          await storeDocument(tx, profile.id, "CERTIFICATE", certificate.file, {
            labId: certificate.labId,
            labOther: certificate.labOther,
          });
        }
      },
    });
    outcome = result.outcome;
  } catch (error) {
    await deleteKeys(writtenKeys);
    console.error("[seller] registration failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, reason: "failed" };
  }

  // Duplicate email: no documents may be kept. The caller still gets the generic success.
  if (outcome === "EXISTING") await deleteKeys(writtenKeys);

  return { ok: true, userId: outcome === "CREATED" ? createdUserId : null };
}
