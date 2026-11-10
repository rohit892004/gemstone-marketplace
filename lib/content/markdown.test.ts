import { describe, expect, it } from "vitest";
import {
  isSafeHref,
  markdownToEmailText,
  MARKDOWN_MAX_CHARS,
  MarkdownTooLongError,
  markdownToPlainText,
  readingMinutes,
  renderMarkdown,
} from "./markdown";

describe("renderMarkdown: raw HTML and scripts", () => {
  it("shows a script tag as text, never as an element", () => {
    const html = renderMarkdown("Hello <script>alert(1)</script>");
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops event handlers from inline HTML", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toMatch(/<img/i);
    // The tag is shown as escaped text, so no live attribute exists.
    expect(html).not.toMatch(/<[^>]*onerror/i);
    expect(html).toContain("&lt;img");
  });

  it("escapes iframes, objects and style blocks", () => {
    const html = renderMarkdown('<iframe src="https://evil.example"></iframe>\n\n<style>body{}</style>\n\n<object data="x"></object>');
    expect(html).not.toMatch(/<(iframe|style|object)/i);
  });

  it("does not render images, even with a safe source", () => {
    const html = renderMarkdown("![cat](https://example.com/cat.png)");
    expect(html).not.toMatch(/<img/i);
  });
});

describe("renderMarkdown: links", () => {
  it.each([
    ["[x](javascript:alert(1))"],
    ["[x](JaVaScRiPt:alert(1))"],
    ["[x](java\tscript:alert(1))"],
    ["[x](data:text/html,<script>alert(1)</script>)"],
    ["[x](vbscript:msgbox(1))"],
    ["[x](//evil.example/path)"],
  ])("refuses the unsafe link %s", (source) => {
    const html = renderMarkdown(source);
    // No anchor is created at all; the source stays as inert text.
    expect(html).not.toMatch(/<a\s/i);
    expect(html).not.toMatch(/<script/i);
  });

  it("never turns a backslash path into a protocol-relative link", () => {
    const html = renderMarkdown("[x](/\\evil.example)");
    expect(html).not.toMatch(/href="\/\//);
    expect(html).not.toMatch(/href="\/\\/);
  });

  it("keeps https links and adds noopener and new-tab attributes", () => {
    const html = renderMarkdown("[GIA](https://www.gia.edu/)");
    expect(html).toContain('href="https://www.gia.edu/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("keeps same-site paths without a new tab", () => {
    const html = renderMarkdown("[Sapphire](/categories/sapphire)");
    expect(html).toContain('href="/categories/sapphire"');
    expect(html).not.toContain("target=");
  });

  it("keeps mailto links", () => {
    expect(renderMarkdown("[mail](mailto:team@example.com)")).toContain('href="mailto:team@example.com"');
  });
});

describe("isSafeHref", () => {
  it("accepts http, https, mailto, same-site paths and fragments", () => {
    for (const href of ["https://a.example", "http://a.example", "mailto:a@b.example", "/x", "#top"]) {
      expect(isSafeHref(href)).toBe(true);
    }
  });

  it("refuses scheme-less, protocol-relative and unknown schemes", () => {
    for (const href of ["", "javascript:1", "ftp://a.example", "//a.example", "\\\\a.example", "a.example"]) {
      expect(isSafeHref(href)).toBe(false);
    }
  });
});

describe("renderMarkdown: ordinary formatting", () => {
  it("renders headings, emphasis, lists and code", () => {
    const html = renderMarkdown("## Care\n\nKeep it *dry* and **clean**.\n\n- one\n- two\n\n`soap`");
    expect(html).toContain("<h2>Care</h2>");
    expect(html).toContain("<em>dry</em>");
    expect(html).toContain("<strong>clean</strong>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<code>soap</code>");
  });

  it("refuses source longer than the limit", () => {
    expect(() => renderMarkdown("a".repeat(MARKDOWN_MAX_CHARS + 1))).toThrow(MarkdownTooLongError);
  });
});

describe("markdownToPlainText and readingMinutes", () => {
  it("strips markup", () => {
    expect(markdownToPlainText("# Title\n\nSome **bold** text with a [link](https://a.example).")).toBe(
      "Title Some bold text with a link.",
    );
  });

  it("never returns less than one minute", () => {
    expect(readingMinutes("Short.")).toBe(1);
  });

  it("rounds up at 200 words per minute", () => {
    const words = Array.from({ length: 401 }, () => "word").join(" ");
    expect(readingMinutes(words)).toBe(3);
  });
});

describe("markdownToEmailText", () => {
  it("keeps the address of an absolute link next to its text", () => {
    expect(markdownToEmailText("Read the [guide](https://example.test/education/guide) today.")).toBe(
      "Read the guide (https://example.test/education/guide) today.",
    );
  });

  it("keeps only the text of a relative link", () => {
    expect(markdownToEmailText("See [Sapphire](/categories/sapphire).")).toBe("See Sapphire.");
  });
});
