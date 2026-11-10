/** Topics offered on the contact form. The value is stored in no table; it only shapes the email subject and body. */
export const CONTACT_TOPICS = [
  { value: "buying", label: "Buying a stone" },
  { value: "selling", label: "Selling on the platform" },
  { value: "valuation", label: "Valuation" },
  { value: "account", label: "Account or technical problem" },
  { value: "other", label: "Something else" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

export const CONTACT_TOPIC_VALUES = CONTACT_TOPICS.map((topic) => topic.value) as [ContactTopic, ...ContactTopic[]];

export function topicLabel(value: ContactTopic): string {
  const topic = CONTACT_TOPICS.find((item) => item.value === value);
  return topic ? topic.label : "Something else";
}
