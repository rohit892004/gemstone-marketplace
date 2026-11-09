import { getEnv } from "@/lib/config/env";
import { ResendEmailProvider } from "./resend";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Sends transactional email. Implementations must not log secrets in production. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/** Dev provider: prints the message (including links) to the server console. */
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      `\n[email:console] to=${message.to}\nsubject: ${message.subject}\n${message.text}\n`,
    );
  }
}

/** Test provider: keeps messages in memory for assertions. */
export class MemoryEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

let override: EmailProvider | undefined;
let instance: EmailProvider | undefined;

/** Tests only: replace the provider. Pass undefined to restore the configured one. */
export function setEmailProviderForTests(provider: EmailProvider | undefined): void {
  override = provider;
}

export function getEmailProvider(): EmailProvider {
  if (override) return override;
  if (!instance) {
    const { EMAIL_PROVIDER, NODE_ENV, ALLOW_NON_DELIVERING_PROVIDERS } = getEnv();
    if (EMAIL_PROVIDER === "console" && NODE_ENV === "production" && ALLOW_NON_DELIVERING_PROVIDERS !== "true") {
      throw new Error("EMAIL_PROVIDER=console is not allowed in production. Configure a real provider.");
    }
    if (EMAIL_PROVIDER === "console") {
      instance = new ConsoleEmailProvider();
    } else if (EMAIL_PROVIDER === "resend") {
      // Refuse to build a sender without its key: nothing is sent and the caller gets a clear error.
      const { RESEND_API_KEY, EMAIL_FROM } = getEnv();
      if (!RESEND_API_KEY || !EMAIL_FROM) {
        throw new Error("EMAIL_PROVIDER=resend needs RESEND_API_KEY and EMAIL_FROM. Email was not sent.");
      }
      instance = new ResendEmailProvider({ apiKey: RESEND_API_KEY, from: EMAIL_FROM });
    } else {
      throw new Error(`Unknown EMAIL_PROVIDER: ${EMAIL_PROVIDER}`);
    }
  }
  return instance;
}
