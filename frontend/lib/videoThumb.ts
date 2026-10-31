// Thumbnail for a project: the admin-set cover first, otherwise a
// first-frame thumbnail derived from a Cloudinary video URL.
// Cloudinary delivery URLs look like:
//   https://res.cloudinary.com/<cloud>/video/upload/v1234567/aict-portfolio/videos/<id>.mp4
// Inserting `so_0,f_jpg,w_800` after /video/upload/ (before the version)
// and switching the extension to .jpg asks Cloudinary for a still from
// the first second of the video, scaled to 800px wide. Non-Cloudinary
// URLs cannot be thumbnailed this way, so they return null and the
// card/detail falls back to a placeholder instead of a broken image.
import type { Project } from './types';

export function videoThumbnailUrl(videoUrl?: string): string | null {
  if (!videoUrl) return null;
  const m = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(?:(v\d+)\/)?(.+?)\.(mp4|webm)(\?.*)?$/.exec(videoUrl.trim());
  if (!m) return null;
  const [, prefix, version, publicPath] = m;
  return `${prefix}so_0,f_jpg,w_800/${version ? `${version}/` : ''}${publicPath}.jpg`;
}

// Thumbnail for a YouTube video: YouTube serves a free still for every
// video at i.ytimg.com/vi/<id>/hqdefault.jpg. hqdefault (480x360) is used
// instead of maxresdefault because maxres does not exist for every video
// and would render a broken image; hqdefault always exists for a video
// that has a thumbnail. Private videos have no public thumbnail, so a
// private link still falls back to the placeholder — use Unlisted.
// Shared YouTube id extraction: youtu.be/<id>, youtube.com/watch?v=<id>,
// /embed/<id>, /shorts/<id>, /live/<id>. Returns '' for anything else.
export function youtubeVideoId(videoUrl?: string): string {
  if (!videoUrl) return '';
  const raw = videoUrl.trim();
  let id = '';
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') id = u.pathname.split('/').filter(Boolean)[0] || '';
    else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      id = u.searchParams.get('v') || '';
      if (!id) {
        const m = /^\/(embed|shorts|live)\/([^/?#]+)/.exec(u.pathname);
        if (m) id = m[2];
      }
    }
  } catch {
    const m = /(?:youtu\.be\/|youtube\.com\/watch\?[^#]*v=)([A-Za-z0-9_-]{11})/.exec(raw);
    if (m) id = m[1];
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
}

export function youtubeThumbnailUrl(videoUrl?: string): string | null {
  const id = youtubeVideoId(videoUrl);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

// Embed URL for playing a YouTube video inside the site (iframe). rel=0
// keeps related videos from the same channel where YouTube allows it.
export function youtubeEmbedUrl(videoUrl?: string): string | null {
  const id = youtubeVideoId(videoUrl);
  return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
}

export function projectThumbnail(p: Project): string | null {
  return p.cover_url || videoThumbnailUrl(p.video_url) || youtubeThumbnailUrl(p.video_url) || null;
}
