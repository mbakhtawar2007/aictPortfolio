'use client';
import type { ReactNode } from 'react';
export function Loading() { return <p className="muted">Loading…</p>; }
export function Empty({ text }: { text: string }) { return <p className="muted">{text}</p>; }
export function ErrorBox({ message }: { message: string }) { return <p className="error" role="alert">{message}</p>; }
export function fmtDate(s?: string) { if (!s) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (!m) return s; const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`; }
export function Section({ title, children }: { title: string; children: ReactNode }) { return (<section style={{ marginTop: 32 }}><h2>{title}</h2>{children}</section>); }
