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

const INPUT_CLASS = "mt-1 w-full rounded border border-stone-300 bg-white p-2 text-base";

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
      ? "min-h-11 rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
      : "min-h-11 rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50";

  return (
    <form action={formAction} aria-labelledby={`${formId}-title`} className="space-y-3 rounded border border-stone-300 bg-white p-4">
      <div>
        <h3 id={`${formId}-title`} className="font-medium">
          {title}
        </h3>
        {description ? <p className="text-sm text-stone-600">{description}</p> : null}
      </div>

      {summaryItems.length > 0 ? (
        <div id={summaryId} role="alert" tabIndex={-1} className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
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
          <div key={field.name} className="space-y-1 text-sm">
            <label htmlFor={id} className="block font-medium">
              {field.label}
              {field.required ? <span className="text-stone-600"> (required)</span> : null}
            </label>
            {field.help ? (
              <p id={`${id}-help`} className="text-stone-600">
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
              <p id={errorId} className="text-red-700">
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
        <p role="status" className="text-sm text-green-800">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
