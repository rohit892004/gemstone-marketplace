import { renderMarkdown } from "./markdown";

/**
 * Gemstone Reference Library: the fixed set of sections on every reference page, in reading order.
 * Pure. The page builder renders each section through renderMarkdown (the only safe HTML path).
 */

export const REFERENCE_SECTIONS = [
  { key: "properties", heading: "Properties" },
  { key: "origins", heading: "Origins" },
  { key: "treatments", heading: "Treatments" },
  { key: "qualityGuide", heading: "How to judge quality" },
  { key: "care", heading: "Care" },
  { key: "priceFactors", heading: "What affects price" },
] as const;

export type ReferenceSectionKey = (typeof REFERENCE_SECTIONS)[number]["key"];
export type ReferenceMarkdown = Record<ReferenceSectionKey, string>;

export interface ReferenceSection {
  key: ReferenceSectionKey;
  heading: string;
  html: string;
}

/** Builds every section, in order. Empty sources give empty html. `render` defaults to renderMarkdown. */
export function buildReferenceSections(
  source: ReferenceMarkdown,
  render: (markdown: string) => string = renderMarkdown,
): ReferenceSection[] {
  return REFERENCE_SECTIONS.map(({ key, heading }) => ({
    key,
    heading,
    html: source[key].trim() === "" ? "" : render(source[key]),
  }));
}

export interface ReferenceProblem {
  field: string;
  message: string;
}

export interface ReferenceFields extends ReferenceMarkdown {
  name: string;
  summary: string;
  categorySlug: string;
  metaDescription?: string | null;
}

export const REFERENCE_META_MAX = 160;

/** What must be filled in before a reference page can be published. */
export function referencePublishProblems(fields: ReferenceFields): ReferenceProblem[] {
  const problems: ReferenceProblem[] = [];
  if (fields.name.trim() === "") problems.push({ field: "name", message: "Add the gemstone name." });
  if (fields.categorySlug.trim() === "") problems.push({ field: "categorySlug", message: "Choose the catalogue category." });
  if (fields.summary.trim() === "") problems.push({ field: "summary", message: "Add a short summary." });
  for (const { key, heading } of REFERENCE_SECTIONS) {
    if (fields[key].trim() === "") problems.push({ field: key, message: `Add the "${heading}" section before publishing.` });
  }
  if (fields.metaDescription && fields.metaDescription.length > REFERENCE_META_MAX) {
    problems.push({ field: "metaDescription", message: `Keep the search description under ${REFERENCE_META_MAX} characters.` });
  }
  return problems;
}
