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

export function projectThumbnail(p: Project): string | null {
  return p.cover_url || videoThumbnailUrl(p.video_url) || null;
}
