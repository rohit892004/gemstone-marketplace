"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

type ToastTone = "success" | "info" | "error";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Toast region. Messages are announced politely (errors assertively). They dismiss after a few seconds
 * and can be closed by hand. Mount once in a layout; call useToast() anywhere below it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96">
        {items.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? TriangleAlert : Info;
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className={cx(
                "pointer-events-auto flex w-full items-start gap-3 border bg-surface-raised p-4 text-sm text-ink shadow-soft",
                t.tone === "success" && "border-success/40",
                t.tone === "error" && "border-danger/50",
                t.tone === "info" && "border-line",
              )}
            >
              <Icon className={cx("mt-0.5 h-4 w-4 shrink-0", t.tone === "success" ? "text-success" : t.tone === "error" ? "text-danger" : "text-accent")} strokeWidth={1.5} aria-hidden />
              <p className="flex-1 leading-relaxed">{t.message}</p>
              <button type="button" aria-label="Dismiss message" onClick={() => dismiss(t.id)} className="text-ink-soft hover:text-ink">
                <X className="h-4 w-4" strokeWidth={1.25} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
