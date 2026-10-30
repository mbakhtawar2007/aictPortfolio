'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MathUtils, type Group } from 'three';
import { scrollProgress } from '../../lib/scroll3d';

/**
 * Cosmic background (2026-10-30): a fixed WebGL canvas behind public pages.
 * Animated fbm nebula (blue -> violet -> magenta -> cyan as you scroll),
 * twinkling star layers with mouse parallax, and rare shooting stars.
 * Reduced motion: one frozen frame. Tab hidden: time stops advancing
 * (browsers also throttle rAF). No WebGL: a CSS nebula fallback.
 * Rendered at 50-75% resolution and upscaled, so it stays at 60fps.
 */

const NEBULA_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const NEBULA_FRAGMENT = `
uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p = p * 2.03 + vec2(19.7, 7.3);
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 drift = vec2(uTime * 0.008, uTime * 0.005 + uScroll * 0.6);
  vec2 warp = vec2(
    fbm(p * 1.5 + drift),
    fbm(p * 1.5 + drift + 4.7)
  );
  vec2 q = p + (warp - 0.5) * 0.55 + uMouse * 0.05;
  float n = fbm(q * 2.2 + drift * 0.5);
  float n2 = fbm(q * 4.5 - drift);
  float clouds = smoothstep(0.35, 0.78, n * 0.75 + n2 * 0.35);

  vec3 blue = vec3(0.12, 0.36, 1.0);
  vec3 violet = vec3(0.48, 0.18, 0.97);
  vec3 magenta = vec3(1.0, 0.24, 0.67);
  vec3 cyan = vec3(0.13, 0.83, 0.93);
  vec3 colA = mix(blue, violet, smoothstep(0.0, 0.4, uScroll));
  vec3 colB = mix(magenta, cyan, smoothstep(0.6, 1.0, uScroll));
  vec3 neb = mix(colA, colB, smoothstep(0.3, 0.7, uScroll));
  vec3 col = mix(neb * 0.7, neb, n2);

  float vig = smoothstep(1.15, 0.35, length(uv - 0.5) * 1.6);
  float alpha = clouds * 0.85 * (0.55 + 0.45 * vig);
  gl_FragColor = vec4(col, alpha);
}
`;

const STAR_VERTEX = `
attribute float aScale;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vColor = aColor;
  float tw = 0.65 + 0.35 * sin(uTime * 1.4 + aPhase);
  vTwinkle = tw;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aScale * tw * uPixelRatio * (100.0 / max(-mv.z, 1.0));
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAGMENT = `
uniform float uOpacity;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.08, d) * vTwinkle * uOpacity;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

type StarLayerDef = {
  key: string;
  count: number;
  scaleMin: number;
  scaleMax: number;
  opacity: number;
  parallax: number;
  drift: number;
};

const LAYERS: StarLayerDef[] = [
  { key: 'far', count: 1600, scaleMin: 0.15, scaleMax: 0.3, opacity: 0.9, parallax: 0.25, drift: 0.3 },
  { key: 'mid', count: 700, scaleMin: 0.3, scaleMax: 0.5, opacity: 0.95, parallax: 0.5, drift: 0.6 },
  { key: 'near', count: 90, scaleMin: 0.7, scaleMax: 1.2, opacity: 1.0, parallax: 0.85, drift: 1.0 },
  { key: 'dust', count: 260, scaleMin: 0.1, scaleMax: 0.2, opacity: 0.35, parallax: 0.15, drift: 0.15 },
];

// Mostly white, with pale blue and warm yellow variation.
const STAR_COLORS = ['#FFFFFF', '#FFFFFF', '#BFD6FF', '#FFE9B8'];

function buildStarGeometry(def: StarLayerDef, count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 56;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 36;
    positions[i * 3 + 2] = -1 - Math.random() * 14;
    scales[i] = def.scaleMin + Math.random() * (def.scaleMax - def.scaleMin);
    phases[i] = Math.random() * Math.PI * 2;
    const c = new THREE.Color(STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]);
    // Bake the layer opacity into the color: additive blending makes a
    // dimmer color a dimmer dot, so all layers share one material.
    colors[i * 3] = c.r * def.opacity;
    colors[i * 3 + 1] = c.g * def.opacity;
    colors[i * 3 + 2] = c.b * def.opacity;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function ShootingStar() {
  const group = useRef<Group>(null);
  const headMat = useRef<THREE.MeshBasicMaterial>(null);
  const trailMat = useRef<THREE.MeshBasicMaterial>(null);
  const state = useRef({
    next: 5 + Math.random() * 6,
    start: 0,
    active: false,
    dir: 1,
    x: 0,
    y: 0,
  });

  useFrame((clockState) => {
    const g = group.current;
    if (!g || document.hidden) return;
    const s = state.current;
    const t = clockState.clock.elapsedTime;
    if (!s.active && t >= s.next) {
      s.active = true;
      s.start = t;
      s.dir = Math.random() > 0.5 ? 1 : -1;
      s.x = (Math.random() - 0.5) * 16;
      s.y = 4 + Math.random() * 4;
    }
    if (!s.active) {
      g.visible = false;
      return;
    }
    const p = (t - s.start) / 0.9;
    if (p >= 1) {
      s.active = false;
      s.next = t + 7 + Math.random() * 8;
      g.visible = false;
      return;
    }
    g.visible = true;
    const fade = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
    g.position.set(s.x + s.dir * p * 9, s.y - p * 4.5, -2);
    g.rotation.z = Math.atan2(-4.5, s.dir * 9);
    if (headMat.current) headMat.current.opacity = fade;
    if (trailMat.current) trailMat.current.opacity = fade * 0.4;
  });

  return (
    <group ref={group} visible={false}>
      <mesh>
        <planeGeometry args={[0.5, 0.03]} />
        <meshBasicMaterial
          ref={headMat}
          color="#EAF6FF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[-1.1, 0, 0]}>
        <planeGeometry args={[2.0, 0.015]} />
        <meshBasicMaterial
          ref={trailMat}
          color="#22D3EE"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function CosmicScene({ reduced, mobile }: { reduced: boolean; mobile: boolean }) {
  const nebulaMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: NEBULA_VERTEX,
        fragmentShader: NEBULA_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uMouse: { value: new THREE.Vector2(0, 0) },
          uScroll: { value: 0 },
          uResolution: { value: new THREE.Vector2(1, 1) },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );
  const starMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uOpacity: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const layers = useMemo(
    () =>
      LAYERS.map((def) => ({
        def,
        geometry: buildStarGeometry(def, mobile ? Math.round(def.count * 0.35) : def.count),
      })),
    [mobile],
  );
  const groupRefs = useRef<(Group | null)[]>([]);
  const dpr = useThree((s) => s.viewport.dpr);
  const size = useThree((s) => s.size);

  useEffect(() => {
    nebulaMaterial.uniforms.uResolution.value.set(size.width, size.height);
  }, [size, nebulaMaterial]);

  useEffect(() => {
    starMaterial.uniforms.uPixelRatio.value = dpr;
  }, [dpr, starMaterial]);

  const time = useRef(0);
  const mouse = useRef({ x: 0, y: 0 });
  const smoothMouse = useRef({ x: 0, y: 0 });
  const fine = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

  useEffect(() => {
    if (!fine || reduced) return;
    const onMove = (e: PointerEvent) => {
      mouse.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [fine, reduced]);

  useFrame((_, delta) => {
    if (!reduced && !document.hidden) time.current += delta;
    const t = time.current;
    nebulaMaterial.uniforms.uTime.value = t;
    nebulaMaterial.uniforms.uScroll.value = reduced ? 0 : scrollProgress.value;
    starMaterial.uniforms.uTime.value = t;
    smoothMouse.current.x = MathUtils.damp(
      smoothMouse.current.x,
      reduced || !fine ? 0 : mouse.current.x,
      3,
      delta,
    );
    smoothMouse.current.y = MathUtils.damp(
      smoothMouse.current.y,
      reduced || !fine ? 0 : mouse.current.y,
      3,
      delta,
    );
    (nebulaMaterial.uniforms.uMouse.value as THREE.Vector2).set(
      smoothMouse.current.x,
      smoothMouse.current.y,
    );
    const p = reduced ? 0 : scrollProgress.value;
    layers.forEach(({ def }, i) => {
      const g = groupRefs.current[i];
      if (!g) return;
      g.position.x = MathUtils.damp(g.position.x, smoothMouse.current.x * def.parallax, 3, delta);
      g.position.y = MathUtils.damp(
        g.position.y,
        -p * def.drift + smoothMouse.current.y * def.parallax * 0.6,
        3,
        delta,
      );
    });
  });

  return (
    <>
      <mesh frustumCulled={false} renderOrder={-1} material={nebulaMaterial}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      {layers.map(({ geometry }, i) => (
        <group
          key={LAYERS[i].key}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
        >
          <points geometry={geometry} material={starMaterial} frustumCulled={false} />
        </group>
      ))}
      {!reduced && <ShootingStar />}
    </>
  );
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function CosmicBackground() {
  const reduced =
    typeof window !== 'undefined' &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.getAttribute('data-reduce') === 'true');
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  if (!isWebGLAvailable()) {
    // Static CSS nebula: same palette, zero WebGL.
    return <div aria-hidden="true" className="cosmic-fallback" />;
  }

  return (
    <div aria-hidden="true" className="cosmic-canvas">
      <Canvas
        dpr={[0.5, 0.75]}
        camera={{ position: [0, 0, 5], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor('#05060F', 0)}
        frameloop={reduced ? 'never' : 'always'}
      >
        <CosmicScene reduced={reduced} mobile={mobile} />
      </Canvas>
    </div>
  );
}
