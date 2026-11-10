import { prisma } from "@/lib/db/client";

/**
 * Runs `fn` only if no other process holds the named job lock. The lock is transaction-scoped
 * (pg_try_advisory_xact_lock), so it is released when `fn` finishes or fails, and a crashed worker
 * cannot leave it held. A second caller gets { ran: false } at once instead of waiting.
 *
 * `fn` runs outside the lock transaction's queries, so it may use the shared client freely.
 * The transaction is kept open for the duration, so give long jobs a timeout that suits them.
 */
export type LockedRun<T> = { ran: true; value: T } | { ran: false };

export async function runExclusive<T>(
  name: string,
  fn: () => Promise<T>,
  options: { timeoutMs?: number } = {},
): Promise<LockedRun<T>> {
  return prisma.$transaction(
    async (tx) => {
      const [row] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${name})) AS locked`;
      if (!row?.locked) return { ran: false } as const;
      const value = await fn();
      return { ran: true, value } as const;
    },
    { timeout: options.timeoutMs ?? 10 * 60 * 1000, maxWait: 10_000 },
  );
}
