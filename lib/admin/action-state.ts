/** Result of an admin server action, shown by the decision form. */
export type AdminActionState = { ok: true; message: string } | { ok: false; error: string } | null;
