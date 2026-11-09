"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { AVAILABILITY_VALUES } from "@/lib/listings/schema";

export interface InventoryActionState {
  error?: string;
  message?: string;
}

const idsSchema = z.array(z.string().min(1).max(64)).min(1, "Select at least one listing.").max(200);
const availabilitySchema = z.enum(AVAILABILITY_VALUES, { message: "Choose an availability." });
const quantitySchema = z.coerce.number().int().min(1, "Quantity must be at least 1.").max(10000);

/** Sets availability for the selected listings. Every row is scoped to the signed-in seller. */
export async function bulkAvailabilityAction(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const ids = idsSchema.safeParse(formData.getAll("ids").filter((v): v is string => typeof v === "string"));
  if (!ids.success) return { error: ids.error.issues[0]?.message ?? "Select at least one listing." };
  const availability = availabilitySchema.safeParse(formData.get("availability"));
  if (!availability.success) return { error: "Choose an availability." };

  const result = await prisma.gemstone.updateMany({
    where: { id: { in: ids.data }, seller: { userId: user.id } },
    data: { availability: availability.data },
  });
  revalidatePath("/seller/inventory");
  revalidatePath("/seller/listings");
  return { message: `Updated ${result.count} listing${result.count === 1 ? "" : "s"}.` };
}

/** Inline quantity edit for one listing. */
export async function updateQuantityAction(_previous: InventoryActionState, formData: FormData): Promise<InventoryActionState> {
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const id = z.string().min(1).max(64).safeParse(formData.get("listingId"));
  if (!id.success) return { error: "Listing not found." };
  const quantity = quantitySchema.safeParse(formData.get("quantity"));
  if (!quantity.success) return { error: quantity.error.issues[0]?.message ?? "Enter a valid quantity." };

  const result = await prisma.gemstone.updateMany({
    where: { id: id.data, seller: { userId: user.id } },
    data: { quantity: quantity.data },
  });
  if (result.count !== 1) return { error: "Listing not found." };
  revalidatePath("/seller/inventory");
  revalidatePath("/seller/listings");
  return { message: "Quantity saved." };
}
