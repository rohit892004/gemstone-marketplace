import type { ReactNode } from "react";

interface BaseProps {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

const inputClass =
  "mt-1 block w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink shadow-sm focus:border-brand focus:outline-none aria-[invalid=true]:border-red-700";

function describedBy(name: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids = [hasHint ? `${name}-hint` : null, hasError ? `${name}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldShell({ name, label, error, hint, required, children }: BaseProps & { children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-red-700" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${name}-hint`} className="text-xs text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
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
      <input
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
        className={inputClass}
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
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, Boolean(hint), Boolean(error))}
        className={inputClass}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
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
        className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
      />
    </FieldShell>
  );
}
