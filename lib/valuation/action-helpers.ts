import { ValuationError } from "./service";
import type { ValuationActionState } from "./form-state";

/** Helpers for valuation server actions. Identities always come from the session; these only read form values. */

export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const ID_PATTERN = /^[a-z0-9]{8,64}$/i;

/** The valuation id from a hidden field. Anything that is not id-shaped is refused before the database is asked. */
export function formId(formData: FormData): string | null {
  const value = formString(formData, "valuationId");
  return ID_PATTERN.test(value) ? value : null;
}

/** Turns a ValuationError into a form state the form can show. Any other error is rethrown. */
export function serviceFailure(error: unknown, values?: Record<string, string>): ValuationActionState {
  if (error instanceof ValuationError) {
    return { ok: false, error: error.message, ...(values ? { values } : {}) };
  }
  throw error;
}

export const NOT_FOUND_STATE: ValuationActionState = { ok: false, error: "This valuation is not available." };
