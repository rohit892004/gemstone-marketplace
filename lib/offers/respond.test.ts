import { describe, expect, it, vi } from "vitest";
import { CommerceError } from "@/lib/commerce/errors";
import { offerResponseProblem, validateCounterOffer } from "./respond";

vi.mock("@/lib/db/client", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => null) }));

const pending = { status: "PENDING", proposerId: "buyer" };

describe("offerResponseProblem", () => {
  it("lets the non-proposer answer a pending offer", () => {
    expect(offerResponseProblem(pending, "seller")).toBeNull();
  });

  it("refuses the proposer, even on a pending offer", () => {
    const problem = offerResponseProblem(pending, "buyer");
    expect(problem).toBeInstanceOf(CommerceError);
    expect(problem?.code).toBe("NOT_ALLOWED");
  });

  it.each(["ACCEPTED", "DECLINED", "COUNTERED", "WITHDRAWN"])("refuses an offer that is %s", (status) => {
    const problem = offerResponseProblem({ status, proposerId: "buyer" }, "seller");
    expect(problem?.code).toBe("CONFLICT");
  });
});

describe("validateCounterOffer", () => {
  const original = { amountMinor: BigInt(10000000) };

  it("accepts a different positive amount and keeps the amount in minor units", () => {
    const result = validateCounterOffer({ amount: "1,15,000", note: "Best price for cash" }, original);
    expect(result).toEqual({
      ok: true,
      value: { amountMinor: BigInt(11500000), note: "Best price for cash", flagged: false, kinds: [] },
    });
  });

  it.each([
    ["an empty amount", ""],
    ["zero", "0"],
    ["the same amount as the offer", "100000"],
    ["letters", "ten thousand"],
  ])("rejects %s", (_label, amount) => {
    expect(validateCounterOffer({ amount, note: "" }, original).ok).toBe(false);
  });

  it("rejects a note longer than the limit", () => {
    expect(validateCounterOffer({ amount: "2000", note: "x".repeat(501) }, original).ok).toBe(false);
  });

  it("masks contact details in the note and flags them", () => {
    const result = validateCounterOffer({ amount: "2000", note: "ring me 98765 43210" }, original);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.flagged).toBe(true);
    expect(result.value.note).not.toMatch(/98765/);
    expect(result.value.kinds).toContain("PHONE");
  });
});
