const SCRIPT_OR_STYLE_BLOCK_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TAG_RE = /<[^>]*>/g;
// Angle brackets left after tag removal, e.g. an unterminated `<script`, which
// a single tag-stripping pass cannot catch.
const ANGLE_BRACKET_RE = /[<>]/g;
const WHITESPACE_RE = /\s+/g;
// C0/C1 control characters (Unicode category Cc), except newline and tab.
const CONTROL_CHAR_RE = /[^\P{Cc}\n\t]/gu;

const stripControlChars = (text: string): string =>
  text.replace(CONTROL_CHAR_RE, "");

// Removes `pattern` until nothing matches, so removing one match can't splice
// a new one together (`<scr<b>ipt>` → `<script>`).
const removeAll = (text: string, pattern: RegExp): string => {
  let previous = text;
  let current = text.replace(pattern, "");

  while (current !== previous) {
    previous = current;
    current = current.replace(pattern, "");
  }

  return current;
};

const stripHtml = (text: string): string =>
  removeAll(text, HTML_TAG_RE).replace(ANGLE_BRACKET_RE, "");

const stripDangerousHtml = (text: string): string =>
  stripHtml(removeAll(text, SCRIPT_OR_STYLE_BLOCK_RE));

const sanitizeText = (text: string, maxLength: number): string =>
  stripDangerousHtml(stripControlChars(text.normalize("NFC")))
    .replace(WHITESPACE_RE, " ")
    .trim()
    .slice(0, maxLength);

const sanitizeNewsInput = (
  title: string,
  description: string
): { title: string; description: string } => ({
  title: sanitizeText(title, 200),
  description: sanitizeText(description, 500),
});

export { sanitizeNewsInput, sanitizeText, stripDangerousHtml, stripHtml };
