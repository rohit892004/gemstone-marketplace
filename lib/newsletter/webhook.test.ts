import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseResendEvent, verifyResendWebhook, WEBHOOK_TOLERANCE_SECONDS } from "./webhook";

const KEY = Buffer.from("test-signing-key-bytes-0123456789");
const SECRET = `whsec_${KEY.toString("base64")}`;
const now = new Date("2026-11-10T06:00:00Z");
const timestamp = String(Math.floor(now.getTime() / 1000));
const id = "msg_123";
const body = JSON.stringify({ type: "email.bounced", data: { to: ["asha@example.com"] } });

function sign(payload: string, ts = timestamp, msgId = id, key = KEY): string {
  return `v1,${createHmac("sha256", key).update(`${msgId}.${ts}.${payload}`).digest("base64")}`;
}

describe("verifyResendWebhook", () => {
  it("accepts a correctly signed delivery", () => {
    expect(verifyResendWebhook({ body, id, timestamp, signature: sign(body), secret: SECRET, now })).toEqual({ ok: true });
  });

  it("accepts when one of several listed signatures matches", () => {
    const signature = `v1,bm90LXRoZS1yaWdodC1vbmU= ${sign(body)}`;
    expect(verifyResendWebhook({ body, id, timestamp, signature, secret: SECRET, now })).toEqual({ ok: true });
  });

  it("refuses a changed body", () => {
    const changed = body.replace("bounced", "delivered");
    expect(verifyResendWebhook({ body: changed, id, timestamp, signature: sign(body), secret: SECRET, now })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("refuses a signature made with another key", () => {
    const other = Buffer.from("some-other-key");
    expect(verifyResendWebhook({ body, id, timestamp, signature: sign(body, timestamp, id, other), secret: SECRET, now })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("refuses an old delivery (replay)", () => {
    const old = String(Math.floor(now.getTime() / 1000) - WEBHOOK_TOLERANCE_SECONDS - 1);
    expect(verifyResendWebhook({ body, id, timestamp: old, signature: sign(body, old), secret: SECRET, now })).toEqual({ ok: false, reason: "stale" });
  });

  it("refuses missing headers and a malformed secret", () => {
    expect(verifyResendWebhook({ body, id: null, timestamp, signature: sign(body), secret: SECRET, now })).toEqual({ ok: false, reason: "missing_headers" });
    expect(verifyResendWebhook({ body, id, timestamp, signature: sign(body), secret: "not-a-secret", now })).toEqual({ ok: false, reason: "bad_secret" });
  });
});

describe("parseResendEvent", () => {
  it("reads the type and recipients", () => {
    expect(parseResendEvent(body)).toEqual({ type: "email.bounced", recipients: ["asha@example.com"] });
  });

  it("returns null for non-events", () => {
    expect(parseResendEvent("not json")).toBeNull();
    expect(parseResendEvent("[]")).toBeNull();
    expect(parseResendEvent('{"data":{}}')).toBeNull();
  });
});
