import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { issueToken } from "@/lib/auth/tokens";
import { sendMailSafely } from "@/lib/auth/flows/send";
import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { appUrl } from "@/lib/config/app-url";
import { prisma } from "@/lib/db/client";
import { emailTemplates } from "@/lib/notify/templates";
import { VALUATOR_QUEUE_STATUSES } from "./valuator-queue";
import type { ParseResult } from "./admin-values";

/**
 * Valuator accounts. Admin only; the callers check the admin role with requireRole(["ADMIN"]) and pass the
 * admin's id from the session. Valuators are internal staff: there is no public way to create one.
 *
 *  - A new valuator is a User with role VALUATOR and status ACTIVE and a random password nobody knows.
 *  - The set-password link uses the password reset token flow (single use, 30 minutes).
 *  - Deactivating sets status SUSPENDED. requireRole and login both refuse a non-ACTIVE account, so a
 *    deactivated valuator cannot log in or act, even with a live session.
 */

export const VALUATOR_NAME_MAX = 120;
export const VALUATOR_EMAIL_MAX = 254;

export interface ValuatorInput {
  name: string;
  email: string;
  mobile: string;
}

/** Trims, lower-cases the email and checks each field. Mobile is optional. */
export function parseValuatorInput(raw: { name: unknown; email: unknown; mobile: unknown }): ParseResult<ValuatorInput> {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name.length === 0) return { ok: false, error: "Enter the valuer's name." };
  if (name.length > VALUATOR_NAME_MAX) return { ok: false, error: `The name must be ${VALUATOR_NAME_MAX} characters or fewer.` };

  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (email.length === 0) return { ok: false, error: "Enter an email address." };
  if (email.length > VALUATOR_EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const mobile = typeof raw.mobile === "string" ? raw.mobile.replace(/[\s-]/g, "") : "";
  if (mobile.length > 0 && !/^\+?\d{8,15}$/.test(mobile)) {
    return { ok: false, error: "Enter a mobile number with 8 to 15 digits, or leave it blank." };
  }
  return { ok: true, value: { name, email, mobile } };
}

export interface ValuatorSummary {
  id: string;
  name: string | null;
  email: string;
  mobile: string | null;
  active: boolean;
  createdAt: Date;
  openAssignments: number;
}

/** Valuators with their count of open assignments (IN_EXPERT_REVIEW or NEEDS_INFO). */
export async function listValuators(): Promise<ValuatorSummary[]> {
  const [users, open] = await Promise.all([
    prisma.user.findMany({
      where: { role: "VALUATOR" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, mobile: true, status: true, createdAt: true },
    }),
    prisma.valuation.groupBy({
      by: ["assignedValuatorId"],
      where: { status: { in: [...VALUATOR_QUEUE_STATUSES] }, withdrawnAt: null, assignedValuatorId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const counts = new Map(open.map((row) => [row.assignedValuatorId, row._count._all]));
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    active: user.status === "ACTIVE",
    createdAt: user.createdAt,
    openAssignments: counts.get(user.id) ?? 0,
  }));
}

/** Open requests assigned to one valuator, for the deactivate warning and reassignment. */
export async function openRequestsFor(valuatorId: string) {
  return prisma.valuation.findMany({
    where: { assignedValuatorId: valuatorId, status: { in: [...VALUATOR_QUEUE_STATUSES] }, withdrawnAt: null },
    orderBy: { submittedAt: "asc" },
    select: { id: true, reference: true, gemstoneType: true, status: true, submittedAt: true },
  });
}

/** Sends the set-password link: a password reset token, emailed. Used on creation and for resends. */
async function sendSetPasswordLink(user: { id: string; email: string; name: string | null }): Promise<void> {
  const token = await issueToken(user.id, "PASSWORD_RESET");
  const mail = emailTemplates.passwordReset(user.name, appUrl(`/reset-password?token=${encodeURIComponent(token)}`));
  await sendMailSafely(user.email, mail);
}

export async function createValuator(input: {
  admin: { id: string };
  raw: { name: unknown; email: unknown; mobile: unknown };
}): Promise<ParseResult<{ userId: string }>> {
  const parsed = parseValuatorInput(input.raw);
  if (!parsed.ok) return parsed;
  const { name, email, mobile } = parsed.value;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "An account with this email already exists." };
  if (mobile) {
    const mobileTaken = await prisma.user.findUnique({ where: { mobile }, select: { id: true } });
    if (mobileTaken) return { ok: false, error: "Another account already uses this mobile number." };
  }

  // Nobody knows this password. The valuator sets their own through the emailed link.
  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
  let user: { id: string; email: string; name: string | null };
  try {
    user = await prisma.user.create({
      data: { email, name, mobile: mobile || null, passwordHash, role: "VALUATOR", status: "ACTIVE" },
      select: { id: true, email: true, name: true },
    });
  } catch (error) {
    // Another request can create the same email or mobile between the check above and this insert.
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      return { ok: false, error: "An account with this email or mobile already exists." };
    }
    throw error;
  }

  await recordAudit({
    action: AuditAction.VALUATION_VALUATOR_CREATED,
    actorId: input.admin.id,
    entityType: "User",
    entityId: user.id,
    meta: { role: "VALUATOR" },
  });
  await sendSetPasswordLink(user);
  return { ok: true, value: { userId: user.id } };
}

/** Sends a fresh set-password link to a valuator who has not yet set a password. */
export async function resendSetPasswordLink(input: { admin: { id: string }; valuatorId: string }): Promise<ParseResult<true>> {
  const user = await prisma.user.findUnique({
    where: { id: input.valuatorId },
    select: { id: true, email: true, name: true, role: true, status: true },
  });
  if (!user || user.role !== "VALUATOR") return { ok: false, error: "Valuer not found." };
  if (user.status !== "ACTIVE") return { ok: false, error: "Reactivate this valuer before sending a link." };
  await sendSetPasswordLink(user);
  await recordAudit({
    action: AuditAction.VALUATION_VALUATOR_CREATED,
    actorId: input.admin.id,
    entityType: "User",
    entityId: user.id,
    meta: { resentSetPasswordLink: true },
  });
  return { ok: true, value: true };
}

/**
 * Deactivates (active false) or reactivates (active true) a valuator. Open requests stay assigned until an admin
 * reassigns them; the admin pages show them. Only one valuator row changes, and only if it is still a valuator.
 */
export async function setValuatorActive(input: {
  admin: { id: string };
  valuatorId: string;
  active: boolean;
}): Promise<ParseResult<true>> {
  const result = await prisma.user.updateMany({
    where: { id: input.valuatorId, role: "VALUATOR", status: input.active ? "SUSPENDED" : "ACTIVE" },
    data: { status: input.active ? "ACTIVE" : "SUSPENDED" },
  });
  if (result.count !== 1) return { ok: false, error: "This valuer is already in that state, or was not found." };

  await recordAudit({
    action: input.active ? AuditAction.VALUATOR_REACTIVATED : AuditAction.VALUATION_VALUATOR_DEACTIVATED,
    actorId: input.admin.id,
    entityType: "User",
    entityId: input.valuatorId,
    meta: {},
  });
  return { ok: true, value: true };
}
