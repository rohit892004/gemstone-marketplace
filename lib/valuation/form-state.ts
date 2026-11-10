/**
 * Result of a valuation form action. Shown by the form: the summary at the top lists `error` and `errors`,
 * and `fieldErrors` appear beside each field.
 */
export type ValuationActionState =
  | { ok: true; message: string }
  | {
      ok: false;
      error: string;
      /** Field name to message. Shown beside the field. */
      fieldErrors?: Record<string, string>;
      /** Several messages, such as one per line of a CSV file. */
      errors?: string[];
      /** What the user typed, so the form can show it again after an error. */
      values?: Record<string, string>;
    }
  | null;
