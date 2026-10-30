'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Section } from '../app/shared';

// The explorable scene (and all of three.js for it) loads only on the
// client, and only when this section is about to scroll into view.
const ExploreScene = dynamic(() => import('./Scene/ExploreScene'), { ssr: false, loading: () => null });

const FALLBACK = [
  { title: 'Team', description: 'The people behind the group — profiles, skills, and stories.', href: '/team' },
  { title: 'Projects', description: 'What the group builds — AI videos, tools, websites, and experiments.', href: '/projects' },
  { title: 'Achievements', description: 'Certificates and milestones the group has earned along the way.', href: '/achievements' },
  { title: 'Gallery', description: 'Photos and videos from the group — moments, work, and events.', href: '/gallery' },
];

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * "Explore the group" section for the home page. Without WebGL, the same
 * content renders as plain accessible cards.
 */
export default function ExploreStudio() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [webgl] = useState(() => isWebGLAvailable());

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Section title="Explore the group">
      <div ref={ref}>
        {!webgl ? (
          <div className="grid">
            {FALLBACK.map((item) => (
              <div className="card card-hover" key={item.title}>
                <h3>
                  <a href={item.href}>{item.title}</a>
                </h3>
                <p className="muted">{item.description}</p>
              </div>
            ))}
            <p className="muted">
              The interactive 3D scene needs WebGL, which this browser could not provide — the same
              sections are listed above.
            </p>
          </div>
        ) : visible ? (
          <ExploreScene />
        ) : (
          <div className="card">
            <p className="muted">Scroll a little further to load the 3D scene…</p>
          </div>
        )}
      </div>
    </Section>
  );
}
