import crypto from 'crypto';
import { db, firebaseEnabled } from './firebase.js';
// Rate limiting.
//
// Client identity: the LAST X-Forwarded-For entry, not the first — a
// client can put any values it likes at the START of XFF, but the entry
// appended by the closest trusted proxy (the hosting edge) is at the
// END. Using the first entry let a caller rotate spoofed IPs to bypass
// the limit entirely. Using the last entry is not perfect — a client
// behind a shared proxy shares a bucket with that proxy's other users,
// and if the edge ever stops appending, the key falls back to the
// socket address (still a working, coarser limit) — but spoofed
// left-side values can no longer mint fresh buckets. Raw IPs are never
// stored: only a SHA-256 hash.
//
// Where the count lives: when Firebase is enabled, the count lives in a
// Firestore document and is incremented in a transaction, so it is
// shared across Vercel serverless instances and two simultaneous
// requests cannot both slip under the limit. When Firestore is
// unavailable, the limiter falls back to in-memory (per-instance)
// rather than blocking legitimate messages; that fallback is
// documented here rather than hidden, and it is the reason the
// invite/upload limits below are defence-in-depth, not a hard
// guarantee, on a cold serverless fleet.
const buckets = new Map();
function hashKey(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
export function clientKeyFromRequest(req, bucket = 'contact') {
  const xff = req.headers['x-forwarded-for'];
  const last = typeof xff === 'string' ? xff.split(',').map((s) => s.trim()).filter(Boolean).pop() : '';
  const raw = last || req.ip || req.socket?.remoteAddress || 'unknown';
  return hashKey(`${bucket}:${raw}`);
}
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const list = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now); buckets.set(key, list); return true;
}
// Generic in-memory limiter for authenticated / token-gated routes.
// Keyed by a stable caller id (actor uid, or a hashed IP for public
// routes), with a per-window cap. Returns true when allowed.
export function actorRateLimit(key, max, windowMs) {
  return rateLimit(key, max, windowMs);
}
async function firestoreIncrement(keyHash, bucket, max) {
  // One document per bucket+hash+window. The window is an hour bucket
  // for contact, and a rolling window is approximated by the caller
  // passing a window label; for the limits in this file the hour
  // bucket is sufficient and keeps the document count bounded.
  const hour = new Date().toISOString().slice(0, 13);
  const ref = db().collection('rate_limits').doc(`${bucket}_${keyHash}_${hour}`);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? (snap.data().count || 0) : 0;
    if (count >= max) return false;
    tx.set(ref, { count: count + 1, hour, updated_at: new Date().toISOString() }, { merge: true });
    return true;
  });
}
export async function contactAllowedForRequest(req) {
  const keyHash = clientKeyFromRequest(req, 'contact');
  if (firebaseEnabled()) {
    try { return await firestoreIncrement(keyHash, 'contact', 5); }
    catch { /* fall through to in-memory below */ }
  }
  return rateLimit(`contact:${keyHash}`, 5, 60 * 60 * 1000);
}
export function contactAllowed(ip) { return rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000); }
// Public invite endpoints: generous caps that stop probing/abuse
// without breaking legitimate use (a real invite is validated once
// and accepted once). Per-IP, in-memory when Firebase is off.
export function inviteValidateAllowed(req) {
  return rateLimit(`invite-validate:${clientKeyFromRequest(req, 'invite-validate')}`, 100, 60 * 60 * 1000);
}
export function inviteAcceptAllowed(req) {
  return rateLimit(`invite-accept:${clientKeyFromRequest(req, 'invite-accept')}`, 20, 60 * 60 * 1000);
}
