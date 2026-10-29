import express from 'express';
import cors from 'cors';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { fail } from './validate.js';
export function createApp() {
  const app = express();
  const origin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.use(cors({ origin: origin.split(',').map((s) => s.trim()), credentials: false }));
  // Section 5E security headers (API only — JSON responses, so a strict
  // policy cannot break Firebase/Cloudinary, which are server-side here).
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', publicRouter);
  app.use('/api/admin', adminRouter);
  // No public signup, ever. Also block the auth-register path explicitly.
  app.post('/api/auth/register', (req, res) => fail(res, 404, 'not_found', 'Not found.'));
  app.use((req, res) => fail(res, 404, 'not_found', 'Not found.'));
  // Safe error handler: no stack traces or provider details to clients.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => fail(res, 500, 'internal_error', 'Something went wrong.'));
  return app;
}
