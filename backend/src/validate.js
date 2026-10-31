import { z } from 'zod';
// Consistent response shape: { data, error: {code,message}|null, meta }
export function ok(res, data, status = 200, meta = {}) {
  return res.status(status).json({ data, error: null, meta });
}
export function fail(res, status, code, message) {
  // Never include stack traces, SQL, provider secrets or tokens here.
  return res.status(status).json({ data: null, error: { code, message }, meta: {} });
}
// URLs rendered as <a href> must be http(s) only: Zod .url() accepts
// javascript: and data: schemes, and a stored javascript: link would
// execute on click in the public detail pages.
const httpUrl = z.string().url().refine((s) => s.startsWith('http://') || s.startsWith('https://'), { message: 'Only http(s) URLs are allowed' });
const httpUrlOrEmpty = httpUrl.optional().or(z.literal(''));
// Safe stored URLs: http(s) only, or a root-relative path (never '//',
// which would be a protocol-relative external URL). This replaces the
// plain z.string() used for photo/cover/logo/hero/og/image fields, which
// previously accepted javascript: and data: values. Root-relative paths
// stay allowed so a site logo like /logo.svg keeps working.
const safeUrlOrEmpty = z.string().max(1000).refine((v) => v === '' || v.startsWith('http://') || v.startsWith('https://') || (v.startsWith('/') && !v.startsWith('//')), { message: 'Only http(s) URLs or site-relative paths are allowed' }).optional().default('');
// Collapse CR/LF to spaces before a value is used in a mail header or
// a one-line email greeting, so a stored name/subject cannot inject
// extra mail headers.
export function oneLine(v) { return String(v || '').replace(/[\r\n]+/g, ' ').trim(); }
// Slugs are public URL segments: the frontend slugify() already produces
// this shape, so the backend enforces it too (no spaces, slashes, uppercase).
const slugField = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and single hyphens (e.g. ayesha-khan)');
export function parseBody(schema, body) {
  const r = schema.safeParse(body ?? {});
  if (!r.success) {
    const first = r.error.issues[0];
    return { ok: false, message: `Invalid ${first.path.join('.') || 'input'}: ${first.message}` };
  }
  return { ok: true, data: r.data };
}
export const memberSchema = z.object({
  slug: slugField, full_name: z.string().trim().min(1).max(200),
  role_title: z.string().max(200).optional().default(''),
  short_intro: z.string().max(500).optional().default(''),
  bio: z.string().max(10000).optional().default(''),
  photo_url: safeUrlOrEmpty,
  cover_url: safeUrlOrEmpty,
  location: z.string().max(200).optional().default(''),
  availability: z.string().max(200).optional().default(''),
  resume_path: httpUrlOrEmpty.default(''),
  resume_is_public: z.boolean().optional().default(false),
  contact_email: z.string().email().optional().or(z.literal('')).default(''),
  contact_email_is_public: z.boolean().optional().default(false),
  status: z.enum(['draft', 'published']).optional().default('draft'),
  is_leader: z.boolean().optional().default(false),
  sort_order: z.number().int().optional().default(0),
  skills: z.array(z.object({ name: z.string().min(1), category: z.string().optional().default('Technical'), level: z.number().int().min(1).max(100).optional().default(50) })).max(100).optional().default([]),
  education: z.array(z.object({ institution: z.string().min(1), degree: z.string().optional().default(''), field: z.string().optional().default(''), start_date: z.string().optional().default(''), end_date: z.string().optional().default(''), description: z.string().optional().default('') })).max(50).optional().default([]),
  experience: z.array(z.object({ organization: z.string().min(1), role: z.string().optional().default(''), start_date: z.string().optional().default(''), end_date: z.string().optional().default(''), description: z.string().optional().default('') })).max(50).optional().default([]),
  links: z.array(z.object({ type: z.string().min(1), label: z.string().optional().default(''), url: httpUrl })).max(20).optional().default([]),
});
export const projectSchema = z.object({
  slug: slugField, title: z.string().trim().min(1).max(300),
  tagline: z.string().max(500).optional().default(''), description: z.string().max(10000).optional().default(''),
  case_study: z.string().max(20000).optional().default(''),
  category: z.enum(['AI Video', 'AI Tool', 'Website', 'Other']).optional().default('Other'),
  // Visibility (2026-10-31, YouTube-like upload form): public = in lists +
  // detail, unlisted = detail only via direct link, private = never public
  // (forced to draft on save). Missing = public, so legacy projects stay listed.
  visibility: z.enum(['public', 'unlisted', 'private']).optional().default('public'),
  // Video format (YouTube-style, 2026-10-31): 'short' = a Shorts-style
  // short vertical video, 'full' = a regular full-length video. This is
  // the uploader's choice, not auto-detected from the file. Missing =
  // 'full', so legacy projects stay full-length.
  video_format: z.enum(['full', 'short']).optional().default('full'),
  tags: z.array(z.string().trim().max(100)).max(30).optional().default([]),
  tech_stack: z.array(z.string()).max(50).optional().default([]), tools_used: z.array(z.string()).max(50).optional().default([]),
  characters: z.array(z.string().trim().max(200)).max(50).optional().default([]),
  project_members: z.array(z.object({ member_id: z.string().min(1), role_in_project: z.string().optional().default('') })).max(50).optional().default([]),
  cover_url: safeUrlOrEmpty, video_url: httpUrlOrEmpty.default(''),
  repo_url: httpUrlOrEmpty.default(''), live_url: httpUrlOrEmpty.default(''),
  // BUG-12: year is nullable so a cleared year can be sent as null.
  // POST treats null as 'no year'; PATCH treats null as 'delete the field'.
  year: z.number().int().min(2000).max(2100).optional().nullable(), featured: z.boolean().optional().default(false),
  status: z.enum(['draft', 'published']).optional().default('draft'), sort_order: z.number().int().optional().default(0),
  member_ids: z.array(z.string()).max(50).optional().default([]),
});
export const achievementSchema = z.object({
  title: z.string().trim().min(1).max(300), issuer: z.string().max(300).optional().default(''),
  type: z.enum(['certificate', 'award', 'competition', 'academic']).optional().default('certificate'),
  date: z.string().optional().default(''), description: z.string().max(5000).optional().default(''),
  credential_url: httpUrlOrEmpty.default(''),
  image_path: safeUrlOrEmpty, featured: z.boolean().optional().default(false),
  member_id: z.string().optional().default(''),
  // Publication workflow (BUG-10, 2026-11 upgrade): draft by default, like
  // members/projects. Legacy records without a status are treated as
  // published by the public filter (see store.js) so existing content is
  // not hidden by this change.
  status: z.enum(['draft', 'published']).optional().default('draft'),
});
export const siteSchema = z.object({
  group_name: z.string().min(1).max(200), tagline: z.string().max(500).optional().default(''),
  mission: z.string().max(5000).optional().default(''), about: z.string().max(10000).optional().default(''),
  logo_url: safeUrlOrEmpty, hero_video_url: safeUrlOrEmpty,
  email: z.string().email().optional().or(z.literal('')).default(''),
  accent_color: z.string().max(50).optional().default(''),
  social_links: z.object({ github: safeUrlOrEmpty, linkedin: safeUrlOrEmpty, youtube: safeUrlOrEmpty, x: safeUrlOrEmpty, instagram: safeUrlOrEmpty }).partial().optional().default({}),
  seo_title: z.string().max(300).optional().default(''), seo_description: z.string().max(500).optional().default(''),
  og_image_url: safeUrlOrEmpty,
});
export const messagePatchSchema = z.object({ read: z.boolean() }).strict();
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(200), email: z.string().email(),
  subject: z.string().max(300).optional().default(''), message: z.string().trim().min(1).max(5000),
  website: z.string().optional().default(''), // honeypot: must stay empty
}).strict();
export const setPasswordSchema = z.object({
  password: z.string().min(6).max(128),
}).strict();
export const userPatchSchema = z.object({
  role: z.enum(['admin', 'member']).optional(),
  account_status: z.enum(['invited', 'active', 'deactivated']).optional(),
  // Admin-only link from a sign-in account to a team profile (members record).
  // Empty string unlinks. The admin route verifies the profile exists first.
  member_id: z.string().optional(),
}).strict().refine((v) => v.role || v.account_status || v.member_id !== undefined, { message: 'Nothing to update' });
export const uploadSignSchema = z.object({
  file_type: z.enum(['image', 'pdf', 'video']),
  file_size: z.number().int().positive().max(50 * 1024 * 1024),
  file_name: z.string().min(1).max(200),
}).strict();
export const mediaMetaSchema = z.object({
  public_id: z.string().min(1).max(300),
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
}).strict();

// Invite-link flow (2026-10-29): admin creates a token invite; the recipient
// opens /invite?token=... and sets their own password. The accept step takes
// NO email/role/member_id — those come from the invite record only.
export const inviteLinkSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()), name: z.string().trim().min(1).max(200),
  role: z.enum(['admin', 'member']).default('member'), member_id: z.string().optional().default(''),
}).strict();
export const inviteAcceptSchema = z.object({
  token: z.string().min(32).max(200), password: z.string().min(6).max(128),
}).strict();
