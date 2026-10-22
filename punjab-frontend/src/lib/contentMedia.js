const IMAGE_MARKER = /\[\[IMAGE:([^\]]+)\]\]/g;

export function splitContentMedia(value) {
  const images = [];
  const text = String(value || "").replace(IMAGE_MARKER, (_marker, url) => {
    const cleanUrl = String(url || "").trim();
    if (cleanUrl) images.push(cleanUrl);
    return "";
  });

  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), images };
}
