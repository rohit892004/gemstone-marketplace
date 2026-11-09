"use client";

import { useActionState } from "react";
import type { AdminActionState } from "@/lib/admin/action-state";

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
  const buttonClass =
    tone === "danger"
      ? "rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
      : "rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50";

  return (
    <form action={formAction} className="space-y-3 rounded border border-stone-300 bg-white p-4">
      <div>
        <h3 className="font-medium">{title}</h3>
        {description ? <p className="text-sm text-stone-600">{description}</p> : null}
      </div>
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((field) => {
        if (field.kind === "checkbox") {
          return (
            <label key={field.name} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name={field.name}
                defaultChecked={field.defaultValue === "on"}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{field.label}</span>
                {field.help ? <span className="block text-stone-600">{field.help}</span> : null}
              </span>
            </label>
          );
        }
        const common = {
          name: field.name,
          defaultValue: field.defaultValue ?? "",
          required: field.required,
          maxLength: field.maxLength,
          className: "w-full rounded border border-stone-300 p-2",
        };
        return (
          <label key={field.name} className="block space-y-1 text-sm">
            <span className="font-medium">{field.label}</span>
            {field.help ? <span className="block text-stone-600">{field.help}</span> : null}
            {field.kind === "textarea" ? (
              <textarea rows={4} {...common} />
            ) : (
              <input type="text" {...common} />
            )}
          </label>
        );
      })}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving..." : submitLabel}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? (
        <p role="status" className="text-sm text-green-800">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
