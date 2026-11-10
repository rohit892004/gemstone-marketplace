import type { ReactNode } from "react";
import { Field, Input, Select } from "@/components/ui/field";

interface BaseProps {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

function describedBy(name: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids = [hasHint ? `${name}-hint` : null, hasError ? `${name}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldShell({ name, label, error, hint, required, children }: BaseProps & { children: ReactNode }) {
  return (
    <Field
      id={name}
      label={
        <>
          {label}
          {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
        </>
      }
      hint={hint ? <span id={`${name}-hint`}>{hint}</span> : undefined}
      error={error}
    >
      {children}
    </Field>
  );
}

export function TextField({
  name,
  label,
  error,
  hint,
  required,
  type = "text",
  defaultValue,
  autoComplete,
  inputMode,
  placeholder,
}: BaseProps & {
  type?: "text" | "email" | "password" | "tel" | "number";
  defaultValue?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  placeholder?: string;
}) {
  return (
    <FieldShell name={name} label={label} error={error} hint={hint} required={required}>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, Boolean(hint), Boolean(error))}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  error,
  hint,
  required,
  options,
  defaultValue,
  placeholder,
}: BaseProps & {
  options: readonly { value: string; label: string }[];
  defaultValue?: string;
  placeholder: string;
}) {
  return (
    <FieldShell name={name} label={label} error={error} hint={hint} required={required}>
      <Select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, Boolean(hint), Boolean(error))}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}

/** Multi-select as a group of checkboxes. All boxes share `name`, so the form posts every ticked value. */
export function CheckboxGroupField({
  name,
  label,
  options,
  defaultValues,
  error,
  hint,
  required,
}: BaseProps & {
  options: readonly { value: string; label: string }[];
  defaultValues?: readonly string[];
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  return (
    <fieldset className="space-y-2" aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}>
      <legend className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
      </legend>
      {hint ? (
        <p id={hintId} className="text-xs text-ink-soft">
          {hint}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-3 border border-line bg-surface-raised px-3 py-2 text-sm text-ink"
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={defaultValues?.includes(option.value) ?? false}
              className="h-4 w-4 accent-brand"
            />
            {option.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function FileField({ name, label, error, hint, required }: BaseProps) {
  return (
    <FieldShell name={name} label={label} error={error} hint={hint} required={required}>
      <input
        id={name}
        name={name}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, Boolean(hint), Boolean(error))}
        className="mt-1 block w-full text-sm text-ink file:mr-3 file: file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
      />
    </FieldShell>
  );
}
