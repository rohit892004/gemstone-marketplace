import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  createError: null as null | { code: string },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    webhookEvent: {
      create: vi.fn(async () => {
        if (state.createError) throw state.createError;
        return {};
      }),
      delete: vi.fn(async () => ({})),
    },
  },
}));

vi.mock("@/lib/newsletter/service", () => ({
  suppressAddress: vi.fn(async () => undefined),
}));

import { prisma } from "@/lib/db/client";
import { suppressAddress } from "@/lib/newsletter/service";
import { POST } from "./route";

const KEY = Buffer.from("resend-test-signing-key-bytes");
const SECRET = `whsec_${KEY.toString("base64")}`;
const ORIGINAL_SECRET = process.env.RESEND_WEBHOOK_SECRET;

function signedRequest(body: string, options: { id?: string; sign?: string; timestamp?: string } = {}): Request {
  const id = options.id ?? "msg_evt_1";
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = `v1,${createHmac("sha256", KEY).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
  return new Request("https://example.test/api/webhooks/resend", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": options.sign ?? signature,
    },
    body,
  });
}

const bounce = JSON.stringify({ type: "email.bounced", data: { to: ["gone@x.test"] } });
const complaint = JSON.stringify({ type: "email.complained", data: { to: ["angry@x.test"] } });

beforeEach(() => {
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
  state.createError = null;
  vi.clearAllMocks();
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
  else process.env.RESEND_WEBHOOK_SECRET = ORIGINAL_SECRET;
});

describe("POST /api/webhooks/resend", () => {
  it("refuses with 503 when the secret is not configured", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const response = await POST(signedRequest(bounce));
    expect(response.status).toBe(503);
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
  });

  it("returns 401 for a bad signature and changes nothing", async () => {
    const response = await POST(signedRequest(bounce, { sign: "v1,AAAA" }));
    expect(response.status).toBe(401);
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(suppressAddress).not.toHaveBeenCalled();
  });

  it("returns 401 when the body was altered after signing", async () => {
    const signed = signedRequest(bounce);
    const tampered = new Request(signed.url, { method: "POST", headers: signed.headers, body: complaint });
    const response = await POST(tampered);
    expect(response.status).toBe(401);
    expect(suppressAddress).not.toHaveBeenCalled();
  });

  it("suppresses each recipient of a bounce", async () => {
    const response = await POST(signedRequest(bounce));
    expect(response.status).toBe(200);
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith({ data: { id: "msg_evt_1", provider: "resend", type: "email.bounced" } });
    expect(suppressAddress).toHaveBeenCalledWith({ email: "gone@x.test", reason: "BOUNCE", source: "resend:email.bounced" });
  });

  it("suppresses a complaint as COMPLAINT", async () => {
    const response = await POST(signedRequest(complaint, { id: "msg_evt_2" }));
    expect(response.status).toBe(200);
    expect(suppressAddress).toHaveBeenCalledWith({ email: "angry@x.test", reason: "COMPLAINT", source: "resend:email.complained" });
  });

  it("acknowledges a redelivered event without processing it again", async () => {
    state.createError = { code: "P2002" };
    const response = await POST(signedRequest(bounce));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
    expect(suppressAddress).not.toHaveBeenCalled();
  });

  it("acknowledges other event types without suppressing anyone", async () => {
    const delivered = JSON.stringify({ type: "email.delivered", data: { to: ["ok@x.test"] } });
    const response = await POST(signedRequest(delivered, { id: "msg_evt_3" }));
    expect(response.status).toBe(200);
    expect(suppressAddress).not.toHaveBeenCalled();
  });

  it("frees the event id and returns 500 when suppression fails, so the provider retries", async () => {
    vi.mocked(suppressAddress).mockRejectedValueOnce(new Error("db down"));
    const response = await POST(signedRequest(bounce, { id: "msg_evt_4" }));
    expect(response.status).toBe(500);
    expect(prisma.webhookEvent.delete).toHaveBeenCalledWith({ where: { id: "msg_evt_4" } });
  });
});
