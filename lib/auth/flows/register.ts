import { z } from "zod";
import { registerAccount } from "@/lib/auth/register";
import { buyerRegisterSchema } from "@/lib/validation/schemas";
import { isBuyerCountry } from "./countries";
import type { FormState } from "./form-state";
import { MESSAGES } from "./messages";
import { LIMITS, withinHourlyLimit } from "./limits";

export const BUYER_REGISTER_FIELDS = ["name", "email", "mobile", "password", "country"] as const;

export type BuyerRegistrationResult = { ok: true } | { ok: false; state: FormState };

/**
 * Buyer sign-up. Returns the same { ok: true } for a new account AND for an existing
 * email (registerAccount handles the duplicate and emails the account owner), so the
 * response never reveals whether the address is registered.
 */
export async function submitBuyerRegistration(
  raw: Record<string, string>,
  ip: string,
): Promise<BuyerRegistrationResult> {
  const values = {
    name: raw.name ?? "",
    email: raw.email ?? "",
    mobile: raw.mobile ?? "",
    country: raw.country ?? "",
  };

  if (!(await withinHourlyLimit(`register:ip:${ip}`, LIMITS.register.ip))) {
    return { ok: false, state: { error: MESSAGES.tooManyAttempts, values } };
  }

  const parsed = buyerRegisterSchema.safeParse({
    name: raw.name,
    email: raw.email,
    mobile: raw.mobile,
    password: raw.password,
    country: raw.country,
  });
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      Object.entries(z.flattenError(parsed.error).fieldErrors).map(([field, messages]) => [
        field,
        messages?.[0] ?? "Check this field",
      ]),
    );
    return { ok: false, state: { fieldErrors, values, error: "Please fix the highlighted fields." } };
  }
  if (!isBuyerCountry(parsed.data.country)) {
    return { ok: false, state: { fieldErrors: { country: "Select a country from the list" }, values } };
  }

  const { name, email, mobile, password, country } = parsed.data;
  await registerAccount({
    role: "BUYER",
    email,
    mobile,
    name,
    password,
    country,
    ip,
    createProfile: async (tx, user) => {
      await tx.buyerProfile.create({ data: { userId: user.id, name, country } });
    },
  });

  return { ok: true };
}
