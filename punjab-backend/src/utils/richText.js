const sanitizeHtml = require("sanitize-html");

const RICH_TEXT_TAG = /<\/?(?:p|br|h[1-6]|strong|em|u|s|ul|ol|li|blockquote|code|pre|hr|a)\b/i;

function isRichTextHtml(value) {
  return RICH_TEXT_TAG.test(String(value || ""));
}

function sanitizeRichText(value) {
  const source = String(value || "").trim();
  if (!isRichTextHtml(source)) return source;
  return sanitizeHtml(source, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "em", "u", "s", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "a"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
    },
  });
}

function richTextToPlainText(value) {
  return sanitizeHtml(String(value || ""), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = { isRichTextHtml, sanitizeRichText, richTextToPlainText };
