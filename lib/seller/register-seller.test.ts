import { beforeEach, describe, expect, it, vi } from "vitest";

const mode = vi.hoisted(() => ({ value: "ok" as "ok" | "tx_fail" | "doc_fail" | "exists" }));

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ UPLOAD_MAX_MB: 10 }),
}));

vi.mock("@/lib/auth/register", () => ({
  registerAccount: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    certificateLab: {
      findMany: vi.fn(async () => [
        { id: "lab_gia", code: "gia", name: "GIA", isOther: false },
        { id: "lab_other", code: "other", name: "Other", isOther: true },
      ]),
    },
  },
}));

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, retryAfterSeconds: 3600 })),
}));

import { registerAccount } from "@/lib/auth/register";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { setStorageProviderForTests, type StorageProvider } from "@/lib/storage/storage";
import { registerSeller } from "./register-seller";
import type { SellerRegistrationInput } from "./types";

const KEY_PATTERN = /^sellers\/[0-9a-f]{24}\/(id-proof|business-proof|certificate)-[0-9a-f]{16}\.(pdf|jpg|png)$/;
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(64)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

let objects: Map<string, Buffer>;
let profileCreates: Record<string, unknown>[];
let documentRows: Record<string, unknown>[];

function fakeStorage(): StorageProvider {
  return {
    async put(key, data) {
      if (objects.has(key)) throw new Error("exists");
      objects.set(key, data);
    },
    async get(key) {
      const data = objects.get(key);
      if (!data) throw new Error("missing");
      return data;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}

function input(overrides: Partial<SellerRegistrationInput> = {}): SellerRegistrationInput {
  return {
    name: "Asha Rao",
    email: "asha@example.com",
    mobile: "+919812345678",
    password: "correct-horse-1",
    country: "India",
    businessName: "Rao Gems & Co.",
    businessType: "PARTNERSHIP",
    gstNumber: "",
    addressLine: "12 MG Road, Jaipur",
    city: "Jaipur",
    state: "Rajasthan",
    businessCountry: "India",
    pincode: "",
    yearsInBusiness: "12",
    specialties: ["Ruby", "Sapphire"],
    idProof: { name: "../id.pdf", size: PDF.length, data: PDF },
    businessProof: { name: "gst.png", size: PNG.length, data: PNG },
    certificates: [
      { file: { name: "gia report.pdf", size: PDF.length, data: PDF }, labCode: "gia", labOther: "" },
    ],
    ...overrides,
  };
}

function fakeTx() {
  return {
    sellerProfile: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        profileCreates.push(data);
        return { id: "sp_1" };
      }),
    },
    sellerDocument: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (mode.value === "doc_fail" && documentRows.length === 1) throw new Error("db down");
        documentRows.push(data);
        return data;
      }),
    },
  };
}

beforeEach(() => {
  mode.value = "ok";
  objects = new Map();
  profileCreates = [];
  documentRows = [];
  setStorageProviderForTests(fakeStorage());
  vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 3600 });
  vi.mocked(registerAccount).mockImplementation(async (args) => {
    const tx = fakeTx();
    await args.createProfile(tx as never, { id: "u_1", email: args.email });
    if (mode.value === "tx_fail") throw new Error("connection reset");
    if (mode.value === "exists") return { outcome: "EXISTING" as const };
    return { outcome: "CREATED" as const, userId: "u_1" };
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("registerSeller", () => {
  it("creates the profile and private documents, with opaque storage keys", async () => {
    const result = await registerSeller(input(), { ip: "203.0.113.5" });
    expect(result).toEqual({ ok: true });

    expect(profileCreates).toHaveLength(1);
    expect(profileCreates[0]).toMatchObject({
      userId: "u_1",
      businessName: "Rao Gems & Co.",
      businessType: "PARTNERSHIP",
      gstNumber: null,
      pincode: null,
      specialties: ["Ruby", "Sapphire"],
    });
    expect(String(profileCreates[0].slug)).toMatch(/^rao-gems-co-[0-9a-f]{6}$/);

    expect(documentRows.map((row) => row.type)).toEqual(["ID_PROOF", "BUSINESS_PROOF", "CERTIFICATE"]);
    for (const row of documentRows) {
      expect(String(row.fileKey)).toMatch(KEY_PATTERN);
      expect(String(row.fileKey)).not.toContain("gia");
    }
    expect(documentRows[0].fileName).toBe("id.pdf");
    expect(documentRows[2]).toMatchObject({ certificateLabId: "lab_gia", certificateLabOther: null });
    expect(objects.size).toBe(3);
  });

  it("passes the account fields and the client IP to registerAccount", async () => {
    await registerSeller(input(), { ip: "203.0.113.5" });
    expect(registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({ role: "SELLER", email: "asha@example.com", mobile: "+919812345678", ip: "203.0.113.5" }),
    );
  });

  it("deletes stored files when the transaction fails after the files were written", async () => {
    mode.value = "tx_fail";
    const result = await registerSeller(input(), { ip: "203.0.113.5" });
    expect(result).toEqual({ ok: false, reason: "failed" });
    expect(objects.size).toBe(0);
  });

  it("deletes files already written when a later document insert fails", async () => {
    mode.value = "doc_fail";
    const result = await registerSeller(input(), { ip: "203.0.113.5" });
    expect(result).toEqual({ ok: false, reason: "failed" });
    expect(objects.size).toBe(0);
  });

  it("deletes stored files and still returns the generic success when the email already exists", async () => {
    mode.value = "exists";
    const result = await registerSeller(input(), { ip: "203.0.113.5" });
    expect(result).toEqual({ ok: true });
    expect(objects.size).toBe(0);
  });

  it("does not touch the database or storage when validation fails", async () => {
    const result = await registerSeller(input({ idProof: null }), { ip: "203.0.113.5" });
    expect(result).toMatchObject({ ok: false, reason: "validation" });
    expect(registerAccount).not.toHaveBeenCalled();
    expect(objects.size).toBe(0);
  });

  it("stops when the per-IP registration limit is reached", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
    const result = await registerSeller(input(), { ip: "203.0.113.5" });
    expect(result).toEqual({ ok: false, reason: "rate_limited" });
    expect(consumeRateLimit).toHaveBeenCalledWith({ key: "register:ip:203.0.113.5", limit: 10, windowSeconds: 3600 });
    expect(registerAccount).not.toHaveBeenCalled();
  });
});
