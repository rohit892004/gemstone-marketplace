"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/lib/auth/auth";
import { loginMessageForCode, INVALID_LOGIN_MESSAGE, safeNextPath } from "@/lib/auth/flows/login";
import type { FormState } from "@/lib/auth/flows/form-state";
import { loginSchema } from "@/lib/validation/schemas";

/**
 * Credentials login. On success Auth.js redirects to `next` (sanitised, relative only).
 * On failure Auth.js throws an AuthError; its CredentialsSignin `code` is mapped to a message.
 * Rate limiting and account checks happen inside the Credentials authorize function.
 */
export async function loginWithPassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { error: INVALID_LOGIN_MESSAGE, values: { email } };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: next,
    });
  } catch (error) {
    // Success throws a Next redirect, which is not an AuthError, so it is rethrown below.
    if (error instanceof AuthError) {
      const code = error instanceof CredentialsSignin ? error.code : undefined;
      return { error: loginMessageForCode(code), values: { email: parsed.data.email } };
    }
    throw error;
  }

  return {};
}
