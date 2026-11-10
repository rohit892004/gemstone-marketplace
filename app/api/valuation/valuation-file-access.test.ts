import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Valuation files (photos, video and the PDF) must follow the account state in the database, not only the session.
 * A deactivated valuer or a suspended buyer with a live session gets a 404 and no bytes.
 */

const mocks = vi.hoisted(() => ({
  session: { user: { id: "val_1", role: "VALUATOR" } } as null | { user: { id: string; role: string } },
  check: vi.fn(),
  loadMedia: vi.fn(),
  renderReport: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => mocks.session) }));
vi.mock("@/lib/auth/require-role", () => ({ checkRole: (...args: unknown[]) => mocks.check(...args) }));
vi.mock("@/lib/valuation/documents", () => ({
  loadValuationMediaForActor: (...args: unknown[]) => mocks.loadMedia(...args),
  renderValuationReport: (...args: unknown[]) => mocks.renderReport(...args),
}));

import { GET as mediaGET } from "./media/[id]/[variant]/route";
import { GET as pdfGET } from "./[id]/pdf/route";

const mediaCtx = { params: Promise.resolve({ id: "media_1", variant: "full" }) };
const pdfCtx = { params: Promise.resolve({ id: "val_1" }) };

describe("valuation files check the account state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: "val_1", role: "VALUATOR" } };
  });

  it("refuses a deactivated valuer's media request with 404 and reads nothing", async () => {
    mocks.check.mockResolvedValue({ ok: false, code: "ACCOUNT_SUSPENDED" });
    const response = await mediaGET(new Request("http://app.test/x"), mediaCtx);
    expect(response.status).toBe(404);
    expect(mocks.loadMedia).not.toHaveBeenCalled();
  });

  it("refuses a deactivated valuer's PDF request with 404 and renders nothing", async () => {
    mocks.check.mockResolvedValue({ ok: false, code: "ACCOUNT_SUSPENDED" });
    const response = await pdfGET(new Request("http://app.test/x"), pdfCtx);
    expect(response.status).toBe(404);
    expect(mocks.renderReport).not.toHaveBeenCalled();
  });

  it("uses the database-checked identity and role for media", async () => {
    mocks.check.mockResolvedValue({ ok: true, user: { id: "val_1", role: "VALUATOR" } });
    mocks.loadMedia.mockResolvedValue({ bytes: Buffer.from("x"), mimeType: "image/webp" });
    const response = await mediaGET(new Request("http://app.test/x"), mediaCtx);
    expect(response.status).toBe(200);
    expect(mocks.loadMedia).toHaveBeenCalledWith("media_1", { id: "val_1", role: "VALUATOR" }, "full");
  });

  it("returns 404 with no session without checking the database", async () => {
    mocks.session = null;
    const response = await pdfGET(new Request("http://app.test/x"), pdfCtx);
    expect(response.status).toBe(404);
    expect(mocks.check).not.toHaveBeenCalled();
  });
});
