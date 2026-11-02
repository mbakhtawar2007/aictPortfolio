// Display-size Cloudinary delivery URLs (2026-11-02 performance fix).
// Stored photo/cover URLs are original uploads served at full size (one
// team PNG is ~818 KB) but displayed as small cards. Inserting a
// transformation before the version segment resizes + auto-formats at
// delivery time, with no re-upload and no stored-data change. Non-
// Cloudinary URLs, video delivery URLs and already-transformed URLs pass
// through untouched. Strict transformations are disabled on the account,
// so on-the-fly transforms are allowed.
export function optimizedImageUrl(url: string | null | undefined, width: number): string | null {
  if (!url) return null;
  const marker = '/image/upload/';
  const at = url.indexOf(marker);
  if (at === -1) return url;
  const rest = url.slice(at + marker.length);
  const first = rest.split('/')[0];
  if (first.includes(',') && /^(f_|w_|h_|c_|q_)/.test(first)) return url;
  return url.slice(0, at + marker.length) + 'f_auto,q_auto,w_' + width + '/' + rest;
}
