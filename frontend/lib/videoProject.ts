// Video upload -> project card (2026-10-30, user request in Roman Urdu:
// "Jab me koi Video upload krn to uska card ban kar projects me show ho").
//
// The Uploads forms on /admin and /member call this after a video upload
// has been verified. It reuses the existing POST /admin/projects endpoint,
// so the backend's own rules still apply:
//  - an admin's project can be 'published' and appears on /projects at once;
//  - the Group Leader's project can be 'published' too and goes live at
//    once (user rule 2026-10-31); any other member's project is forced to
//    'draft' by the backend, so an admin must publish it before it
//    appears publicly (same rule as a manually created member project).
// The upload itself is never rolled back if this fails: the video stays in
// Uploads and the caller reports the failure so the card can be made by hand.
import { apiSend } from './api';
import { videoThumbnailUrl } from './videoThumb';
import type { Project } from './types';

export function slugifyVideoTitle(v: string): string {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function titleFromVideoFile(fileName: string, title: string): string {
  const typed = (title || '').trim();
  if (typed) return typed.slice(0, 300);
  const base = fileName.replace(/\.[^.]*$/, '').replace(/[-_]+/g, ' ').trim();
  return base.slice(0, 300) || 'Untitled video';
}

// Comma-separated form values -> arrays, the rule the Uploads forms use
// for Characters and Technology (also used by the project form).
export function splitCsv(v: string): string[] {
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

// Success wording for a created video project, shared by the /admin and
// /member Uploads forms so the visibility meaning stays identical.
export function videoProjectSuccessMessage(p: Project): string {
  const vis = p.visibility || 'public';
  if (p.status === 'published') {
    return vis === 'unlisted'
      ? `Video uploaded. Its project card is unlisted — it will not appear in Projects lists, but anyone with the direct link can open it: /projects/${p.slug}`
      : `Video uploaded and its project card is now live on Projects: /projects/${p.slug}`;
  }
  return vis === 'unlisted'
    ? 'Video uploaded and saved as a draft — an admin will publish it, and it will then be unlisted (direct link only).'
    : 'Video uploaded and its project card is saved as a draft — an admin will publish it before it appears on Projects.';
}

export async function createVideoProject(input: {
  title: string;
  description: string;
  videoUrl: string;
  fileName: string;
  caseStudy?: string;
  characters?: string[];
  techStack?: string[];
  memberIds?: string[];
  category?: string;
  visibility?: string;
  tags?: string[];
  year?: number;
  coverUrl?: string;
}): Promise<{ data: Project | null; error: string | null }> {
  const title = titleFromVideoFile(input.fileName, input.title);
  const description = (input.description || '').trim();
  const baseSlug = slugifyVideoTitle(title) || `video-${Date.now().toString(36)}`;
  const attempts = [baseSlug, `${baseSlug}-2`, `${baseSlug}-3`, `${baseSlug}-4`, `${baseSlug}-5`, `${baseSlug}-${Date.now().toString(36)}`];
  let lastError = 'Project could not be created.';
  for (const slug of attempts) {
    const r = await apiSend<Project>('/admin/projects', 'POST', {
      slug,
      title,
      tagline: description.slice(0, 500),
      description: description.slice(0, 10000),
      category: input.category || 'AI Video',
      video_url: input.videoUrl,
      // A custom thumbnail wins; otherwise the video's first frame is used.
      cover_url: input.coverUrl || videoThumbnailUrl(input.videoUrl) || '',
      visibility: input.visibility || 'public',
      tags: (input.tags || []).map((t) => t.trim().slice(0, 100)).filter(Boolean),
      ...(input.year !== undefined ? { year: input.year } : {}),
      // Optional details asked for in the Uploads form (2026-10-31): they
      // land on the project details page instead of its empty states.
      // Slices keep the backend's limits (case_study 20000, each
      // character 200) so a long entry cannot fail the whole card.
      case_study: (input.caseStudy || '').trim().slice(0, 20000),
      characters: (input.characters || []).map((c) => c.trim().slice(0, 200)).filter(Boolean),
      tech_stack: (input.techStack || []).map((s) => s.trim()).filter(Boolean),
      // Non-leader members are forced to 'draft' by the backend; admins and the Group Leader stay published.
      // Private is always a draft, even for admins (backend enforces it too).
      status: input.visibility === 'private' ? 'draft' : 'published',
      member_ids: input.memberIds || [],
      project_members: (input.memberIds || []).map((member_id) => ({ member_id, role_in_project: '' })),
    }, true);
    if (!r.error && r.data) return { data: r.data, error: null };
    lastError = r.error?.message || lastError;
    // Only a taken slug is worth retrying with a new slug; anything else
    // (validation, profile-less member, backend down) will not change.
    if (r.error?.code !== 'slug_taken') return { data: null, error: lastError };
  }
  return { data: null, error: lastError };
}
