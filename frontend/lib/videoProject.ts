// Video upload -> project card (2026-10-30, user request in Roman Urdu:
// "Jab me koi Video upload krn to uska card ban kar projects me show ho").
//
// The Uploads forms on /admin and /member call this after a video upload
// has been verified. It reuses the existing POST /admin/projects endpoint,
// so the backend's own rules still apply:
//  - an admin's project can be 'published' and appears on /projects at once;
//  - a member's project is forced to 'draft' by the backend, so an admin
//    must publish it before it appears publicly (same rule as a manually
//    created member project).
// The upload itself is never rolled back if this fails: the video stays in
// Uploads and the caller reports the failure so the card can be made by hand.
import { apiSend } from './api';
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

export async function createVideoProject(input: {
  title: string;
  description: string;
  videoUrl: string;
  fileName: string;
  memberId?: string;
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
      category: 'AI Video',
      video_url: input.videoUrl,
      // Members are forced to 'draft' by the backend; admins stay published.
      status: 'published',
      member_ids: input.memberId ? [input.memberId] : [],
      project_members: input.memberId ? [{ member_id: input.memberId, role_in_project: '' }] : [],
    }, true);
    if (!r.error && r.data) return { data: r.data, error: null };
    lastError = r.error?.message || lastError;
    // Only a taken slug is worth retrying with a new slug; anything else
    // (validation, profile-less member, backend down) will not change.
    if (r.error?.code !== 'slug_taken') return { data: null, error: lastError };
  }
  return { data: null, error: lastError };
}
