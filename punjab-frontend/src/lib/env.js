function requiredUrl(value, name) {
  const normalized = String(value || "").trim().replace(/\/$/, "");
  if (!normalized) throw new Error(`${name} is required`);
  try {
    new URL(normalized);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }
  return normalized;
}

export const API_BASE_URL = requiredUrl(process.env.NEXT_PUBLIC_API_URL, "NEXT_PUBLIC_API_URL");
export const PUBLIC_SITE_URL = requiredUrl(process.env.NEXT_PUBLIC_SITE_URL, "NEXT_PUBLIC_SITE_URL");
export const PANEL_SITE_URL = requiredUrl(process.env.NEXT_PUBLIC_PANEL_URL, "NEXT_PUBLIC_PANEL_URL");
