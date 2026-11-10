import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { formatMoney } from "@/lib/money/money";
import { getStorageProvider } from "@/lib/storage/storage";
import { QUALITY_GRADE_LABELS, type QualityGrade } from "./engine";
import { buildValuationPdf, type ValuationPdfRow } from "./pdf";
import { isResultReady } from "./access";
import { getValuationView, thumbKeyFor, type Actor, ValuationError } from "./service";
import { VALUATION_ROUTES } from "./routes";
import type { ValuationView } from "./view";

/**
 * Files that belong to a valuation: its photos and its PDF report. Both are gated by the same viewer rules as the
 * valuation itself. Route handlers call these and return the bytes; they do no access checks of their own.
 */

/** A photo or video. Requesters, assigned valuators and admins only. Null when not visible to the actor. */
export async function loadValuationMediaForActor(
  mediaId: string,
  actor: Actor,
  variant: "thumb" | "full",
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const media = await prisma.valuationMedia.findUnique({
    where: { id: mediaId },
    select: { valuationId: true, kind: true, storageKey: true, mimeType: true },
  });
  if (!media) return null;
  // getValuationView applies the viewer rules and throws NOT_FOUND for anyone else.
  try {
    await getValuationView(media.valuationId, actor);
  } catch (error) {
    if (error instanceof ValuationError) return null;
    throw error;
  }
  const storage = getStorageProvider();
  const wantThumb = variant === "thumb" && media.kind === "IMAGE";
  try {
    const bytes = await storage.get(wantThumb ? thumbKeyFor(media.storageKey) : media.storageKey);
    return { bytes, mimeType: wantThumb ? "image/webp" : media.mimeType };
  } catch {
    return null;
  }
}

/**
 * The PDF report. Only the requester and admins may download it, and only once a result exists (or after it was
 * withdrawn, so the copy the requester holds still explains the withdrawal). Valuators never download the PDF.
 * The PDF has no requester field.
 */
export async function renderValuationReport(valuationId: string, actor: Actor): Promise<{ bytes: Buffer; filename: string } | null> {
  if (actor.role === "VALUATOR") return null;
  let view: ValuationView;
  try {
    view = await getValuationView(valuationId, actor);
  } catch (error) {
    if (error instanceof ValuationError) return null;
    throw error;
  }
  if (!isResultReady(view.status) && !view.withdrawn) return null;

  const row = await prisma.valuation.findUnique({ where: { id: valuationId }, select: { autoFactors: true, isDemo: true } });
  const factors = Array.isArray(row?.autoFactors) ? (row?.autoFactors as unknown[]).filter((f): f is string => typeof f === "string") : [];
  const result = view.result;
  const currency = view.currency;

  const rows: ValuationPdfRow[] = [
    { label: "Gemstone type", value: view.gemstoneType },
    ...(view.categoryName ? [{ label: "Category", value: view.categoryName }] : []),
    ...(view.shape ? [{ label: "Shape / cut", value: view.shape }] : []),
    ...(view.caratMilli !== null ? [{ label: "Carat", value: `${(view.caratMilli / 1000).toFixed(3)} ct` }] : []),
    ...(view.dimensions ? [{ label: "Dimensions", value: view.dimensions }] : []),
    ...(view.colour ? [{ label: "Colour", value: view.colour }] : []),
    ...(view.clarity ? [{ label: "Clarity", value: view.clarity }] : []),
    ...(view.qualityGrade ? [{ label: "Quality grade", value: QUALITY_GRADE_LABELS[view.qualityGrade as QualityGrade] ?? view.qualityGrade }] : []),
    ...(view.origin ? [{ label: "Origin", value: view.origin }] : []),
    ...(view.treatment ? [{ label: "Treatment", value: view.treatment }] : []),
    ...(view.labName ? [{ label: "Certificate lab", value: view.labName }] : []),
    ...(view.certificateNumber ? [{ label: "Certificate number", value: view.certificateNumber }] : []),
  ];

  const issued = view.completedAt ?? view.submittedAt ?? view.createdAt;
  const pdf = buildValuationPdf({
    reference: view.reference,
    verifyUrl: `${getEnv().APP_URL}${VALUATION_ROUTES.verify(view.reference)}`,
    issuedLabel: issued.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    statusLabel: view.withdrawn ? "Withdrawn" : result ? "Valid" : "Not complete",
    valuedByLabel: result ? (result.valuedBy === "EXPERT" ? "Expert review (valuer sign-off)" : "Automatic (rule-based, indicative)") : null,
    rows,
    estimateLabel: result ? formatMoney(result.estimateMinor, currency) : null,
    rangeLabel: result ? `${formatMoney(result.lowMinor, currency)} to ${formatMoney(result.highMinor, currency)}` : null,
    confidenceLabel: result ? result.confidence : null,
    factors,
    isDemo: row?.isDemo ?? false,
    withdrawn: view.withdrawn,
  });
  return { bytes: pdf, filename: `${view.reference}.pdf` };
}
