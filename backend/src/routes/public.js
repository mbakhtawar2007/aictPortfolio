import express from 'express';
import { ok, fail, parseBody, contactSchema } from '../validate.js';
import { store, isFirebase } from '../store.js';
import { contactAllowed } from '../rateLimit.js';
import { demoMode } from '../firebase.js';
export const publicRouter = express.Router();
publicRouter.get('/health', (req, res) => ok(res, { status: 'ok', mode: isFirebase() ? 'firebase' : 'demo', demo: demoMode() }));
publicRouter.get('/site', async (req, res) => { try { const s = await store.site(); return ok(res, s); } catch { return fail(res, 503, 'unavailable', 'Site settings are temporarily unavailable.'); } });
publicRouter.get('/members', async (req, res) => { try { return ok(res, await store.membersPublished()); } catch { return fail(res, 503, 'unavailable', 'Members are temporarily unavailable.'); } });
publicRouter.get('/members/:slug', async (req, res) => { try { const m = await store.memberBySlug(req.params.slug); if (!m) return fail(res, 404, 'not_found', 'Member not found.'); return ok(res, m); } catch { return fail(res, 503, 'unavailable', 'Member is temporarily unavailable.'); } });
publicRouter.get('/projects', async (req, res) => { try { return ok(res, await store.projectsPublished()); } catch { return fail(res, 503, 'unavailable', 'Projects are temporarily unavailable.'); } });
publicRouter.get('/projects/:slug', async (req, res) => { try { const p = await store.projectBySlug(req.params.slug); if (!p) return fail(res, 404, 'not_found', 'Project not found.'); return ok(res, p); } catch { return fail(res, 503, 'unavailable', 'Project is temporarily unavailable.'); } });
publicRouter.get('/achievements', async (req, res) => { try { return ok(res, await store.achievementsPublished()); } catch { return fail(res, 503, 'unavailable', 'Achievements are temporarily unavailable.'); } });
publicRouter.post('/contact', async (req, res) => {
  const parsed = parseBody(contactSchema, req.body);
  if (!parsed.ok) return fail(res, 400, 'validation_error', parsed.message);
  const body = parsed.data;
  // Honeypot: bots fill it. Silently "accept" without storing or emailing.
  if (body.website) return ok(res, { received: true });
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || 'unknown';
  if (!contactAllowed(ip)) return fail(res, 429, 'rate_limited', 'Too many messages. Please try again later.');
  try {
    const msg = await store.addMessage({ name: body.name, email: body.email, subject: body.subject, message: body.message, created_at: new Date().toISOString(), read: false });
    // Resend is optional. A mail failure must not expose the key or fail the stored message.
    try {
      if (process.env.RESEND_API_KEY && process.env.CONTACT_NOTIFY_EMAIL) {
        const { Resend } = await import('resend');
        await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'AICT Portfolio <onboarding@resend.dev>', to: process.env.CONTACT_NOTIFY_EMAIL, subject: `Portfolio contact: ${body.subject || 'New message'}`, text: `From ${body.name} <${body.email}>\n\n${body.message}` });
      }
    } catch { /* notification failed; message is still stored */ }
    return ok(res, { received: true, id: msg.id });
  } catch { return fail(res, 503, 'unavailable', 'Your message could not be saved right now.'); }
});
// Explicitly no other auth creation routes. /auth/register is 404 in app.js.
