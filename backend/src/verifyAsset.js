// Pure check for POST /api/admin/upload/verify, kept separate from the
// route so it can be unit-tested without Cloudinary credentials.
// `expected` is 'video' | 'pdf' | 'image'; `asset` is the Cloudinary
// Admin API resource; `publicId` is the id the browser asked to verify.
//
// Why PDFs get a fallback: a raw PDF's format is supposed to come back
// as 'pdf', but on 2026-10-30 a real admin resume upload reached verify
// (so the asset existed, ownership and size passed) and was still
// rejected with "file format is not allowed" — i.e. Cloudinary did not
// return a usable format for that raw asset. Rejecting on that one field
// alone therefore blocks genuine PDFs. For a PDF, an absent format is
// accepted ONLY when Cloudinary itself classifies the asset as `raw`
// and the server-signed id or the delivery URL still ends in `.pdf`
// (the sign step already required a `.pdf` filename and a <=5 MB file,
// and prefix/ownership checks run before this). A present format that
// is not PDF (e.g. 'docx') is still rejected, even with a `.pdf` id.
export function checkVerifyAsset(expected, asset, publicId) {
  const maxBytes = expected === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
  const format = (asset.format || '').toLowerCase().trim();
  const resourceType = asset.resource_type || '';
  if (typeof asset.bytes !== 'number' || asset.bytes > maxBytes) {
    return { ok: false, reason: 'size', format, resourceType, bytes: asset.bytes };
  }
  if (expected === 'pdf') {
    if (format === 'pdf' || format.includes('pdf')) return { ok: true };
    if (!format && resourceType === 'raw') {
      const idEndsPdf = String(publicId || '').toLowerCase().endsWith('.pdf');
      const urlEndsPdf = typeof asset.secure_url === 'string'
        && asset.secure_url.split('?')[0].toLowerCase().endsWith('.pdf');
      if (idEndsPdf || urlEndsPdf) return { ok: true };
    }
    return { ok: false, reason: 'format', format, resourceType, bytes: asset.bytes };
  }
  const allowed = expected === 'video' ? ['mp4', 'webm'] : ['jpg', 'jpeg', 'png', 'webp', 'avif'];
  if (allowed.includes(format)) return { ok: true };
  return { ok: false, reason: 'format', format, resourceType, bytes: asset.bytes };
}
