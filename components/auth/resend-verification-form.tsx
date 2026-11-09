"use client";

import { useActionState } from "react";
import { resendVerification } from "@/app/check-email/actions";
import type { FormState } from "@/lib/auth/flows/form-state";
import { Notice, TextField } from "./fields";
import { SubmitButton } from "./submit-button";

const initialState: FormState = {};

export function ResendVerificationForm() {
  const [state, formAction] = useActionState(resendVerification, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.notice ? <Notice tone="success">{state.notice}</Notice> : null}
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Sending...">Resend verification link</SubmitButton>
    </form>
  );
}
