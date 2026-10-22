/**
 * Creates a small shared JSON resource. The resolved value survives component
 * remounts and client-side navigation, while the in-flight promise prevents
 * concurrent consumers from sending duplicate requests.
 */
export function createJsonResource(url, { ttl = 60_000, fetchOptions = {} } = {}) {
  const entries = new Map();

  return async function readJsonResource() {
    const resolvedOptions = typeof fetchOptions === "function" ? await fetchOptions() : fetchOptions;
    const siteKey = resolvedOptions?.headers?.["X-Site-Domain"] || "default";
    const entry = entries.get(siteKey) || { value: undefined, expiresAt: 0, pending: null };
    const now = Date.now();
    if (entry.value !== undefined && now < entry.expiresAt) return entry.value;
    if (entry.pending) return entry.pending;

    entry.pending = fetch(url, resolvedOptions)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data = await response.json();
        entry.value = data;
        entry.expiresAt = Date.now() + ttl;
        return data;
      })
      .finally(() => {
        entry.pending = null;
      });
    entries.set(siteKey, entry);

    return entry.pending;
  };
}
