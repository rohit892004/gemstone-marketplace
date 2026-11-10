import { randomBytes } from "node:crypto";
import { recordAudit } from "@/lib/audit/audit";
import { AuditAction } from "@/lib/audit/actions";
import { prisma } from "@/lib/db/client";
import { NOTIFICATION_TYPES, notify } from "@/lib/notifications/service";
import { DEFAULT_TIER_RULES } from "./defaults";
import { emailDomain, isSelfReferral, referralFlagReasons, referralOutcome, REFERRAL_RULES } from "./referrals";
import {
  canPublishNewListing,
  evaluateTier,
  featuredAvailable,
  ruleFor,
  TIERS,
  unlockReport,
  type SellerMetrics,
  type Tier,
  type TierDecision,
  type TierRule,
  type TierState,
  type UnlockReport,
} from "./tiers";

/**
 * Membership service: tier rules, seller metrics, the listing and featured guards, referrals, and admin overrides.
 * Every write checks the actor and writes an audit row. Callers pass the acting user from the session.
 */

export class MembershipError extends Error {
  constructor(
    public readonly code: "NOT_ALLOWED" | "INVALID" | "LIMIT" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "MembershipError";
  }
}

const RESPONSE_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** Listings that use up a seller's tier limit: live ones and ones waiting for review. DRAFT does not count. */
export const LIMIT_COUNTED_STATUSES = ["PUBLISHED", "PENDING_REVIEW"] as const;

/** The tier rules the server enforces: the table when it has rows, otherwise the placeholder defaults. */
export async function loadTierRules(): Promise<TierRule[]> {
  const rows = await prisma.tierRule.findMany();
  if (rows.length === 0) return DEFAULT_TIER_RULES.map((r) => ({ ...r }));
  return TIERS.map((tier) => {
    const row = rows.find((r) => r.tier === tier);
    const fallback = ruleFor(DEFAULT_TIER_RULES, tier);
    if (!row) return fallback;
    return {
      tier,
      activeListingLimit: row.activeListingLimit,
      featuredSlots: row.featuredSlots,
      analyticsDays: row.analyticsDays,
      hasBadge: row.hasBadge,
      rankingBoost: row.rankingBoost,
      unlockReferrals: row.unlockReferrals,
      unlockFollowers: row.unlockFollowers,
      minResponseRate: row.minResponseRate,
      minRating: row.minRating === null ? null : Number(row.minRating.toString()),
    };
  });
}

/** Metrics for many sellers at once. Each figure is computed by one grouped query, never per seller. */
export async function metricsFor(sellerIds: string[], now: Date = new Date()): Promise<Map<string, SellerMetrics>> {
  const out = new Map<string, SellerMetrics>();
  for (const id of sellerIds) out.set(id, { qualifiedReferrals: 0, followerCount: 0, responseRate: null, averageRating: null });
  if (sellerIds.length === 0) return out;

  const [referrals, follows, ratings] = await Promise.all([
    prisma.referral.groupBy({ by: ["referrerSellerId"], where: { status: "QUALIFIED", referrerSellerId: { in: sellerIds } }, _count: { _all: true } }),
    prisma.follow.groupBy({ by: ["sellerId"], where: { sellerId: { in: sellerIds } }, _count: { _all: true } }),
    prisma.review.groupBy({
      by: ["sellerId"],
      where: { status: "APPROVED", isDemo: false, sellerId: { in: sellerIds } },
      _avg: { rating: true },
    }),
  ]);
  for (const row of referrals) {
    const m = out.get(row.referrerSellerId);
    if (m) m.qualifiedReferrals = row._count._all;
  }
  for (const row of follows) {
    const m = out.get(row.sellerId);
    if (m) m.followerCount = row._count._all;
  }
  for (const row of ratings) {
    const m = out.get(row.sellerId);
    if (m && row._avg.rating !== null) m.averageRating = Math.round(row._avg.rating * 100) / 100;
  }

  // Response rate: buyer-started enquiries in the last 90 days that the seller has answered at least once.
  const since = new Date(now.getTime() - RESPONSE_WINDOW_DAYS * DAY_MS);
  const responses = await prisma.$queryRaw<Array<{ sellerId: string; started: number; replied: number }>>`
    SELECT g."sellerId" AS "sellerId",
           count(*)::int AS started,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM "Message" m WHERE m."conversationId" = c.id AND m."senderId" = sp."userId"
           ))::int AS replied
    FROM "Conversation" c
    JOIN "Gemstone" g ON g.id = c."gemstoneId"
    JOIN "SellerProfile" sp ON sp.id = g."sellerId"
    WHERE c.kind = 'ENQUIRY' AND c."createdAt" >= ${since} AND c."startedById" <> sp."userId"
    GROUP BY g."sellerId"`;
  for (const row of responses) {
    const m = out.get(row.sellerId);
    if (m && row.started > 0) m.responseRate = Math.round((row.replied / row.started) * 100);
  }
  return out;
}

export interface MembershipSnapshot {
  sellerId: string;
  tier: Tier;
  rule: TierRule;
  metrics: SellerMetrics;
  /** Progress toward the next tier up. Null on the top tier. */
  nextTier: Tier | null;
  nextUnlock: UnlockReport | null;
  graceUntil: Date | null;
  graceTier: Tier | null;
  manualOverride: boolean;
  overrideReason: string | null;
  publishedListings: number;
  featuredInUse: number;
}

/** A seller's membership page data. Read-only: the rollup job is what changes tiers. */
export async function membershipSnapshot(sellerId: string, now: Date = new Date()): Promise<MembershipSnapshot> {
  const [rules, metrics, row, published, featured] = await Promise.all([
    loadTierRules(),
    metricsFor([sellerId], now),
    prisma.sellerMembership.findUnique({ where: { sellerId } }),
    prisma.gemstone.count({ where: { sellerId, status: { in: [...LIMIT_COUNTED_STATUSES] } } }),
    prisma.gemstone.count({ where: { sellerId, sellerFeatured: true, status: "PUBLISHED" } }),
  ]);
  const tier: Tier = row?.tier ?? "FREE";
  const seller = metrics.get(sellerId) ?? { qualifiedReferrals: 0, followerCount: 0, responseRate: null, averageRating: null };
  const next = TIERS[TIERS.indexOf(tier) + 1] ?? null;
  return {
    sellerId,
    tier,
    rule: ruleFor(rules, tier),
    metrics: seller,
    nextTier: next,
    nextUnlock: next ? unlockReport(ruleFor(rules, next), seller) : null,
    graceUntil: row?.graceUntil ?? null,
    graceTier: row?.graceTier ?? null,
    manualOverride: row?.manualOverride ?? false,
    overrideReason: row?.overrideReason ?? null,
    publishedListings: published,
    featuredInUse: featured,
  };
}

/**
 * The server check for every publish of a new listing. Throws LIMIT with a message the seller can act on.
 * `excludeGemstoneId` is the listing being published, so it is not counted against itself (an admin approving a
 * PENDING_REVIEW listing, or a seller resubmitting one).
 */
export async function assertCanPublishListing(sellerId: string, excludeGemstoneId?: string): Promise<void> {
  const snapshot = await membershipSnapshot(sellerId);
  const others = excludeGemstoneId
    ? await prisma.gemstone.count({ where: { sellerId, status: { in: [...LIMIT_COUNTED_STATUSES] }, NOT: { id: excludeGemstoneId } } })
    : snapshot.publishedListings;
  const check = canPublishNewListing(snapshot.rule, others);
  if (!check.ok) {
    throw new MembershipError("LIMIT", `Your ${snapshot.tier.toLowerCase()} membership allows ${check.limit} active listings. Archive one to publish another.`);
  }
}

/** The server check for turning on a seller-chosen featured slot. Turning one off is always allowed. */
export async function assertFeaturedSlot(sellerId: string, gemstoneId: string): Promise<void> {
  const snapshot = await membershipSnapshot(sellerId);
  const current = await prisma.gemstone.findFirst({ where: { id: gemstoneId, sellerId }, select: { sellerFeatured: true } });
  if (current?.sellerFeatured) return;
  if (!featuredAvailable(snapshot.rule, snapshot.featuredInUse)) {
    throw new MembershipError(
      "LIMIT",
      snapshot.rule.featuredSlots === 0
        ? "Featured listings are a Premium and Elite benefit."
        : `Your membership allows ${snapshot.rule.featuredSlots} featured listing(s). Unfeature one first.`,
    );
  }
}

const TIER_MESSAGE: Record<Tier, string> = {
  FREE: "Free",
  PREMIUM: "Premium",
  ELITE: "Elite",
};

async function notifyTierChange(sellerId: string, decision: TierDecision): Promise<void> {
  const seller = await prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { userId: true } });
  if (!seller) return;
  if (decision.change === "UPGRADED") {
    await notify({
      userId: seller.userId,
      type: NOTIFICATION_TYPES.MEMBERSHIP_TIER,
      title: "Membership upgraded",
      body: `You now have the ${TIER_MESSAGE[decision.tier]} membership. Open your membership page to see your new benefits.`,
      href: "/seller/membership",
    });
  } else if (decision.change === "GRACE_STARTED") {
    await notify({
      userId: seller.userId,
      type: NOTIFICATION_TYPES.MEMBERSHIP_TIER,
      title: "Membership review",
      body: "You no longer meet the requirements for your current membership. It stays the same for 14 days, then changes unless you qualify again.",
      href: "/seller/membership",
    });
  } else if (decision.change === "DOWNGRADED") {
    await notify({
      userId: seller.userId,
      type: NOTIFICATION_TYPES.MEMBERSHIP_TIER,
      title: "Membership changed",
      body: `Your membership is now ${TIER_MESSAGE[decision.tier]}. Your listings stay published.`,
      href: "/seller/membership",
    });
  }
}

/**
 * The rollup job's pass over every approved seller. Stores the metrics and the new state, and notifies a seller
 * when the tier changes. Admin overrides are left alone. Returns how many tiers changed.
 */
export async function evaluateMemberships(now: Date = new Date()): Promise<{ evaluated: number; changed: number }> {
  const sellers = await prisma.sellerProfile.findMany({ where: { approvalStatus: "APPROVED" }, select: { id: true, isDemo: true } });
  const rules = await loadTierRules();
  const metrics = await metricsFor(sellers.map((s) => s.id), now);
  let changed = 0;
  for (const seller of sellers) {
    const existing = await prisma.sellerMembership.findUnique({ where: { sellerId: seller.id } });
    const state: TierState = existing
      ? { tier: existing.tier, graceUntil: existing.graceUntil, graceTier: existing.graceTier, manualOverride: existing.manualOverride }
      : { tier: "FREE", graceUntil: null, graceTier: null, manualOverride: false };
    const m = metrics.get(seller.id) ?? { qualifiedReferrals: 0, followerCount: 0, responseRate: null, averageRating: null };
    const decision = evaluateTier({ rules, metrics: m, state, now });
    const rating = m.averageRating === null ? null : m.averageRating;
    await prisma.sellerMembership.upsert({
      where: { sellerId: seller.id },
      create: {
        sellerId: seller.id,
        tier: decision.tier,
        graceUntil: decision.graceUntil,
        graceTier: decision.graceTier,
        qualifiedReferrals: m.qualifiedReferrals,
        followerCount: m.followerCount,
        responseRate: m.responseRate,
        averageRating: rating,
        evaluatedAt: now,
        isDemo: seller.isDemo,
      },
      update: {
        tier: decision.tier,
        tierSince: decision.change === "UPGRADED" || decision.change === "DOWNGRADED" ? now : undefined,
        graceUntil: decision.graceUntil,
        graceTier: decision.graceTier,
        qualifiedReferrals: m.qualifiedReferrals,
        followerCount: m.followerCount,
        responseRate: m.responseRate,
        averageRating: rating,
        evaluatedAt: now,
      },
    });
    if (decision.change !== "NONE") {
      changed += 1;
      await recordAudit({
        action: AuditAction.MEMBERSHIP_TIER_CHANGED,
        actorId: null,
        entityType: "SellerProfile",
        entityId: seller.id,
        meta: { change: decision.change, tier: decision.tier },
      });
      await notifyTierChange(seller.id, decision);
    }
  }
  return { evaluated: sellers.length, changed };
}

/** Admin sets a seller's tier with a reason. Audited. Holds until cleared. */
export async function setTierOverride(input: { adminId: string; adminRole: string; sellerId: string; tier: Tier; reason: string; now?: Date }): Promise<void> {
  if (input.adminRole !== "ADMIN") throw new MembershipError("NOT_ALLOWED", "Only admins can set a tier.");
  const reason = input.reason.trim();
  if (reason.length < 5) throw new MembershipError("INVALID", "Give a reason of at least 5 characters.");
  const now = input.now ?? new Date();
  const seller = await prisma.sellerProfile.findUnique({ where: { id: input.sellerId }, select: { id: true } });
  if (!seller) throw new MembershipError("NOT_FOUND", "Seller not found.");

  await prisma.sellerMembership.upsert({
    where: { sellerId: input.sellerId },
    create: { sellerId: input.sellerId, tier: input.tier, tierSince: now, manualOverride: true, overrideReason: reason, overrideById: input.adminId },
    update: { tier: input.tier, tierSince: now, graceUntil: null, graceTier: null, manualOverride: true, overrideReason: reason, overrideById: input.adminId },
  });
  await recordAudit({
    action: AuditAction.MEMBERSHIP_OVERRIDE_SET,
    actorId: input.adminId,
    entityType: "SellerProfile",
    entityId: input.sellerId,
    meta: { tier: input.tier, reason },
  });
  const user = await prisma.sellerProfile.findUnique({ where: { id: input.sellerId }, select: { userId: true } });
  if (user) {
    await notify({
      userId: user.userId,
      type: NOTIFICATION_TYPES.MEMBERSHIP_TIER,
      title: "Membership changed",
      body: `Your membership is now ${TIER_MESSAGE[input.tier]}. Open your membership page for details.`,
      href: "/seller/membership",
    });
  }
}

/** Admin clears an override. The tier stays until the next evaluation changes it. */
export async function clearTierOverride(input: { adminId: string; adminRole: string; sellerId: string }): Promise<void> {
  if (input.adminRole !== "ADMIN") throw new MembershipError("NOT_ALLOWED", "Only admins can clear an override.");
  const result = await prisma.sellerMembership.updateMany({
    where: { sellerId: input.sellerId, manualOverride: true },
    data: { manualOverride: false, overrideReason: null, overrideById: null },
  });
  if (result.count !== 1) throw new MembershipError("NOT_FOUND", "No override to clear.");
  await recordAudit({ action: AuditAction.MEMBERSHIP_OVERRIDE_CLEARED, actorId: input.adminId, entityType: "SellerProfile", entityId: input.sellerId, meta: {} });
}

/** The public referral code for an approved seller. Generated on first use. */
export async function ensureReferralCode(sellerId: string): Promise<string> {
  const seller = await prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { referralCode: true, approvalStatus: true } });
  if (!seller) throw new MembershipError("NOT_FOUND", "Seller not found.");
  if (seller.referralCode) return seller.referralCode;
  if (seller.approvalStatus !== "APPROVED") throw new MembershipError("NOT_ALLOWED", "Referral links are available once your account is approved.");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const bytes = randomBytes(8);
    let code = "";
    for (let i = 0; i < 8; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    try {
      await prisma.sellerProfile.update({ where: { id: sellerId }, data: { referralCode: code } });
      return code;
    } catch (error) {
      if (!(typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002")) throw error;
    }
  }
  throw new MembershipError("NOT_ALLOWED", "Could not create a referral code. Try again.");
}

export interface AttributeInput {
  referredUserId: string;
  referredEmail: string;
  code: string;
  ipHash: string | null;
  deviceHash: string | null;
  now?: Date;
}

/**
 * Records a referral when a seller signs up with another seller's code. Self-referrals are refused. Suspicious
 * sign-ups are recorded but flagged for an admin, and do not qualify automatically.
 */
export async function attributeReferral(input: AttributeInput): Promise<{ attributed: boolean; flagged: boolean; reason?: string }> {
  const now = input.now ?? new Date();
  const referrer = await prisma.sellerProfile.findFirst({
    where: { referralCode: input.code, approvalStatus: "APPROVED" },
    select: { id: true, userId: true, user: { select: { email: true } } },
  });
  if (!referrer) return { attributed: false, flagged: false, reason: "unknown-code" };
  if (isSelfReferral({ referrerUserId: referrer.userId, referredUserId: input.referredUserId, referrerEmail: referrer.user.email, referredEmail: input.referredEmail })) {
    return { attributed: false, flagged: false, reason: "self" };
  }
  if (await prisma.referral.findUnique({ where: { referredUserId: input.referredUserId }, select: { id: true } })) {
    return { attributed: false, flagged: false, reason: "already-referred" };
  }

  const since = new Date(now.getTime() - REFERRAL_RULES.bulkWindowHours * 60 * 60 * 1000);
  const domain = emailDomain(input.referredEmail);
  const [sameIpOthers, sameDeviceOthers, sameDomainOthers] = await Promise.all([
    input.ipHash ? prisma.referral.count({ where: { ipHash: input.ipHash, createdAt: { gte: since } } }) : Promise.resolve(0),
    input.deviceHash ? prisma.referral.count({ where: { deviceHash: input.deviceHash, createdAt: { gte: since } } }) : Promise.resolve(0),
    domain
      ? prisma.referral.count({
          where: {
            referrerSellerId: referrer.id,
            createdAt: { gte: since },
            referred: { email: { endsWith: "@" + domain, mode: "insensitive" } },
          },
        })
      : Promise.resolve(0),
  ]);
  const reasons = referralFlagReasons({ sameIpOthers, sameDeviceOthers, sameDomainInWindow: sameDomainOthers + 1 });

  await prisma.referral.create({
    data: {
      referrerSellerId: referrer.id,
      referredUserId: input.referredUserId,
      status: "PENDING",
      flagged: reasons.length > 0,
      flagReason: reasons.length > 0 ? reasons.join("; ") : null,
      ipHash: input.ipHash,
      deviceHash: input.deviceHash,
    },
  });
  await recordAudit({
    action: AuditAction.REFERRAL_ATTRIBUTED,
    actorId: null,
    entityType: "User",
    entityId: input.referredUserId,
    meta: { flagged: reasons.length > 0 },
  });
  return { attributed: true, flagged: reasons.length > 0 };
}

/** The rollup job's pass: pending referrals qualify when the referred seller is approved and has a published listing. */
export async function qualifyReferrals(now: Date = new Date()): Promise<number> {
  const pending = await prisma.referral.findMany({
    where: { status: "PENDING", flagged: false },
    select: {
      id: true,
      referrerSellerId: true,
      referred: { select: { sellerProfile: { select: { approvalStatus: true, id: true } } } },
    },
  });
  let qualified = 0;
  for (const referral of pending) {
    const profile = referral.referred.sellerProfile;
    const publishedListings = profile ? await prisma.gemstone.count({ where: { sellerId: profile.id, status: "PUBLISHED" } }) : 0;
    const outcome = referralOutcome({
      status: "PENDING",
      flagged: false,
      referredApproved: profile?.approvalStatus === "APPROVED",
      referredPublishedListings: publishedListings,
    });
    if (outcome !== "QUALIFY") continue;
    const update = await prisma.referral.updateMany({ where: { id: referral.id, status: "PENDING" }, data: { status: "QUALIFIED", qualifiedAt: now } });
    if (update.count !== 1) continue;
    qualified += 1;
    await recordAudit({ action: AuditAction.REFERRAL_QUALIFIED, actorId: null, entityType: "Referral", entityId: referral.id, meta: {} });
    const referrer = await prisma.sellerProfile.findUnique({ where: { id: referral.referrerSellerId }, select: { userId: true } });
    if (referrer) {
      await notify({
        userId: referrer.userId,
        type: NOTIFICATION_TYPES.REFERRAL_QUALIFIED,
        title: "A referral qualified",
        body: "A seller you referred is now approved and listing products. It counts toward your membership progress.",
        href: "/seller/membership",
      });
    }
  }
  return qualified;
}

/** Admin voids a referral. It no longer counts. Audited. */
export async function voidReferral(input: { adminId: string; adminRole: string; referralId: string; reason: string; now?: Date }): Promise<void> {
  if (input.adminRole !== "ADMIN") throw new MembershipError("NOT_ALLOWED", "Only admins can void a referral.");
  const reason = input.reason.trim();
  if (reason.length < 5) throw new MembershipError("INVALID", "Give a reason of at least 5 characters.");
  const result = await prisma.referral.updateMany({
    where: { id: input.referralId, status: { not: "VOIDED" } },
    data: { status: "VOIDED", voidedAt: input.now ?? new Date(), voidedReason: reason },
  });
  if (result.count !== 1) throw new MembershipError("NOT_FOUND", "Referral not found or already voided.");
  await recordAudit({ action: AuditAction.REFERRAL_VOIDED, actorId: input.adminId, entityType: "Referral", entityId: input.referralId, meta: { reason } });
}

/** Admin clears a flag after review. The referral can then qualify on the next rollup. Audited. */
export async function clearReferralFlag(input: { adminId: string; adminRole: string; referralId: string }): Promise<void> {
  if (input.adminRole !== "ADMIN") throw new MembershipError("NOT_ALLOWED", "Only admins can clear a flag.");
  const result = await prisma.referral.updateMany({ where: { id: input.referralId, flagged: true }, data: { flagged: false, flagReason: null } });
  if (result.count !== 1) throw new MembershipError("NOT_FOUND", "Referral not flagged.");
  await recordAudit({ action: AuditAction.REFERRAL_FLAG_CLEARED, actorId: input.adminId, entityType: "Referral", entityId: input.referralId, meta: {} });
}

export interface TierRuleInput {
  tier: Tier;
  activeListingLimit: number | null;
  featuredSlots: number;
  analyticsDays: number;
  hasBadge: boolean;
  rankingBoost: number;
  unlockReferrals: number | null;
  unlockFollowers: number | null;
  minResponseRate: number;
  minRating: number | null;
}

/** Validates and saves the tier rules. Audited. Free never has unlock requirements. */
export async function saveTierRules(input: { adminId: string; adminRole: string; rules: TierRuleInput[] }): Promise<void> {
  if (input.adminRole !== "ADMIN") throw new MembershipError("NOT_ALLOWED", "Only admins can change tier rules.");
  for (const r of input.rules) {
    const bad = (cond: boolean, msg: string) => {
      if (cond) throw new MembershipError("INVALID", msg);
    };
    bad(r.activeListingLimit !== null && (r.activeListingLimit < 1 || r.activeListingLimit > 100000), "Listing limit must be between 1 and 100,000, or blank for unlimited.");
    bad(r.featuredSlots < 0 || r.featuredSlots > 50, "Featured slots must be between 0 and 50.");
    bad(r.analyticsDays < 7 || r.analyticsDays > 730, "Analytics days must be between 7 and 730.");
    bad(r.rankingBoost < 0 || r.rankingBoost > 100, "Ranking boost must be between 0 and 100.");
    bad(r.minResponseRate < 0 || r.minResponseRate > 100, "Response rate must be between 0 and 100.");
    bad(r.minRating !== null && (r.minRating < 0 || r.minRating > 5), "Minimum rating must be between 0 and 5.");
    bad(r.unlockReferrals !== null && (r.unlockReferrals < 1 || r.unlockReferrals > 10000), "Referrals must be between 1 and 10,000.");
    bad(r.unlockFollowers !== null && (r.unlockFollowers < 1 || r.unlockFollowers > 100000), "Followers must be between 1 and 100,000.");
    bad(r.tier === "FREE" && (r.unlockReferrals !== null || r.unlockFollowers !== null), "The Free tier has no unlock requirements.");
  }
  for (const r of input.rules) {
    await prisma.tierRule.upsert({
      where: { tier: r.tier },
      create: { ...r, minRating: r.minRating === null ? null : r.minRating, updatedById: input.adminId },
      update: { ...r, minRating: r.minRating === null ? null : r.minRating, updatedById: input.adminId },
    });
  }
  await recordAudit({ action: AuditAction.TIER_RULES_CHANGED, actorId: input.adminId, entityType: "TierRule", entityId: "all", meta: { tiers: input.rules.map((r) => r.tier).join(",") } });
}
