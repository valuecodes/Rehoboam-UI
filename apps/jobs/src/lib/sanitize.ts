const SCRIPT_OR_STYLE_BLOCK_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TAG_RE = /<[^>]*>/g;
const WHITESPACE_RE = /\s+/g;
// C0/C1 control characters (Unicode category Cc), except newline and tab.
const CONTROL_CHAR_RE = /[^\P{Cc}\n\t]/gu;

const stripControlChars = (text: string): string =>
  text.replace(CONTROL_CHAR_RE, "");

const stripHtml = (text: string): string => text.replace(HTML_TAG_RE, "");

const stripDangerousHtml = (text: string): string =>
  text.replace(SCRIPT_OR_STYLE_BLOCK_RE, "").replace(HTML_TAG_RE, "");

const sanitizeText = (text: string, maxLength: number): string =>
  stripControlChars(text.normalize("NFC"))
    .replace(SCRIPT_OR_STYLE_BLOCK_RE, "")
    .replace(HTML_TAG_RE, "")
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
