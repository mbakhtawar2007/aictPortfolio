'use client';
import { useState } from 'react';
import { apiSend } from '../../lib/api';
export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle'); const [error, setError] = useState('');
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setState('sending'); setError('');
    const r = await apiSend('/contact', 'POST', form);
    if (r.error) { setError(r.error.message); setState('error'); } else setState('done');
  }
  if (state === 'done') return <div><h1>Message sent</h1><p className="success">Thanks — your message was received. (In demo mode it is stored in backend memory only; production requires Firebase — see README.)</p><p><a href="/">Back home</a></p></div>;
  return (<div><h1>Contact</h1><p className="muted">Messages go to the admin inbox. There is no public account creation on this site.</p>
    <form onSubmit={submit}>
      <label>Name<input required value={form.name} onChange={set('name')} /></label>
      <label>Email<input required type="email" value={form.email} onChange={set('email')} /></label>
      <label>Subject<input value={form.subject} onChange={set('subject')} /></label>
      <label>Message<textarea required rows={6} value={form.message} onChange={set('message')} /></label>
      {/* Honeypot: hidden from humans, filled by bots. Do not remove. */}
      <div style={{ display: 'none' }}><label>Website<input value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" /></label></div>
      {state === 'error' && <p className="error">{error}</p>}
      <button className="btn" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send message'}</button>
    </form></div>);
}
