"use client";

import { useActionState } from "react";
import { registerBuyer } from "@/app/register/buyer/actions";
import { BUYER_COUNTRIES } from "@/lib/auth/flows/countries";
import type { FormState } from "@/lib/auth/flows/form-state";
import { Notice, SelectField, TextField } from "./fields";
import { SubmitButton } from "./submit-button";

const initialState: FormState = {};

export function RegisterBuyerForm() {
  const [state, formAction] = useActionState(registerBuyer, initialState);
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <TextField name="name" label="Full name" autoComplete="name" defaultValue={values.name} error={errors.name} />
      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={values.email}
        error={errors.email}
      />
      <TextField
        name="mobile"
        label="Mobile number"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        defaultValue={values.mobile}
        error={errors.mobile}
        hint="Include the country code, for example +91 98123 45678. We text a code to confirm it."
      />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        error={errors.password}
        hint="At least 10 characters, with a letter and a number."
      />
      <SelectField
        name="country"
        label="Country"
        options={BUYER_COUNTRIES}
        defaultValue={values.country || "India"}
        error={errors.country}
      />

      <SubmitButton pendingLabel="Creating account...">Create buyer account</SubmitButton>
    </form>
  );
}
