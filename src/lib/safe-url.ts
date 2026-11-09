/**
 * Returns a normalized http(s) URL, or null. Rejects javascript:, data:, and any
 * other scheme so user-supplied links can't execute script when clicked.
 */
export function safeHttpUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
