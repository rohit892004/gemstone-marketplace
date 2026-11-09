import type { DefaultSession } from "next-auth";
import type { Role } from "@/app/generated/prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    /** Unix seconds when this session was issued. Used to revoke sessions after a password reset. */
    issuedAt?: number;
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    sessionIssuedAt?: number;
  }
}
