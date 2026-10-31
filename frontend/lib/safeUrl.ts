// Shared URL-scheme guard for every href/src rendered from stored
// content. React escapes text, but it does not scheme-check
// attributes, so a stored `javascript:` link would execute on click
// in the site origin — where localStorage holds the auth token.
// The backend now rejects these at save time too; this is the
// defence-in-depth layer for already-stored values and for paste
// previews, which render before any save.
// Allowed: http(s) only, plus a root-relative path (never '//', which
// would be a protocol-relative external URL). data:, javascript:,
// vbscript: and every other scheme are refused.
export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  const v = value.trim();
  if (v.startsWith('http://') || v.startsWith('https://')) return true;
  if (v.startsWith('/') && !v.startsWith('//')) return true;
  return false;
}
// Returns the URL when safe, otherwise undefined, so callers can omit
// the link/image instead of rendering an unsafe attribute.
export function safeHref(value: unknown): string | undefined {
  return isSafeHttpUrl(value) ? (value as string) : undefined;
}
export function safeSrc(value: unknown): string | undefined {
  return isSafeHttpUrl(value) ? (value as string) : undefined;
}
