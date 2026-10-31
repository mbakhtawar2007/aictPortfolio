// Upload ownership helpers. Cloudinary public IDs in this project are
// server-generated as `aict-portfolio/<type>/<uid>-<timestamp>` (with
// `.pdf` appended for raw PDFs). The owner is therefore the filename
// segment with its trailing `-<digits>` timestamp stripped — not a
// substring match. The old `publicId.includes('/<uid>-')` check would
// also match a UID that is a prefix of another UID (e.g. actor `abc`
// matching an asset owned by `abc-xyz`), so it is replaced here by an
// exact parse. Demo UIDs contain hyphens (e.g. `demo-admin`), which is
// why only the final `-<digits>` timestamp is stripped.
export function assetOwnerUid(publicId) {
  if (typeof publicId !== 'string') return '';
  const parts = publicId.split('/');
  if (parts.length < 3) return '';
  let file = parts[parts.length - 1];
  if (file.toLowerCase().endsWith('.pdf')) file = file.slice(0, -4);
  const m = file.match(/^(.*)-(\d+)$/);
  return m ? m[1] : file;
}
export function isPortfolioAsset(publicId) {
  return typeof publicId === 'string' && publicId.startsWith('aict-portfolio/');
}
export function isOwnAsset(actor, publicId) {
  if (!actor || actor.role === 'admin') return true;
  return assetOwnerUid(publicId) === actor.uid;
}
