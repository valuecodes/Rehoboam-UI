import { describe, expect, it } from "vitest";

import {
  sanitizeNewsInput,
  sanitizeText,
  stripDangerousHtml,
  stripHtml,
} from "../sanitize";

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<b>hello</b>")).toBe("hello");
  });

  it("removes nested tags", () => {
    expect(stripHtml("<p><a href='x'>link</a></p>")).toBe("link");
  });

  it("removes script tags", () => {
    expect(stripHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("leaves plain text unchanged", () => {
    expect(stripHtml("plain text")).toBe("plain text");
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });
});

describe("stripDangerousHtml", () => {
  it("removes script blocks including their contents", () => {
    expect(stripDangerousHtml("<script>alert('xss')</script>headline")).toBe(
      "headline"
    );
  });

  it("removes style blocks including their contents", () => {
    expect(stripDangerousHtml("<style>.x{color:red}</style>headline")).toBe(
      "headline"
    );
  });
});

describe("sanitizeText", () => {
  it("strips null bytes", () => {
    expect(sanitizeText("hel\x00lo", 100)).toBe("hello");
  });

  it("strips control characters", () => {
    expect(sanitizeText("hel\x01\x02\x1Flo", 100)).toBe("hello");
  });

  it("preserves newline and tab", () => {
    expect(sanitizeText("line1\nline2\ttabbed", 100)).toBe(
      "line1 line2 tabbed"
    );
  });

  it("strips HTML tags", () => {
    expect(sanitizeText("<b>bold</b>", 100)).toBe("bold");
  });

  it("removes script contents entirely", () => {
    expect(sanitizeText("<script>alert('xss')</script>headline", 100)).toBe(
      "headline"
    );
  });

  it("collapses whitespace", () => {
    expect(sanitizeText("  too   many   spaces  ", 100)).toBe(
      "too many spaces"
    );
  });

  it("truncates to maxLength", () => {
    expect(sanitizeText("abcde", 3)).toBe("abc");
  });

  it("does not truncate when within maxLength", () => {
    expect(sanitizeText("abc", 10)).toBe("abc");
  });

  it("handles empty string", () => {
    expect(sanitizeText("", 100)).toBe("");
  });

  it("normalizes unicode to NFC", () => {
    // café: NFC vs NFD decomposed
    const nfd = "cafe\u0301"; // e + combining accent
    const nfc = "caf\u00E9"; // é precomposed
    expect(sanitizeText(nfd, 100)).toBe(nfc);
  });

  it("strips HTML then collapses resulting whitespace", () => {
    expect(sanitizeText("hello <br/> world", 100)).toBe("hello world");
  });
});

describe("sanitizeNewsInput", () => {
  it("truncates title at 200 chars", () => {
    const long = "a".repeat(250);
    const result = sanitizeNewsInput(long, "desc");
    expect(result.title).toHaveLength(200);
  });

  it("truncates description at 500 chars", () => {
    const long = "a".repeat(600);
    const result = sanitizeNewsInput("title", long);
    expect(result.description).toHaveLength(500);
  });

  it("sanitizes both fields", () => {
    const result = sanitizeNewsInput("<b>title</b>", "<i>desc\x00</i>");
    expect(result.title).toBe("title");
    expect(result.description).toBe("desc");
  });

  it("handles empty strings", () => {
    const result = sanitizeNewsInput("", "");
    expect(result.title).toBe("");
    expect(result.description).toBe("");
  });
});
