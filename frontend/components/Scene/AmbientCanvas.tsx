'use client';
import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, RoundedBox } from '@react-three/drei';
import { MathUtils, type Group } from 'three';
import { scrollProgress } from '../../lib/scroll3d';

/**
 * Fixed, pointer-transparent canvas behind public pages.
 * Soft procedural shapes (matte clay, frosted glass, one accent-blue piece)
 * drift with drei Float, react gently to the cursor, and travel downward as
 * the GSAP scroll progress advances. Reduced motion: no drifting, no
 * parallax, no camera travel. Mobile: only the first three shapes.
 */

type AmbientShape = {
  kind: 'sphere' | 'torus' | 'capsule' | 'box' | 'icosahedron' | 'knot';
  position: [number, number, number];
  scale: number;
  color: string;
  material: 'clay' | 'glass' | 'accent';
};

const SHAPES: AmbientShape[] = [
  { kind: 'sphere', position: [-3.4, 1.4, -2], scale: 1.1, color: '#EDEFF3', material: 'clay' },
  { kind: 'torus', position: [3.2, 0.6, -3], scale: 1.0, color: '#1F5BFF', material: 'accent' },
  { kind: 'capsule', position: [2.2, -1.8, -1], scale: 0.8, color: '#DDE1E8', material: 'clay' },
  { kind: 'box', position: [-2.6, -1.6, -2], scale: 0.9, color: '#C7CDD8', material: 'clay' },
  { kind: 'icosahedron', position: [0.4, 2.2, -4], scale: 0.7, color: '#EDEFF3', material: 'glass' },
  { kind: 'knot', position: [-0.6, -2.4, -3], scale: 0.55, color: '#DDE1E8', material: 'clay' },
];

function ShapeMesh({ shape }: { shape: AmbientShape }) {
  const material =
    shape.material === 'glass' ? (
      <meshPhysicalMaterial color="#ffffff" transparent opacity={0.38} roughness={0.35} metalness={0} />
    ) : shape.material === 'accent' ? (
      <meshStandardMaterial color={shape.color} roughness={0.3} metalness={0.1} />
    ) : (
      <meshStandardMaterial color={shape.color} roughness={0.9} metalness={0} />
    );
  if (shape.kind === 'box') {
    return (
      <RoundedBox args={[1.6, 1.6, 1.6]} radius={0.35} smoothness={8}>
        {material}
      </RoundedBox>
    );
  }
  const geometry = (() => {
    switch (shape.kind) {
      case 'sphere':
        return <sphereGeometry args={[1, 48, 48]} />;
      case 'torus':
        return <torusGeometry args={[1, 0.38, 24, 64]} />;
      case 'capsule':
        return <capsuleGeometry args={[0.55, 1.1, 8, 24]} />;
      case 'icosahedron':
        return <icosahedronGeometry args={[1, 0]} />;
      case 'knot':
        return <torusKnotGeometry args={[0.7, 0.26, 128, 24]} />;
    }
  })();
  return (
    <mesh>
      {geometry}
      {material}
    </mesh>
  );
}

function Shape({ shape, reduced }: { shape: AmbientShape; reduced: boolean }) {
  const inner = (
    <group position={shape.position} scale={shape.scale}>
      <ShapeMesh shape={shape} />
    </group>
  );
  if (reduced) return inner;
  return (
    <Float speed={1.1} rotationIntensity={0.35} floatIntensity={0.9} floatingRange={[-0.12, 0.12]}>
      {inner}
    </Float>
  );
}

/** Reads scroll progress + cursor every frame and eases camera/group toward them. */
function ScrollRig({ group }: { group: React.RefObject<Group | null> }) {
  const reduced =
    typeof window !== 'undefined' &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.getAttribute('data-reduce') === 'true');
  const fine = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!fine || reduced) return;
    const onMove = (e: PointerEvent) => {
      pointer.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [fine, reduced]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const p = reduced ? 0 : scrollProgress.value;
    const targetY = -p * 2.4;
    const targetX = reduced || !fine ? 0 : pointer.current.x * 0.4;
    state.camera.position.y = MathUtils.damp(state.camera.position.y, targetY, 3, delta);
    state.camera.position.x = MathUtils.damp(state.camera.position.x, targetX, 3, delta);
    state.camera.lookAt(0, state.camera.position.y, 0);
    g.rotation.y = MathUtils.damp(
      g.rotation.y,
      p * 0.7 + (reduced || !fine ? 0 : pointer.current.x * 0.12),
      3,
      delta,
    );
    g.position.x = MathUtils.damp(g.position.x, reduced || !fine ? 0 : pointer.current.x * 0.25, 3, delta);
  });
  return null;
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function AmbientCanvas() {
  const reduced =
    typeof window !== 'undefined' &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.getAttribute('data-reduce') === 'true');
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  const group = useRef<Group>(null);

  if (!isWebGLAvailable()) {
    // Static gradient fallback: same palette, zero WebGL.
    return (
      <div
        aria-hidden="true"
        className="ambient-fallback"
        style={{
          background:
            'radial-gradient(60% 50% at 20% 20%, #EDEFF3 0%, transparent 70%), radial-gradient(50% 40% at 85% 30%, #dbe6ff 0%, transparent 70%), linear-gradient(180deg, #F6F7F9 0%, #eef0f4 100%)',
        }}
      />
    );
  }

  const shapes = mobile ? SHAPES.slice(0, 3) : SHAPES;

  return (
    <div aria-hidden="true" className="ambient-canvas">
      <Canvas
        dpr={mobile ? [1, 1.75] : [1, 2]}
        camera={{ position: [0, 0, 9], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor('#F6F7F9', 0)}
      >
        <ambientLight intensity={0.85} />
        <hemisphereLight args={['#ffffff', '#dfe3ea', 0.5]} />
        <directionalLight position={[5, 8, 5]} intensity={1.4} />
        <ScrollRig group={group} />
        <group ref={group}>
          {shapes.map((shape, i) => (
            <Shape key={i} shape={shape} reduced={reduced} />
          ))}
        </group>
      </Canvas>
    </div>
  );
}
