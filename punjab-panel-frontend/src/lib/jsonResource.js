/**
 * Creates a small shared JSON resource. The resolved value survives component
 * remounts and client-side navigation, while the in-flight promise prevents
 * concurrent consumers from sending duplicate requests.
 */
export function createJsonResource(url, { ttl = 60_000, fetchOptions = {} } = {}) {
  let value;
  let expiresAt = 0;
  let pending = null;

  return async function readJsonResource() {
    const now = Date.now();
    if (value !== undefined && now < expiresAt) return value;
    if (pending) return pending;

    pending = fetch(url, fetchOptions)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data = await response.json();
        value = data;
        expiresAt = Date.now() + ttl;
        return data;
      })
      .finally(() => {
        pending = null;
      });

    return pending;
  };
}
