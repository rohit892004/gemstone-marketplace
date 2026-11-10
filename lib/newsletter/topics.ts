/** Newsletter topics: labels for the forms and the admin, and parsing of submitted values. */

export const NEWSLETTER_TOPICS = ["EDUCATION", "MARKET_NEWS", "NEW_LISTINGS", "PLATFORM_UPDATES"] as const;
export type NewsletterTopicName = (typeof NEWSLETTER_TOPICS)[number];

export const TOPIC_LABELS: Record<NewsletterTopicName, string> = {
  EDUCATION: "Education",
  MARKET_NEWS: "Market news",
  NEW_LISTINGS: "New listings",
  PLATFORM_UPDATES: "Platform updates",
};

export const TOPIC_DESCRIPTIONS: Record<NewsletterTopicName, string> = {
  EDUCATION: "New guides and reference pages on gemstones.",
  MARKET_NEWS: "Market news, with the source of each item.",
  NEW_LISTINGS: "Notable new stones from our verified sellers.",
  PLATFORM_UPDATES: "What is new on Gemstone Selections.",
};

export function isNewsletterTopic(value: string): value is NewsletterTopicName {
  return (NEWSLETTER_TOPICS as readonly string[]).includes(value);
}

/**
 * Keeps only known topics, without duplicates, in the canonical order.
 * Unknown values are dropped, never stored.
 */
export function normaliseTopics(values: readonly string[]): NewsletterTopicName[] {
  const wanted = new Set(values.filter(isNewsletterTopic));
  return NEWSLETTER_TOPICS.filter((topic) => wanted.has(topic));
}

/**
 * Topics a subscriber receives from a campaign or digest aimed at `target`:
 * true when they chose at least one of the target topics.
 */
export function wantsAnyTopic(subscriberTopics: readonly string[], target: readonly string[]): boolean {
  return target.some((topic) => subscriberTopics.includes(topic));
}
