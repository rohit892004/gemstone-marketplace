import type { ContactInput } from "./schema";
import { topicLabel } from "./topics";

/**
 * Email to the admin team. The subject is built only from the fixed topic label, never from visitor text,
 * so a crafted name or message cannot inject headers or change the subject.
 * The provider adapters do not support a reply-to field, so the visitor's address is written in the body.
 */
export function renderContactEmail(input: ContactInput): { subject: string; text: string } {
  return {
    subject: `[Contact form] ${topicLabel(input.topic)}`,
    text: [
      "A new message arrived through the contact form.",
      "",
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      `Topic: ${topicLabel(input.topic)}`,
      "",
      "Message:",
      input.message,
      "",
      `Reply to the sender at ${input.email}.`,
    ].join("\n"),
  };
}
