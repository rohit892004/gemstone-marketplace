import { getEnv } from "@/lib/config/env";
import { Msg91SmsProvider } from "./msg91";

export interface SmsMessage {
  /** E.164-style number, e.g. +919812345678 */
  to: string;
  body: string;
}

/** Sends SMS. Used for mobile OTP. */
export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

/** Dev provider: prints the message to the server console. Blocked in production by env validation. */
export class ConsoleSmsProvider implements SmsProvider {
  async send(message: SmsMessage): Promise<void> {
    console.log(`\n[sms:console] to=${message.to}\n${message.body}\n`);
  }
}

/** Test provider: keeps messages in memory. */
export class MemorySmsProvider implements SmsProvider {
  readonly sent: SmsMessage[] = [];
  async send(message: SmsMessage): Promise<void> {
    this.sent.push(message);
  }
}

let override: SmsProvider | undefined;
let instance: SmsProvider | undefined;

/** Tests only. */
export function setSmsProviderForTests(provider: SmsProvider | undefined): void {
  override = provider;
}

export function getSmsProvider(): SmsProvider {
  if (override) return override;
  if (!instance) {
    const { SMS_PROVIDER, NODE_ENV, ALLOW_NON_DELIVERING_PROVIDERS } = getEnv();
    if (SMS_PROVIDER === "console" && NODE_ENV === "production" && ALLOW_NON_DELIVERING_PROVIDERS !== "true") {
      throw new Error("SMS_PROVIDER=console is not allowed in production. Configure a real provider.");
    }
    if (SMS_PROVIDER === "console") {
      instance = new ConsoleSmsProvider();
    } else if (SMS_PROVIDER === "msg91") {
      // Refuse to build a sender without its keys: nothing is sent and the caller gets a clear error.
      const { MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_TEMPLATE_ID } = getEnv();
      if (!MSG91_AUTH_KEY || !MSG91_SENDER_ID || !MSG91_TEMPLATE_ID) {
        throw new Error("SMS_PROVIDER=msg91 needs MSG91_AUTH_KEY, MSG91_SENDER_ID and MSG91_TEMPLATE_ID. SMS was not sent.");
      }
      instance = new Msg91SmsProvider({
        authKey: MSG91_AUTH_KEY,
        senderId: MSG91_SENDER_ID,
        templateId: MSG91_TEMPLATE_ID,
      });
    } else {
      throw new Error(`Unknown SMS_PROVIDER: ${SMS_PROVIDER}`);
    }
  }
  return instance;
}
