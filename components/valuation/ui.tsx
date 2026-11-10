import type { ReactNode } from "react";

/** Shared form and layout pieces for the valuation pages. Server-safe: no hooks. */

export const inputClass =
  "mt-1 block w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink shadow-sm focus:border-brand focus:outline-none aria-[invalid=true]:border-red-700";

export const primaryButtonClass =
  "rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50";

export const secondaryButtonClass =
  "rounded-md border border-brand px-5 py-2.5 text-sm font-medium text-brand-strong hover:bg-accent-soft disabled:opacity-50";

export const linkClass = "font-medium text-brand-strong underline underline-offset-4";

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
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-red-700" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
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
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc pl-5">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

export function StatusMessage({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-md border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
      {children}
    </p>
  );
}

/** A quiet panel for the result page and the dashboards. */
export function Panel({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-lg border border-line bg-surface-raised p-5">
      <h2 id={id} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The site-wide indicative-only notice. Always shown with any number from the engine. */
export function Disclaimer({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1">{text}</p>
    </div>
  );
}

export function DemoTag({ label }: { label: string }) {
  return <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink-soft">{label}</span>;
}

/** Plain access message for pages a visitor cannot use yet. */
export function AccessMessage({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-2 text-sm text-ink-soft">{children}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
