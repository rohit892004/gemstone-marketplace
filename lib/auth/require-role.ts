import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ApprovalStatus, Role } from "@/app/generated/prisma/client";
import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/client";
import { auth } from "./auth";

/**
 * THE access-control helper. Every protected server action, route handler and page
 * calls one of these adapters, which all share evaluateRole().
 *
 *   requireRole(...)       throws AuthzError          → server actions, server code
 *   checkRole(...)         returns a result object     → actions that return errors to the form
 *   requirePageRole(...)   redirects on failure        → pages and layouts
 *   requireApiRole(...)    returns a 401/403 Response  → route handlers
 *
 * Account state is re-read from the database on every call, so suspension,
 * approval changes and password resets take effect immediately, not at token expiry.
 */

import { AuthzError, type AuthzCode } from "./authz-error";
export { AuthzError, type AuthzCode };

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  /** Seller approval state. null for non-sellers. */
  sellerApproval: ApprovalStatus | null;
}

export interface RoleOptions {
  /** For SELLER: require approvalStatus APPROVED. PENDING and REJECTED sellers are refused. */
  sellerApproved?: boolean;
}

export type RoleResult = { ok: true; user: CurrentUser } | { ok: false; code: AuthzCode };

async function evaluateRole(allowed: readonly Role[], options: RoleOptions = {}): Promise<RoleResult> {
  // Marks the render as request-time so protected pages are never prerendered or cached.
  await connection();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, code: "UNAUTHENTICATED" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      passwordChangedAt: true,
      sellerProfile: { select: { approvalStatus: true } },
    },
  });
  if (!user) return { ok: false, code: "UNAUTHENTICATED" };

  // Sessions issued before the last password change (e.g. after a reset) are revoked.
  const issuedAt = session?.issuedAt;
  if (user.passwordChangedAt && (issuedAt === undefined || issuedAt * 1000 < user.passwordChangedAt.getTime())) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }
  if (!user.emailVerifiedAt) return { ok: false, code: "EMAIL_NOT_VERIFIED" };
  if (user.status !== "ACTIVE") return { ok: false, code: "ACCOUNT_SUSPENDED" };

  const sellerApproval = user.sellerProfile?.approvalStatus ?? null;

  if (!allowed.includes(user.role)) {
    await recordAudit({
      action: AuditAction.ACCESS_DENIED,
      actorId: user.id,
      entityType: "User",
      entityId: user.id,
      meta: { reason: "role", required: allowed.join(",") },
    });
    return { ok: false, code: "FORBIDDEN" };
  }

  if (user.role === "SELLER") {
    if (sellerApproval === "SUSPENDED") return { ok: false, code: "SELLER_SUSPENDED" };
    if (options.sellerApproved && sellerApproval !== "APPROVED") {
      return { ok: false, code: "SELLER_NOT_APPROVED" };
    }
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sellerApproval,
    },
  };
}

/** Throws AuthzError unless the caller has one of `roles`. Use in server actions and server code. */
export async function requireRole(roles: readonly Role[], options?: RoleOptions): Promise<CurrentUser> {
  const result = await evaluateRole(roles, options);
  if (!result.ok) throw new AuthzError(result.code);
  return result.user;
}

/** Non-throwing variant for actions that return { error } to the form. */
export async function checkRole(roles: readonly Role[], options?: RoleOptions): Promise<RoleResult> {
  return evaluateRole(roles, options);
}

/**
 * For pages and layouts. Redirects instead of throwing.
 * Do not call inside try/catch blocks that would swallow Next's redirect.
 */
export async function requirePageRole(roles: readonly Role[], options?: RoleOptions): Promise<CurrentUser> {
  const result = await evaluateRole(roles, options);
  if (result.ok) return result.user;

  switch (result.code) {
    case "UNAUTHENTICATED":
      redirect("/login");
    case "EMAIL_NOT_VERIFIED":
      redirect("/login?error=email_not_verified");
    case "ACCOUNT_SUSPENDED":
    case "SELLER_SUSPENDED":
      redirect("/login?error=account_suspended");
    default:
      // FORBIDDEN and SELLER_NOT_APPROVED go to the role router, which shows the right home.
      redirect("/dashboard");
  }
}

/** For route handlers. Returns a ready-made 401/403 response on failure. */
export async function requireApiRole(
  roles: readonly Role[],
  options?: RoleOptions,
): Promise<{ ok: true; user: CurrentUser } | { ok: false; response: Response }> {
  const result = await evaluateRole(roles, options);
  if (result.ok) return { ok: true, user: result.user };
  const status = result.code === "UNAUTHENTICATED" || result.code === "EMAIL_NOT_VERIFIED" ? 401 : 403;
  return {
    ok: false,
    response: Response.json({ error: result.code }, { status }),
  };
}
