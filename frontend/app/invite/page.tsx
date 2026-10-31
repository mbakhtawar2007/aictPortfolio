'use client';
// Public invitation-accept page. This is NOT a signup page: it does
// nothing without a valid admin-issued token, and the token (not the
// visitor) decides the email and role. The form takes only a password.
import { useEffect, useState } from 'react';
import { apiGet, apiSend } from '../../lib/api';
import { Loading, ErrorBox } from '../shared';

export default function InvitePage() {
  const [token, setToken] = useState('');
  const [checking, setChecking] = useState(true);
  const [info, setInfo] = useState<{ email: string; name: string; role: string; expires_at: string } | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || '';
    setToken(t);
    if (!t) { setError('This page needs an invitation link. Ask an admin to send you a new one.'); setChecking(false); return; }
    apiGet(`/invite/validate?token=${encodeURIComponent(t)}`).then((r) => {
      if (r.error || !r.data) setError(r.error?.message || 'This invitation link is invalid, expired, or already used. Ask an admin for a new one.');
      else setInfo(r.data as typeof info);
      setChecking(false);
    });
  }, []);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    const r = await apiSend('/invite/accept', 'POST', { token, password });
    setBusy(false);
    if (r.error) setError(r.error.message);
    else setDone(true);
  }

  if (checking) return <Loading />;
  if (done) return (<div><h1>Account created</h1><p className="success">Your account is ready. You can now sign in with your email and the password you just set.</p><p><a className="btn" href="/login">Go to login</a></p></div>);
  if (error || !info) return (<div><h1>Invitation</h1><ErrorBox message={error} /><p className="muted">Invitation links expire after 7 days and work only once. If yours has expired, ask an admin for a new one.</p><p><a href="/login">Go to login</a>{' '}<a href="/">Back home</a></p></div>);
  return (<div><h1>Create your account</h1>
    <p>You have been invited to TechHive.</p>
    <p><strong>Email:</strong> {info.email}<br /><strong>Role:</strong> {info.role === 'admin' ? 'Admin' : 'Team member'}{info.name ? <><br /><strong>Name:</strong> {info.name}</> : null}</p>
    <form onSubmit={accept}>
      <label>Choose a password<input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /><button type="button" className="btn secondary small" aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onClick={() => setShowPw((v) => !v)}>{showPw ? 'Hide' : 'Show'}</button></label>
      <label>Confirm password<input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /><button type="button" className="btn secondary small" aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirm} onClick={() => setShowConfirm((v) => !v)}>{showConfirm ? 'Hide' : 'Show'}</button></label>
      {error && <ErrorBox message={error} />}
      <p><button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create my account'}</button></p>
    </form>
    <p className="muted">This link expires on {new Date(info.expires_at).toLocaleDateString()} and can be used only once. Your email and role were set by the admin and cannot be changed here.</p>
  </div>);
}
