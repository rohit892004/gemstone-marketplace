"use server";

import { headers } from "next/headers";
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
 * Contact form. Order: honeypot, validation, rate limit, send. Validation runs before the rate limit so that
 * only well-formed messages count against the hourly allowance. Nothing is written to the database and the
 * message is never echoed back in the URL or the page.
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

  const outcome = await submitContactMessage(parsed.data, getClientIp(await headers()));
  if (outcome === "sent") return { status: "sent" };
  if (outcome === "rate_limited") {
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
