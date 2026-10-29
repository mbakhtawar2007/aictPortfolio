import crypto from 'crypto';
import { db, firebaseEnabled } from './firebase.js';
// Contact rate limiting (BUG-13 upgrade, 2026-11).
//
// Why the LAST X-Forwarded-For entry, not the first: a client can put any
// values it likes at the START of XFF, but the entry appended by the
// closest trusted proxy (the hosting edge) is at the END. Using the first
// entry let a caller rotate spoofed IPs to bypass the limit entirely.
// Using the last entry is not perfect — a client behind a shared proxy
// shares a bucket with that proxy's other users, and if the edge ever
// stops appending, the key falls back to the socket address (still a
// working, coarser limit) — but spoofed left-side values can no longer
// mint fresh buckets. Raw IPs are never stored: only a SHA-256 hash.
//
// Where the count lives: when Firebase is enabled, the count lives in a
// Firestore document (rate_limits/contact_<hash>_<hour>), so it is shared
// across Vercel serverless instances instead of per-process. The check is
// read-then-write, not a transaction, so two requests in the same instant
// can both pass — a small race window that is acceptable for a contact
// form and is documented here rather than hidden. When Firestore is
// unavailable, the limiter falls back to in-memory (per-instance) rather
// than blocking legitimate messages; that fallback is also documented.
const buckets = new Map();
function hashKey(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
export function clientKeyFromRequest(req) {
  const xff = req.headers['x-forwarded-for'];
  const last = typeof xff === 'string' ? xff.split(',').map((s) => s.trim()).filter(Boolean).pop() : '';
  const raw = last || req.ip || req.socket?.remoteAddress || 'unknown';
  return hashKey(`contact:${raw}`);
}
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const list = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now); buckets.set(key, list); return true;
}
export async function contactAllowedForRequest(req) {
  const keyHash = clientKeyFromRequest(req);
  if (firebaseEnabled()) {
    try {
      const hour = new Date().toISOString().slice(0, 13);
      const ref = db().collection('rate_limits').doc(`contact_${keyHash}_${hour}`);
      const snap = await ref.get();
      const count = snap.exists ? (snap.data().count || 0) : 0;
      if (count >= 5) return false;
      await ref.set({ count: count + 1, hour, updated_at: new Date().toISOString() }, { merge: true });
      return true;
    } catch { /* fall through to in-memory below */ }
  }
  return rateLimit(`contact:${keyHash}`, 5, 60 * 60 * 1000);
}
export function contactAllowed(ip) { return rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000); }
