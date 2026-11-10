"use client";

import { useState } from "react";

/** A read-only link field with a copy button. The copied text is also announced in a status line. */
export function CopyLink({ id, label, value }: { id: string; label: string; value: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 border border-line bg-surface-raised px-4 py-2.5 text-sm text-ink"
        />
        <button
          type="button"
          onClick={copy}
          className="min-h-11 border border-brand px-5 py-2.5 text-sm font-medium text-ink hover:bg-accent-soft"
        >
          Copy link
        </button>
      </div>
      <p role="status" className="text-xs text-ink-soft">
        {status === "copied" ? "Link copied." : status === "failed" ? "Copy did not work. Select the link and copy it by hand." : ""}
      </p>
    </div>
  );
}
