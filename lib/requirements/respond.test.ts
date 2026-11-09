import { describe, expect, it, vi } from "vitest";
import { requirementResponseProblem } from "./respond";

vi.mock("@/lib/db/client", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => null) }));

const NOW = new Date("2026-11-09T06:00:00.000Z");
const open = { buyerId: "buyer", status: "OPEN", deadline: null, categoryId: "cat_a" };
const seller = { sellerId: "seller", categoryIds: ["cat_a"] };

describe("requirementResponseProblem", () => {
  it("lets an approved seller in a matching category respond to an open requirement", () => {
    expect(requirementResponseProblem(open, seller, NOW)).toBeNull();
  });

  it("refuses the buyer's own requirement", () => {
    expect(requirementResponseProblem(open, { sellerId: "buyer", categoryIds: ["cat_a"] }, NOW)?.code).toBe("NOT_ALLOWED");
  });

  it("refuses closed requirements and requirements past their deadline", () => {
    expect(requirementResponseProblem({ ...open, status: "CLOSED" }, seller, NOW)?.code).toBe("CLOSED");
    const past = { ...open, deadline: new Date("2026-11-01T00:00:00Z") };
    expect(requirementResponseProblem(past, seller, NOW)?.code).toBe("CLOSED");
    const future = { ...open, deadline: new Date("2026-12-01T00:00:00Z") };
    expect(requirementResponseProblem(future, seller, NOW)).toBeNull();
  });

  it("refuses sellers outside the requirement's category, and requirements without a category", () => {
    expect(requirementResponseProblem({ ...open, categoryId: "cat_z" }, seller, NOW)?.code).toBe("NOT_ALLOWED");
    expect(requirementResponseProblem({ ...open, categoryId: null }, seller, NOW)?.code).toBe("NOT_ALLOWED");
  });
});
