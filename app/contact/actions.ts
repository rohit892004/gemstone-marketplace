"use server";

import { headers } from "next/headers";
import { checkRole } from "@/lib/auth/require-role";
import { contactSchema, type ContactField } from "@/lib/contact/schema";
import type { ContactFormState } from "@/lib/contact/state";
import { submitContactMessage } from "@/lib/contact/service";
import { getClientIp } from "@/lib/security/client-ip";

const FIELDS: ContactField[] = ["name", "email", "topic", "message"];

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Contact form. Order: honeypot, validation, contact-detail check, rate limit, send, audit. Validation and the
 * contact-detail check run before the rate limit, so only acceptable messages count against the hourly allowance.
 * Nothing is written to the database (except the audit row) and the message is never echoed back in the URL or the page.
 */
export async function submitContactAction(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  // Honeypot: bots fill every field. Answer as if sent, so they learn nothing and nothing is delivered.
  if (text(formData, "website").trim() !== "") return { status: "sent" };

  const parsed = contactSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    topic: text(formData, "topic"),
    message: text(formData, "message"),
    website: text(formData, "website"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const fieldErrors: Partial<Record<ContactField, string>> = {};
    for (const field of FIELDS) {
      const first = flat[field]?.[0];
      if (first) fieldErrors[field] = first;
    }
    return { status: "error", fieldErrors };
  }

  // Signed-in visitors are recorded by user id in the audit row. Anonymous visitors (the common case) get null.
  const access = await checkRole(["BUYER", "SELLER", "ADMIN", "VALUATOR"]);
  const actorId = access.ok ? access.user.id : null;

  const outcome = await submitContactMessage(parsed.data, getClientIp(await headers()), actorId);
  if (outcome.status === "sent") return { status: "sent" };
  if (outcome.status === "refused") return { status: "error", fieldErrors: outcome.fieldErrors };
  if (outcome.status === "rate_limited") {
    return {
      status: "error",
      fieldErrors: {},
      formError: "You have sent several messages recently. Please try again later.",
    };
  }
  return {
    status: "error",
    fieldErrors: {},
    formError: "We could not send your message right now. Please try again in a few minutes.",
  };
}
