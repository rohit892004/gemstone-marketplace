/**
 * Pure rules for editorial content (articles, news, reference pages). No database access, so they are
 * unit-tested directly. The service applies them inside a conditional update.
 */

export const CONTENT_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
export type ContentStatusName = (typeof CONTENT_STATUSES)[number];

export const CONTENT_TYPES = ["EDUCATION", "GUIDE", "RESEARCH", "NEWS"] as const;
export type ContentTypeName = (typeof CONTENT_TYPES)[number];

const TRANSITIONS: Record<ContentStatusName, readonly ContentStatusName[]> = {
  DRAFT: ["SCHEDULED", "PUBLISHED", "ARCHIVED"],
  SCHEDULED: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function canTransition(from: ContentStatusName, to: ContentStatusName): boolean {
  return from !== to && TRANSITIONS[from].includes(to);
}

export interface PublishableFields {
  type: ContentTypeName;
  title: string;
  body: string;
  summary?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  metaDescription?: string | null;
}

export interface PublishProblem {
  field: "title" | "body" | "sourceName" | "sourceUrl" | "summary" | "metaDescription" | "scheduledFor" | "status";
  message: string;
}

export const META_DESCRIPTION_MAX = 160;
export const SUMMARY_MAX = 300;

/** What must be true before content can be PUBLISHED or SCHEDULED. Returns no problems when it is ready. */
export function publishProblems(fields: PublishableFields): PublishProblem[] {
  const problems: PublishProblem[] = [];
  if (fields.title.trim() === "") problems.push({ field: "title", message: "Add a title." });
  if (fields.body.trim() === "") problems.push({ field: "body", message: "Add some content before publishing." });
  if (fields.summary && fields.summary.length > SUMMARY_MAX) {
    problems.push({ field: "summary", message: `Keep the summary under ${SUMMARY_MAX} characters.` });
  }
  if (fields.metaDescription && fields.metaDescription.length > META_DESCRIPTION_MAX) {
    problems.push({ field: "metaDescription", message: `Keep the search description under ${META_DESCRIPTION_MAX} characters.` });
  }
  if (fields.type === "NEWS") {
    if (!fields.sourceName || fields.sourceName.trim() === "") {
      problems.push({ field: "sourceName", message: "News needs a source name, so readers know where it came from." });
    }
    if (!fields.sourceUrl || !isHttpsUrl(fields.sourceUrl)) {
      problems.push({ field: "sourceUrl", message: "News needs a full https:// link to the original source." });
    }
  }
  return problems;
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** A scheduled time must be in the future when it is set. Returns a problem, or null when fine. */
export function scheduleProblem(scheduledFor: Date | null, now: Date): PublishProblem | null {
  if (!scheduledFor) return { field: "scheduledFor", message: "Pick a date and time to publish." };
  if (scheduledFor.getTime() <= now.getTime()) {
    return { field: "scheduledFor", message: "The scheduled time must be in the future. Publish now instead." };
  }
  return null;
}

/** Public visibility: only PUBLISHED content whose publish time has passed. */
export function isPubliclyVisible(status: ContentStatusName, publishedAt: Date | null, now: Date): boolean {
  return status === "PUBLISHED" && publishedAt !== null && publishedAt.getTime() <= now.getTime();
}

/** URL slug from a title: lowercase ASCII words joined by hyphens. Never empty. */
export function slugify(title: string, fallback = "item"): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base === "" ? fallback : base;
}

/** Appends -2, -3 … to a slug until it is free. Pure: the caller passes the taken slugs. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
