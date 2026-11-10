"use client";

import { useActionState, useId } from "react";
import type { AdminActionState } from "@/lib/admin/action-state";
import { adminButtonClass } from "@/components/admin/button-classes";
import { Field, Input, Textarea } from "@/components/ui/field";

export interface ActionField {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "checkbox";
  /** Text/textarea default. For checkboxes, "on" means checked. */
  defaultValue?: string;
  maxLength?: number;
  required?: boolean;
  help?: string;
}

interface ActionFormProps {
  action: (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  title: string;
  description?: string;
  submitLabel: string;
  /** Hidden inputs sent with the form, e.g. the target id. */
  hidden?: Record<string, string>;
  fields?: ActionField[];
  tone?: "primary" | "danger";
}

/**
 * Generic admin form. Each decision is a server action; the form shows the result and disables
 * itself while the action runs. Used for moderation, toggles and the homepage/settings editors.
 */
export function ActionForm({ action, title, description, submitLabel, hidden, fields = [], tone = "primary" }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const baseId = useId();

  return (
    <form action={formAction} className="space-y-4 border border-line bg-surface-raised p-5 sm:p-6">
      <div className="space-y-2">
        <h3 className="font-heading text-xl text-ink">{title}</h3>
        {description ? <p className="text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((field, index) => {
        const id = `${baseId}-${index}`;
        if (field.kind === "checkbox") {
          return (
            <label key={field.name} className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                name={field.name}
                defaultChecked={field.defaultValue === "on"}
                className="mt-1 h-4 w-4 accent-brand"
              />
              <span>
                <span className="font-medium text-ink">{field.label}</span>
                {field.help ? <span className="block text-ink-soft">{field.help}</span> : null}
              </span>
            </label>
          );
        }
        return (
          <Field key={field.name} id={id} label={field.label} hint={field.help} className="text-sm">
            {field.kind === "textarea" ? (
              <Textarea id={id} name={field.name} defaultValue={field.defaultValue ?? ""} required={field.required} maxLength={field.maxLength} rows={4} />
            ) : (
              <Input id={id} type="text" name={field.name} defaultValue={field.defaultValue ?? ""} required={field.required} maxLength={field.maxLength} />
            )}
          </Field>
        );
      })}
      <button type="submit" disabled={pending} className={adminButtonClass(tone === "danger")}>
        {pending ? "Saving..." : submitLabel}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
