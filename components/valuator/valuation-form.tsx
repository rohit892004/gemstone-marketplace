"use client";

import { useActionState, useId } from "react";
import type { ValuationActionState } from "@/lib/valuation/form-state";

export interface FormOption {
  value: string;
  label: string;
}

export interface FormField {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "select" | "file" | "number" | "date";
  options?: FormOption[];
  /** Text shown under the label. */
  help?: string;
  required?: boolean;
  maxLength?: number;
  defaultValue?: string;
  inputMode?: "text" | "decimal" | "numeric";
  accept?: string;
  rows?: number;
}

interface ValuationFormProps {
  action: (prev: ValuationActionState, formData: FormData) => Promise<ValuationActionState>;
  submitLabel: string;
  /** Hidden inputs sent with the form, such as the valuation id. */
  hidden?: Record<string, string>;
  fields?: FormField[];
  tone?: "primary" | "danger";
  /** Heading for the form. Also used in the summary text. */
  title: string;
  description?: string;
}

const INPUT_CLASS = "block min-h-11 w-full border border-line bg-surface-raised px-4 py-3 text-[15px] text-ink focus:border-accent focus:outline-none";

/**
 * Generic form for valuation actions. Errors appear in a summary at the top and beside each field. Every field
 * has a visible label. The form disables itself while the action runs.
 */
export function ValuationForm({ action, submitLabel, hidden, fields = [], tone = "primary", title, description }: ValuationFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const formId = useId();
  const summaryId = `${formId}-summary`;
  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const echoed = state && !state.ok ? state.values ?? {} : {};
  const summaryItems: string[] = [];
  if (state && !state.ok) {
    if (state.error) summaryItems.push(state.error);
    for (const message of state.errors ?? []) summaryItems.push(message);
    for (const [name, message] of Object.entries(fieldErrors)) {
      const field = fields.find((f) => f.name === name);
      summaryItems.push(field ? `${field.label}: ${message}` : message);
    }
  }
  const buttonClass =
    tone === "danger"
      ? "inline-flex min-h-11 items-center justify-center border border-danger px-6 py-3 text-sm tracking-wide text-danger hover:bg-danger/5 disabled:opacity-50"
      : "inline-flex min-h-11 items-center justify-center bg-brand px-6 py-3 text-sm tracking-wide text-ivory hover:bg-[#2e2b26] disabled:opacity-50";

  return (
    <form action={formAction} aria-labelledby={`${formId}-title`} className="space-y-5 border border-line bg-surface-raised p-5 sm:p-6">
      <div>
        <h3 id={`${formId}-title`} className="font-heading text-2xl text-ink">
          {title}
        </h3>
        {description ? <p className="text-sm text-ink-soft">{description}</p> : null}
      </div>

      {summaryItems.length > 0 ? (
        <div id={summaryId} role="alert" tabIndex={-1} className="border border-danger bg-surface-raised p-3 text-sm text-danger">
          <p className="font-medium">Please fix the following:</p>
          <ul className="list-disc pl-5">
            {summaryItems.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {fields.map((field) => {
        const id = `${formId}-${field.name}`;
        const errorId = `${id}-error`;
        const error = fieldErrors[field.name];
        const describedBy = [field.help ? `${id}-help` : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
        const common = {
          id,
          name: field.name,
          required: field.required,
          maxLength: field.maxLength,
          defaultValue: echoed[field.name] ?? field.defaultValue,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy,
          className: INPUT_CLASS,
        };
        return (
          <div key={field.name} className="space-y-2 text-sm">
            <label htmlFor={id} className="block text-[13px] tracking-wide text-ink">
              {field.label}
              {field.required ? <span className="text-ink-soft"> (required)</span> : null}
            </label>
            {field.help ? (
              <p id={`${id}-help`} className="text-ink-soft">
                {field.help}
              </p>
            ) : null}
            {field.kind === "textarea" ? (
              <textarea rows={field.rows ?? 4} {...common} />
            ) : field.kind === "select" ? (
              <select {...common}>
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.kind === "file" ? (
              <input type="file" id={id} name={field.name} accept={field.accept} required={field.required} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className="mt-1 block w-full text-sm" />
            ) : (
              <input
                type={field.kind === "number" ? "text" : field.kind ?? "text"}
                inputMode={field.inputMode ?? (field.kind === "number" ? "decimal" : undefined)}
                {...common}
              />
            )}
            {error ? (
              <p id={errorId} className="text-danger">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving..." : submitLabel}
      </button>

      {state && state.ok ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
