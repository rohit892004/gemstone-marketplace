import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@/app/generated/prisma/client";
import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validation/schemas";
import { getDummyHash, verifyPassword } from "./password";

/**
 * Auth.js (next-auth v5) configuration. Credentials provider + JWT sessions.
 *
 * Do not import this from client components. Server code should use
 * requireRole() from lib/auth/require-role.ts, which also checks account state in the DB.
 */

// Errors surfaced to the login page via the `error` query param (code is the key).
class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}
class AccountSuspendedError extends CredentialsSignin {
  code = "account_suspended";
}
class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_IP_LIMIT = 30;
const LOGIN_EMAIL_LIMIT = 8;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  // Required when running behind proxies/localhost; set AUTH_URL explicitly in production.
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const ip = getClientIp(request?.headers ?? new Headers());

        // Both limits count every attempt, whether or not the account exists,
        // so the response does not reveal existence.
        const [byIp, byEmail] = await Promise.all([
          consumeRateLimit({ key: `login:ip:${ip}`, limit: LOGIN_IP_LIMIT, windowSeconds: LOGIN_WINDOW_SECONDS }),
          consumeRateLimit({ key: `login:email:${email}`, limit: LOGIN_EMAIL_LIMIT, windowSeconds: LOGIN_WINDOW_SECONDS }),
        ]);
        if (!byIp.allowed || !byEmail.allowed) {
          await recordAudit({ action: AuditAction.LOGIN_BLOCKED, entityType: "User", ip, meta: { reason: "rate_limited" } });
          throw new RateLimitedError();
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, role: true, status: true, passwordHash: true, emailVerifiedAt: true },
        });

        if (!user) {
          // Spend the same time as a real check, then fail generically.
          await verifyPassword(password, await getDummyHash());
          await recordAudit({ action: AuditAction.LOGIN_FAILED, entityType: "User", ip, meta: { reason: "invalid_credentials" } });
          return null;
        }

        const passwordOk = await verifyPassword(password, user.passwordHash);
        if (!passwordOk) {
          await recordAudit({ action: AuditAction.LOGIN_FAILED, actorId: user.id, entityType: "User", entityId: user.id, ip, meta: { reason: "invalid_credentials" } });
          return null;
        }

        // Only reached with the correct password, so these messages reveal nothing new.
        if (!user.emailVerifiedAt) {
          await recordAudit({ action: AuditAction.LOGIN_BLOCKED, actorId: user.id, entityType: "User", entityId: user.id, ip, meta: { reason: "email_not_verified" } });
          throw new EmailNotVerifiedError();
        }
        if (user.status !== "ACTIVE") {
          await recordAudit({ action: AuditAction.LOGIN_BLOCKED, actorId: user.id, entityType: "User", entityId: user.id, ip, meta: { reason: "account_suspended" } });
          throw new AccountSuspendedError();
        }

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await resetRateLimit(`login:email:${email}`);
        await recordAudit({ action: AuditAction.LOGIN_SUCCESS, actorId: user.id, entityType: "User", entityId: user.id, ip });

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        // Fixed at sign-in. Compared against passwordChangedAt to revoke sessions after a password reset.
        token.sessionIssuedAt = Math.floor(Date.now() / 1000);
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as Role;
      session.issuedAt = token.sessionIssuedAt as number | undefined;
      return session;
    },
  },
});
