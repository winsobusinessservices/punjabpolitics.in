import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const DEFAULT_SOCIAL_IMAGE = {
  url: "/globe.svg",
  width: 1401,
  height: 752,
  alt: `${SITE_NAME} — Indian political news and analysis`,
};

export function buildPageMetadata({ title, description, path, image, type = "website", noIndex = false }) {
  const rawDescription = String(description || SITE_DESCRIPTION).replace(/\s+/g, " ").trim();
  const pageDescription = rawDescription.length > 165 ? `${rawDescription.slice(0, 162).trimEnd()}...` : rawDescription;
  const images = image ? [{ url: image, alt: title }] : [DEFAULT_SOCIAL_IMAGE];

  return {
    title,
    description: pageDescription,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: "en_IN",
      url: path,
      siteName: SITE_NAME,
      title,
      description: pageDescription,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: pageDescription,
      images: images.map((entry) => entry.url),
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}

// Prevent user-managed content from closing the JSON-LD script element.
export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
