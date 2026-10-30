'use client';
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { MathUtils, type Mesh } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

/**
 * Explorable "Explore the group" scene. Orbit with mouse/touch, zoom with
 * scroll/pinch, click an object to read what it stands for (with a link to
 * the real section), "Reset view" returns the camera to its start.
 * No auto-rotation; hover scale is instant when reduced motion is preferred.
 */

type ExploreObject = {
  key: string;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  geometry: 'icosahedron' | 'torus' | 'sphere' | 'capsule';
  position: [number, number, number];
  color: string;
};

const OBJECTS: ExploreObject[] = [
  {
    key: 'team',
    title: 'Team',
    description: 'The people behind the group — profiles, skills, and stories.',
    href: '/team',
    hrefLabel: 'See the team',
    geometry: 'icosahedron',
    position: [-2.6, 0.3, 0],
    color: '#7B2FF7',
  },
  {
    key: 'projects',
    title: 'Projects',
    description: 'What the group builds — AI videos, tools, websites, and experiments.',
    href: '/projects',
    hrefLabel: 'See projects',
    geometry: 'torus',
    position: [2.6, 0.3, 0],
    color: '#22D3EE',
  },
  {
    key: 'achievements',
    title: 'Achievements',
    description: 'Certificates and milestones the group has earned along the way.',
    href: '/achievements',
    hrefLabel: 'See achievements',
    geometry: 'sphere',
    position: [0, 0.3, -2.2],
    color: '#FF3CAC',
  },
  {
    key: 'gallery',
    title: 'Gallery',
    description: 'Photos and videos from the group — moments, work, and events.',
    href: '/gallery',
    hrefLabel: 'Open the gallery',
    geometry: 'capsule',
    position: [0, 0.3, 2.2],
    color: '#1F5BFF',
  },
];

function StudioMesh({ obj, selected, onSelect }: {
  obj: ExploreObject;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const mesh = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const reduced =
    typeof window !== 'undefined' &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.getAttribute('data-reduce') === 'true');
  const target = hovered || selected ? 1.15 : 1;

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const next = reduced ? target : MathUtils.damp(mesh.current.scale.x, target, 8, delta);
    mesh.current.scale.setScalar(next);
  });

  const geometry = (() => {
    switch (obj.geometry) {
      case 'icosahedron':
        return <icosahedronGeometry args={[1, 0]} />;
      case 'torus':
        return <torusGeometry args={[1, 0.38, 24, 64]} />;
      case 'sphere':
        return <sphereGeometry args={[1, 48, 48]} />;
      case 'capsule':
        return <capsuleGeometry args={[0.55, 1.1, 8, 24]} />;
    }
  })();

  return (
    <mesh
      ref={mesh}
      position={obj.position}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(obj.key);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {geometry}
      <meshPhysicalMaterial
        color={obj.color}
        roughness={0.15}
        metalness={0.1}
        clearcoat={1}
        clearcoatRoughness={0.25}
        emissive={obj.color}
        emissiveIntensity={selected ? 0.55 : 0.3}
      />
    </mesh>
  );
}

export default function ExploreScene() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const controls = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    // Snapshot the starting camera so "Reset view" can return to it.
    controls.current?.saveState();
  }, []);

  const selected = OBJECTS.find((o) => o.key === selectedKey) || null;

  const resetView = () => {
    controls.current?.reset();
    setSelectedKey(null);
  };

  return (
    <div>
      <div className="explore-canvas-wrap">
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 1.4, 7.5], fov: 42 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => gl.setClearColor('#000000', 0)}
          onPointerMissed={() => setSelectedKey(null)}
        >
          <ambientLight intensity={0.9} />
          <hemisphereLight args={['#8AB4FF', '#0B0B2B', 0.6]} />
          <directionalLight position={[5, 8, 5]} intensity={1.3} />
          <pointLight position={[-6, 3, 3]} intensity={20} distance={25} color="#FF3CAC" />
          <pointLight position={[6, 3, 3]} intensity={20} distance={25} color="#22D3EE" />
          {OBJECTS.map((obj) => (
            <StudioMesh
              key={obj.key}
              obj={obj}
              selected={obj.key === selectedKey}
              onSelect={setSelectedKey}
            />
          ))}
          <ContactShadows position={[0, -1.4, 0]} opacity={0.25} scale={14} blur={2.4} />
          <OrbitControls
            ref={controls}
            makeDefault
            enableDamping
            enablePan={false}
            minDistance={3.5}
            maxDistance={10}
            maxPolarAngle={Math.PI / 2.15}
            target={[0, 0.2, 0]}
          />
        </Canvas>
        <p className="explore-hint">Drag to orbit · Scroll or pinch to zoom · Click an object</p>
        <button
          type="button"
          onClick={resetView}
          className="btn explore-reset"
          aria-label="Reset the 3D view to its starting position"
        >
          ↺ Reset view
        </button>
      </div>

      {selected && (
        <div role="dialog" aria-label={`${selected.title} details`} className="card explore-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0 }}>{selected.title}</h3>
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="btn secondary small"
              aria-label="Close details"
            >
              ×
            </button>
          </div>
          <p className="muted">{selected.description}</p>
          <p>
            <a className="btn" href={selected.href}>
              {selected.hrefLabel} →
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
