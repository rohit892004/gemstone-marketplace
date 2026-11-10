import MarkdownIt from "markdown-it";

/**
 * Markdown for articles, reference pages and campaigns. Strict by construction:
 * - raw HTML in the source is shown as text (html: false), never parsed;
 * - images are disabled (cover images go through StorageProvider instead);
 * - links are limited to http, https, mailto and same-site paths. Anything else
 *   (javascript:, data:, vbscript:, protocol-relative //host) is dropped to plain text.
 * - external links open in a new tab with rel="noopener noreferrer nofollow".
 *
 * Callers may place the output in the page with dangerouslySetInnerHTML only
 * because it comes from this module. Do not pass HTML from anywhere else.
 */

/** Longest source accepted, in characters. Larger input is refused before parsing. */
export const MARKDOWN_MAX_CHARS = 100_000;

/** Allowed link targets: https/http/mailto, or a same-site path or fragment. */
export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed === "") return false;
  // "/path" is same-site; "//host" and "/\host" are protocol-relative and not allowed.
  if (/^\/(?![\/\\])/.test(trimmed) || trimmed.startsWith("#")) return true;
  if (/^[\/\\]/.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

function createParser(): ReturnType<typeof MarkdownIt> {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false });
  md.disable("image");
  md.validateLink = isSafeHref;

  const defaultLinkOpen =
    md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = String(token.attrGet("href") ?? "");
    if (isExternal(href)) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer nofollow");
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };
  return md;
}

const parser = createParser();

export class MarkdownTooLongError extends Error {
  constructor() {
    super(`Markdown is longer than ${MARKDOWN_MAX_CHARS} characters.`);
    this.name = "MarkdownTooLongError";
  }
}

/** Renders Markdown to safe HTML. Throws MarkdownTooLongError for oversized input. */
export function renderMarkdown(source: string): string {
  if (source.length > MARKDOWN_MAX_CHARS) throw new MarkdownTooLongError();
  return parser.render(source);
}

/** Plain text of a Markdown source (no markup), for excerpts, search and reading time. */
export function markdownToPlainText(source: string): string {
  if (source.length > MARKDOWN_MAX_CHARS) throw new MarkdownTooLongError();
  const tokens = parser.parse(source, {});
  const parts: string[] = [];
  for (const token of tokens) {
    if (token.type === "inline" && token.children) {
      for (const child of token.children) {
        if (child.type === "text" || child.type === "code_inline") parts.push(child.content);
        else if (child.type === "softbreak" || child.type === "hardbreak") parts.push(" ");
      }
      parts.push(" ");
    }
  }
  return parts.join("").replace(/\s+/g, " ").trim();
}

/**
 * Plain text for email: like markdownToPlainText, but each absolute link keeps its address, as "text (https://...)",
 * so the reader can follow it. Relative links keep only their text (an email has no base address to resolve them).
 */
export function markdownToEmailText(source: string): string {
  if (source.length > MARKDOWN_MAX_CHARS) throw new MarkdownTooLongError();
  const parts: string[] = [];
  for (const token of parser.parse(source, {})) {
    if (token.type !== "inline" || !token.children) continue;
    const hrefs: string[] = [];
    for (const child of token.children) {
      if (child.type === "link_open") {
        hrefs.push(String(child.attrGet("href") ?? ""));
      } else if (child.type === "link_close") {
        const href = hrefs.pop() ?? "";
        if (isExternal(href) || href.toLowerCase().startsWith("mailto:")) parts.push(` (${href})`);
      } else if (child.type === "text" || child.type === "code_inline") {
        parts.push(child.content);
      } else if (child.type === "softbreak" || child.type === "hardbreak") {
        parts.push("\n");
      }
    }
    parts.push("\n\n");
  }
  return parts
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Reading time in whole minutes at 200 words per minute. Never less than 1. */
export function readingMinutes(source: string): number {
  const words = markdownToPlainText(source).split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
