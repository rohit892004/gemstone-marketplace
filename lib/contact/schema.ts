import { z } from "zod";
import { emailSchema, nameSchema } from "@/lib/validation/schemas";
import { CONTACT_TOPIC_VALUES } from "./topics";

export const CONTACT_MESSAGE_MIN = 10;
export const CONTACT_MESSAGE_MAX = 2000;

/**
 * Contact form input. `website` is a honeypot: real visitors never see or fill it, so any value means a bot.
 * The server action also checks it before parsing and answers as if the message were sent.
 */
export const contactSchema = z.object({
  name: nameSchema.refine((value) => !/[\r\n]/.test(value), "Enter your name on one line"),
  email: emailSchema,
  topic: z.enum(CONTACT_TOPIC_VALUES, { error: "Choose a topic" }),
  message: z
    .string()
    .trim()
    .min(CONTACT_MESSAGE_MIN, `Write at least ${CONTACT_MESSAGE_MIN} characters`)
    .max(CONTACT_MESSAGE_MAX, `Use at most ${CONTACT_MESSAGE_MAX} characters`),
  website: z.string().refine((value) => value.trim() === "", "Spam check failed"),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactField = "name" | "email" | "topic" | "message";
