import { NEWSLETTER_TOPICS, TOPIC_DESCRIPTIONS, TOPIC_LABELS, type NewsletterTopicName } from "@/lib/newsletter/topics";

/**
 * Topic checkboxes in a fieldset. Nothing is pre-ticked unless `selected` says so (for example, the
 * current choices on the preferences page). Works in server and client components.
 */
export function TopicFieldset({
  selected = [],
  legend = "Topics",
  hint,
  idPrefix = "topic",
}: {
  selected?: readonly string[];
  legend?: string;
  hint?: string;
  idPrefix?: string;
}) {
  const hintId = `${idPrefix}-hint`;
  return (
    <fieldset className="space-y-3" aria-describedby={hint ? hintId : undefined}>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {NEWSLETTER_TOPICS.map((topic: NewsletterTopicName) => (
          <label
            key={topic}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
          >
            <input
              type="checkbox"
              name="topics"
              value={topic}
              defaultChecked={selected.includes(topic)}
              id={`${idPrefix}-${topic.toLowerCase()}`}
              className="mt-1 h-4 w-4 shrink-0 accent-brand-strong focus:outline-none"
            />
            <span className="text-sm">
              <span className="block font-medium text-ink">{TOPIC_LABELS[topic]}</span>
              <span className="block text-ink-soft">{TOPIC_DESCRIPTIONS[topic]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
