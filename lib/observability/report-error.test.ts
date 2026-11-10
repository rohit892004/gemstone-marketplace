import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { buildEnvelope, parseDsn, reportError, scrubForReport } from "./report-error";

const fetchMock = vi.fn();

describe("reportError is off by default", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://x@y/z";
    delete process.env.SENTRY_DSN;
    resetEnvCacheForTests();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
    vi.unstubAllGlobals();
    resetEnvCacheForTests();
  });

  it("sends nothing when SENTRY_DSN is not set", async () => {
    await reportError(new Error("boom"), { route: "/x" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends to Sentry when a valid DSN is set", async () => {
    process.env.SENTRY_DSN = "https://abc123@o1.ingest.example/42";
    resetEnvCacheForTests();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await reportError(new Error("boom"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://o1.ingest.example/api/42/envelope/");
  });

  it("never throws when the network fails", async () => {
    process.env.SENTRY_DSN = "https://abc123@o1.ingest.example/42";
    resetEnvCacheForTests();
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(reportError(new Error("boom"))).resolves.toBeUndefined();
  });
});

describe("scrubbing", () => {
  it("removes cookies, authorisation headers and request bodies", () => {
    const scrubbed = scrubForReport({
      route: "/login",
      request: {
        method: "POST",
        headers: { cookie: "authjs.session-token=abc", authorization: "Bearer x", "user-agent": "ua" },
        body: { email: "buyer@example.com", password: "hunter22" },
      },
    });
    const json = JSON.stringify(scrubbed);
    expect(json).not.toContain("authjs.session-token");
    expect(json).not.toContain("Bearer x");
    expect(json).not.toContain("hunter22");
    expect(json).not.toContain("buyer@example.com");
    expect(json).toContain('"route":"/login"');
    expect(json).toContain('"method":"POST"');
  });

  it("masks emails and phone numbers inside messages", () => {
    const parsed = parseDsn("https://k@h.example/1");
    expect(parsed).toBeDefined();
    const { body } = buildEnvelope(parsed!, new Error("failed for jane@example.com on +91 98765 43210"), {});
    expect(body).not.toContain("jane@example.com");
    expect(body).not.toContain("98765 43210");
    expect(body).toContain("[email]");
  });

  it("truncates long strings", () => {
    // Words separated by spaces, as real messages are. One unbroken run would be masked as a token instead.
    expect((scrubForReport("word ".repeat(400)) as string).length).toBe(500);
  });
});

describe("parseDsn", () => {
  it("accepts the standard DSN and rejects malformed ones", () => {
    expect(parseDsn("https://key@o1.ingest.example/42")?.projectId).toBe("42");
    expect(parseDsn("not a dsn")).toBeUndefined();
    expect(parseDsn("http://key@host/1")).toBeUndefined();
  });
});
