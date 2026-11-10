import type { EmailMessage, EmailProvider } from "./email";

/** Resend HTTP API (no SDK). https://resend.com/docs/api-reference/emails/send-email */
export const RESEND_API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;

export interface ResendConfig {
  apiKey: string;
  /** Verified sender, e.g. "Gemstone Selections <no-reply@your-domain>". */
  from: string;
}

export interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  headers?: Record<string, string>;
}

/** Builds the JSON body for one message. Pure, so it can be tested without the network. */
export function buildResendPayload(message: EmailMessage, from: string): ResendPayload {
  const payload: ResendPayload = { from, to: [message.to], subject: message.subject, text: message.text };
  if (message.headers && Object.keys(message.headers).length > 0) payload.headers = message.headers;
  return payload;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly config: ResendConfig,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  async send(message: EmailMessage): Promise<void> {
    if (!this.config.apiKey || !this.config.from) {
      throw new Error("Resend needs RESEND_API_KEY and EMAIL_FROM. Email was not sent.");
    }
    const response = await this.fetchImpl(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildResendPayload(message, this.config.from)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // Status only: the response body can echo the recipient address, so it is not logged.
    if (!response.ok) {
      throw new Error(`Resend rejected the email with HTTP ${response.status}`);
    }
  }
}
