"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { formString } from "@/lib/valuation/action-helpers";
import type { ValuationActionState } from "@/lib/valuation/form-state";
import {
  addMultiplier,
  importReferencePriceCsv,
  saveEditedPrices,
  saveMultiplierPercents,
  savePriceRow,
} from "@/lib/valuation/admin-prices";

/**
 * Reference price table, multipliers and CSV import. Admin only. Every write is audited in the services.
 * The page refreshes after each change.
 */

const PAGE = "/admin/valuations/prices";
/** A CSV upload larger than this is refused before it is read. */
const MAX_CSV_BYTES = 1024 * 1024;

export async function savePricesAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const updates: Array<{ id: string; priceMajor: string }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("price:") || typeof value !== "string") continue;
    updates.push({ id: key.slice("price:".length), priceMajor: value.trim() });
  }
  if (updates.length === 0) return { ok: false, error: "There are no prices to save." };
  const result = await saveEditedPrices({ admin: { id: admin.id }, updates });
  if (!result.ok) return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  revalidatePath(PAGE);
  return {
    ok: true,
    message: result.changed === 0 ? "No prices changed." : `Saved ${result.changed} price${result.changed === 1 ? "" : "s"}. They are now real data, not demo.`,
  };
}

export async function addPriceRowAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const cell = {
    gemstoneType: formString(formData, "gemstoneType"),
    currency: formString(formData, "currency"),
    qualityGrade: formString(formData, "qualityGrade"),
    band: formString(formData, "band"),
    priceMajor: formString(formData, "priceMajor").trim(),
  };
  const result = await savePriceRow({ admin: { id: admin.id }, cell });
  if (!result.ok) return { ok: false, error: result.error, values: cell };
  revalidatePath(PAGE);
  return { ok: true, message: "Price saved for that type, currency, grade and band." };
}

export async function importPricesAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a CSV file to import.", fieldErrors: { file: "Choose a CSV file." } };
  }
  if (file.size > MAX_CSV_BYTES) {
    return { ok: false, error: "The file is larger than 1 MB. Split it and import the parts.", fieldErrors: { file: "The file is too large." } };
  }
  const text = await file.text();
  const result = await importReferencePriceCsv({ admin: { id: admin.id }, text });
  if (!result.ok) {
    const errors = result.errors.map((e) => (e.line > 0 ? `Line ${e.line}: ${e.message}` : e.message));
    return {
      ok: false,
      error: `Nothing was imported. ${errors.length} problem${errors.length === 1 ? "" : "s"} found. Fix them and upload the file again.`,
      errors,
    };
  }
  revalidatePath(PAGE);
  return { ok: true, message: `Imported ${result.rows} price row${result.rows === 1 ? "" : "s"}. They are now real data, not demo.` };
}

export async function saveMultipliersAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const updates: Array<{ id: string; percent: string }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("pct:") || typeof value !== "string") continue;
    updates.push({ id: key.slice("pct:".length), percent: value.trim() });
  }
  const result = await saveMultiplierPercents({ admin: { id: admin.id }, updates });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(PAGE);
  return { ok: true, message: result.value === 0 ? "No multipliers changed." : `Saved ${result.value} multiplier${result.value === 1 ? "" : "s"}.` };
}

export async function addMultiplierAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const values = {
    kind: formString(formData, "kind"),
    key: formString(formData, "key"),
    label: formString(formData, "label"),
    percent: formString(formData, "percent").trim(),
  };
  const result = await addMultiplier({ admin: { id: admin.id }, ...values });
  if (!result.ok) return { ok: false, error: result.error, values };
  revalidatePath(PAGE);
  return { ok: true, message: "Multiplier added." };
}
