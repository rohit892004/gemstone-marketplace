"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Submit button that disables itself while the parent form's action is pending. */
export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
