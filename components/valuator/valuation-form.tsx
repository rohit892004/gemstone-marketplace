"use client";

import { useActionState, useId, type ReactNode } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
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
      : buttonClasses({ className: "min-h-11 px-6 py-3" });

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
        const error = fieldErrors[field.name];
        const describedBy = [field.help && !error ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
        const common = {
          id,
          name: field.name,
          required: field.required,
          maxLength: field.maxLength,
          defaultValue: echoed[field.name] ?? field.defaultValue,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy,
        };
        const label = (
          <>
            {field.label}
            {field.required ? <span className="text-ink-soft"> (required)</span> : null}
          </>
        );
        const hint = field.help ? <span id={`${id}-help`}>{field.help}</span> : undefined;
        let control: ReactNode;
        if (field.kind === "textarea") {
          control = <Textarea rows={field.rows ?? 4} {...common} />;
        } else if (field.kind === "select") {
          control = (
            <Select {...common}>
              {(field.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          );
        } else if (field.kind === "file") {
          control = <input type="file" id={id} name={field.name} accept={field.accept} required={field.required} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className="block w-full min-h-11 text-sm text-ink" />;
        } else {
          control = (
            <Input
              type={field.kind === "number" ? "text" : field.kind ?? "text"}
              inputMode={field.inputMode ?? (field.kind === "number" ? "decimal" : undefined)}
              {...common}
            />
          );
        }
        return (
          <Field key={field.name} id={id} label={label} hint={hint} error={error} className="text-sm">
            {control}
          </Field>
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
