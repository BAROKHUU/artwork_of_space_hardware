import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react';
import { Stars, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  MathUtils,
  PerspectiveCamera,
  RingGeometry,
  SRGBColorSpace,
  Texture,
  Vector3,
} from 'three';
import { planetMapUrl, textureUrl } from '../data';
import type { Chapter } from '../data/types';
import { GameCanvas } from './GameCanvas';

export type PortalBody = 'moon' | 'mars' | 'saturn' | 'neptune';

interface BodyConfig {
  texture: string;
  glow: string;
  fallback: string;
  roughness: number;
  tilt: number;
  ring?: boolean;
}

export const PORTAL_BODY_CONFIG: Record<PortalBody, BodyConfig> = {
  moon: { texture: textureUrl('moon'), glow: '#a9c8ff', fallback: '#8d96a8', roughness: 0.9, tilt: 0.08 },
  mars: { texture: textureUrl('mars'), glow: '#ff7d45', fallback: '#b85432', roughness: 0.86, tilt: 0.26 },
  saturn: { texture: planetMapUrl('saturn'), glow: '#f4d38e', fallback: '#c7aa74', roughness: 0.8, tilt: 0.28, ring: true },
  neptune: { texture: planetMapUrl('neptune'), glow: '#64c6ff', fallback: '#2e5eb8', roughness: 0.74, tilt: 0.22 },
};

const SEED_YAW: Record<string, number> = {
  ch0: 0.35,
  ch1: 1.55,
  ch2: 2.75,
  ch3: 0.85,
  ch4: 0.5,
  ch5: 2.1,
  ch6: 3.7,
  ch7: 1.25,
  m1: 3.35,
  m2: 4.2,
  m3: 5.1,
  m4: 1.0,
  m5: 2.15,
};

export function chapterPortalBody(chapter: Chapter): PortalBody {
  if (chapter.world === 'mars') return 'mars';
  if (chapter.world === 'deep') return chapter.id === 'ch3' ? 'saturn' : 'neptune';
  return 'moon';
}

export function chapterSeedYaw(chapterId: string): number {
  return SEED_YAW[chapterId] ?? 0.6;
}

interface Props {
  chapter: Chapter | null;
  showPlanet: boolean;
  launching: boolean;
  switchDir: number;
  switchSeq: number;
  pointer: { x: number; y: number };
}

function makeSaturnRingTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, 'rgba(180,158,125,0.0)');
  grad.addColorStop(0.14, 'rgba(205,184,146,0.34)');
  grad.addColorStop(0.34, 'rgba(238,218,180,0.88)');
  grad.addColorStop(0.56, 'rgba(246,228,192,0.92)');
  grad.addColorStop(0.61, 'rgba(28,24,20,0.12)');
  grad.addColorStop(0.68, 'rgba(225,204,166,0.8)');
  grad.addColorStop(0.88, 'rgba(212,188,150,0.46)');
  grad.addColorStop(1.0, 'rgba(180,158,125,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 8);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function makeRadialRingGeometry(inner = 1.24, outer = 1.72, segments = 72): RingGeometry {
  const geo = new RingGeometry(inner, outer, segments, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new Vector3();
  const span = outer - inner;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.y);
    uv.setXY(i, MathUtils.clamp((r - inner) / span, 0, 1), 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

function TexturedPlanetSurface({ url, roughness }: { url: string; roughness: number }) {
  const map = useTexture(url) as Texture;
  useEffect(() => {
    map.colorSpace = SRGBColorSpace;
  }, [map]);

  return (
    <mesh>
      <sphereGeometry args={[1, 64, 48]} />
      <meshStandardMaterial map={map} roughness={roughness} metalness={0.05} />
    </mesh>
  );
}

function FallbackSurface({ color, roughness }: { color: string; roughness: number }) {
  return (
    <mesh>
      <sphereGeometry args={[1, 48, 32]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={0.05} />
    </mesh>
  );
}

function SaturnRing() {
  const tex = useMemo(() => makeSaturnRingTexture(), []);
  const geo = useMemo(() => makeRadialRingGeometry(), []);
  useEffect(() => () => {
    tex.dispose();
    geo.dispose();
  }, [tex, geo]);
  return (
    <mesh geometry={geo} rotation={[Math.PI / 2 - 0.14, 0, -0.18]}>
      <meshStandardMaterial map={tex} transparent side={2} roughness={0.78} depthWrite={false} />
    </mesh>
  );
}

function WarpStarStream({ progressRef }: { progressRef: RefObject<number> }) {
  const count = 240;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.6 + ((i * 73) % 100) * 0.08;
      const a = i * 2.39996;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = Math.sin(a) * r;
      arr[i * 3 + 2] = -24 + ((i * 37) % 100) * 0.27;
    }
    return arr;
  }, []);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = progressRef.current;
    const speed = 0.24 + p * p * 26;
    const attr = geometry.getAttribute('position') as Float32BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const idx = i * 3 + 2;
      arr[idx] += speed * dt;
      if (arr[idx] > 4.2) arr[idx] = -24;
    }
    attr.needsUpdate = true;
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#e6f0ff" size={0.048} transparent opacity={0.72} sizeAttenuation depthWrite={false} />
    </points>
  );
}

const HORIZON_Y = -2.46;
const HORIZON_Z = -0.4;
const HORIZON_RADIUS = 2.42;

function HorizonPlanetStage({
  chapter,
  showPlanet,
  launching,
  switchDir,
  switchSeq,
  pointer,
}: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const groupRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const launchTRef = useRef(0);
  const switchTRef = useRef(0);
  const lastSeqRef = useRef(switchSeq);
  const lookTarget = useRef(new Vector3(0, 0.05, 0));

  const body: PortalBody = chapter ? chapterPortalBody(chapter) : 'moon';
  const cfg = PORTAL_BODY_CONFIG[body];
  const seedYaw = chapter ? chapterSeedYaw(chapter.id) : 0.4;

  useEffect(() => {
    if (switchSeq !== lastSeqRef.current) {
      lastSeqRef.current = switchSeq;
      switchTRef.current = 1;
    }
  }, [switchSeq]);

  useEffect(() => {
    if (chapter && spinRef.current) {
      spinRef.current.rotation.y = seedYaw;
    }
  }, [chapter?.id, seedYaw]);

  useEffect(() => {
    if (!launching) launchTRef.current = 0;
  }, [launching]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);

    if (launching) launchTRef.current = Math.min(1, launchTRef.current + dt / 0.64);
    else launchTRef.current = Math.max(0, launchTRef.current - dt * 4);

    if (switchTRef.current > 0) {
      switchTRef.current = Math.max(0, switchTRef.current - dt / 0.48);
    }

    const t = launchTRef.current;
    const fly = t < 0.24 ? 1.6 * t * t : Math.min(1, 0.092 + 0.908 * Math.pow((t - 0.24) / 0.76, 1.8));
    const sw = switchTRef.current;
    const swDip = Math.sin(sw * Math.PI) * 0.2;

    const targetFov = MathUtils.lerp(42, 68, fly);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    // Camera swoops gracefully down from orbit directly onto the curved planetary horizon on launch.
    camera.position.set(
      pointer.x * 0.12 * (1 - fly),
      MathUtils.lerp(0.28 + pointer.y * 0.08, HORIZON_Y + 2.0, fly),
      MathUtils.lerp(4.6, 1.55, fly),
    );
    lookTarget.current.set(
      0,
      MathUtils.lerp(0.05, HORIZON_Y + 0.7, fly),
      MathUtils.lerp(0, HORIZON_Z, fly),
    );
    camera.lookAt(lookTarget.current);

    if (groupRef.current) {
      const targetScale = cfg.ring ? HORIZON_RADIUS * 0.84 : HORIZON_RADIUS;
      groupRef.current.position.set(0, MathUtils.lerp(HORIZON_Y - swDip, HORIZON_Y + 0.35, fly), HORIZON_Z);
      groupRef.current.scale.setScalar(MathUtils.lerp(groupRef.current.scale.x, targetScale, 1 - Math.exp(-10 * dt)));
      groupRef.current.rotation.x = MathUtils.lerp(groupRef.current.rotation.x, cfg.tilt * 0.4 + pointer.y * 0.06, 1 - Math.exp(-6 * dt));
      groupRef.current.rotation.z = MathUtils.lerp(groupRef.current.rotation.z, -cfg.tilt * 0.32 + pointer.x * 0.06, 1 - Math.exp(-6 * dt));
    }

    if (spinRef.current) {
      const impulseSpin = sw * (switchDir >= 0 ? 1 : -1) * 2.1;
      spinRef.current.rotation.y += dt * (0.09 + impulseSpin + t * 0.9);
    }
  });

  return (
    <>
      <color attach="background" args={['#03060f']} />
      <ambientLight intensity={0.26} />
      <directionalLight position={[2.8, 5.2, 2.4]} intensity={2.45} color="#fff7ec" />
      <directionalLight position={[-3.5, 2.5, -2.5]} intensity={0.22} color="#d6dbe6" />

      <Stars radius={95} depth={38} count={1500} factor={3.2} saturation={0.08} fade speed={0.22} />
      <WarpStarStream progressRef={launchTRef} />

      {showPlanet && chapter && (
        <group ref={groupRef} position={[0, HORIZON_Y, HORIZON_Z]} scale={cfg.ring ? HORIZON_RADIUS * 0.84 : HORIZON_RADIUS}>
          <group ref={spinRef}>
            <Suspense fallback={<FallbackSurface color={cfg.fallback} roughness={cfg.roughness} />}>
              <TexturedPlanetSurface url={cfg.texture} roughness={cfg.roughness} />
            </Suspense>
            {cfg.ring && <SaturnRing />}
          </group>
        </group>
      )}
    </>
  );
}

/** Full-viewport deep-space cosmos with the featured 3D planet rising along the lower horizon. */
export function PortalPlanetCanvas({ chapter, showPlanet, launching, switchDir, switchSeq, pointer }: Props) {
  useEffect(() => {
    const urls = [textureUrl('moon'), textureUrl('mars'), planetMapUrl('saturn'), planetMapUrl('neptune')];
    const imgs = urls.map((src) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      return img;
    });
    return () => {
      imgs.length = 0;
    };
  }, []);

  return (
    <div className="voyage-canvas-layer" aria-hidden="true">
      <GameCanvas
        camera={{ position: [0, 0.28, 4.6], fov: 42, near: 0.05, far: 140 }}
        fallback={<div className="voyage-canvas-fallback" />}
      >
        <HorizonPlanetStage
          chapter={chapter}
          showPlanet={showPlanet}
          launching={launching}
          switchDir={switchDir}
          switchSeq={switchSeq}
          pointer={pointer}
        />
      </GameCanvas>
    </div>
  );
}
