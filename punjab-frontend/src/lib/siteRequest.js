const FALLBACK_DOMAIN = process.env.NEXT_PUBLIC_DEFAULT_SITE_DOMAIN || "punjabpolitics.com";

function cleanHost(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  const [hostname] = normalized.split(":");
  return ["localhost", "127.0.0.1"].includes(hostname) ? normalized : hostname;
}

export async function getRequestSiteDomain() {
  if (typeof window !== "undefined") return cleanHost(window.location.host) || FALLBACK_DOMAIN;

  try {
    // Kept dynamic because this helper is also used by browser-side API calls.
    const { headers } = await import("next/headers");
    const requestHeaders = await headers();
    return cleanHost(requestHeaders.get("x-forwarded-host") || requestHeaders.get("host")) || FALLBACK_DOMAIN;
  } catch {
    return FALLBACK_DOMAIN;
  }
}

export async function withSiteHeaders(options = {}) {
  const domain = await getRequestSiteDomain();
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      "X-Site-Domain": domain,
    },
  };
}
