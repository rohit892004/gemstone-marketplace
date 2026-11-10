import { recordAudit } from "@/lib/audit/audit";
import { AuditAction } from "@/lib/audit/actions";
import { prisma } from "@/lib/db/client";
import { parseMajorToMinor } from "@/lib/money/money";
import { CARAT_BANDS, CURRENCIES, QUALITY_GRADES, type CaratBandKey, type Currency, type QualityGrade } from "./engine";
import { VALUATION_CATEGORIES } from "./defaults";
import { normaliseMultiplierKey, MULTIPLIER_KINDS, parsePercentToBps, type MultiplierKind, type ParseResult } from "./admin-values";
import { parseReferencePriceCsv, serialiseReferencePriceCsv, type CsvError, type ReferencePriceRow } from "./admin-csv";

/**
 * Reference price table and multipliers, edited by admins. Every write is audited as REFERENCE_PRICES_CHANGED
 * and sets isDemo to false, so a demo row becomes a real one the moment an admin changes it.
 *
 * Money: stored as BigInt minor units. Input is a major-unit string parsed by parseMajorToMinor. No floats.
 */

export interface ReferencePriceEntry {
  id: string;
  gemstoneType: string;
  currency: string;
  qualityGrade: string;
  band: string;
  pricePerCaratMinor: bigint;
  isDemo: boolean;
  updatedAt: Date;
}

export interface MultiplierEntry {
  id: string;
  kind: string;
  key: string;
  label: string;
  bps: number;
  isDemo: boolean;
}

export async function loadReferencePriceEntries(): Promise<ReferencePriceEntry[]> {
  return prisma.referencePrice.findMany({
    orderBy: [{ gemstoneType: "asc" }, { currency: "asc" }, { qualityGrade: "asc" }, { band: "asc" }],
    select: { id: true, gemstoneType: true, currency: true, qualityGrade: true, band: true, pricePerCaratMinor: true, isDemo: true, updatedAt: true },
  });
}

export async function loadMultiplierEntries(): Promise<MultiplierEntry[]> {
  return prisma.valuationMultiplier.findMany({
    orderBy: [{ kind: "asc" }, { key: "asc" }],
    select: { id: true, kind: true, key: true, label: true, bps: true, isDemo: true },
  });
}

/** Rows for the CSV export. Only rows with a known type, currency, grade and band are exported, so a re-import works. */
export async function loadExportRows(): Promise<ReferencePriceRow[]> {
  const rows = await prisma.referencePrice.findMany({
    select: { gemstoneType: true, currency: true, qualityGrade: true, band: true, pricePerCaratMinor: true },
  });
  const out: ReferencePriceRow[] = [];
  for (const row of rows) {
    const gemstoneType = (VALUATION_CATEGORIES as readonly string[]).find((name) => name === row.gemstoneType);
    if (!gemstoneType) continue;
    if (!(CURRENCIES as readonly string[]).includes(row.currency)) continue;
    if (!(QUALITY_GRADES as readonly string[]).includes(row.qualityGrade)) continue;
    if (!CARAT_BANDS.some((band) => band.key === row.band)) continue;
    out.push({
      gemstoneType,
      currency: row.currency as Currency,
      qualityGrade: row.qualityGrade as QualityGrade,
      band: row.band as CaratBandKey,
      pricePerCaratMinor: row.pricePerCaratMinor,
    });
  }
  return out;
}

export function exportCsvText(rows: ReferencePriceRow[]): string {
  return serialiseReferencePriceCsv(rows);
}

export interface PriceCell {
  gemstoneType: string;
  currency: string;
  qualityGrade: string;
  band: string;
  priceMajor: string;
}

/** Validates one price cell from a form. Returns the parsed minor units, or a message for the field. */
export function parsePriceCell(cell: PriceCell): ParseResult<{
  gemstoneType: string;
  currency: Currency;
  qualityGrade: QualityGrade;
  band: CaratBandKey;
  pricePerCaratMinor: bigint;
}> {
  const gemstoneType = (VALUATION_CATEGORIES as readonly string[]).find((name) => name === cell.gemstoneType.trim());
  if (!gemstoneType) return { ok: false, error: "Choose a gemstone type from the list." };
  if (!(CURRENCIES as readonly string[]).includes(cell.currency)) return { ok: false, error: "Choose INR or USD." };
  if (!(QUALITY_GRADES as readonly string[]).includes(cell.qualityGrade)) return { ok: false, error: "Choose a quality grade." };
  if (!CARAT_BANDS.some((band) => band.key === cell.band)) return { ok: false, error: "Choose a carat band." };
  const price = parseMajorToMinor(cell.priceMajor);
  if (!price.ok) {
    return { ok: false, error: "Enter a price per carat above zero, such as 50000.00 (at most two decimals)." };
  }
  return {
    ok: true,
    value: {
      gemstoneType,
      currency: cell.currency as Currency,
      qualityGrade: cell.qualityGrade as QualityGrade,
      band: cell.band as CaratBandKey,
      pricePerCaratMinor: price.minor,
    },
  };
}

export async function savePriceRow(input: { admin: { id: string }; cell: PriceCell }): Promise<ParseResult<true>> {
  const parsed = parsePriceCell(input.cell);
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  await prisma.referencePrice.upsert({
    where: {
      gemstoneType_qualityGrade_band_currency: {
        gemstoneType: value.gemstoneType,
        qualityGrade: value.qualityGrade,
        band: value.band,
        currency: value.currency,
      },
    },
    create: { ...value, isDemo: false, updatedById: input.admin.id },
    update: { pricePerCaratMinor: value.pricePerCaratMinor, isDemo: false, updatedById: input.admin.id },
  });
  await recordAudit({
    action: AuditAction.REFERENCE_PRICES_CHANGED,
    actorId: input.admin.id,
    entityType: "ReferencePrice",
    meta: { rows: 1, gemstoneType: value.gemstoneType, currency: value.currency },
  });
  return { ok: true, value: true };
}

/**
 * Imports a CSV. All or nothing: the file is validated in full first, and rows are written in one transaction only
 * when every row is valid. Imported rows are real data (isDemo false).
 */
export async function importReferencePriceCsv(input: {
  admin: { id: string };
  text: string;
}): Promise<{ ok: true; rows: number } | { ok: false; errors: CsvError[] }> {
  const parsed = parseReferencePriceCsv(input.text);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  await prisma.$transaction(
    parsed.rows.map((row) =>
      prisma.referencePrice.upsert({
        where: {
          gemstoneType_qualityGrade_band_currency: {
            gemstoneType: row.gemstoneType,
            qualityGrade: row.qualityGrade,
            band: row.band,
            currency: row.currency,
          },
        },
        create: { ...row, isDemo: false, updatedById: input.admin.id },
        update: { pricePerCaratMinor: row.pricePerCaratMinor, isDemo: false, updatedById: input.admin.id },
      }),
    ),
  );
  await recordAudit({
    action: AuditAction.REFERENCE_PRICES_CHANGED,
    actorId: input.admin.id,
    entityType: "ReferencePrice",
    meta: { source: "csv_import", rows: parsed.rows.length },
  });
  return { ok: true, rows: parsed.rows.length };
}

/** Saves edited percentages. Each update is checked before any write, so a bad value changes nothing. */
export async function saveMultiplierPercents(input: {
  admin: { id: string };
  updates: Array<{ id: string; percent: string }>;
}): Promise<ParseResult<number>> {
  const parsedUpdates: Array<{ id: string; bps: number }> = [];
  for (const update of input.updates) {
    const bps = parsePercentToBps(update.percent);
    if (!bps.ok) return bps;
    parsedUpdates.push({ id: update.id, bps: bps.value });
  }
  const existing = await prisma.valuationMultiplier.findMany({
    where: { id: { in: parsedUpdates.map((u) => u.id) } },
    select: { id: true, bps: true },
  });
  const current = new Map(existing.map((row) => [row.id, row.bps]));
  const changed = parsedUpdates.filter((u) => current.has(u.id) && current.get(u.id) !== u.bps);
  if (changed.length === 0) return { ok: true, value: 0 };

  await prisma.$transaction(
    changed.map((u) => prisma.valuationMultiplier.update({ where: { id: u.id }, data: { bps: u.bps, isDemo: false } })),
  );
  await recordAudit({
    action: AuditAction.REFERENCE_PRICES_CHANGED,
    actorId: input.admin.id,
    entityType: "ValuationMultiplier",
    meta: { kind: "multipliers", rows: changed.length },
  });
  return { ok: true, value: changed.length };
}

export async function addMultiplier(input: {
  admin: { id: string };
  kind: string;
  key: string;
  label: string;
  percent: string;
}): Promise<ParseResult<true>> {
  if (!(MULTIPLIER_KINDS as readonly string[]).includes(input.kind)) return { ok: false, error: "Choose origin, treatment or lab." };
  const kind = input.kind as MultiplierKind;
  const key = normaliseMultiplierKey(input.key);
  if (!key.ok) return key;
  const label = input.label.trim();
  if (label.length === 0 || label.length > 80) return { ok: false, error: "Enter a label of 80 characters or fewer." };
  const bps = parsePercentToBps(input.percent);
  if (!bps.ok) return bps;

  const existing = await prisma.valuationMultiplier.findUnique({ where: { kind_key: { kind, key: key.value } }, select: { id: true } });
  if (existing) return { ok: false, error: "That key already exists for this kind. Edit its percentage instead." };

  await prisma.valuationMultiplier.create({
    data: { kind, key: key.value, label, bps: bps.value, isDemo: false },
  });
  await recordAudit({
    action: AuditAction.REFERENCE_PRICES_CHANGED,
    actorId: input.admin.id,
    entityType: "ValuationMultiplier",
    meta: { kind, rows: 1 },
  });
  return { ok: true, value: true };
}

/**
 * Saves edited prices from the table. Every value is checked first, and nothing is written unless all are valid.
 * Only rows whose price actually changed are written, and each becomes a real row (isDemo false).
 */
export async function saveEditedPrices(input: {
  admin: { id: string };
  updates: Array<{ id: string; priceMajor: string }>;
}): Promise<{ ok: true; changed: number } | { ok: false; error: string; fieldErrors: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {};
  const parsed: Array<{ id: string; minor: bigint }> = [];
  for (const update of input.updates) {
    const price = parseMajorToMinor(update.priceMajor);
    if (!price.ok) {
      fieldErrors[update.id] = "Enter an amount above zero with at most two decimals, such as 50000.00.";
      continue;
    }
    parsed.push({ id: update.id, minor: price.minor });
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Check the highlighted prices.", fieldErrors };
  }

  const existing = await prisma.referencePrice.findMany({
    where: { id: { in: parsed.map((p) => p.id) } },
    select: { id: true, pricePerCaratMinor: true },
  });
  const current = new Map(existing.map((row) => [row.id, row.pricePerCaratMinor]));
  const changes = parsed.filter((p) => current.has(p.id) && current.get(p.id) !== p.minor);
  if (changes.length === 0) return { ok: true, changed: 0 };

  await prisma.$transaction(
    changes.map((change) =>
      prisma.referencePrice.update({
        where: { id: change.id },
        data: { pricePerCaratMinor: change.minor, isDemo: false, updatedById: input.admin.id },
      }),
    ),
  );
  await recordAudit({
    action: AuditAction.REFERENCE_PRICES_CHANGED,
    actorId: input.admin.id,
    entityType: "ReferencePrice",
    meta: { source: "table", rows: changes.length },
  });
  return { ok: true, changed: changes.length };
}
