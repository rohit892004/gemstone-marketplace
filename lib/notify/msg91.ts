import type { SmsMessage, SmsProvider } from "./sms";

/**
 * MSG91 Flow API (no SDK). The DLT-approved Flow has one variable, VAR1, which carries the whole
 * message text, so the approved template must be "##var1##" (or equivalent). Unverified against
 * live MSG91: no key was available when this was written.
 */
export const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow/";
const REQUEST_TIMEOUT_MS = 10_000;

export interface Msg91Config {
  authKey: string;
  /** DLT sender ID (6 characters). */
  senderId: string;
  /** MSG91 Flow id (the DLT template id). */
  templateId: string;
}

export interface Msg91Payload {
  flow_id: string;
  sender: string;
  mobiles: string;
  VAR1: string;
}

/** MSG91 wants the country code and digits without "+" or spaces. */
export function msg91Mobile(to: string): string {
  const digits = to.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("SMS recipient is not a valid phone number. SMS was not sent.");
  }
  return digits;
}

/** Builds the JSON body for one SMS. Pure, so it can be tested without the network. */
export function buildMsg91Payload(message: SmsMessage, config: Pick<Msg91Config, "senderId" | "templateId">): Msg91Payload {
  return {
    flow_id: config.templateId,
    sender: config.senderId,
    mobiles: msg91Mobile(message.to),
    VAR1: message.body,
  };
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export class Msg91SmsProvider implements SmsProvider {
  constructor(
    private readonly config: Msg91Config,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  async send(message: SmsMessage): Promise<void> {
    const { authKey, senderId, templateId } = this.config;
    if (!authKey || !senderId || !templateId) {
      throw new Error("MSG91 needs MSG91_AUTH_KEY, MSG91_SENDER_ID and MSG91_TEMPLATE_ID. SMS was not sent.");
    }
    const response = await this.fetchImpl(MSG91_FLOW_URL, {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(buildMsg91Payload(message, { senderId, templateId })),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`MSG91 rejected the SMS with HTTP ${response.status}`);
    }
    const data = (await response.json().catch(() => null)) as { type?: string } | null;
    if (data?.type === "error") {
      throw new Error("MSG91 reported an error for the SMS request");
    }
  }
}
