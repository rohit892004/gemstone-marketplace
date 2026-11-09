"use client";

import { useActionState } from "react";
import { forgotPassword } from "@/app/forgot-password/actions";
import type { FormState } from "@/lib/auth/flows/form-state";
import { Notice, TextField } from "./fields";
import { SubmitButton } from "./submit-button";

const initialState: FormState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPassword, initialState);

  if (state.done && state.notice) {
    return <Notice tone="success">{state.notice}</Notice>;
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Sending...">Send reset link</SubmitButton>
    </form>
  );
}
