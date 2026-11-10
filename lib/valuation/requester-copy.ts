/**
 * Status labels and copy for the requester side (wizard, results, dashboards, verification page).
 * Plain text only. Every status label and disclaimer used by a requester page comes from here.
 */

export const DISCLAIMER_TITLE = "Indicative only";
export const DISCLAIMER_TEXT =
  "This valuation is indicative only. It is not a certified appraisal and should not be used as one for insurance, sale, or legal purposes.";

export const ESTIMATE_METHOD_NOTE =
  "The estimate uses reference prices and the details you give. It does not look at your photos. Photos are for the expert valuer.";

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  AUTO_VALUED: "Valued automatically",
  IN_EXPERT_REVIEW: "With an expert valuer",
  NEEDS_INFO: "Valuer needs more information",
  COMPLETED: "Expert valuation completed",
  REJECTED: "Not completed",
};

export const WITHDRAWN_LABEL = "Withdrawn";

/** The label for a status, with withdrawal taking precedence. Unknown statuses fall back to a neutral label. */
export function statusLabel(status: string, withdrawn = false): string {
  if (withdrawn) return WITHDRAWN_LABEL;
  return STATUS_LABEL[status] ?? "In progress";
}

/** One sentence under the status heading, saying what happens next. */
export const STATUS_BODY: Record<string, string> = {
  DRAFT: "Your request is saved but not yet sent. Add your details and photos, then submit it for a valuation.",
  AUTO_VALUED: "The automatic estimate is ready below.",
  IN_EXPERT_REVIEW: "An expert valuer is reviewing your request. There is no estimate yet. We will let you know when it is ready.",
  NEEDS_INFO: "The valuer has one question before they can continue. Reply below. You can also add photos.",
  COMPLETED: "An expert valuer has signed off this valuation. The result is below.",
  REJECTED: "This request could not be completed. The reason is below.",
};

export const METHOD_LABEL = {
  AUTO: "Automatic (rule-based, indicative)",
  EXPERT: "Expert review (valuer sign-off)",
} as const;

export const CONFIDENCE_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

/** Plain-language reasons for routing a request to an expert, keyed by the engine's reason codes. */
export const EXPERT_REASON_TEXT: Record<string, string> = {
  REQUESTED: "You asked for an expert to review it.",
  INCOMPLETE: "Some details were missing, so the automatic estimate is not reliable enough.",
  LOW_CONFIDENCE: "The details give a low-confidence estimate.",
  ABOVE_THRESHOLD: "The estimated value is above the level we value automatically.",
  NO_REFERENCE: "We do not yet have reference prices for this gemstone type.",
};

export function expertReasonText(code: string): string {
  return EXPERT_REASON_TEXT[code] ?? "A valuer needs to review this request.";
}

export const THREAD_LABEL: Record<string, string> = {
  INFO_REQUEST: "Question from the valuer",
  INFO_RESPONSE: "Your reply",
  SIGNOFF: "Valuer note",
};

export const WITHDRAWN_BANNER_TITLE = "This report has been withdrawn";
export const WITHDRAWN_BANNER_TEXT =
  "It should no longer be relied on. The PDF is still available for your records, and the verification page now shows it as withdrawn.";

/** Verification page copy. The public page never shows more than these labels. */
export const VERIFY_STATUS_LABEL = {
  VALID: "Valid",
  WITHDRAWN: "Withdrawn",
  NOT_COMPLETE: "Not complete",
} as const;

export const VERIFY_METHOD_LABEL = {
  AUTO: "Automatic",
  EXPERT: "Expert",
} as const;

export const VERIFY_NOT_FOUND_TITLE = "No valuation found for this reference";
export const VERIFY_NOT_FOUND_TEXT = "Check the reference on the report and try again. References look like GSV-26-K7Q2M9.";

export const WIZARD_STEPS = [
  { step: 1, label: "Upload" },
  { step: 2, label: "Review" },
  { step: 3, label: "Result" },
] as const;

export function stepText(step: 1 | 2 | 3): string {
  return `Step ${step} of ${WIZARD_STEPS.length}`;
}
