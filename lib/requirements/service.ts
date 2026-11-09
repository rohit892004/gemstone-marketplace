import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/client";
import { CONTACT_WARNING } from "@/lib/messaging/service";
import { recordContactFlag } from "@/lib/commerce/strikes";
import { NOTIFICATION_TYPES, notify } from "@/lib/notifications/service";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  type RequirementCheck,
  type RequirementField,
  type RequirementRaw,
  type RequirementValues,
  validateRequirementInput,
} from "./validate";

/**
 * Buyer requirements. The only code that writes requirements.
 *
 * Posting: buyer only, validated, free text masked, rate limited (5 posts per 24 hours per buyer),
 * then approved sellers in the requirement's category (or all approved sellers when there is no
 * category) get a requirement.match notification. At most MAX_REQUIREMENT_RECIPIENTS are notified.
 * Editing: owner only, OPEN requirements only. Closing: owner only, sets status CLOSED.
 *
 * Callers pass a trusted buyerId from the server session. Every read and write is scoped to it.
 */

export const REQUIREMENT_POST_RATE = { limit: 5, windowSeconds: 24 * 60 * 60 } as const;
export const MAX_REQUIREMENT_RECIPIENTS = 200;
/** Where a notified seller goes. The seller requirements board lives here (seller agent). */
export const REQUIREMENT_BOARD_HREF = "/seller/requirements";
const NOTIFY_CHUNK = 20;

export class RequirementError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "NOT_OPEN" | "NOT_AVAILABLE" | "INVALID" | "RATE_LIMITED" | "RESTRICTED",
    message: string,
    readonly fieldErrors?: Partial<Record<RequirementField, string>>,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "RequirementError";
  }
}

function requireValid(check: RequirementCheck): Extract<RequirementCheck, { ok: true }> {
  if (!check.ok) throw new RequirementError("INVALID", "Check the highlighted fields.", check.fieldErrors);
  return check;
}

async function assertBuyer(buyerId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: buyerId }, select: { role: true } });
  if (user?.role !== "BUYER") throw new RequirementError("NOT_AVAILABLE", "Only buyers can post requirements.");
}

/** Contact-detail restrictions also stop requirement posts and edits, not only chat. */
async function assertNotRestricted(buyerId: string, now: Date): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: buyerId }, select: { messagingRestrictedUntil: true } });
  if (user?.messagingRestrictedUntil && user.messagingRestrictedUntil > now) {
    throw new RequirementError(
      "RESTRICTED",
      "Your account is temporarily restricted, so you can't post or edit requirements right now.",
    );
  }
}

async function assertCategory(categoryId: string | null): Promise<void> {
  if (!categoryId) return;
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) {
    throw new RequirementError("INVALID", "Check the highlighted fields.", { categoryId: "Choose a category from the list." });
  }
}

function toDbData(values: RequirementValues) {
  return {
    gemstoneType: values.gemstoneType,
    categoryId: values.categoryId,
    shape: values.shape,
    caratMin: values.caratMin,
    caratMax: values.caratMax,
    budgetMinMinor: values.budgetMinMinor,
    budgetMaxMinor: values.budgetMaxMinor,
    currency: values.currency,
    certificateNeeded: values.certificateNeeded,
    originPreference: values.originPreference,
    quantity: values.quantity,
    deadline: values.deadline,
    notes: values.notes,
  };
}

/** Approved, active, email-verified sellers in the category, excluding anyone blocked either way. */
export async function findMatchingSellerIds(buyerId: string, categoryId: string | null): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      role: "SELLER",
      status: "ACTIVE",
      emailVerifiedAt: { not: null },
      sellerProfile: {
        approvalStatus: "APPROVED",
        ...(categoryId ? { categories: { some: { id: categoryId } } } : {}),
      },
      NOT: [
        { blocksGiven: { some: { blockedId: buyerId } } },
        { blocksReceived: { some: { blockerId: buyerId } } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: MAX_REQUIREMENT_RECIPIENTS,
  });
  return rows.map((r) => r.id);
}

async function notifySellers(sellerIds: string[]): Promise<void> {
  for (let i = 0; i < sellerIds.length; i += NOTIFY_CHUNK) {
    await Promise.all(
      sellerIds.slice(i, i + NOTIFY_CHUNK).map((userId) =>
        notify({
          userId,
          type: NOTIFICATION_TYPES.REQUIREMENT_MATCH,
          title: "New buyer requirement",
          body: "A buyer posted a requirement in your categories. Review it on Gemstone Selections.",
          href: REQUIREMENT_BOARD_HREF,
        }),
      ),
    );
  }
}

export interface PostRequirementResult {
  requirementId: string;
  /** Number of sellers notified (capped). */
  notified: number;
  /** Set when contact details were masked. Show it to the buyer. */
  warning: string | null;
}

export async function postRequirement(input: {
  buyerId: string;
  raw: RequirementRaw;
  now?: Date;
}): Promise<PostRequirementResult> {
  const now = input.now ?? new Date();
  await assertBuyer(input.buyerId);
  await assertNotRestricted(input.buyerId, now);
  const check = requireValid(validateRequirementInput(input.raw, now));
  await assertCategory(check.values.categoryId);

  const limit = await consumeRateLimit({ key: `requirement:user:${input.buyerId}`, ...REQUIREMENT_POST_RATE });
  if (!limit.allowed) {
    throw new RequirementError(
      "RATE_LIMITED",
      "You have posted too many requirements today. Try again tomorrow.",
      undefined,
      limit.retryAfterSeconds,
    );
  }

  const { requirementId, strike } = await prisma.$transaction(async (tx) => {
    const row = await tx.requirement.create({
      data: { buyerId: input.buyerId, status: "OPEN", ...toDbData(check.values) },
      select: { id: true },
    });
    const strike = check.flagged
      ? await recordContactFlag(tx, {
          conversationId: null,
          messageId: null,
          requirementId: row.id,
          senderId: input.buyerId,
          source: "REQUIREMENT",
          kinds: check.kinds,
          now,
        })
      : null;
    return { requirementId: row.id, strike };
  });

  await recordAudit({
    action: AuditAction.REQUIREMENT_POSTED,
    actorId: input.buyerId,
    entityType: "Requirement",
    entityId: requirementId,
    meta: { flagged: check.flagged, certificateNeeded: check.values.certificateNeeded, quantity: check.values.quantity },
  });
  await auditFlagged(input.buyerId, requirementId, check, strike);

  const sellerIds = await findMatchingSellerIds(input.buyerId, check.values.categoryId);
  await notifySellers(sellerIds);

  return { requirementId, notified: sellerIds.length, warning: check.flagged ? CONTACT_WARNING : null };
}

async function auditFlagged(
  buyerId: string,
  requirementId: string,
  check: Extract<RequirementCheck, { ok: true }>,
  strike: { strikes: number; restrictedUntil: Date | null } | null,
): Promise<void> {
  if (!check.flagged) return;
  // Requirement text has no conversation, so it cannot be a ModerationFlag row yet (see report).
  // The audit row keeps the event visible to admins.
  await recordAudit({
    action: AuditAction.MESSAGE_FLAGGED,
    actorId: buyerId,
    entityType: "Requirement",
    entityId: requirementId,
    meta: { source: "REQUIREMENT", kinds: check.kinds.join(","), strikes: strike?.strikes ?? 0 },
  });
  if (strike?.restrictedUntil) {
    await recordAudit({
      action: AuditAction.MESSAGING_RESTRICTED,
      actorId: buyerId,
      entityType: "User",
      entityId: buyerId,
      meta: { until: strike.restrictedUntil.toISOString(), strikes: strike.strikes },
    });
  }
}

export async function updateRequirement(input: {
  buyerId: string;
  requirementId: string;
  raw: RequirementRaw;
  now?: Date;
}): Promise<{ warning: string | null }> {
  const now = input.now ?? new Date();
  await assertNotRestricted(input.buyerId, now);
  const existing = await prisma.requirement.findFirst({
    where: { id: input.requirementId, buyerId: input.buyerId },
    select: { id: true, status: true },
  });
  if (!existing) throw new RequirementError("NOT_FOUND", "This requirement is not available.");
  if (existing.status !== "OPEN") {
    throw new RequirementError("NOT_OPEN", "Closed requirements can't be edited. Post a new requirement instead.");
  }

  const check = requireValid(validateRequirementInput(input.raw, now));
  await assertCategory(check.values.categoryId);

  const strike = await prisma.$transaction(async (tx) => {
    // Guarded by status so an edit cannot land after a concurrent close.
    const updated = await tx.requirement.updateMany({
      where: { id: input.requirementId, buyerId: input.buyerId, status: "OPEN" },
      data: toDbData(check.values),
    });
    if (updated.count === 0) throw new RequirementError("NOT_OPEN", "Closed requirements can't be edited. Post a new requirement instead.");
    return check.flagged
      ? await recordContactFlag(tx, {
          conversationId: null,
          messageId: null,
          requirementId: input.requirementId,
          senderId: input.buyerId,
          source: "REQUIREMENT",
          kinds: check.kinds,
          now,
        })
      : null;
  });

  await recordAudit({
    action: AuditAction.REQUIREMENT_UPDATED,
    actorId: input.buyerId,
    entityType: "Requirement",
    entityId: input.requirementId,
    meta: { flagged: check.flagged },
  });
  await auditFlagged(input.buyerId, input.requirementId, check, strike);
  return { warning: check.flagged ? CONTACT_WARNING : null };
}

export async function closeRequirement(input: { buyerId: string; requirementId: string }): Promise<{ alreadyClosed: boolean }> {
  const result = await prisma.requirement.updateMany({
    where: { id: input.requirementId, buyerId: input.buyerId, status: "OPEN" },
    data: { status: "CLOSED" },
  });
  if (result.count === 0) {
    const existing = await prisma.requirement.findFirst({
      where: { id: input.requirementId, buyerId: input.buyerId },
      select: { id: true },
    });
    if (!existing) throw new RequirementError("NOT_FOUND", "This requirement is not available.");
    return { alreadyClosed: true };
  }
  await recordAudit({
    action: AuditAction.REQUIREMENT_CLOSED,
    actorId: input.buyerId,
    entityType: "Requirement",
    entityId: input.requirementId,
  });
  return { alreadyClosed: false };
}

/** The buyer's requirements, newest first, with a count of seller responses. */
export async function listRequirementsForBuyer(buyerId: string) {
  return prisma.requirement.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      gemstoneType: true,
      shape: true,
      caratMin: true,
      caratMax: true,
      budgetMinMinor: true,
      budgetMaxMinor: true,
      currency: true,
      quantity: true,
      deadline: true,
      status: true,
      category: { select: { name: true } },
      _count: { select: { responses: true } },
    },
  });
}

/** One requirement, only when the buyer owns it. Null otherwise. */
export async function getRequirementForBuyer(buyerId: string, requirementId: string) {
  return prisma.requirement.findFirst({
    where: { id: requirementId, buyerId },
    select: {
      id: true,
      gemstoneType: true,
      categoryId: true,
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
      notes: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { name: true } },
      _count: { select: { responses: true } },
    },
  });
}

/** Conversations a seller has opened on this requirement, where the buyer is a participant. */
export async function listRequirementThreads(buyerId: string, requirementId: string) {
  const rows = await prisma.conversation.findMany({
    where: { requirementId, participants: { some: { userId: buyerId } } },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      lastMessageAt: true,
      participants: {
        select: {
          userId: true,
          user: { select: { name: true, sellerProfile: { select: { businessName: true } } } },
        },
      },
    },
  });
  return rows.map((row) => {
    const seller = row.participants.find((p) => p.userId !== buyerId);
    return {
      id: row.id,
      lastMessageAt: row.lastMessageAt,
      sellerName: seller?.user.sellerProfile?.businessName ?? seller?.user.name ?? "Seller",
    };
  });
}
