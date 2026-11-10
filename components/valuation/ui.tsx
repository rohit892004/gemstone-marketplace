import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { DemoTag as UiDemoTag } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { ESTIMATE_METHOD_NOTE } from "@/lib/valuation/requester-copy";

/** Shared form and layout pieces for the valuation pages. Server-safe: no hooks. */

export const inputClass =
  "mt-2 block w-full border border-line bg-surface-raised px-4 py-3 text-[15px] text-ink transition duration-300 placeholder:text-ink-soft/70 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-60";

/** Same look as the site buttons (components/ui/button), with a 44px touch target. */
export const primaryButtonClass = buttonClasses({ variant: "primary", className: "min-h-11" });

export const secondaryButtonClass = buttonClasses({ variant: "secondary", className: "min-h-11" });

export const linkClass =
  "inline-flex min-h-11 items-center text-[14px] text-ink underline underline-offset-4 hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[13px] tracking-wide text-ink">
        {label}
        {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[12px] leading-relaxed text-ink-soft">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Summary at the top of a form. Lists each error once, in order. */
export function ErrorSummary({ messages, title = "Please check the form" }: { messages: string[]; title?: string }) {
  if (messages.length === 0) return null;
  return (
    <div role="alert" className="border border-danger/40 bg-surface-raised px-5 py-4 text-[14px] text-danger">
      <p className="font-medium">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

export function StatusMessage({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="border border-accent/40 bg-accent-soft px-5 py-4 text-[14px] text-ink">
      {children}
    </p>
  );
}

/** A document-style panel: a serif heading over a thin rule, then the body. Used on the result and verification pages. */
export function Panel({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="border border-line bg-surface-raised shadow-soft">
      <div className="border-b border-line px-6 py-5 sm:px-8">
        <h2 id={id} className="font-heading text-2xl font-medium text-ink">
          {title}
        </h2>
      </div>
      <div className="space-y-5 px-6 py-6 sm:px-8">{children}</div>
    </section>
  );
}

/** The site-wide indicative-only notice. Always shown with any number from the engine. */
export function Disclaimer({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-l-2 border-accent bg-surface-raised px-5 py-4 text-[14px] text-ink-soft">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

/** Side panel for the wizard and result pages: how the estimate is made, in plain words. */
export function EstimateNote({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-4 border border-line bg-surface-raised p-6">
      <div className="flex items-center gap-3 text-accent">
        <Info className="h-5 w-5" strokeWidth={1.25} aria-hidden />
        <h2 className="font-heading text-xl text-ink">{title}</h2>
      </div>
      <p className="text-[14px] leading-relaxed text-ink-soft">{ESTIMATE_METHOD_NOTE}</p>
      <p className="text-[14px] leading-relaxed text-ink-soft">{text}</p>
    </div>
  );
}

export function DemoTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center text-[10px] uppercase tracking-[0.22em] text-ink-soft">
      {label === "Demo" ? <UiDemoTag /> : label}
    </span>
  );
}

/** Plain access message for pages a visitor cannot use yet. */
export function AccessMessage({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-line bg-surface-raised p-8 text-center shadow-soft sm:p-12">
      <h2 className="font-heading text-2xl font-medium text-ink">{title}</h2>
      <div className="mx-auto mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">{children}</div>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
