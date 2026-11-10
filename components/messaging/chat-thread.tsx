"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { markReadAction, sendMessageAction } from "@/app/conversations/actions";
import { ComposerExtras } from "./composer-extras";
import { MessageExtras } from "./message-extras";
import type { OfferPayload, QuotationPayload, ThreadContext } from "./types";

/**
 * Shared chat thread for buyers, sellers and the enquiry/requirement views.
 * Transport: polls /api/conversations/:id/messages every POLL_MS and merges new rows by id.
 * Read receipts: a sent message shows "Read" once the other person's lastReadAt is at or after it.
 * All message text is rendered as plain text (React escapes it). Never use dangerouslySetInnerHTML here.
 */

export interface ThreadMessage {
  id: string;
  kind: "TEXT" | "OFFER" | "QUOTATION" | "SYSTEM";
  body: string;
  flagged: boolean;
  createdAt: string;
  mine: boolean;
  attachments: { id: string; fileName: string; mimeType: string; sizeBytes: number }[];
  offer: OfferPayload | null;
  quotation: QuotationPayload | null;
}

/** New rows are appended; rows already on screen are replaced, so status changes (offer or quotation) show up. */
function mergeMessages(prev: ThreadMessage[], incoming: ThreadMessage[]): ThreadMessage[] {
  const byId = new Map(incoming.map((m) => [m.id, m] as const));
  const merged = prev.map((m) => byId.get(m.id) ?? m);
  const known = new Set(prev.map((m) => m.id));
  return [...merged, ...incoming.filter((m) => !known.has(m.id))];
}

export interface ChatThreadProps {
  conversationId: string;
  initialMessages: ThreadMessage[];
  initialCounterpartLastReadAt: string | null;
  counterpartLabel: string;
  isDemo: boolean;
  disabledReason?: string | null;
  context: ThreadContext;
}

const POLL_MS = 5000;
const MAX_FILES = 3;
const MAX_FILE_MB = 10;
const ACCEPT = "application/pdf,image/jpeg,image/png";

export function ChatThread(props: ChatThreadProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>(props.initialMessages);
  const [counterpartRead, setCounterpartRead] = useState<string | null>(props.initialCounterpartLastReadAt);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const lastCreatedAt = useRef<string | null>(props.initialMessages.at(-1)?.createdAt ?? null);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const url = new URL(`/api/conversations/${props.conversationId}/messages`, window.location.origin);
        if (lastCreatedAt.current) url.searchParams.set("since", lastCreatedAt.current);
        const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
        if (!active || !res.ok) return;
        const data = (await res.json()) as {
          messages: ThreadMessage[];
          counterpartLastReadAt: string | null;
        };
        if (data.messages.length > 0) {
          lastCreatedAt.current = data.messages.at(-1)!.createdAt;
          setMessages((prev) => {
            return mergeMessages(prev, data.messages);
          });
        }
        setCounterpartRead(data.counterpartLastReadAt);
      } catch {
        // Network blips are retried on the next tick.
      }
    };
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [props.conversationId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  // Opening the thread (and seeing new messages while it is open) marks it read for read receipts.
  useEffect(() => {
    void markReadAction(props.conversationId);
  }, [props.conversationId, messages.length]);

  function onFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const tooBig = picked.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) {
      setError(`Files must be ${MAX_FILE_MB} MB or smaller.`);
      return;
    }
    setFiles(picked.slice(0, MAX_FILES));
  }

  function send() {
    setError(null);
    const form = new FormData();
    form.set("body", body);
    for (const file of files) form.append("files", file);
    startTransition(async () => {
      const result = await sendMessageAction(props.conversationId, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setFiles([]);
      setWarning(result.warning);
      // Pull the new message straight away instead of waiting for the next poll.
      const url = new URL(`/api/conversations/${props.conversationId}/messages`, window.location.origin);
      if (lastCreatedAt.current) url.searchParams.set("since", lastCreatedAt.current);
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { messages: ThreadMessage[]; counterpartLastReadAt: string | null };
        if (data.messages.length > 0) {
          lastCreatedAt.current = data.messages.at(-1)!.createdAt;
          setMessages((prev) => {
            return mergeMessages(prev, data.messages);
          });
        }
        setCounterpartRead(data.counterpartLastReadAt);
      }
    });
  }

  const canSend = !props.disabledReason && !pending && (body.trim().length > 0 || files.length > 0);

  return (
    <section aria-label={`Conversation with ${props.counterpartLabel}`} className="flex flex-col rounded-lg border border-line bg-surface-raised">
      <div ref={listRef} className="flex max-h-[60vh] min-h-[16rem] flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <p className="m-auto text-sm text-ink-soft">No messages yet. Say hello to start the conversation.</p>}
        {messages.map((m) => {
          const read = m.mine && counterpartRead !== null && new Date(counterpartRead) >= new Date(m.createdAt);
          return (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm sm:max-w-[70%] ${m.mine ? "bg-brand text-white" : "bg-surface text-ink"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <MessageExtras message={m} context={props.context} />
                {m.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={`/api/conversations/${props.conversationId}/attachments/${a.id}`}
                    className={`mt-2 block break-all underline underline-offset-2 ${m.mine ? "text-white" : "text-brand"}`}
                  >
                    {a.fileName} ({Math.max(1, Math.round(a.sizeBytes / 1024))} KB)
                  </a>
                ))}
                <p className={`mt-1 text-xs ${m.mine ? "text-white/80" : "text-ink-soft"}`}>
                  {new Date(m.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  {m.mine && <span> · {read ? "Read" : "Sent"}</span>}
                  {m.flagged && <span> · contact details hidden</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {props.isDemo && (
        <p className="border-t border-line px-4 py-2 text-xs text-accent-text">Demo conversation: sample data for demonstration.</p>
      )}
      {warning && <p role="status" className="border-t border-line bg-accent-soft px-4 py-2 text-sm text-ink">{warning}</p>}

      {props.disabledReason ? (
        <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">{props.disabledReason}</p>
      ) : (
        <div className="flex flex-col gap-2 border-t border-line p-4">
          <ComposerExtras context={props.context} />
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) send();
          }}
        >
          <label className="sr-only" htmlFor="chat-body">Message</label>
          <textarea
            id="chat-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setWarning(null);
            }}
            maxLength={2000}
            rows={3}
            placeholder="Write a message. Phone numbers, emails and social handles are hidden automatically."
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-ink-soft">
              <span className="sr-only">Attach files</span>
              <input
                type="file"
                multiple
                accept={ACCEPT}
                onChange={(e) => onFiles(e.target.files)}
                className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-ink"
              />
            </label>
            {files.length > 0 && <span className="text-xs text-ink-soft">{files.length} file(s) ready</span>}
            <button
              type="submit"
              disabled={!canSend}
              className="ml-auto rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
            >
              {pending ? "Sending..." : "Send"}
            </button>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </form>
        </div>
      )}
    </section>
  );
}
