import { NEWSLETTER_TOPICS, TOPIC_DESCRIPTIONS, TOPIC_LABELS, type NewsletterTopicName } from "@/lib/newsletter/topics";

/**
 * Topic checkboxes in a fieldset. Nothing is pre-ticked unless `selected` says so (for example, the
 * current choices on the preferences page). Works in server and client components.
 * `layout="list"` stacks the topics as one tidy list (sign-up panels, footer). The default `grid` is two
 * columns on wide screens (account page).
 */
export function TopicFieldset({
  selected = [],
  legend = "Topics",
  hint,
  idPrefix = "topic",
  layout = "grid",
}: {
  selected?: readonly string[];
  legend?: string;
  hint?: string;
  idPrefix?: string;
  layout?: "grid" | "list";
}) {
  const hintId = `${idPrefix}-hint`;
  const list = layout === "list";
  return (
    <fieldset className="space-y-3" aria-describedby={hint ? hintId : undefined}>
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-sm leading-relaxed text-ink-soft">
          {hint}
        </p>
      ) : null}
      <div className={list ? "divide-y divide-line border border-line" : "grid gap-2 sm:grid-cols-2"}>
        {NEWSLETTER_TOPICS.map((topic: NewsletterTopicName) => (
          <label
            key={topic}
            className={
              "flex min-h-11 cursor-pointer items-start gap-3 bg-surface-raised p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent" +
              (list ? "" : " border border-line")
            }
          >
            <input
              type="checkbox"
              name="topics"
              value={topic}
              defaultChecked={selected.includes(topic)}
              id={`${idPrefix}-${topic.toLowerCase()}`}
              className="mt-0.5 h-5 w-5 shrink-0 accent-brand-strong focus:outline-none"
            />
            <span className="text-sm leading-relaxed">
              <span className="block font-medium text-ink">{TOPIC_LABELS[topic]}</span>
              <span className="block text-ink-soft">{TOPIC_DESCRIPTIONS[topic]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
