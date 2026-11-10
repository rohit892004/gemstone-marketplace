"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClasses } from "@/components/ui/button";

/** Submit button that disables itself while the parent form's action is pending. */
export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses({ block: true, size: "lg", className: "min-h-11" })}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
