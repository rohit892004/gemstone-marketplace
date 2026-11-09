import { afterEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/app/generated/prisma/client";
import { AuditAction } from "@/lib/audit/actions";
import {
  auditInTransaction,
  SAVE_FAILED_MESSAGE,
  SELLER_CATEGORIES_CHANGED,
  STALE_RECORD_MESSAGE,
  StaleRecordError,
  transactionFailure,
} from "./audit";
import { restrictMessaging } from "./restrict";

/** A fake transaction client. Only the methods the helpers call are implemented. No database. */
function fakeTx(options: { auditFails?: boolean; user?: { messagingRestrictedUntil: Date | null } | null } = {}) {
  const auditRows: Record<string, unknown>[] = [];
  const userUpdates: Record<string, unknown>[] = [];
  const tx = {
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (options.auditFails) throw new Error("audit table unavailable");
        auditRows.push(data);
        return data;
      }),
    },
    user: {
      findUnique: vi.fn(async () => (options.user === undefined ? { messagingRestrictedUntil: null } : options.user)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        userUpdates.push(data);
        return data;
      }),
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, auditRows, userUpdates };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("auditInTransaction", () => {
  it("writes the action, actor, entity, ip and meta", async () => {
    const { tx, auditRows } = fakeTx();
    await auditInTransaction(tx, {
      action: AuditAction.REPORT_RESOLVED,
      actorId: "u_admin",
      entityType: "Report",
      entityId: "rep_1",
      ip: "203.0.113.4",
      meta: { decision: "RESOLVED", restricted: false },
    });
    expect(auditRows).toEqual([
      {
        action: "report.resolved",
        actorId: "u_admin",
        entityType: "Report",
        entityId: "rep_1",
        ip: "203.0.113.4",
        meta: { decision: "RESOLVED", restricted: false },
      },
    ]);
  });

  it("propagates a failed write, so the surrounding transaction rolls back", async () => {
    const { tx } = fakeTx({ auditFails: true });
    await expect(
      auditInTransaction(tx, { action: AuditAction.REQUIREMENT_CLOSED, actorId: "u_admin", entityType: "Requirement", entityId: "r" }),
    ).rejects.toThrow("audit table unavailable");
  });

  it("uses the seller category audit name until the lead adds the constant", () => {
    expect(SELLER_CATEGORIES_CHANGED).toBe("seller.categories_changed");
  });
});

describe("transactionFailure", () => {
  it("maps a stale record to a reload message", () => {
    expect(transactionFailure(new StaleRecordError(), "test")).toEqual({ ok: false, error: STALE_RECORD_MESSAGE });
  });

  it("maps any other failure to a save-failed message and logs only the error name", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = transactionFailure(new TypeError("secret detail here"), "test");
    expect(result).toEqual({ ok: false, error: SAVE_FAILED_MESSAGE });
    expect(log).toHaveBeenCalledWith(expect.any(String), "TypeError");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret detail");
  });
});

describe("restrictMessaging", () => {
  const NOW = new Date("2026-11-09T10:00:00.000Z");

  it("sets seven days and writes MESSAGING_RESTRICTED in the same transaction", async () => {
    const { tx, auditRows, userUpdates } = fakeTx();
    const until = await restrictMessaging(tx, {
      userId: "u_seller",
      actorId: "u_admin",
      ip: null,
      now: NOW,
      meta: { flagId: "flag_1" },
    });
    expect(until.getTime()).toBe(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(userUpdates).toEqual([{ messagingRestrictedUntil: until }]);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: "messaging.restricted",
      entityType: "User",
      entityId: "u_seller",
      meta: { flagId: "flag_1", days: 7, until: until.toISOString() },
    });
  });

  it("keeps a longer existing restriction", async () => {
    const longer = new Date(NOW.getTime() + 60 * 24 * 60 * 60 * 1000);
    const { tx, userUpdates } = fakeTx({ user: { messagingRestrictedUntil: longer } });
    const until = await restrictMessaging(tx, { userId: "u_seller", actorId: "u_admin", ip: null, now: NOW, meta: {} });
    expect(until).toEqual(longer);
    expect(userUpdates[0]).toEqual({ messagingRestrictedUntil: longer });
  });

  it("throws when the target user does not exist, so nothing is written", async () => {
    const { tx, auditRows, userUpdates } = fakeTx({ user: null });
    await expect(
      restrictMessaging(tx, { userId: "u_gone", actorId: "u_admin", ip: null, now: NOW, meta: {} }),
    ).rejects.toThrow("RESTRICT_TARGET_MISSING");
    expect(userUpdates).toHaveLength(0);
    expect(auditRows).toHaveLength(0);
  });
});
