import type { ApiResult } from './types';
// NEXT_PUBLIC_API_URL is baked in at build time. Local default is the
// local backend; Netlify builds MUST set it to the Vercel backend URL.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';
export function authToken(): string | null { if (typeof window === 'undefined') return null; return window.localStorage.getItem('aict_admin_token'); }
function authHeaders(auth: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (auth) { const t = authToken(); if (t) headers.Authorization = `Bearer ${t}`; }
  return headers;
}
// Parse a response as the API envelope, but never mistake an HTML
// error page (Vercel/Netlify 502, 404) for a network failure: a
// non-JSON response is a deterministic upstream error, not something
// a retry will fix, so it is returned immediately as upstream_error.
async function parseEnvelope<T>(res: Response): Promise<ApiResult<T> | null> {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  try { return (await res.json()) as ApiResult<T>; } catch { return null; }
}
function upstreamError<T>(status: number): ApiResult<T> {
  return { data: null, error: { code: 'upstream_error', message: 'The server returned an unexpected response. Please try again in a moment.' }, meta: { status } };
}
// A transient failure (cold start, flaky network) must not surface as an
// error on a public page: retry network failures silently a couple of times
// while the caller still shows its loading skeleton. Only the final failure
// is returned, and public pages render it as a calm note, never as a red box.
export async function apiGet<T>(path: string, auth = false): Promise<ApiResult<T>> {
  const last: ApiResult<T> = { data: null, error: { code: 'network_error', message: 'Could not reach the server. Please try again in a moment.' }, meta: {} };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API_URL}${path}`, { headers: authHeaders(auth), cache: 'no-store' });
      const parsed = await parseEnvelope<T>(res);
      if (parsed) return parsed;
      return upstreamError<T>(res.status);
    } catch {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 900));
    }
  }
  return last;
}
export async function apiSend<T>(path: string, method: string, body: unknown, auth = false): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...authHeaders(auth) };
    const res = await fetch(`${API_URL}${path}`, { method, headers, body: JSON.stringify(body) });
    const parsed = await parseEnvelope<T>(res);
    if (parsed) return parsed;
    return upstreamError<T>(res.status);
  } catch { return { data: null, error: { code: 'network_error', message: 'Could not reach the backend.' }, meta: {} }; }
}
