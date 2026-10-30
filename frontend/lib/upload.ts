// Shared direct file upload: sign with the backend, upload straight to
// Cloudinary from the device, then have the backend verify the asset.
// Used by the profile form so a member can pick a photo or resume and have
// the URL field filled automatically — no copy-paste from Uploads.
// Throws an Error with a user-facing message on any failure.
import { apiSend } from './api';

export type DirectFileType = 'image' | 'pdf';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
const MAX_BYTES = 5 * 1024 * 1024;

function extOf(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
}

export async function uploadDirectFile(
  file: File,
  fileType: DirectFileType,
  onProgress: (pct: number) => void,
  metaTitle?: string,
): Promise<string> {
  const ext = extOf(file.name);
  if (fileType === 'image' && !IMAGE_EXTS.includes(ext)) {
    throw new Error('Photos must be jpg, png, webp or avif.');
  }
  if (fileType === 'pdf' && ext !== 'pdf') {
    throw new Error('Resumes must be PDF files.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('File must be 5 MB or smaller.');
  }
  const sign = await apiSend('/admin/upload/sign', 'POST', { file_type: fileType, file_size: file.size, file_name: file.name }, true);
  if (sign.error || !sign.data) {
    throw new Error(sign.error?.message || 'Upload signing is unavailable.');
  }
  const d = sign.data as Record<string, unknown>;
  const secureUrl = await new Promise<string>((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', String(d.api_key));
    form.append('timestamp', String(d.timestamp));
    form.append('public_id', String(d.public_id));
    form.append('signature', String(d.signature));
    const endpoint = `https://api.cloudinary.com/v1_1/${String(d.cloud_name)}/${fileType === 'pdf' ? 'raw' : 'image'}/upload`;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText) as Record<string, unknown>;
        if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) resolve(String(j.secure_url));
        else reject(new Error((j.error as Record<string, unknown> | undefined)?.message as string | undefined || 'Upload failed.'));
      } catch { reject(new Error('Upload failed.')); }
    };
    xhr.onerror = () => reject(new Error('Upload failed (network).'));
    xhr.send(form);
  });
  const v = await apiSend('/admin/upload/verify', 'POST', { public_id: String(d.public_id), file_type: fileType }, true);
  if (v.error || !v.data) {
    throw new Error(v.error?.message || 'Upload was checked by the server and rejected.');
  }
  // Title the asset so it does not show as "Untitled" in media lists.
  // A meta failure never blocks the upload itself.
  if (metaTitle) {
    const meta = await apiSend('/admin/media/meta', 'POST', { public_id: String(d.public_id), title: metaTitle.slice(0, 120), description: '' }, true);
    if (meta.error) console.warn('direct upload meta failed', meta.error.message);
  }
  return String((v.data as Record<string, unknown>).secure_url || secureUrl);
}
