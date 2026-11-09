import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { getEnv } from "@/lib/config/env";

/**
 * Single shared Prisma client. In development, cached on globalThis so hot
 * reloads do not open a new connection pool on every change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }),
  });

if (getEnv().NODE_ENV !== "production") globalForPrisma.prisma = prisma;
