import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { endOfValidityDay, parseAmountToMinor, QUOTATION_CURRENCIES, type QuotationCurrency } from "@/lib/quotations/validate";

/**
 * Requirements board for approved sellers.
 *
 * Shows OPEN requirements in the seller's own categories, whose deadline has not passed.
 * The query selects no buyer fields: no name, email, mobile or buyer ID is ever returned.
 *
 * Filter semantics:
 *  - Carat and budget ranges overlap. A requirement matches when its range touches the chosen range.
 *    A missing bound on the requirement counts as open-ended.
 *  - Budget filters apply only to requirements in the chosen currency (default INR).
 *  - Certificate needed: when ticked, only requirements that need a certificate.
 *  - Deadline by: requirements whose deadline is on or before that date. No-deadline requirements are
 *    excluded from this filter only.
 *  - Category: only one of the seller's own categories. A category the seller does not have is ignored.
 */

export interface BoardFilters {
  categoryId?: string;
  gemstoneType?: string;
  caratMin?: string;
  caratMax?: string;
  budgetMinMinor?: bigint;
  budgetMaxMinor?: bigint;
  currency: QuotationCurrency;
  certificateNeeded?: boolean;
  deadlineBy?: Date;
}

export const GEMSTONE_TYPE_MAX = 60;
export const CARAT_MAX = 100000;

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

/** Parses URL search params into filters. Invalid values are dropped and reported in `errors`. */
export function parseBoardFilters(raw: RawParams): { filters: BoardFilters; errors: string[] } {
  const errors: string[] = [];
  const currencyRaw = single(raw.currency).toUpperCase();
  const currency: QuotationCurrency = (QUOTATION_CURRENCIES as readonly string[]).includes(currencyRaw)
    ? (currencyRaw as QuotationCurrency)
    : "INR";

  const filters: BoardFilters = { currency };

  const category = single(raw.category).slice(0, 64);
  if (category) filters.categoryId = category;

  const type = single(raw.type).slice(0, GEMSTONE_TYPE_MAX);
  if (type) filters.gemstoneType = type;

  const caratMin = single(raw.caratMin);
  const caratMax = single(raw.caratMax);
  const caratPattern = /^\d{1,6}(\.\d{1,3})?$/;
  let minValue = caratMin && caratPattern.test(caratMin) ? Number(caratMin) : null;
  let maxValue = caratMax && caratPattern.test(caratMax) ? Number(caratMax) : null;
  if ((caratMin && minValue === null) || (caratMax && maxValue === null)) errors.push("Enter carat weights as numbers.");
  if (minValue !== null && maxValue !== null && minValue > maxValue) [minValue, maxValue] = [maxValue, minValue];
  if (minValue !== null && minValue <= CARAT_MAX) filters.caratMin = String(minValue);
  if (maxValue !== null && maxValue <= CARAT_MAX) filters.caratMax = String(maxValue);

  const budgetMin = single(raw.budgetMin);
  const budgetMax = single(raw.budgetMax);
  let budgetMinMinor = budgetMin ? parseAmountToMinor(budgetMin) : null;
  let budgetMaxMinor = budgetMax ? parseAmountToMinor(budgetMax) : null;
  if ((budgetMin && budgetMinMinor === null) || (budgetMax && budgetMaxMinor === null)) {
    errors.push("Enter budgets as amounts, for example 50000.");
  }
  if (budgetMinMinor !== null && budgetMaxMinor !== null && budgetMinMinor > budgetMaxMinor) {
    [budgetMinMinor, budgetMaxMinor] = [budgetMaxMinor, budgetMinMinor];
  }
  if (budgetMinMinor !== null) filters.budgetMinMinor = budgetMinMinor;
  if (budgetMaxMinor !== null) filters.budgetMaxMinor = budgetMaxMinor;

  if (single(raw.certificate) === "yes") filters.certificateNeeded = true;

  const by = single(raw.deadlineBy);
  if (by) {
    const parsed = endOfValidityDay(by);
    if (parsed) filters.deadlineBy = parsed;
    else errors.push("Choose a valid deadline date.");
  }

  return { filters, errors };
}

/**
 * The Prisma filter for the board. Pure: takes the viewing seller's ID, their category IDs and the
 * current time. The viewer's own requirements are always excluded.
 */
export function buildBoardWhere(
  filters: BoardFilters,
  viewerUserId: string,
  sellerCategoryIds: string[],
  now: Date,
): Prisma.RequirementWhereInput {
  const and: Prisma.RequirementWhereInput[] = [
    { buyerId: { not: viewerUserId } },
    { OR: [{ deadline: null }, { deadline: { gte: now } }] },
  ];

  if (filters.gemstoneType) {
    and.push({ gemstoneType: { contains: filters.gemstoneType, mode: "insensitive" } });
  }
  if (filters.caratMin !== undefined) {
    and.push({ OR: [{ caratMax: null }, { caratMax: { gte: filters.caratMin } }] });
  }
  if (filters.caratMax !== undefined) {
    and.push({ OR: [{ caratMin: null }, { caratMin: { lte: filters.caratMax } }] });
  }
  if (filters.budgetMinMinor !== undefined || filters.budgetMaxMinor !== undefined) {
    and.push({ currency: filters.currency });
  }
  if (filters.budgetMinMinor !== undefined) {
    const min = filters.budgetMinMinor;
    and.push({ OR: [{ budgetMaxMinor: null }, { budgetMaxMinor: { gte: min } }] });
  }
  if (filters.budgetMaxMinor !== undefined) {
    const max = filters.budgetMaxMinor;
    and.push({ OR: [{ budgetMinMinor: null }, { budgetMinMinor: { lte: max } }] });
  }
  if (filters.certificateNeeded) and.push({ certificateNeeded: true });
  if (filters.deadlineBy) and.push({ deadline: { lte: filters.deadlineBy } });

  const categoryIds =
    filters.categoryId && sellerCategoryIds.includes(filters.categoryId) ? [filters.categoryId] : sellerCategoryIds;

  return { status: "OPEN", categoryId: { in: categoryIds }, AND: and };
}

export const BOARD_PAGE_SIZE = 60;

export async function loadRequirementBoard(sellerUserId: string, rawParams: RawParams, now = new Date()) {
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: sellerUserId },
    select: { categories: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
  });
  const categories = profile?.categories ?? [];
  const { filters, errors } = parseBoardFilters(rawParams);
  const rows = await prisma.requirement.findMany({
    where: buildBoardWhere(
      filters,
      sellerUserId,
      categories.map((c) => c.id),
      now,
    ),
    orderBy: { createdAt: "desc" },
    take: BOARD_PAGE_SIZE,
    select: {
      id: true,
      gemstoneType: true,
      shape: true,
      caratMin: true,
      caratMax: true,
      budgetMinMinor: true,
      budgetMaxMinor: true,
      currency: true,
      certificateNeeded: true,
      originPreference: true,
      quantity: true,
      deadline: true,
      createdAt: true,
      isDemo: true,
      category: { select: { name: true } },
      responses: { where: { sellerId: sellerUserId }, select: { conversationId: true }, take: 1 },
    },
  });
  return { categories, filters, errors, rows };
}
