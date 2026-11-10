import { randomBytes } from "node:crypto";
import type { Role } from "@/app/generated/prisma/client";
import { recordAudit } from "@/lib/audit/audit";
import { AuditAction } from "@/lib/audit/actions";
import { prisma } from "@/lib/db/client";
import { NOTIFICATION_TYPES, notify } from "@/lib/notifications/service";
import type { NotificationType } from "@/lib/notifications/rules";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { processMedia, MEDIA_ERROR_TEXT } from "@/lib/media/pipeline";
import { getStorageProvider } from "@/lib/storage/storage";
import { canActAsValuator, canPublishOnListing, canRequestValuation, canViewValuation, isResultReady, type ValuationAccessRecord } from "./access";
import { formatMoney } from "@/lib/money/money";
import { applyExpertThreshold, runValuationEngine, normaliseKey, type CaratBandKey, type Currency, type EngineOutput, type MultiplierTable, type QualityGrade, type ReferenceRow, type ValuationInput } from "./engine";
import { newValuationReference } from "./reference";
import { VALUATION_ROUTES } from "./routes";
import { categoryThresholdKey, EXPERT_THRESHOLD_KEY, parseThresholdSetting, resolveExpertThreshold } from "./thresholds";
import { CONTACT_REFUSAL, parseSignOff, parseThreadText, parseValuationDetails, type SignOffInput, type ValuationDetails } from "./validate";
import { buildValuationView, type ViewRecord, type ValuationView, type ViewerRole } from "./view";

/**
 * Valuation service. Every function takes the acting user from the server session (never from the client)
 * and checks the rules itself, so a server action that forgets a check still cannot break the rule.
 *
 * Statuses: DRAFT -> AUTO_VALUED (engine result) or IN_EXPERT_REVIEW (routed to a valuator).
 *   IN_EXPERT_REVIEW <-> NEEDS_INFO. IN_EXPERT_REVIEW -> COMPLETED (sign-off) or REJECTED.
 *   AUTO_VALUED or COMPLETED -> withdrawn by an admin (withdrawnAt is set; the status stays).
 *
 * Each status change writes an audit row and notifies the requester (and the valuator, where relevant).
 * Notification text is fixed. No user-written text and no contact details are ever sent by email.
 */

export type ValuationErrorCode = "NOT_FOUND" | "NOT_ALLOWED" | "INVALID" | "LIMIT" | "RATE_LIMITED" | "CONFLICT" | "CONTACT_DETAILS";

export class ValuationError extends Error {
  constructor(
    public readonly code: ValuationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ValuationError";
  }
}

export interface Actor {
  id: string;
  role: Role;
}

export const SUBMIT_LIMIT = { limit: 10, windowSeconds: 24 * 60 * 60 } as const;
export const MAX_IMAGES = 12;
export const MAX_VIDEOS = 1;
export const MAX_THREAD_TEXT = 1000;

const LOAD_INCLUDE = {
  requester: { select: { id: true, name: true, email: true } },
  assignedValuator: { select: { id: true, name: true } },
  certificateLab: { select: { name: true } },
  gemstone: { select: { id: true, seller: { select: { userId: true } } } },
  media: { select: { id: true, kind: true, mimeType: true, sortOrder: true, storageKey: true }, orderBy: { sortOrder: "asc" as const } },
  notes_: {
    select: { id: true, kind: true, body: true, createdAt: true, authorId: true, author: { select: { role: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

type LoadedRow = NonNullable<Awaited<ReturnType<typeof loadRow>>>;

async function loadRow(id: string) {
  return prisma.valuation.findUnique({ where: { id }, include: LOAD_INCLUDE });
}

function toViewRecord(row: LoadedRow, categoryName: string | null): ViewRecord {
  return {
    id: row.id,
    reference: row.reference,
    requesterId: row.requesterId,
    source: row.source,
    status: row.status,
    gemstoneId: row.gemstoneId,
    listingSellerUserId: row.gemstone?.seller.userId ?? null,
    gemstoneType: row.gemstoneType,
    categoryName,
    shape: row.shape,
    caratMilli: row.caratMilli,
    dimensions: row.dimensions,
    colour: row.colour,
    clarity: row.clarity,
    qualityGrade: row.qualityGrade,
    origin: row.origin,
    treatment: row.treatment,
    labName: row.certificateLab?.name ?? null,
    certificateNumber: row.certificateNumber,
    notes: row.notes,
    currency: row.currency,
    requestExpert: row.requestExpert,
    autoEstimateMinor: row.autoEstimateMinor,
    autoLowMinor: row.autoLowMinor,
    autoHighMinor: row.autoHighMinor,
    autoConfidence: row.autoConfidence,
    expertReasons: row.expertReasons,
    finalEstimateMinor: row.finalEstimateMinor,
    finalLowMinor: row.finalLowMinor,
    finalHighMinor: row.finalHighMinor,
    finalConfidence: row.finalConfidence,
    assignedValuatorId: row.assignedValuatorId,
    assignedValuator: row.assignedValuator,
    rejectionReason: row.rejectionReason,
    withdrawnAt: row.withdrawnAt,
    withdrawnReason: row.withdrawnReason,
    publishedOnListing: row.publishedOnListing,
    submittedAt: row.submittedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    requester: row.requester,
    media: row.media.map((m) => ({ id: m.id, kind: m.kind, mimeType: m.mimeType, sortOrder: m.sortOrder })),
    thread: row.notes_.map((n) => ({ id: n.id, kind: n.kind, body: n.body, createdAt: n.createdAt, authorId: n.authorId, authorRole: n.author.role })),
  };
}

function accessRecord(row: { requesterId: string; assignedValuatorId: string | null; status: string; withdrawnAt: Date | null }): ValuationAccessRecord {
  return { requesterId: row.requesterId, assignedValuatorId: row.assignedValuatorId, status: row.status, withdrawnAt: row.withdrawnAt };
}

async function categoryNameFor(categoryId: string | null): Promise<string | null> {
  if (!categoryId) return null;
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { name: true } });
  return category?.name ?? null;
}

/** Loads a valuation the viewer may see. Otherwise NOT_FOUND, so no one can tell a missing ID from a private one. */
async function loadViewable(valuationId: string, actor: Actor) {
  const row = await loadRow(valuationId);
  if (!row || !canViewValuation(actor, accessRecord(row))) {
    throw new ValuationError("NOT_FOUND", "This valuation is not available.");
  }
  return row;
}

/** Loads a valuation the actor requested. Anyone else gets NOT_FOUND. */
async function loadOwnRequest(valuationId: string, actor: Actor) {
  const row = await loadRow(valuationId);
  if (!row || row.requesterId !== actor.id) throw new ValuationError("NOT_FOUND", "This valuation is not available.");
  return row;
}

function assertRole(actor: Actor, role: Role, message: string): void {
  if (actor.role !== role) throw new ValuationError("NOT_ALLOWED", message);
}

/** The viewer-specific view of a valuation. Use this for every page and server action that shows one. */
export async function getValuationView(valuationId: string, actor: Actor): Promise<ValuationView> {
  const row = await loadViewable(valuationId, actor);
  const categoryName = await categoryNameFor(row.categoryId);
  const viewerRole: ViewerRole = actor.role === "ADMIN" ? "ADMIN" : actor.role === "VALUATOR" ? "VALUATOR" : "REQUESTER";
  return buildValuationView({ id: actor.id, role: viewerRole }, toViewRecord(row, categoryName));
}

// ---------------------------------------------------------------------------------------------------------------
// Requester: create, details, media
// ---------------------------------------------------------------------------------------------------------------

export interface CreateDraftInput {
  requesterId: string;
  /** Set when the request starts on a product page. The listing's details and images are copied in. */
  gemstoneId?: string | null;
}

export async function createValuationDraft(input: CreateDraftInput): Promise<{ valuationId: string }> {
  const user = await prisma.user.findUnique({
    where: { id: input.requesterId },
    select: { role: true, status: true, sellerProfile: { select: { approvalStatus: true } } },
  });
  if (!user || user.status !== "ACTIVE" || !canRequestValuation({ role: user.role, approvalStatus: user.sellerProfile?.approvalStatus ?? null })) {
    throw new ValuationError("NOT_ALLOWED", "Only approved sellers and buyers can request a valuation.");
  }

  const gemstone = input.gemstoneId
    ? await prisma.gemstone.findUnique({
        where: { id: input.gemstoneId },
        select: {
          id: true,
          status: true,
          species: true,
          categoryId: true,
          shape: true,
          caratWeight: true,
          dimensions: true,
          colour: true,
          clarity: true,
          origin: true,
          treatment: true,
          certificateLabId: true,
          certificateNo: true,
          currency: true,
          seller: { select: { userId: true } },
          media: { where: { type: "IMAGE", status: "READY" }, orderBy: { sortOrder: "asc" }, select: { fileKey: true, thumbKey: true, mimeType: true } },
        },
      })
    : null;
  if (input.gemstoneId && (!gemstone || (gemstone.status !== "PUBLISHED" && gemstone.seller.userId !== input.requesterId))) {
    throw new ValuationError("NOT_FOUND", "This gemstone is not available for valuation.");
  }

  const currency: Currency = gemstone && (gemstone.currency === "INR" || gemstone.currency === "USD") ? gemstone.currency : "INR";
  const reference = await createRowWithUniqueReference({
    requesterId: input.requesterId,
    source: gemstone ? "LISTING" : "STANDALONE",
    gemstoneId: gemstone?.id ?? null,
    gemstoneType: gemstone?.species?.trim() || "",
    categoryId: gemstone?.categoryId ?? null,
    shape: gemstone?.shape ?? null,
    caratMilli: gemstone?.caratWeight ? Math.round(Number(gemstone.caratWeight.toString()) * 1000) : null,
    dimensions: gemstone?.dimensions ?? null,
    colour: gemstone?.colour ?? null,
    clarity: gemstone?.clarity ?? null,
    origin: gemstone?.origin ?? null,
    treatment: gemstone?.treatment ?? null,
    labId: gemstone?.certificateLabId ?? null,
    certificateNumber: gemstone?.certificateNo ?? null,
    currency,
  });

  if (gemstone) {
    // Copy the listing's images into private valuation storage. The listing's own files are not shared.
    const storage = getStorageProvider();
    let sortOrder = 0;
    for (const image of gemstone.media.slice(0, MAX_IMAGES)) {
      try {
        const main = await storage.get(image.fileKey);
        const thumb = image.thumbKey ? await storage.get(image.thumbKey) : main;
        const key = mediaKey(reference.id, "webp");
        await storage.put(key, main);
        await storage.put(thumbKeyFor(key), thumb);
        await prisma.valuationMedia.create({
          data: { valuationId: reference.id, kind: "IMAGE", storageKey: key, mimeType: image.mimeType, sizeBytes: main.length, sortOrder },
        });
        sortOrder += 1;
      } catch {
        // A missing listing image should not stop the request. The requester can add their own photos.
      }
    }
  }

  await recordAudit({
    action: AuditAction.VALUATION_CREATED,
    actorId: input.requesterId,
    entityType: "Valuation",
    entityId: reference.id,
    meta: { source: gemstone ? "LISTING" : "STANDALONE" },
  });
  return { valuationId: reference.id };
}

async function createRowWithUniqueReference(data: {
  requesterId: string;
  source: "LISTING" | "STANDALONE";
  gemstoneId: string | null;
  gemstoneType: string;
  categoryId: string | null;
  shape: string | null;
  caratMilli: number | null;
  dimensions: string | null;
  colour: string | null;
  clarity: string | null;
  origin: string | null;
  treatment: string | null;
  labId: string | null;
  certificateNumber: string | null;
  currency: Currency;
}): Promise<{ id: string }> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = newValuationReference(randomBytes, new Date().getUTCFullYear());
    try {
      const row = await prisma.valuation.create({ data: { ...data, reference, status: "DRAFT" }, select: { id: true } });
      return row;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new ValuationError("CONFLICT", "Could not allocate a reference. Try again.");
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

function editableBy(row: { status: string }): boolean {
  return row.status === "DRAFT" || row.status === "NEEDS_INFO";
}

/** Saves the stone details. Allowed while DRAFT, and while the valuator has asked for more information. */
export async function updateValuationDetails(input: { valuationId: string; actor: Actor; raw: unknown }): Promise<void> {
  const row = await loadOwnRequest(input.valuationId, input.actor);
  if (!editableBy(row)) throw new ValuationError("NOT_ALLOWED", "These details can no longer be changed.");

  const parsed = parseValuationDetails(input.raw);
  if (!parsed.ok) throw new ValuationError("INVALID", parsed.error);
  const value: ValuationDetails = parsed.value;

  if (value.categoryId && !(await prisma.category.findUnique({ where: { id: value.categoryId }, select: { id: true } }))) {
    throw new ValuationError("INVALID", "Choose a category from the list.");
  }
  if (value.labId && !(await prisma.certificateLab.findFirst({ where: { id: value.labId, active: true }, select: { id: true } }))) {
    throw new ValuationError("INVALID", "Choose a certificate lab from the list.");
  }

  await prisma.valuation.update({
    where: { id: row.id },
    data: {
      gemstoneType: value.gemstoneType,
      categoryId: value.categoryId,
      shape: value.shape,
      caratMilli: value.caratMilli,
      dimensions: value.dimensions,
      colour: value.colour,
      clarity: value.clarity,
      qualityGrade: value.qualityGrade,
      origin: value.origin,
      treatment: value.treatment,
      labId: value.labId,
      certificateNumber: value.certificateNumber,
      notes: value.notes,
      currency: value.currency,
    },
  });
}

/** Sets whether a valuation asks for expert review. Only before submission. */
export async function setRequestExpert(input: { valuationId: string; actor: Actor; requestExpert: boolean }): Promise<void> {
  const row = await loadOwnRequest(input.valuationId, input.actor);
  if (row.status !== "DRAFT") throw new ValuationError("NOT_ALLOWED", "This valuation has already been submitted.");
  await prisma.valuation.update({ where: { id: row.id }, data: { requestExpert: input.requestExpert } });
}

function mediaKey(valuationId: string, ext: string): string {
  return `valuations/${valuationId}/${randomBytes(12).toString("hex")}.${ext}`;
}

/** The thumbnail of an image is stored beside its main file. */
export function thumbKeyFor(mainKey: string): string {
  return mainKey.replace(/\.webp$/, "-thumb.webp");
}

/** Adds one photo or video. The file goes through the same validation and EXIF-stripping pipeline as listings. */
export async function addValuationMedia(input: { valuationId: string; actor: Actor; bytes: Buffer }): Promise<{ mediaId: string }> {
  const row = await loadOwnRequest(input.valuationId, input.actor);
  if (!editableBy(row)) throw new ValuationError("NOT_ALLOWED", "Photos can no longer be added to this valuation.");

  const processed = await processMedia(input.bytes);
  if (!processed.ok) throw new ValuationError("INVALID", MEDIA_ERROR_TEXT[processed.reason]);
  const media = processed.media;

  const existing = await prisma.valuationMedia.groupBy({ by: ["kind"], where: { valuationId: row.id }, _count: { _all: true } });
  const count = (kind: "IMAGE" | "VIDEO") => existing.find((e) => e.kind === kind)?._count._all ?? 0;
  if (media.kind === "IMAGE" && count("IMAGE") >= MAX_IMAGES) throw new ValuationError("LIMIT", `Up to ${MAX_IMAGES} photos per valuation.`);
  if (media.kind === "VIDEO" && count("VIDEO") >= MAX_VIDEOS) throw new ValuationError("LIMIT", "Only one video per valuation.");

  const storage = getStorageProvider();
  const key = mediaKey(row.id, media.kind === "IMAGE" ? "webp" : media.ext);
  const thumb = media.kind === "IMAGE" ? thumbKeyFor(key) : null;
  await storage.put(key, media.kind === "IMAGE" ? media.main.data : media.data);
  if (thumb && media.kind === "IMAGE") await storage.put(thumb, media.thumb.data);

  try {
    const created = await prisma.valuationMedia.create({
      data: {
        valuationId: row.id,
        kind: media.kind,
        storageKey: key,
        mimeType: media.kind === "IMAGE" ? "image/webp" : media.mimeType,
        sizeBytes: media.sizeBytes,
        sortOrder: row.media.length,
      },
      select: { id: true },
    });
    await recordAudit({
      action: AuditAction.VALUATION_MEDIA_ADDED,
      actorId: input.actor.id,
      entityType: "Valuation",
      entityId: row.id,
      meta: { kind: media.kind, sizeBytes: media.sizeBytes },
    });
    return { mediaId: created.id };
  } catch (error) {
    await storage.delete(key).catch(() => undefined);
    if (thumb) await storage.delete(thumb).catch(() => undefined);
    throw error;
  }
}

export async function removeValuationMedia(input: { valuationId: string; mediaId: string; actor: Actor }): Promise<void> {
  const row = await loadOwnRequest(input.valuationId, input.actor);
  if (!editableBy(row)) throw new ValuationError("NOT_ALLOWED", "Photos can no longer be removed from this valuation.");
  const media = await prisma.valuationMedia.findFirst({ where: { id: input.mediaId, valuationId: row.id } });
  if (!media) throw new ValuationError("NOT_FOUND", "This photo is not available.");
  await prisma.valuationMedia.delete({ where: { id: media.id } });
  const storage = getStorageProvider();
  await storage.delete(media.storageKey).catch(() => undefined);
  if (media.kind === "IMAGE") await storage.delete(thumbKeyFor(media.storageKey)).catch(() => undefined);
}

// ---------------------------------------------------------------------------------------------------------------
// Engine inputs
// ---------------------------------------------------------------------------------------------------------------

async function loadReferenceRows(gemstoneType: string, currency: Currency): Promise<ReferenceRow[]> {
  const rows = await prisma.referencePrice.findMany({
    where: { currency, gemstoneType: { equals: gemstoneType, mode: "insensitive" } },
  });
  const out: ReferenceRow[] = [];
  for (const row of rows) {
    const band = row.band as CaratBandKey;
    if (row.currency !== "INR" && row.currency !== "USD") continue;
    out.push({
      gemstoneType: row.gemstoneType,
      qualityGrade: row.qualityGrade as QualityGrade,
      band,
      pricePerCaratMinor: row.pricePerCaratMinor,
      currency: row.currency,
    });
  }
  return out;
}

async function loadMultipliers(): Promise<MultiplierTable> {
  const rows = await prisma.valuationMultiplier.findMany();
  const table: MultiplierTable = { origin: {}, treatment: {}, lab: {} };
  for (const row of rows) {
    if (row.kind === "origin" || row.kind === "treatment" || row.kind === "lab") {
      table[row.kind][row.kind === "lab" ? row.key.toLowerCase() : normaliseKey(row.key)] = row.bps;
    }
  }
  return table;
}

/** The expert threshold for a category: the category override when set, otherwise the global value. */
export async function expertThresholdFor(categoryId: string | null): Promise<bigint | null> {
  const keys = [EXPERT_THRESHOLD_KEY, ...(categoryId ? [categoryThresholdKey(categoryId)] : [])];
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const global = parseThresholdSetting(byKey.get(EXPERT_THRESHOLD_KEY));
  const override = categoryId ? parseThresholdSetting(byKey.get(categoryThresholdKey(categoryId))) : null;
  return resolveExpertThreshold(global, override);
}

/** Runs the engine on the stored request. Pure logic is in engine.ts; this only loads the inputs. */
export async function evaluateValuation(row: {
  gemstoneType: string;
  categoryId: string | null;
  caratMilli: number | null;
  qualityGrade: string | null;
  currency: string;
  origin: string | null;
  treatment: string | null;
  labId: string | null;
  certificateNumber: string | null;
  dimensions: string | null;
  colour: string | null;
  clarity: string | null;
  requestExpert: boolean;
}): Promise<EngineOutput> {
  const currency: Currency = row.currency === "USD" ? "USD" : "INR";
  const lab = row.labId ? await prisma.certificateLab.findUnique({ where: { id: row.labId }, select: { code: true } }) : null;
  const input: ValuationInput = {
    gemstoneType: row.gemstoneType,
    qualityGrade: (row.qualityGrade as QualityGrade | null) ?? null,
    caratMilli: row.caratMilli,
    currency,
    origin: row.origin,
    treatment: row.treatment,
    labCode: lab?.code ?? null,
    certificateNumber: row.certificateNumber,
    dimensionsGiven: Boolean(row.dimensions),
    colourGiven: Boolean(row.colour),
    clarityGiven: Boolean(row.clarity),
  };
  const reference = row.gemstoneType.trim() ? await loadReferenceRows(row.gemstoneType.trim(), currency) : [];
  const multipliers = await loadMultipliers();
  let output = runValuationEngine(input, reference, multipliers);
  output = applyExpertThreshold(output, await expertThresholdFor(row.categoryId));
  if (row.requestExpert && !output.expertReasons.includes("REQUESTED")) {
    output = { ...output, expertReasons: [...output.expertReasons, "REQUESTED"] };
  }
  return output;
}

// ---------------------------------------------------------------------------------------------------------------
// Submission and routing
// ---------------------------------------------------------------------------------------------------------------

const REQUESTER_STATUS_TEXT: Partial<Record<string, { title: string; body: string }>> = {
  AUTO_VALUED: {
    title: "Valuation ready",
    body: "Your indicative valuation is ready. Open it on Gemstone Selections to see the result.",
  },
  IN_EXPERT_REVIEW: {
    title: "Valuation with an expert",
    body: "Your valuation request is with an expert valuer. Open it on Gemstone Selections to follow progress.",
  },
  COMPLETED: {
    title: "Valuation completed",
    body: "An expert has completed your valuation. Open it on Gemstone Selections to see the result.",
  },
  REJECTED: {
    title: "Valuation not completed",
    body: "Your valuation request could not be completed. Open it on Gemstone Selections to see the reason.",
  },
};

async function notifyRequester(requesterId: string, valuationId: string, copy: { title: string; body: string }, type: NotificationType = NOTIFICATION_TYPES.VALUATION_STATUS) {
  await notify({ userId: requesterId, type, title: copy.title, body: copy.body, href: VALUATION_ROUTES.result(valuationId) });
}

export async function submitValuation(input: { valuationId: string; actor: Actor; requestExpert: boolean }): Promise<{ status: string }> {
  const row = await loadOwnRequest(input.valuationId, input.actor);
  if (row.status !== "DRAFT") throw new ValuationError("NOT_ALLOWED", "This valuation has already been submitted.");

  const hasImage = row.media.some((m) => m.kind === "IMAGE");
  if (!hasImage) throw new ValuationError("INVALID", "Add at least one photo of the stone before you submit.");

  const limit = await consumeRateLimit({ key: `valuation:submit:${input.actor.id}`, ...SUBMIT_LIMIT });
  if (!limit.allowed) {
    throw new ValuationError("RATE_LIMITED", `You have reached the limit for valuation requests. Try again in about ${Math.ceil(limit.retryAfterSeconds / 3600)} hour(s).`);
  }

  const now = new Date();
  const output = await evaluateValuation({ ...row, requestExpert: input.requestExpert });
  const automatic = output.estimate !== null && output.expertReasons.length === 0;
  const status = automatic ? "AUTO_VALUED" : "IN_EXPERT_REVIEW";

  const result = await prisma.valuation.updateMany({
    where: { id: row.id, status: "DRAFT" },
    data: {
      status,
      submittedAt: now,
      requestExpert: input.requestExpert,
      autoEstimateMinor: output.estimate?.estimateMinor ?? null,
      autoLowMinor: output.estimate?.lowMinor ?? null,
      autoHighMinor: output.estimate?.highMinor ?? null,
      autoConfidence: output.confidence,
      autoFactors: output.factors,
      expertReasons: output.expertReasons,
      valuedBy: automatic ? "AUTO" : null,
      completedAt: automatic ? now : null,
    },
  });
  if (result.count !== 1) throw new ValuationError("CONFLICT", "This valuation has already been submitted.");

  await recordAudit({
    action: AuditAction.VALUATION_SUBMITTED,
    actorId: input.actor.id,
    entityType: "Valuation",
    entityId: row.id,
    meta: { status, reasons: output.expertReasons.join(","), confidence: output.confidence },
  });
  if (automatic) {
    await recordAudit({ action: AuditAction.VALUATION_AUTO_VALUED, actorId: null, entityType: "Valuation", entityId: row.id, meta: { confidence: output.confidence } });
  }
  await notifyRequester(row.requesterId, row.id, REQUESTER_STATUS_TEXT[status]!);
  return { status };
}

// ---------------------------------------------------------------------------------------------------------------
// Needs-info thread
// ---------------------------------------------------------------------------------------------------------------

/** Valuator asks the requester for more information. The question is shown on the site, not in the email. */
export async function requestValuationInfo(input: { valuationId: string; valuator: Actor; body: unknown }): Promise<void> {
  assertRole(input.valuator, "VALUATOR", "Only valuators can ask for more information.");
  const row = await loadRow(input.valuationId);
  if (!row || !canActAsValuator(input.valuator, accessRecord(row)) || row.status !== "IN_EXPERT_REVIEW" || row.withdrawnAt) {
    throw new ValuationError("NOT_ALLOWED", "You can only ask for more information on your assigned requests.");
  }
  const text = parseThreadText(input.body, "your question", MAX_THREAD_TEXT);
  if (!text.ok) throw new ValuationError(text.error === CONTACT_REFUSAL ? "CONTACT_DETAILS" : "INVALID", text.error);

  const moved = await prisma.$transaction(async (tx) => {
    const update = await tx.valuation.updateMany({
      where: { id: row.id, status: "IN_EXPERT_REVIEW", assignedValuatorId: input.valuator.id },
      data: { status: "NEEDS_INFO" },
    });
    if (update.count !== 1) return false;
    await tx.valuationNote.create({ data: { valuationId: row.id, authorId: input.valuator.id, kind: "INFO_REQUEST", body: text.value } });
    return true;
  });
  if (!moved) throw new ValuationError("CONFLICT", "This valuation changed while you were working on it. Reload and try again.");

  await recordAudit({ action: AuditAction.VALUATION_INFO_REQUESTED, actorId: input.valuator.id, entityType: "Valuation", entityId: row.id, meta: {} });
  await notifyRequester(row.requesterId, row.id, {
    title: "More information needed",
    body: "The valuer needs one more detail for your valuation. Open it on Gemstone Selections to reply.",
  }, NOTIFICATION_TYPES.VALUATION_INFO_REQUESTED);
}

/** The requester answers the valuator's question. Photos and details can be added at the same time. */
export async function answerValuationInfoRequest(input: { valuationId: string; actor: Actor; body: unknown }): Promise<void> {
  const row = await loadOwnRequest(input.valuationId, input.actor);
  if (row.status !== "NEEDS_INFO") throw new ValuationError("NOT_ALLOWED", "There is no open question on this valuation.");
  const text = parseThreadText(input.body, "your reply", MAX_THREAD_TEXT);
  if (!text.ok) throw new ValuationError(text.error === CONTACT_REFUSAL ? "CONTACT_DETAILS" : "INVALID", text.error);

  const moved = await prisma.$transaction(async (tx) => {
    const update = await tx.valuation.updateMany({ where: { id: row.id, status: "NEEDS_INFO" }, data: { status: "IN_EXPERT_REVIEW" } });
    if (update.count !== 1) return false;
    await tx.valuationNote.create({ data: { valuationId: row.id, authorId: input.actor.id, kind: "INFO_RESPONSE", body: text.value } });
    return true;
  });
  if (!moved) throw new ValuationError("CONFLICT", "This valuation changed. Reload and try again.");

  await recordAudit({ action: AuditAction.VALUATION_INFO_ANSWERED, actorId: input.actor.id, entityType: "Valuation", entityId: row.id, meta: {} });
  if (row.assignedValuatorId) {
    await notify({
      userId: row.assignedValuatorId,
      type: NOTIFICATION_TYPES.VALUATION_INFO_ANSWERED,
      title: "Valuation: reply received",
      body: "The requester has replied to your question. Open your queue to continue.",
      href: VALUATION_ROUTES.valuatorDetail(row.id),
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Valuator decisions
// ---------------------------------------------------------------------------------------------------------------

/** Sign-off: the valuator sets the value, the range and the confidence, with a note. Completes the valuation. */
export async function signOffValuation(input: {
  valuationId: string;
  valuator: Actor;
  raw: { estimate: unknown; low: unknown; high: unknown; confidence: unknown; notes: unknown };
}): Promise<void> {
  assertRole(input.valuator, "VALUATOR", "Only valuators can sign off a valuation.");
  const row = await loadRow(input.valuationId);
  if (!row || !canActAsValuator(input.valuator, accessRecord(row)) || row.status !== "IN_EXPERT_REVIEW" || row.withdrawnAt) {
    throw new ValuationError("NOT_ALLOWED", "You can only sign off your assigned requests that are in review.");
  }
  const parsed = parseSignOff(input.raw);
  if (!parsed.ok) {
    throw new ValuationError(parsed.error === CONTACT_REFUSAL ? "CONTACT_DETAILS" : "INVALID", parsed.error);
  }
  const value: SignOffInput = parsed.value;
  const now = new Date();

  const done = await prisma.$transaction(async (tx) => {
    const update = await tx.valuation.updateMany({
      where: { id: row.id, status: "IN_EXPERT_REVIEW", assignedValuatorId: input.valuator.id },
      data: {
        status: "COMPLETED",
        valuedBy: "EXPERT",
        finalEstimateMinor: value.estimateMinor,
        finalLowMinor: value.lowMinor,
        finalHighMinor: value.highMinor,
        finalConfidence: value.confidence,
        completedAt: now,
      },
    });
    if (update.count !== 1) return false;
    await tx.valuationNote.create({ data: { valuationId: row.id, authorId: input.valuator.id, kind: "SIGNOFF", body: value.notes } });
    return true;
  });
  if (!done) throw new ValuationError("CONFLICT", "This valuation changed while you were working on it. Reload and try again.");

  await recordAudit({
    action: AuditAction.VALUATION_SIGNED_OFF,
    actorId: input.valuator.id,
    entityType: "Valuation",
    entityId: row.id,
    meta: { confidence: value.confidence },
  });
  await notifyRequester(row.requesterId, row.id, REQUESTER_STATUS_TEXT.COMPLETED!);
}

/** Rejects a request with a reason. A valuator may reject their own assigned requests; an admin may reject any open one. */
export async function rejectValuation(input: { valuationId: string; actor: Actor; reason: unknown }): Promise<void> {
  const row = await loadRow(input.valuationId);
  const allowed =
    !!row &&
    (input.actor.role === "ADMIN" || canActAsValuator(input.actor, accessRecord(row))) &&
    (row.status === "IN_EXPERT_REVIEW" || row.status === "NEEDS_INFO") &&
    row.withdrawnAt === null;
  if (!row || !allowed) throw new ValuationError("NOT_ALLOWED", "This valuation cannot be rejected now.");
  const text = parseThreadText(input.reason, "a reason", 500);
  if (!text.ok) throw new ValuationError(text.error === CONTACT_REFUSAL ? "CONTACT_DETAILS" : "INVALID", text.error);

  const update = await prisma.valuation.updateMany({
    where: { id: row.id, status: { in: ["IN_EXPERT_REVIEW", "NEEDS_INFO"] } },
    data: { status: "REJECTED", rejectionReason: text.value },
  });
  if (update.count !== 1) throw new ValuationError("CONFLICT", "This valuation changed. Reload and try again.");

  await recordAudit({ action: AuditAction.VALUATION_REJECTED, actorId: input.actor.id, entityType: "Valuation", entityId: row.id, meta: {} });
  await notifyRequester(row.requesterId, row.id, REQUESTER_STATUS_TEXT.REJECTED!);
}

// ---------------------------------------------------------------------------------------------------------------
// Admin: assignment and withdrawal
// ---------------------------------------------------------------------------------------------------------------

/** Assigns (or reassigns) a valuator. Admin only. Pass null to unassign. */
export async function assignValuation(input: { valuationId: string; admin: Actor; valuatorId: string | null }): Promise<void> {
  assertRole(input.admin, "ADMIN", "Only admins can assign valuations.");
  const row = await loadRow(input.valuationId);
  if (!row || (row.status !== "IN_EXPERT_REVIEW" && row.status !== "NEEDS_INFO") || row.withdrawnAt) {
    throw new ValuationError("NOT_ALLOWED", "Only open expert requests can be assigned.");
  }
  if (input.valuatorId) {
    const valuator = await prisma.user.findUnique({ where: { id: input.valuatorId }, select: { role: true, status: true } });
    if (!valuator || valuator.role !== "VALUATOR" || valuator.status !== "ACTIVE") {
      throw new ValuationError("NOT_ALLOWED", "Choose an active valuator.");
    }
  }
  const previous = row.assignedValuatorId;
  await prisma.valuation.update({ where: { id: row.id }, data: { assignedValuatorId: input.valuatorId } });
  await recordAudit({
    action: AuditAction.VALUATION_ASSIGNED,
    actorId: input.admin.id,
    entityType: "Valuation",
    entityId: row.id,
    meta: { from: previous, to: input.valuatorId },
  });
  if (input.valuatorId && input.valuatorId !== previous) {
    await notify({
      userId: input.valuatorId,
      type: NOTIFICATION_TYPES.VALUATION_ASSIGNED,
      title: "Valuation assigned",
      body: "A valuation request has been assigned to you. Open your queue to review it.",
      href: VALUATION_ROUTES.valuatorDetail(row.id),
    });
  }
}

/** Withdraws a report. The public verification page then shows "withdrawn". Admin only. */
export async function withdrawValuation(input: { valuationId: string; admin: Actor; reason: unknown }): Promise<void> {
  assertRole(input.admin, "ADMIN", "Only admins can withdraw a report.");
  const row = await loadRow(input.valuationId);
  if (!row || !isResultReady(row.status) || row.withdrawnAt) {
    throw new ValuationError("NOT_ALLOWED", "Only a completed report can be withdrawn.");
  }
  const text = parseThreadText(input.reason, "a reason", 500);
  if (!text.ok) throw new ValuationError(text.error === CONTACT_REFUSAL ? "CONTACT_DETAILS" : "INVALID", text.error);

  const update = await prisma.valuation.updateMany({
    where: { id: row.id, withdrawnAt: null },
    data: { withdrawnAt: new Date(), withdrawnReason: text.value, publishedOnListing: false },
  });
  if (update.count !== 1) throw new ValuationError("CONFLICT", "This report was already withdrawn.");

  await recordAudit({ action: AuditAction.VALUATION_WITHDRAWN, actorId: input.admin.id, entityType: "Valuation", entityId: row.id, meta: {} });
  await notifyRequester(row.requesterId, row.id, {
    title: "Valuation report withdrawn",
    body: "A valuation report has been withdrawn. Open it on Gemstone Selections for details.",
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Publish on a listing (the seller's own listing only)
// ---------------------------------------------------------------------------------------------------------------

export async function setPublishedOnListing(input: { valuationId: string; actor: Actor; publish: boolean }): Promise<void> {
  const row = await loadRow(input.valuationId);
  if (!row || row.requesterId !== input.actor.id || !row.gemstoneId) throw new ValuationError("NOT_FOUND", "This valuation is not available.");
  const listing = { id: row.gemstoneId, sellerUserId: row.gemstone?.seller.userId ?? "" };
  if (input.publish) {
    if (!canPublishOnListing(input.actor, { ...accessRecord(row), gemstoneId: row.gemstoneId }, listing)) {
      throw new ValuationError("NOT_ALLOWED", "Only the seller of this listing can publish a completed report on it.");
    }
  } else if (listing.sellerUserId !== input.actor.id) {
    throw new ValuationError("NOT_ALLOWED", "Only the seller of this listing can change this.");
  }
  await prisma.valuation.update({ where: { id: row.id }, data: { publishedOnListing: input.publish } });
  await recordAudit({
    action: AuditAction.VALUATION_PUBLISHED,
    actorId: input.actor.id,
    entityType: "Valuation",
    entityId: row.id,
    meta: { publish: input.publish },
  });
}

/**
 * Completed reports a listing shows publicly, when the seller chose to publish them. Only the seller's own
 * completed, non-withdrawn report can be here (setPublishedOnListing enforces it). No requester identity.
 */
export async function publishedValuationsForListing(gemstoneId: string) {
  const rows = await prisma.valuation.findMany({
    where: { gemstoneId, publishedOnListing: true, withdrawnAt: null, status: { in: ["AUTO_VALUED", "COMPLETED"] } },
    orderBy: { completedAt: "desc" },
    select: {
      reference: true,
      status: true,
      valuedBy: true,
      completedAt: true,
      currency: true,
      autoEstimateMinor: true,
      autoLowMinor: true,
      autoHighMinor: true,
      autoConfidence: true,
      finalEstimateMinor: true,
      finalLowMinor: true,
      finalHighMinor: true,
      finalConfidence: true,
    },
  });
  return rows.map((row) => {
    const expert = row.status === "COMPLETED";
    const estimate = expert ? row.finalEstimateMinor : row.autoEstimateMinor;
    const low = expert ? row.finalLowMinor : row.autoLowMinor;
    const high = expert ? row.finalHighMinor : row.autoHighMinor;
    return {
      reference: row.reference,
      completedAt: row.completedAt,
      method: expert ? ("EXPERT" as const) : ("AUTO" as const),
      confidence: expert ? row.finalConfidence : row.autoConfidence,
      estimateLabel: formatMoney(estimate, row.currency),
      rangeLabel: low !== null && high !== null ? `${formatMoney(low, row.currency)} to ${formatMoney(high, row.currency)}` : null,
    };
  });
}
