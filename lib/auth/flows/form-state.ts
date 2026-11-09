/** Shape returned by server actions to client forms (useActionState). Types only, safe to share. */
export interface FormState {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
  /** Values echoed back so the form keeps what the user typed. Never echo passwords. */
  values?: Record<string, string>;
  /** Set when a link/code is no longer usable, so the UI can offer a fresh one. */
  invalidLink?: boolean;
  done?: boolean;
}
