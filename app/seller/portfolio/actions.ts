"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { MEDIA_LIMITS } from "@/lib/listings/schema";
import { MEDIA_ERROR_TEXT, processMedia } from "@/lib/media/pipeline";
import { portfolioImageKey } from "@/lib/seller-catalogue/keys";
import { validatePortfolioText, type PortfolioField } from "@/lib/seller/portfolio";
import { getStorageProvider } from "@/lib/storage/storage";

export interface PortfolioFormState {
  fieldErrors?: Partial<Record<PortfolioField | "logo" | "banner", string>>;
  formError?: string;
  values?: Record<string, string>;
  saved?: boolean;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Reads an optional image. Returns null when no file was chosen. */
async function readImage(
  formData: FormData,
  key: "logo" | "banner",
  sellerId: string,
): Promise<{ ok: true; key: string | null } | { ok: false; error: string }> {
  const file = formData.get(key);
  if (!(file instanceof File) || file.size === 0) return { ok: true, key: null };
  if (file.size > MEDIA_LIMITS.maxImageBytes) return { ok: false, error: "Images must be 15 MB or smaller." };

  const result = await processMedia(Buffer.from(await file.arrayBuffer()));
  if (!result.ok) return { ok: false, error: MEDIA_ERROR_TEXT[result.reason] };
  if (result.media.kind !== "IMAGE") return { ok: false, error: "Upload an image file." };

  const storageKey = portfolioImageKey(sellerId, key);
  await getStorageProvider().put(storageKey, result.media.main.data);
  return { ok: true, key: storageKey };
}

export async function savePortfolioAction(
  _previous: PortfolioFormState,
  formData: FormData,
): Promise<PortfolioFormState> {
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, logoKey: true, bannerKey: true },
  });
  if (!seller) return { formError: "Your seller profile could not be found." };

  const values = {
    tagline: text(formData, "tagline"),
    description: text(formData, "description"),
    specialties: text(formData, "specialties"),
  };
  const parsed = validatePortfolioText(values);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values, formError: "Please correct the highlighted fields." };

  const logo = await readImage(formData, "logo", seller.id);
  if (!logo.ok) return { fieldErrors: { logo: logo.error }, values, formError: "Please correct the highlighted fields." };
  const banner = await readImage(formData, "banner", seller.id);
  if (!banner.ok) {
    if (logo.key) await getStorageProvider().delete(logo.key).catch(() => undefined);
    return { fieldErrors: { banner: banner.error }, values, formError: "Please correct the highlighted fields." };
  }

  const newKeys = [logo.key, banner.key].filter((k): k is string => Boolean(k));
  try {
    // Only the portfolio fields and the new image keys are written. Business and GST fields are never touched here.
    await prisma.sellerProfile.update({
      where: { id: seller.id, userId: user.id },
      data: {
        tagline: parsed.value.tagline,
        description: parsed.value.description,
        specialties: { set: parsed.value.specialties },
        ...(logo.key ? { logoKey: logo.key } : {}),
        ...(banner.key ? { bannerKey: banner.key } : {}),
      },
    });
  } catch (error) {
    await Promise.all(newKeys.map((k) => getStorageProvider().delete(k).catch(() => undefined)));
    console.error("[portfolio] save failed", error);
    return { formError: "Your portfolio could not be saved. Try again.", values };
  }

  // Replaced images are removed after the new keys are saved.
  const replaced = [logo.key ? seller.logoKey : null, banner.key ? seller.bannerKey : null].filter(
    (k): k is string => Boolean(k),
  );
  await Promise.all(replaced.map((k) => getStorageProvider().delete(k).catch(() => undefined)));

  revalidatePath("/seller/portfolio");
  return { saved: true };
}
