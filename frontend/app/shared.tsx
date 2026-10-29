'use client';
import type { ReactNode } from 'react';
export function SampleBadge({ isSample }: { isSample?: boolean }) { return isSample ? <span className="sample">SAMPLE</span> : null; }
export function Loading() { return <p className="muted">Loading…</p>; }
export function Empty({ text }: { text: string }) { return <p className="muted">{text}</p>; }
export function ErrorBox({ message }: { message: string }) { return <p className="error" role="alert">{message}</p>; }
export function Section({ title, children }: { title: string; children: ReactNode }) { return (<section style={{ marginTop: 32 }}><h2>{title}</h2>{children}</section>); }
