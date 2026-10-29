// In-memory rate limiter. Per-process only (fine for foundation + single
// Vercel instance notes in README); production can swap in a shared store.
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const list = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now); buckets.set(key, list); return true;
}
export function contactAllowed(ip) { return rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000); }
