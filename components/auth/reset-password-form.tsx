"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword } from "@/app/reset-password/actions";
import type { FormState } from "@/lib/auth/flows/form-state";
import { Notice, TextField } from "./fields";
import { SubmitButton } from "./submit-button";

const initialState: FormState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPassword, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <Notice tone="error">
          {state.error}
          {state.invalidLink ? (
            <>
              {" "}
              <Link href="/forgot-password" className="font-medium underline">
                Request a new link
              </Link>
            </>
          ) : null}
        </Notice>
      ) : null}

      {state.invalidLink ? null : (
        <>
          <TextField
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            error={state.fieldErrors?.password}
            hint="At least 10 characters, with a letter and a number."
          />
          <TextField
            name="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={state.fieldErrors?.confirmPassword}
          />
          <SubmitButton pendingLabel="Saving...">Set new password</SubmitButton>
        </>
      )}
    </form>
  );
}
