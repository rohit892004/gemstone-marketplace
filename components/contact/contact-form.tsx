"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { submitContactAction } from "@/app/contact/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { CONTACT_MESSAGE_MAX } from "@/lib/contact/schema";
import { CONTACT_FORM_IDLE, type ContactFormState } from "@/lib/contact/state";
import { CONTACT_TOPICS } from "@/lib/contact/topics";

type Errors = Partial<Record<"name" | "email" | "topic" | "message", string>>;

/** Error text announced at once through role="alert". The control points at it with aria-describedby. */
function FieldError({ id, message }: { id: string; message?: string }): ReactNode {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[12px] text-danger">
      {message}
    </p>
  );
}

/**
 * In-platform contact form. Posts to submitContactAction. The form is cleared only after a successful send,
 * so a validation error keeps what the visitor typed. The honeypot field is outside the tab order and hidden
 * from assistive technology.
 */
export function ContactForm() {
  const id = useId();
  const [state, setState] = useState<ContactFormState>(CONTACT_FORM_IDLE);
  const [pending, startTransition] = useTransition();

  const errors: Errors = state.status === "error" ? state.fieldErrors : {};
  const describe = (field: keyof Errors) => (errors[field] ? `${id}-${field}-error` : undefined);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await submitContactAction(state, data);
      setState(result);
      if (result.status === "sent") form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {state.status === "error" && state.formError ? (
        <p role="alert" className="border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.formError}
        </p>
      ) : null}

      <div role="status" aria-live="polite" className="empty:hidden">
        {state.status === "sent" ? (
          <p className="border border-success/40 bg-success/5 px-4 py-3 text-sm text-ink">
            Thank you. Your message has been sent to the Gemstone Selections team. We will reply to the email address you gave us.
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id={`${id}-name`} label="Your name">
          <Input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            required
            maxLength={120}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describe("name")}
            className="min-h-11"
          />
          <FieldError id={`${id}-name-error`} message={errors.name} />
        </Field>

        <Field id={`${id}-email`} label="Email address">
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describe("email")}
            className="min-h-11"
          />
          <FieldError id={`${id}-email-error`} message={errors.email} />
        </Field>
      </div>

      <Field id={`${id}-topic`} label="Topic">
        <Select
          id={`${id}-topic`}
          name="topic"
          required
          defaultValue=""
          aria-invalid={errors.topic ? true : undefined}
          aria-describedby={describe("topic")}
          className="min-h-11"
        >
          <option value="" disabled>
            Choose a topic
          </option>
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic.value} value={topic.value}>
              {topic.label}
            </option>
          ))}
        </Select>
        <FieldError id={`${id}-topic-error`} message={errors.topic} />
      </Field>

      <Field
        id={`${id}-message`}
        label="Your message"
        hint={`Between 10 and ${CONTACT_MESSAGE_MAX} characters. Do not include card or bank details.`}
      >
        <Textarea
          id={`${id}-message`}
          name="message"
          required
          minLength={10}
          maxLength={CONTACT_MESSAGE_MAX}
          rows={7}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? `${id}-message-error` : undefined}
        />
        <FieldError id={`${id}-message-error`} message={errors.message} />
      </Field>

      {/* Honeypot: hidden from people and assistive technology, skipped by Tab. Bots fill it in. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Button type="submit" block disabled={pending} className="min-h-11">
        {pending ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}
