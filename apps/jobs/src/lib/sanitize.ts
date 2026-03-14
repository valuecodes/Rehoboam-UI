const SCRIPT_OR_STYLE_BLOCK_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TAG_RE = /<[^>]*>/g;
const WHITESPACE_RE = /\s+/g;

const isAllowedControlChar = (char: string): boolean =>
  char === "\n" || char === "\t";

const stripControlChars = (text: string): string =>
  Array.from(text)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      const isControl =
        (code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f);

      return !isControl || isAllowedControlChar(char);
    })
    .join("");

export const stripHtml = (text: string): string =>
  text.replace(HTML_TAG_RE, "");

export const stripDangerousHtml = (text: string): string =>
  text.replace(SCRIPT_OR_STYLE_BLOCK_RE, "").replace(HTML_TAG_RE, "");

export const sanitizeText = (text: string, maxLength: number): string =>
  stripControlChars(text.normalize("NFC"))
    .replace(SCRIPT_OR_STYLE_BLOCK_RE, "")
    .replace(HTML_TAG_RE, "")
    .replace(WHITESPACE_RE, " ")
    .trim()
    .slice(0, maxLength);

export const sanitizeNewsInput = (
  title: string,
  description: string
): { title: string; description: string } => ({
  title: sanitizeText(title, 200),
  description: sanitizeText(description, 500),
});
