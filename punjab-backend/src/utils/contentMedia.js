const IMAGE_MARKER = /\[\[IMAGE:([^\]]+)\]\]/g;

function splitContentMedia(value) {
  const images = [];
  const text = String(value || "").replace(IMAGE_MARKER, (_marker, url) => {
    const cleanUrl = String(url || "").trim();
    if (cleanUrl) images.push(cleanUrl);
    return "";
  });

  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), images };
}

function joinContentMedia(text, images = []) {
  const cleanText = splitContentMedia(text).text;
  const markers = images
    .map((url) => String(url || "").trim())
    .filter(Boolean)
    .map((url) => `[[IMAGE:${url}]]`);
  return [cleanText, ...markers].filter(Boolean).join("\n\n");
}

module.exports = { splitContentMedia, joinContentMedia };
