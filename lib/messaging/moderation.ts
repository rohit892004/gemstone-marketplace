/**
 * Contact-detail moderation. Runs on every message, offer note, quotation, and requirement note
 * BEFORE the text is stored. Stored text is the masked text, so raw contact details never reach
 * the database, the admin queue, or a notification email.
 *
 * Detects: phone numbers (digits, spaced or dashed digits, number words, Unicode digits, letter
 * lookalikes), email addresses (including "name at domain dot com"), URLs and bare domains,
 * @handles, and messaging-app names followed by a handle ("whatsapp 98...", "telegram: name").
 *
 * This is a best-effort filter, not a guarantee. The review checklist asks a reviewer to try to
 * bypass it. Known gaps are listed in the M3 status notes.
 */

export const CONTACT_KINDS = ["PHONE", "EMAIL", "URL", "HANDLE", "PLATFORM"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const MASK = "[hidden contact]";

export interface ModerationResult {
  /** Text with contact details masked. Safe to store and to show to other users. */
  text: string;
  /** Kinds detected. Never contains the detected values. */
  kinds: ContactKind[];
  /** True when at least one contact detail was masked. */
  flagged: boolean;
}

// Zero-width and formatting characters that can split digits or words.
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠋-᠎​-‏‪-‮⁠-⁯︀-️﻿⃣\u{E0100}-\u{E01EF}]/gu;

// Non-ASCII decimal digit blocks that NFKC does not fold to ASCII.
const DIGIT_BLOCKS: [number, number][] = [
  [0x0660, 0x0669], // Arabic-Indic
  [0x06f0, 0x06f9], // Extended Arabic-Indic
  [0x0966, 0x096f], // Devanagari
  [0x09e6, 0x09ef], // Bengali
  [0x0a66, 0x0a6f], // Gurmukhi
  [0x0ae6, 0x0aef], // Gujarati
  [0x0be6, 0x0bef], // Tamil
  [0x0c66, 0x0c6f], // Telugu
  [0x0ce6, 0x0cef], // Kannada
  [0x0d66, 0x0d6f], // Malayalam
];

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", oh: "0", o: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

const TLDS =
  "com|net|org|info|biz|io|co|in|uk|us|au|ca|de|fr|ru|me|ly|gl|app|ai|xyz|tv|edu|gov|store|shop|online|site|link|to|cc";

/** Normalises text so detection sees the characters a reader would see. */
export function normaliseForModeration(input: string): string {
  let s = input.normalize("NFKC").replace(INVISIBLE, "");
  s = s.replace(/\p{Nd}/gu, (ch) => {
    const code = ch.codePointAt(0)!;
    for (const [lo, hi] of DIGIT_BLOCKS) {
      if (code >= lo && code <= hi) return String(code - lo);
    }
    return ch;
  });
  return s;
}

/** Turns runs of spelled-out digits ("nine eight seven six five four three") into digits. */
function convertNumberWords(s: string): string {
  const words = Object.keys(NUMBER_WORDS).join("|");
  const runRe = new RegExp(`\\b(?:${words})(?:[\\s,.\\-]+(?:${words}))+\\b`, "gi");
  return s.replace(runRe, (run) => {
    const parts = run.match(/[a-z]+/gi) ?? [];
    if (parts.length < 3) return run; // two words in a row is not a phone number
    return parts.map((w) => NUMBER_WORDS[w.toLowerCase()] ?? "").join("");
  });
}

/** Letter lookalikes inside digit runs: "98765 4321O" -> "98765 43210". */
function convertLetterDigits(s: string): string {
  return s
    .replace(/(?<=\d)[oO]|[oO](?=\d)/g, "0")
    .replace(/(?<=\d)[lI]|[lI](?=\d)/g, "1");
}

/** Collapses "name at domain dot com" and "name(at)domain(dot)com" into normal email and domain syntax. */
function convertSpelledDomains(s: string): string {
  const at = /\s*[\[({]?\s*(?:at|@)\s*[\])}]?\s*/i;
  const dot = /\s*[\[({]?\s*dot\s*[\])}]?\s*/i;
  const emailForm = new RegExp(
    `([a-z0-9._-]+)${at.source}([a-z0-9-]+)${dot.source}(${TLDS.split("|").join("|")})\\b`,
    "gi",
  );
  const domainForm = new RegExp(`\\b([a-z0-9-]+)${dot.source}(${TLDS.split("|").join("|")})\\b`, "gi");
  return s.replace(emailForm, "$1@$2.$3").replace(domainForm, "$1.$2");
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const URL_RE = new RegExp(
  `(?:\\bhttps?:\\/\\/\\S+|\\bwww\\.\\S+|\\b[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})(?:\\/\\S*)?\\b)`,
  "gi",
);
const HANDLE_RE = /(?<![\w@.])@[a-z0-9._]{3,40}\b/gi;
// Strong names: the word that follows is a handle or number, so it is masked with the name.
const PLATFORM_STRONG_RE = /\b(?:whats\s?app|telegram|insta(?:gram)?|snapchat|wechat|viber|skype)\b(?:\s*[:=@\-]\s*|\s+)?[a-z0-9._+-]*/gi;
// Short or ordinary names: only a separator or a keyword makes it a handle ("ig: name", "wa id 123").
const PLATFORM_WEAK_RE = new RegExp(
  `\\b(?:snap|signal|wa|tg|ig)\\b(?:\\s*[:=@\\-]\\s*|\\s+(?:id|no|number|handle|link|me|on|at)\\b\\s*[:=@\\-]?\\s*)[a-z0-9._+-]*`,
  "gi",
);
// Digit runs with optional separators. Counted after masking emails and URLs.
const PHONE_CANDIDATE_RE = /(?:\+?\d[\s\-.()/]{0,3}){7,}\d/g;
const DATE_SHAPE = /^\D*\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\D*$/;

function maskPhones(s: string): { text: string; found: boolean } {
  let found = false;
  const text = s.replace(PHONE_CANDIDATE_RE, (candidate) => {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return candidate;
    // A date such as 2026-11-09 has 8 digits but is not a phone number.
    if (DATE_SHAPE.test(candidate)) return candidate;
    found = true;
    return MASK;
  });
  return { text, found };
}

/**
 * Masks contact details. Returns the masked text and the kinds found.
 * Idempotent: masking already-masked text changes nothing.
 */
export function moderateContactDetails(input: string): ModerationResult {
  const kinds = new Set<ContactKind>();
  let s = normaliseForModeration(input);
  s = convertSpelledDomains(s);
  s = convertNumberWords(s);
  s = convertLetterDigits(s);

  const mask = (re: RegExp, kind: ContactKind) => {
    s = s.replace(re, () => {
      kinds.add(kind);
      return MASK;
    });
  };

  mask(EMAIL_RE, "EMAIL");
  mask(URL_RE, "URL");
  mask(HANDLE_RE, "HANDLE");
  mask(PLATFORM_STRONG_RE, "PLATFORM");
  mask(PLATFORM_WEAK_RE, "PLATFORM");

  const phones = maskPhones(s);
  if (phones.found) kinds.add("PHONE");
  s = phones.text;

  // Collapse runs of adjacent masks into one, so "a@b.com whatsapp 9876..." reads cleanly.
  s = s.replace(new RegExp(`(?:${MASK.replace(/[[\]]/g, "\\$&")}\\s*){2,}`, "g"), MASK + " ");
  s = s.replace(/[ \t]{2,}/g, " ").trim();

  return { text: s, kinds: [...kinds], flagged: kinds.size > 0 };
}
