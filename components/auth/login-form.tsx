"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginWithPassword } from "@/app/login/actions";
import type { FormState } from "@/lib/auth/flows/form-state";
import { Notice, TextField } from "./fields";
import { SubmitButton } from "./submit-button";

const initialState: FormState = {};

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, formAction] = useActionState(loginWithPassword, initialState);
  const error = state.error ?? initialError;
  const values = state.values ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {error ? <Notice tone="error">{error}</Notice> : null}

      <TextField name="email" label="Email" type="email" autoComplete="email" defaultValue={values.email} />
      <TextField name="password" label="Password" type="password" autoComplete="current-password" />

      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="text-brand hover:text-brand-strong">
          Forgot password?
        </Link>
      </div>

      <SubmitButton pendingLabel="Logging in...">Log in</SubmitButton>
    </form>
  );
}
