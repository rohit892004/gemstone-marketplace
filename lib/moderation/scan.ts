import { type ContactKind, moderateContactDetails } from "@/lib/messaging/moderation";

/**
 * Public seller text is checked when it is saved, and a save that contains contact details is refused
 * (not masked). Public text is shown to every visitor, so there is nothing safe to store.
 *
 * Pure: no database access. The recording side lives in ./public-text.ts.
 */

export interface PublicTextField {
  /** The form field name, used to attach the error to the right input. */
  field: string;
  /** The label shown to the seller, e.g. "About". */
  label: string;
  value: string | null | undefined;
}

export interface PublicTextScan {
  flagged: boolean;
  /** Field names that contain contact details. */
  flaggedFields: string[];
  /** Labels of the flagged fields, in the order given. */
  flaggedLabels: string[];
  /** Union of detected kinds across all fields. Never the detected values. */
  kinds: ContactKind[];
}

export function scanPublicText(fields: readonly PublicTextField[]): PublicTextScan {
  const flaggedFields: string[] = [];
  const flaggedLabels: string[] = [];
  const kinds = new Set<ContactKind>();

  for (const item of fields) {
    const value = (item.value ?? "").trim();
    if (value.length === 0) continue;
    const result = moderateContactDetails(value);
    if (!result.flagged) continue;
    flaggedFields.push(item.field);
    flaggedLabels.push(item.label);
    for (const kind of result.kinds) kinds.add(kind);
  }

  return { flagged: flaggedFields.length > 0, flaggedFields, flaggedLabels, kinds: [...kinds] };
}

/** The message a seller sees when a save is refused. Names the fields, never the detected text. */
export function publicTextBlockedMessage(labels: readonly string[]): string {
  const list = labels.length > 0 ? labels.join(", ") : "this text";
  return `Remove the contact details from ${list}. Phone numbers, email addresses, website links and messaging handles can't appear in public text. Then save again.`;
}
