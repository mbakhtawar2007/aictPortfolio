'use client';
import type { ReactNode } from 'react';
import { useState } from 'react';

export type Toast = { id: number; kind: 'success' | 'error'; text: string };
export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (<div className="toasts" role="status" aria-live="polite">
    {toasts.map((t) => (<div key={t.id} className={`toast ${t.kind}`}>
      <span>{t.kind === 'success' ? '✓ ' : '⚠ '}{t.text}</span>
      <button aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>×</button>
    </div>))}
  </div>);
}
export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (<div className="grid" aria-label="Loading">{Array.from({ length: count }).map((_, i) => (<div className="card skeleton" key={i}><div className="sk-line sk-title" /><div className="sk-line" /><div className="sk-line sk-short" /></div>))}</div>);
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (<div className="modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Close" onClick={onClose}>×</button></div>
      {children}
    </div>
  </div>);
}
export function ConfirmDialog({ text, onConfirm, onCancel, busy }: { text: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return (<Modal title="Confirm" onClose={onCancel}><p>{text}</p>
    <p><button className="btn danger" disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : 'Yes, delete'}</button>{' '}
    <button className="btn secondary" disabled={busy} onClick={onCancel}>Cancel</button></p></Modal>);
}
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (<label className="field"><span className="field-label">{label}</span>{children}{error ? <span className="field-error" role="alert">{error}</span> : null}</label>);
}
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (<button className="btn secondary small" title={copied ? 'Copied' : 'Copy to clipboard'} onClick={async () => { try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ } setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? '✓ Copied' : label}</button>);
}
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (kind: 'success' | 'error', text: string) => { const id = Date.now() + Math.random(); setToasts((t) => [...t, { id, kind, text }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000); };
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  return { toasts, push, dismiss };
}
