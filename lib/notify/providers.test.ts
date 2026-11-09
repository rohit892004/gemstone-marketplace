import { describe, expect, it, vi } from "vitest";
import { buildResendPayload, RESEND_API_URL, ResendEmailProvider } from "./resend";
import { buildMsg91Payload, msg91Mobile, MSG91_FLOW_URL, Msg91SmsProvider } from "./msg91";

function fakeFetch(status: number, body: unknown = {}) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

describe("buildResendPayload", () => {
  it("sends only the recipient, subject and text to the configured sender", () => {
    expect(
      buildResendPayload({ to: "buyer@example.com", subject: "Hi", text: "Body" }, "Gemstone <no-reply@example.com>"),
    ).toEqual({
      from: "Gemstone <no-reply@example.com>",
      to: ["buyer@example.com"],
      subject: "Hi",
      text: "Body",
    });
  });
});

describe("ResendEmailProvider", () => {
  it("posts to the Resend API with a bearer key", async () => {
    const fetchImpl = fakeFetch(200, { id: "email_1" });
    const provider = new ResendEmailProvider({ apiKey: "re_test", from: "from@example.com" }, fetchImpl);
    await provider.send({ to: "buyer@example.com", subject: "S", text: "T" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_API_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ["buyer@example.com"], subject: "S" });
  });

  it("throws with the status only when Resend rejects the email", async () => {
    const provider = new ResendEmailProvider({ apiKey: "re_test", from: "from@example.com" }, fakeFetch(422, { message: "buyer@example.com is invalid" }));
    const error = await provider.send({ to: "buyer@example.com", subject: "S", text: "T" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Resend rejected the email with HTTP 422");
    expect((error as Error).message).not.toContain("buyer@example.com");
  });

  it("refuses to send without a key and never calls the network", async () => {
    const fetchImpl = fakeFetch(200);
    const provider = new ResendEmailProvider({ apiKey: "", from: "from@example.com" }, fetchImpl);
    await expect(provider.send({ to: "a@example.com", subject: "S", text: "T" })).rejects.toThrow(/RESEND_API_KEY/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("msg91Mobile", () => {
  it("strips the plus sign and spaces, keeping the country code", () => {
    expect(msg91Mobile("+91 98765 43210")).toBe("919876543210");
  });

  it("rejects numbers that are too short or too long", () => {
    expect(() => msg91Mobile("123")).toThrow(/not a valid phone number/);
    expect(() => msg91Mobile("+1234567890123456")).toThrow(/not a valid phone number/);
  });
});

describe("buildMsg91Payload", () => {
  it("maps the message to the Flow fields", () => {
    expect(
      buildMsg91Payload({ to: "+919876543210", body: "Your code is 123456" }, { senderId: "GEMSEL", templateId: "flow-1" }),
    ).toEqual({ flow_id: "flow-1", sender: "GEMSEL", mobiles: "919876543210", VAR1: "Your code is 123456" });
  });
});

describe("Msg91SmsProvider", () => {
  const config = { authKey: "auth-test", senderId: "GEMSEL", templateId: "flow-1" };

  it("posts to the Flow endpoint with the authkey header", async () => {
    const fetchImpl = fakeFetch(200, { type: "success" });
    await new Msg91SmsProvider(config, fetchImpl).send({ to: "+919876543210", body: "Code 1" });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(MSG91_FLOW_URL);
    expect((init.headers as Record<string, string>).authkey).toBe("auth-test");
    expect(JSON.parse(init.body as string)).toMatchObject({ flow_id: "flow-1", mobiles: "919876543210" });
  });

  it("throws when MSG91 returns an error body or a non-2xx status", async () => {
    await expect(
      new Msg91SmsProvider(config, fakeFetch(200, { type: "error", message: "bad" })).send({ to: "+919876543210", body: "x" }),
    ).rejects.toThrow(/reported an error/);
    await expect(
      new Msg91SmsProvider(config, fakeFetch(401, {})).send({ to: "+919876543210", body: "x" }),
    ).rejects.toThrow("MSG91 rejected the SMS with HTTP 401");
  });

  it("refuses to send without its keys and never calls the network", async () => {
    const fetchImpl = fakeFetch(200);
    await expect(
      new Msg91SmsProvider({ ...config, authKey: "" }, fetchImpl).send({ to: "+919876543210", body: "x" }),
    ).rejects.toThrow(/MSG91_AUTH_KEY/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
