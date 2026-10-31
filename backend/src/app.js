import express from 'express';
import cors from 'cors';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { fail } from './validate.js';
// CORS allowlist, normalised at boot: exact origins only, no wildcard,
// no trailing slash (the browser Origin never has one, so a trailing
// slash would silently fail closed for a legitimate origin). A '*' or an
// empty entry is dropped rather than passed to cors(), so the
// exact-match rule is enforced in code, not left to operator convention.
export function corsOrigins() {
  const raw = process.env.CORS_ORIGIN || 'http://localhost:3000';
  return raw.split(',').map((s) => s.trim().replace(/\/$/, '')).filter((s) => s && s !== '*');
}
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigins(), credentials: false }));
  // Section 5E security headers (API only — JSON responses, so a strict
  // policy cannot break Firebase/Cloudinary, which are server-side here).
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    // API responses carry account data; never let a cache store them.
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', publicRouter);
  app.use('/api/admin', adminRouter);
  // No public signup, ever. Also block the auth-register path explicitly.
  app.post('/api/auth/register', (req, res) => fail(res, 404, 'not_found', 'Not found.'));
  app.use((req, res) => fail(res, 404, 'not_found', 'Not found.'));
  // Safe error handler: no stack traces or provider details to clients.
  // Body-parser errors are client errors (400/413), not 500s.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') return fail(res, 413, 'payload_too_large', 'Request body is too large.');
    if (err instanceof SyntaxError) return fail(res, 400, 'validation_error', 'Request body is not valid JSON.');
    return fail(res, 500, 'internal_error', 'Something went wrong.');
  });
  return app;
}
