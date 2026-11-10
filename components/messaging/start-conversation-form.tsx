"use client";

import { Textarea } from "@/components/ui/field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/messaging/action-helpers";

/**
 * First message form for a new conversation (enquiry on a listing, or contact with a seller).
 * The caller passes the server action wrapper. The server checks identity, membership and moderation.
 * Message text is sent as plain text and never rendered as HTML.
 */

const MAX_FILES = 3;
const MAX_FILE_MB = 10;
const ACCEPT = "application/pdf,image/jpeg,image/png";

type StartResult = ActionResult<{ conversationId: string; warning: string | null }>;

export function StartConversationForm({
  intro,
  placeholder,
  submitLabel,
  onSubmit,
}: {
  intro: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (data: FormData) => Promise<StartResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [done, setDone] = useState<{ conversationId: string; warning: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = useId();

  function handleFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.some((f) => f.size > MAX_FILE_MB * 1024 * 1024)) {
      setFileError(`Files must be ${MAX_FILE_MB} MB or smaller.`);
      return false;
    }
    if (picked.length > MAX_FILES) {
      setFileError(`You can attach up to ${MAX_FILES} files.`);
      return false;
    }
    setFileError(null);
    return true;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setError(null);
        const data = new FormData(form);
        startTransition(async () => {
          const result = await onSubmit(data);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (result.warning) {
            setDone({ conversationId: result.conversationId, warning: result.warning });
            return;
          }
          router.push(`/conversations/${result.conversationId}`);
        });
      }}
    >
      <p className="text-sm text-ink-soft">{intro}</p>
      <div className="space-y-1">
        <label htmlFor={`${ids}-body`} className="sr-only">
          Message
        </label>
        <Textarea
          id={`${ids}-body`}
          name="body"
          rows={4}
          maxLength={2000}
          placeholder={placeholder}
          
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-ink-soft">
          <span className="sr-only">Attach files</span>
          <input
            type="file"
            name="files"
            multiple
            accept={ACCEPT}
            onChange={(e) => handleFiles(e.currentTarget.files)}
            className="text-sm file:mr-3 file: file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending || done !== null}
          className="ml-auto bg-brand px-4 py-2 text-sm font-medium text-ivory hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? "Sending..." : submitLabel}
        </button>
      </div>
      <p className="text-xs text-ink-soft">
        Phone numbers, emails and social handles are hidden automatically. Keep the conversation on Gemstone Selections.
      </p>
      {fileError ? (
        <p role="alert" className="text-sm text-danger">
          {fileError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {done ? (
        <div role="status" className="space-y-2 bg-accent-soft px-3 py-2 text-sm text-ink">
          <p>{done.warning}</p>
          <Link href={`/conversations/${done.conversationId}`} className="font-medium text-ink underline underline-offset-4 hover:text-accent-text">
            Open the conversation
          </Link>
        </div>
      ) : null}
    </form>
  );
}
