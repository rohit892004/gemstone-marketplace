import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Filters for the admin valuation queue. Pure: parses URL search params and builds the Prisma where clause.
 * Every filter maps to a real indexed or unique column (status, assignedValuatorId, source, submittedAt,
 * reference). There is no free-text search.
 */

export const ADMIN_VALUATION_PAGE_SIZE = 25;

export const ADMIN_VALUATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "AUTO_VALUED",
  "IN_EXPERT_REVIEW",
  "NEEDS_INFO",
  "COMPLETED",
  "REJECTED",
] as const;
export type AdminValuationStatus = (typeof ADMIN_VALUATION_STATUSES)[number];

export const ADMIN_VALUATION_STATUS_LABELS: Record<AdminValuationStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  AUTO_VALUED: "Auto valued",
  IN_EXPERT_REVIEW: "In expert review",
  NEEDS_INFO: "Needs info",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

export const ADMIN_VALUATION_SOURCES = ["all", "LISTING", "STANDALONE"] as const;
export type AdminValuationSource = (typeof ADMIN_VALUATION_SOURCES)[number];

export interface AdminValuationFilters {
  statuses: AdminValuationStatus[];
  /** "all", "unassigned", or a valuator user id. */
  assignment: string;
  source: AdminValuationSource;
  /** Inclusive start of the submitted-date range (UTC midnight), or null. */
  from: Date | null;
  /** Exclusive end of the range (the day after the chosen "to" date, UTC midnight), or null. */
  to: Date | null;
  fromText: string;
  toText: string;
  /** Exact reference, upper case, or null. */
  reference: string | null;
  page: number;
}

export interface AdminValuationFilterParse {
  filters: AdminValuationFilters;
  /** Field name to message. Invalid values are dropped, and the message explains why. */
  errors: Record<string, string>;
}

type RawParams = Record<string, string | string[] | undefined>;

function values(raw: RawParams, key: string): string[] {
  const value = raw[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function first(raw: RawParams, key: string): string {
  return values(raw, key)[0]?.trim() ?? "";
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-03-15" becomes UTC midnight. Returns null for anything that is not a real calendar date. */
export function parseIsoDate(text: string): Date | null {
  const match = DATE_PATTERN.exec(text);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseAdminValuationFilters(raw: RawParams): AdminValuationFilterParse {
  const errors: Record<string, string> = {};

  const statuses = values(raw, "status").filter((s): s is AdminValuationStatus =>
    (ADMIN_VALUATION_STATUSES as readonly string[]).includes(s),
  );
  const uniqueStatuses = [...new Set(statuses)];

  const assignmentRaw = first(raw, "assignment") || "all";
  const assignment = /^[a-z0-9]{1,40}$/i.test(assignmentRaw) || assignmentRaw === "all" || assignmentRaw === "unassigned"
    ? assignmentRaw
    : "all";

  const sourceRaw = first(raw, "source") || "all";
  const source = (ADMIN_VALUATION_SOURCES as readonly string[]).includes(sourceRaw)
    ? (sourceRaw as AdminValuationSource)
    : "all";

  const fromText = first(raw, "from");
  const toText = first(raw, "to");
  let from: Date | null = null;
  let to: Date | null = null;
  if (fromText) {
    from = parseIsoDate(fromText);
    if (!from) errors.from = "Use a real date in the form YYYY-MM-DD.";
  }
  if (toText) {
    const parsed = parseIsoDate(toText);
    if (!parsed) errors.to = "Use a real date in the form YYYY-MM-DD.";
    else to = new Date(parsed.getTime() + DAY_MS);
  }
  if (from && to && from.getTime() >= to.getTime()) {
    errors.to = "The end date must be the same as or after the start date.";
    to = null;
  }

  const referenceRaw = first(raw, "ref").toUpperCase();
  const reference = referenceRaw === "" ? null : referenceRaw.slice(0, 20);

  const pageNumber = Number(first(raw, "page") || "1");
  const page = Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 100000 ? pageNumber : 1;

  return {
    filters: {
      statuses: uniqueStatuses,
      assignment,
      source,
      from: errors.from ? null : from,
      to: errors.to ? null : to,
      fromText: errors.from ? "" : fromText,
      toText: errors.to ? "" : toText,
      reference,
      page,
    },
    errors,
  };
}

export function adminValuationWhere(filters: AdminValuationFilters): Prisma.ValuationWhereInput {
  const where: Prisma.ValuationWhereInput = {};
  if (filters.statuses.length > 0) where.status = { in: filters.statuses };
  if (filters.assignment === "unassigned") where.assignedValuatorId = null;
  else if (filters.assignment !== "all") where.assignedValuatorId = filters.assignment;
  if (filters.source !== "all") where.source = filters.source;
  if (filters.from || filters.to) {
    where.submittedAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lt: filters.to } : {}),
    };
  }
  if (filters.reference) where.reference = filters.reference;
  return where;
}

/** Builds the query string for a given page, keeping every other filter. */
export function adminValuationQuery(filters: AdminValuationFilters, page: number): string {
  const params = new URLSearchParams();
  for (const status of filters.statuses) params.append("status", status);
  if (filters.assignment !== "all") params.set("assignment", filters.assignment);
  if (filters.source !== "all") params.set("source", filters.source);
  if (filters.fromText) params.set("from", filters.fromText);
  if (filters.toText) params.set("to", filters.toText);
  if (filters.reference) params.set("ref", filters.reference);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/valuations?${query}` : "/admin/valuations";
}
