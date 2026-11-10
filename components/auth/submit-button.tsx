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
      className="inline-flex min-h-11 w-full items-center justify-center bg-brand px-6 py-3 text-sm tracking-wide text-ivory transition duration-300 hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
