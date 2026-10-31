// Public resume delivery helpers, kept pure so they can be unit-tested
// without Cloudinary credentials.
//
// Why a proxy exists at all (2026-10-31): a published member's resume
// failed in two independent ways at once. (1) Chrome's PDF viewer for an
// <embed> is governed by CSP frame-src, which Netlify's CSP never set,
// so framing res.cloudinary.com fell back to default-src 'self' and was
// blocked. (2) Opening the Cloudinary raw URL directly returned
// 401 "deny or ACL failure" — the raw asset is not publicly deliverable
// as-is, even though the server-side verify (which uses the API key)
// succeeded. The backend therefore looks the asset up with its own
// credentials, learns its real delivery type, and redirects the visitor
// to a signed Cloudinary URL for that type. The public page never links
// the raw Cloudinary URL directly anymore.
export function resumePublicIdFromUrl(url) {
  try {
    const u = new URL(String(url || ''));
    const idx = u.pathname.indexOf('/upload/');
    if (idx < 0) return null;
    let rest = u.pathname.slice(idx + '/upload/'.length);
    rest = rest.replace(/^v\d+\//, '');
    rest = decodeURIComponent(rest);
    return rest || null;
  } catch { return null; }
}

export function signedResumeUrl(cloudinary, publicId, type, download, fullName, version) {
  const opts = { resource_type: 'raw', type: type || 'upload', sign_url: true, secure: true };
  if (version) opts.version = version;
  if (download) {
    const safe = String(fullName || '').replace(/[^a-zA-Z]+/g, '-').replace(/^-+|-+$/g, '') || 'Resume';
    opts.flags = [`attachment:${safe}-CV.pdf`];
  }
  return cloudinary.url(publicId, opts);
}
