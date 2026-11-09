/**
 * Contact-detail moderation. Runs on every message, offer note, quotation, and requirement note
 * BEFORE the text is stored. Stored text is the masked text, so raw contact details never reach
 * the database, the admin queue, or a notification email.
 *
 * Detects: phone numbers (digits with any punctuation or space between them, spelled-out digits,
 * Unicode digit scripts, letter lookalikes), email addresses (including "name at domain dot com"
 * and bracketed forms like "[at]" and "[.]"), URLs and bare domains with any letter TLD, @handles,
 * and messaging-app names followed by a handle ("whatsapp 98...", "insta is name").
 *
 * This is a best-effort filter, not a guarantee. Known gaps are listed in the M3 status notes:
 * a phone split across two messages is not joined, and letters used as separators are not treated
 * as digit separators.
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

// Zero-width, formatting and tag characters that can split digits or words.
const INVISIBLE =
  /[­͏؜ᅟᅠ឴឵᠋-᠎​-‏‪-‮⁠-⁯︀-️﻿⃣\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;

// Decimal digit blocks that NFKC does not fold to ASCII. Each block starts at digit zero.
const DIGIT_BLOCKS: [number, number][] = [
  [0x0660, 0x0669], // Arabic-Indic
  [0x06f0, 0x06f9], // Extended Arabic-Indic
  [0x07c0, 0x07c9], // NKo
  [0x0966, 0x096f], // Devanagari
  [0x09e6, 0x09ef], // Bengali
  [0x0a66, 0x0a6f], // Gurmukhi
  [0x0ae6, 0x0aef], // Gujarati
  [0x0b66, 0x0b6f], // Oriya
  [0x0be6, 0x0bef], // Tamil
  [0x0c66, 0x0c6f], // Telugu
  [0x0ce6, 0x0cef], // Kannada
  [0x0d66, 0x0d6f], // Malayalam
  [0x0e50, 0x0e59], // Thai
  [0x0ed0, 0x0ed9], // Lao
  [0x0f20, 0x0f29], // Tibetan
  [0x1040, 0x1049], // Myanmar
  [0x17e0, 0x17e9], // Khmer
  [0x1810, 0x1819], // Mongolian
];

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", oh: "0", o: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

// Known TLDs are still matched explicitly in the spelled-out email form, but bare domains accept any
// letter TLD of two to six letters, so an uncommon TLD does not get past the filter.
const TLD = "[a-z]{2,6}";

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
  // Any punctuation or space may separate the words, so "nine/eight/seven" is covered too.
  const runRe = new RegExp(`\\b(?:${words})(?:[^\\p{L}\\p{N}]+(?:${words}))+\\b`, "giu");
  return s.replace(runRe, (run) => {
    const parts = run.match(/\p{L}+/gu) ?? [];
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

/**
 * Collapses "name at domain dot com", "name(at)domain(dot)com", "john [at] gmail [.] com" and
 * "gmail[.]com" into normal email and domain syntax.
 */
function convertSpelledDomains(s: string): string {
  // "at" must be a whole word: "quotation" contains "at" and must not become an address.
  const at = String.raw`\s*[\[({]?\s*(?:\bat\b|@)\s*[\])}]?\s*`;
  // A dot is "dot", "[.]", "(.)" or an unspaced ".". A spaced " . " counts only before a well-known TLD,
  // so prose such as "sapphire. Could" is never joined into a domain.
  const knownTld = "com|in|net|org|co|io|uk|us|au|ca|de|fr|ru|me|ng|jp|app|ai|xyz|info|biz|edu|gov|tv|ly|link|shop|store|online|site";
  const dotStrict = String.raw`(?:\s*[\[({]\s*\.\s*[\])}]\s*|\s*[\[({]?\s*\bdot\b\s*[\])}]?\s*|\.)`;
  const spacedDot = String.raw`\s+\.\s+(?=(?:${knownTld})\b)`;
  const emailForm = new RegExp(String.raw`([a-z0-9._-]+)${at}([a-z0-9-]+)(?:${dotStrict}|${spacedDot})(${TLD})\b`, "gi");
  const domainForm = new RegExp(String.raw`\b([a-z0-9-]+)${dotStrict}(${TLD})\b`, "gi");
  return s.replace(emailForm, "$1@$2.$3").replace(domainForm, "$1.$2");
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const URL_RE = new RegExp(
  String.raw`(?:\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]{3,}(?:\.[a-z0-9-]+)*\.[a-z]{2,6}(?:\/\S*)?\b|\b[a-z0-9-]+\.[a-z]{2,6}\/\S*)`,
  "gi",
);
const HANDLE_RE = /(?<![\w@.])@[a-z0-9._]{3,40}\b/gi;

// Words that may sit between an app name and its handle: "insta is name", "skype me: name".
const FILLER = String.raw`(?:\s*(?:[:=@\-]|\b(?:is|id|no|me|on|at|handle|number|link)\b)\s*)*`;
// Strong names: the handle after the name is masked with it.
const PLATFORM_STRONG_RE = new RegExp(
  String.raw`\b(?:whats\s?app|telegram|insta(?:gram)?|snapchat|wechat|viber|skype)\b${FILLER}\s*[a-z0-9._+-]*`,
  "gi",
);
// Short or ordinary names ("snap", "signal", "wa", "tg", "ig"): only a separator or a keyword after
// them makes them a handle ("ig: name", "snap me at name", "wa id 123"). Scanned by hand, because the
// filler loop is easier to reason about this way than as one regular expression.
const WEAK_NAME_RE = /\b(?:snap|signal|wa|tg|ig)\b/gi;
const WEAK_FILLER_RE = /^(?:\s*(?:[:=@-]|\b(?:id|no|number|handle|link|me|on|at|is)\b))+\s*/i;
const HANDLE_TOKEN_RE = /^[a-z0-9._+-]*/i;

function maskWeakPlatforms(input: string): { text: string; found: boolean } {
  let out = "";
  let cursor = 0;
  let found = false;
  WEAK_NAME_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WEAK_NAME_RE.exec(input)) !== null) {
    const start = match.index;
    const afterName = start + match[0].length;
    const filler = WEAK_FILLER_RE.exec(input.slice(afterName));
    if (!filler) continue; // "snap decision" is ordinary text
    const tokenStart = afterName + filler[0].length;
    const token = HANDLE_TOKEN_RE.exec(input.slice(tokenStart))?.[0] ?? "";
    const end = tokenStart + token.length;
    out += input.slice(cursor, start) + MASK;
    cursor = end;
    found = true;
    WEAK_NAME_RE.lastIndex = end;
  }
  out += input.slice(cursor);
  return { text: out, found };
}

// Digit runs joined by any punctuation or space (up to four characters), or by "and", "or", "plus".
// Counted after masking emails and URLs.
const PHONE_CANDIDATE_RE = /(?:\+?\p{Nd}(?:[^\p{L}\p{N}\n]{0,4}|\s*\b(?:and|or|plus)\b\s*)){6,}\p{Nd}/gu;
// A date such as 2026-11-09, or 09-11-2026, has 8 digits but is not a phone number.
const DATE_SHAPE = /^\D*(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\D*$/;

function maskPhones(s: string): { text: string; found: boolean } {
  let found = false;
  const text = s.replace(PHONE_CANDIDATE_RE, (candidate) => {
    const digits = candidate.replace(/\P{Nd}/gu, "");
    if (digits.length < 7 || digits.length > 15) return candidate;
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
  // The normalised copy is used only for detection and masking. Text with nothing to mask is returned
  // exactly as typed, so certificate and stock codes such as "GIA-l2345" are not rewritten.
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
  const weak = maskWeakPlatforms(s);
  if (weak.found) kinds.add("PLATFORM");
  s = weak.text;

  const phones = maskPhones(s);
  if (phones.found) kinds.add("PHONE");
  s = phones.text;

  // Collapse runs of adjacent masks into one, so "a@b.com whatsapp 9876..." reads cleanly.
  s = s.replace(new RegExp(`(?:${MASK.replace(/[[\]]/g, "\\$&")}\\s*){2,}`, "g"), MASK + " ");
  s = s.replace(/[ \t]{2,}/g, " ").trim();

  if (kinds.size === 0) return { text: input, kinds: [], flagged: false };
  return { text: s, kinds: [...kinds], flagged: true };
}
