"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeRequirementAction } from "@/app/buyer/requirements/actions";

/** Closes an open requirement. The server checks ownership and status. Closing is final for responses. */
export function CloseRequirementButton({ requirementId }: { requirementId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (!window.confirm("Close this requirement? Sellers will no longer be able to respond to it.")) return;
    setError(null);
    startTransition(async () => {
      const result = await closeRequirementAction(requirementId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={close}
        disabled={pending}
        className=" border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-accent-soft/40 disabled:opacity-60"
      >
        {pending ? "Closing..." : "Close requirement"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
