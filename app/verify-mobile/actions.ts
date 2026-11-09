"use server";

import { headers } from "next/headers";
import { confirmMobileOtp, sendMobileOtp } from "@/lib/auth/flows/mobile-otp";
import type { FormState } from "@/lib/auth/flows/form-state";
import { MESSAGES } from "@/lib/auth/flows/messages";
import { checkRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/security/client-ip";
import { otpSchema } from "@/lib/validation/schemas";

const ANY_SIGNED_IN_ROLE = ["BUYER", "SELLER", "ADMIN"] as const;

/** Sends (or re-sends) a 6-digit code to the mobile number on the account. */
export async function sendMobileCode(): Promise<FormState> {
  const access = await checkRole(ANY_SIGNED_IN_ROLE);
  if (!access.ok) return { error: "Sign in to verify your mobile number." };

  const record = await prisma.user.findUnique({ where: { id: access.user.id }, select: { mobile: true } });
  if (!record?.mobile) return { error: "Add a mobile number to your account first." };

  try {
    const ip = getClientIp(await headers());
    const result = await sendMobileOtp(access.user.id, record.mobile, ip);
    if (result === "limited") return { error: MESSAGES.tooManyAttempts };
    return { notice: "We've sent a 6-digit code by text message. It expires in 10 minutes." };
  } catch (error) {
    console.error("[otp] send failed", error);
    return { error: MESSAGES.genericError };
  }
}

/** Checks the code. Confirms the mobile number on success. */
export async function verifyMobileCode(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await checkRole(ANY_SIGNED_IN_ROLE);
  if (!access.ok) return { error: "Sign in to verify your mobile number." };

  const raw = String(formData.get("code") ?? "").replace(/\s/g, "");
  const parsed = otpSchema.safeParse({ code: raw });
  if (!parsed.success) {
    return { fieldErrors: { code: "Enter the 6-digit code" }, values: { code: raw } };
  }

  const ip = getClientIp(await headers());
  const result = await confirmMobileOtp(access.user.id, parsed.data.code, ip);
  if (result === "verified") {
    return { done: true, notice: "Your mobile number is verified." };
  }
  if (result === "limited") return { error: MESSAGES.tooManyAttempts };
  return { error: MESSAGES.invalidCode };
}
