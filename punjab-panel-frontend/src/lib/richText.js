import sanitizeHtml from "sanitize-html";

const RICH_TEXT_TAG = /<\/?(?:p|br|h[1-6]|strong|em|u|s|ul|ol|li|blockquote|code|pre|hr|a)\b/i;

const SANITIZE_OPTIONS = {
  allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "em", "u", "s", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "a"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: "a",
      attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
    }),
  },
};

export function isRichTextHtml(value) {
  return RICH_TEXT_TAG.test(String(value || ""));
}

export function sanitizeRichText(value) {
  return sanitizeHtml(String(value || ""), SANITIZE_OPTIONS);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function editorHtmlFromStored(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (isRichTextHtml(source)) return sanitizeRichText(source);

  return source
    .split(/\n\s*\n/)
    .map((block) => {
      const text = block.trim();
      const heading = text.match(/^(#{1,6})\s+([^\r\n]+)$/);
      if (heading) {
        const level = Math.min(Math.max(heading[1].length, 2), 4);
        return `<h${level}>${escapeHtml(heading[2].trim())}</h${level}>`;
      }
      return `<p>${escapeHtml(text).replace(/\r?\n/g, "<br>")}</p>`;
    })
    .join("");
}

export function hasRichText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .trim().length > 0;
}

export function richTextToPlainText(value) {
  return sanitizeHtml(String(value || ""), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
