"use client";

import { useActionState } from "react";
import { sendMobileCode, verifyMobileCode } from "@/app/verify-mobile/actions";
import type { FormState } from "@/lib/auth/flows/form-state";
import { Notice, TextField } from "./fields";
import { SubmitButton } from "./submit-button";

const initialState: FormState = {};

/** Requests a code by SMS. Used for the first send and for resend. */
export function SendMobileCodeForm({ label }: { label: string }) {
  const [state, formAction] = useActionState(sendMobileCode, initialState);
  return (
    <form action={formAction} className="space-y-4">
      {state.notice ? <Notice tone="success">{state.notice}</Notice> : null}
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <SubmitButton pendingLabel="Sending...">{label}</SubmitButton>
    </form>
  );
}

/** Enter the 6-digit code from the SMS. */
export function VerifyMobileCodeForm() {
  const [state, formAction] = useActionState(verifyMobileCode, initialState);
  if (state.done) {
    return <Notice tone="success">{state.notice ?? "Your mobile number is verified."}</Notice>;
  }
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <TextField
        name="code"
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        defaultValue={state.values?.code}
        error={state.fieldErrors?.code}
      />
      <SubmitButton pendingLabel="Checking...">Verify code</SubmitButton>
    </form>
  );
}
