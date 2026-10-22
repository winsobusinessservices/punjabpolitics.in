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

export function richTextToPlainText(value) {
  return sanitizeHtml(String(value || ""), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
