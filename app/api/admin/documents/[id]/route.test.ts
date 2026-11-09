import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string }; issuedAt?: number },
  dbUser: null as null | Record<string, unknown>,
  document: null as null | Record<string, unknown>,
}));

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  sellerDocument: { findUnique: vi.fn() },
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => state.session),
}));

vi.mock("@/lib/db/client", () => ({ prisma: db }));

vi.mock("next/server", () => ({
  connection: async () => undefined,
}));

vi.mock("@/lib/audit/audit", () => ({
  recordAudit: vi.fn(async () => undefined),
}));

import { recordAudit } from "@/lib/audit/audit";
import { setStorageProviderForTests, type StorageProvider } from "@/lib/storage/storage";
import { GET } from "./route";

const STORED_KEY = "sellers/sp_1/doc-1.pdf";
const PDF_BYTES = Buffer.from("%PDF-1.4 fake certificate bytes");

const admin = {
  id: "u_admin",
  email: "admin@example.com",
  name: "Platform Admin",
  role: "ADMIN",
  status: "ACTIVE",
  emailVerifiedAt: new Date("2026-01-01"),
  passwordChangedAt: null,
  sellerProfile: null,
};

/** In-memory storage. Records every key it is asked for. */
function fakeStorage(objects: Record<string, Buffer>) {
  const requested: string[] = [];
  const provider: StorageProvider = {
    put: vi.fn(async () => undefined),
    get: vi.fn(async (key: string) => {
      requested.push(key);
      const data = objects[key];
      if (!data) {
        const error = new Error("ENOENT: no such file") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return data;
    }),
    delete: vi.fn(async () => undefined),
  };
  return { provider, requested };
}

function request(id: string): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`https://app.test/api/admin/documents/${id}`, {
      headers: { "x-forwarded-for": "198.51.100.4" },
    }),
    { params: Promise.resolve({ id }) },
  ];
}

function setAdmin(role: string) {
  state.dbUser = { ...admin, id: role === "ADMIN" ? "u_admin" : "u_other", role };
  state.session = { user: { id: state.dbUser.id as string, role }, issuedAt: Math.floor(Date.now() / 1000) };
}

beforeEach(() => {
  setAdmin("ADMIN");
  state.document = {
    id: "doc_1",
    sellerId: "sp_1",
    fileKey: STORED_KEY,
    fileName: 'GIA "report"\\final.pdf',
    mimeType: "application/pdf",
  };
  db.user.findUnique.mockImplementation(async () => state.dbUser);
  db.sellerDocument.findUnique.mockImplementation(async () => state.document);
});

afterEach(() => {
  setStorageProviderForTests(undefined);
  vi.clearAllMocks();
});

describe("GET /api/admin/documents/[id]", () => {
  it("refuses a non-admin with 403 and never looks up the document", async () => {
    setAdmin("BUYER");
    const { provider, requested } = fakeStorage({ [STORED_KEY]: PDF_BYTES });
    setStorageProviderForTests(provider);

    const response = await GET(...request("doc_1"));

    expect(response.status).toBe(403);
    expect(db.sellerDocument.findUnique).not.toHaveBeenCalled();
    expect(requested).toHaveLength(0);
  });

  it("refuses an anonymous request with 401", async () => {
    state.session = null;
    const response = await GET(...request("doc_1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown id", async () => {
    state.document = null;
    const { provider, requested } = fakeStorage({});
    setStorageProviderForTests(provider);

    const response = await GET(...request("nope"));

    expect(response.status).toBe(404);
    expect(requested).toHaveLength(0);
  });

  it("serves the bytes to an admin with the secure headers", async () => {
    const { provider } = fakeStorage({ [STORED_KEY]: PDF_BYTES });
    setStorageProviderForTests(provider);

    const response = await GET(...request("doc_1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="GIA _report_final.pdf"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-length")).toBe(String(PDF_BYTES.byteLength));
    expect(Buffer.from(await response.arrayBuffer()).equals(PDF_BYTES)).toBe(true);
  });

  it("records a DOCUMENT_DOWNLOADED audit entry with the admin, document and IP", async () => {
    setStorageProviderForTests(fakeStorage({ [STORED_KEY]: PDF_BYTES }).provider);

    await GET(...request("doc_1"));

    expect(recordAudit).toHaveBeenCalledWith({
      action: "seller.document.downloaded",
      actorId: "u_admin",
      entityType: "SellerDocument",
      entityId: "doc_1",
      ip: "198.51.100.4",
      meta: { sellerId: "sp_1" },
    });
  });

  it("never includes the storage key in headers or body", async () => {
    setStorageProviderForTests(fakeStorage({ [STORED_KEY]: PDF_BYTES }).provider);

    const response = await GET(...request("doc_1"));
    const headerText = [...response.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
    const body = await response.text();

    expect(headerText).not.toContain(STORED_KEY);
    expect(headerText).not.toContain("sellers/");
    expect(body).not.toContain(STORED_KEY);
  });

  it("rejects a traversal-looking fileKey from the database with 404 and never reads storage", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.document = { ...(state.document as object), fileKey: "../../etc/passwd" };
    const { provider, requested } = fakeStorage({ "../../etc/passwd": Buffer.from("root:x") });
    setStorageProviderForTests(provider);

    const response = await GET(...request("doc_1"));
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(requested).toHaveLength(0);
    expect(body).not.toContain("etc/passwd");
    expect(recordAudit).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("returns 404 when the stored file is missing, without leaking the key", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setStorageProviderForTests(fakeStorage({}).provider);

    const response = await GET(...request("doc_1"));
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body).not.toContain(STORED_KEY);
    errorSpy.mockRestore();
  });

  it("returns a generic 500 for other storage failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const provider: StorageProvider = {
      put: vi.fn(async () => undefined),
      get: vi.fn(async () => {
        throw new Error("EACCES: /secret/root/sellers/sp_1/doc-1.pdf");
      }),
      delete: vi.fn(async () => undefined),
    };
    setStorageProviderForTests(provider);

    const response = await GET(...request("doc_1"));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).not.toContain("/secret");
    expect(body).not.toContain(STORED_KEY);
    errorSpy.mockRestore();
  });
});
