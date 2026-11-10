import type { ContactField } from "./schema";

/** Result of the contact form action. Kept out of the "use server" file, which may only export async functions. */
export type ContactFormState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; formError?: string; fieldErrors: Partial<Record<ContactField, string>> };

export const CONTACT_FORM_IDLE: ContactFormState = { status: "idle" };
