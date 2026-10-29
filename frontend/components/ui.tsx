'use client';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

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
// Focusable elements inside a container, in DOM order.
function focusables(root: HTMLElement): HTMLElement[] {
  const els = Array.from(root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
  return els.filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
}
export function useDialogFocus(onClose: () => void, containerRef: React.RefObject<HTMLElement | null>) {
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const node = containerRef.current; if (!node) return;
    // Move focus into the dialog: first focusable, else the dialog itself.
    const first = focusables(node)[0];
    if (first) first.focus(); else { node.setAttribute('tabindex', '-1'); node.focus(); }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables(node); if (!items.length) { e.preventDefault(); return; }
      const firstEl = items[0]; const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); triggerRef.current?.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(onClose, ref);
  return (<div className="modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal" ref={ref} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><h2 id="modal-title">{title}</h2><button className="icon-btn" aria-label={`Close ${title}`} onClick={onClose}>×</button></div>
      {children}
    </div>
  </div>);
}
// Shared accessible tabs: roving tabindex, arrow-key focus movement,
// Enter/Space (native button activation) selects. Callers render the
// matching tabpanel with id `${id}-panel` and
// aria-labelledby={`${id}-tab-${value}`}.
export function Tabs({ id, label, tabs, value, onChange }: { id: string; label: string; tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, index: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next !== null) { e.preventDefault(); refs.current[next]?.focus(); }
  };
  return (<div className="tabs" role="tablist" aria-label={label}>
    {tabs.map((tab, i) => { const safeId = tab.id.replace(/\s+/g, '-'); return (<button key={tab.id} ref={(el) => { refs.current[i] = el; }} id={`${id}-tab-${safeId}`} role="tab" aria-selected={value === tab.id} aria-controls={`${id}-panel`} tabIndex={value === tab.id ? 0 : -1} className={`tab-btn${value === tab.id ? ' active' : ''}`} onClick={() => onChange(tab.id)} onKeyDown={(e) => onKey(e, i)}>{tab.label}</button>); })}

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
  const [failed, setFailed] = useState(false);
  return (<button className="btn secondary small" title={copied ? 'Copied' : failed ? 'Copy failed' : 'Copy to clipboard'} onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setFailed(false); setTimeout(() => setCopied(false), 2000); } catch { setFailed(true); setCopied(false); } }}>{copied ? '✓ Copied' : failed ? 'Copy failed — select it manually' : label}</button>);
}
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (kind: 'success' | 'error', text: string) => { const id = Date.now() + Math.random(); setToasts((t) => [...t, { id, kind, text }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000); };
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  return { toasts, push, dismiss };
}

// Accessible lightbox: Escape closes (via useDialogFocus), Tab is trapped
// inside, focus returns to the triggering element on close.
export function Lightbox({ label, src, alt, onClose, onPrev, onNext }: { label: string; src: string; alt: string; onClose: () => void; onPrev?: () => void; onNext?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(onClose, ref);
  return (<div className="lightbox" ref={ref} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <img src={src} alt={alt} />
    <button className="icon-btn" style={{ top: 16, right: 16 }} aria-label="Close preview" onClick={onClose}>×</button>
    {onPrev && <button className="icon-btn" style={{ left: 16, top: '50%' }} aria-label="Previous image" onClick={(e) => { e.stopPropagation(); onPrev(); }}>‹</button>}
    {onNext && <button className="icon-btn" style={{ right: 16, top: '50%' }} aria-label="Next image" onClick={(e) => { e.stopPropagation(); onNext(); }}>›</button>}
    <p className="muted" style={{ position: 'absolute', bottom: 16 }}>Press Esc or tap outside to close. Pinch-zoom is not implemented in this viewer.</p>
  </div>);
}
