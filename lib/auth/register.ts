import { Prisma, type Role } from "@/app/generated/prisma/client";
import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { appUrl } from "@/lib/config/app-url";
import { prisma } from "@/lib/db/client";
import { emailTemplates } from "@/lib/notify/templates";
import { getEmailProvider } from "@/lib/notify/email";
import { hashPassword } from "./password";
import { issueToken } from "./tokens";

/**
 * Shared account creation for buyers and sellers.
 *
 * Enumeration safety: the result is the same whether or not the email already exists.
 * Callers always show "check your email". Existing accounts get an "account exists"
 * notice email instead of a new account.
 */

export interface RegisterInput {
  role: Extract<Role, "BUYER" | "SELLER">;
  email: string;
  mobile: string;
  name: string;
  password: string;
  country: string;
  ip?: string | null;
  /**
   * Creates the role profile (BuyerProfile / SellerProfile, documents, ...).
   * Runs inside the same transaction as the user, so a failure rolls back the account.
   */
  createProfile: (tx: Prisma.TransactionClient, user: { id: string; email: string }) => Promise<void>;
}

export interface RegisterResult {
  /** Always "CHECK_EMAIL" to the caller. Internal outcome is for logs and tests only. */
  outcome: "CREATED" | "EXISTING";
  userId?: string;
}

export async function registerAccount(input: RegisterInput): Promise<RegisterResult> {
  const passwordHash = await hashPassword(input.password);

  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          mobile: input.mobile,
          name: input.name,
          passwordHash,
          role: input.role,
        },
        select: { id: true, email: true },
      });
      await input.createProfile(tx, user);
      return user.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await notifyExistingAccount(input.email);
      await recordAudit({
        action: AuditAction.REGISTER_DUPLICATE_ATTEMPT,
        entityType: "User",
        ip: input.ip ?? null,
        meta: { role: input.role },
      });
      return { outcome: "EXISTING" };
    }
    throw error;
  }

  const token = await issueToken(userId, "EMAIL_VERIFICATION");
  const mail = emailTemplates.verifyEmail(input.name, appUrl(`/verify-email?token=${encodeURIComponent(token)}`));
  await sendSafely(input.email, mail);

  await recordAudit({
    action: input.role === "SELLER" ? AuditAction.REGISTER_SELLER : AuditAction.REGISTER_BUYER,
    actorId: userId,
    entityType: "User",
    entityId: userId,
    ip: input.ip ?? null,
  });

  return { outcome: "CREATED", userId };
}

async function notifyExistingAccount(email: string): Promise<void> {
  const mail = emailTemplates.accountExists(appUrl("/login"));
  await sendSafely(email, mail);
}

/** Email failures are logged, not thrown. The user can request another email. */
async function sendSafely(to: string, mail: { subject: string; text: string }): Promise<void> {
  try {
    await getEmailProvider().send({ to, ...mail });
  } catch (error) {
    console.error("[email] send failed", mail.subject, error);
  }
}
