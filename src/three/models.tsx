import { Component, Suspense, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { modelUrl } from '../data';
import { useGame } from '../state/store';
import type { ModelId } from '../data/types';

/** Crumpled thermal blanket, used as a bump map so foil catches light unevenly. */
function foilBump(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#7c7c7c';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 640; i++) {
    const v = 72 + ((i * 53) % 128);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    const x = ((i * 97) % 256);
    const y = ((i * 151) % 256);
    const r = 6 + (i % 22);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    for (let a = 1; a < 5; a++) {
      const ang = a * 1.26 + (i % 7) * 0.4;
      ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function solarCells(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0e1d3b';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const hue = 216 + ((x * 7 + y * 13) % 8);
      const light = 17 + ((x * 3 + y * 5) % 6);
      ctx.fillStyle = `hsl(${hue} 66% ${light}%)`;
      ctx.fillRect(x * 32 + 2, y * 32 + 2, 28, 28);
      // Metallic silver busbars and grid traces across each photovoltaic cell.
      ctx.fillStyle = 'rgba(205, 224, 250, 0.35)';
      ctx.fillRect(x * 32 + 15, y * 32 + 2, 1.5, 28);
      ctx.fillStyle = 'rgba(180, 206, 240, 0.16)';
      ctx.fillRect(x * 32 + 2, y * 32 + 9, 28, 1);
      ctx.fillRect(x * 32 + 2, y * 32 + 20, 28, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function panelBump(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#909090';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = '#a4a4a4';
      ctx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      ctx.fillStyle = '#686868';
      ctx.fillRect(x * 64 + 5, y * 64 + 5, 3, 3);
      ctx.fillRect(x * 64 + 56, y * 64 + 5, 3, 3);
      ctx.fillRect(x * 64 + 5, y * 64 + 56, 3, 3);
      ctx.fillRect(x * 64 + 56, y * 64 + 56, 3, 3);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function retroPrisms(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3c434f';
  ctx.fillRect(0, 0, 256, 256);
  const step = 25.6;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const px = x * step + 2;
      const py = y * step + 2;
      const w = step - 4;
      ctx.fillStyle = '#203249';
      ctx.fillRect(px, py, w, w);
      ctx.fillStyle = '#7bb4d9';
      ctx.beginPath();
      ctx.moveTo(px + 2, py + 2);
      ctx.lineTo(px + w - 2, py + 2);
      ctx.lineTo(px + w * 0.5, py + w * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#48769b';
      ctx.beginPath();
      ctx.moveTo(px + 2, py + 2);
      ctx.lineTo(px + w * 0.5, py + w * 0.5);
      ctx.lineTo(px + 2, py + w - 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const FOIL = foilBump();
const CELLS = solarCells();
const PANELS = panelBump();
const RETRO = retroPrisms();

const mat = (color: string, roughness = 0.5, metalness = 0.1, side: THREE.Side = THREE.FrontSide) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side });
const foil = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.9, bumpMap: FOIL, bumpScale: 2.1 });

const MAT = {
  white: new THREE.MeshStandardMaterial({ color: '#e7e4dc', roughness: 0.44, metalness: 0.12, bumpMap: PANELS, bumpScale: 0.35 }),
  grey: new THREE.MeshStandardMaterial({ color: '#8d9096', roughness: 0.38, metalness: 0.65, bumpMap: PANELS, bumpScale: 0.28 }),
  steel: mat('#b9bcc2', 0.25, 0.88),
  dark: mat('#25272e', 0.68, 0.22),
  louver: mat('#1f242f', 0.42, 0.72),
  nozzle: mat('#323039', 0.32, 0.88),
  gold: foil('#dca842'),
  foil: foil('#c5923d'),
  silver: foil('#cdd1d8'),
  solar: new THREE.MeshStandardMaterial({ color: '#ffffff', map: CELLS, roughness: 0.14, metalness: 0.65 }),
  copper: mat('#b56e3e', 0.34, 0.78),
  glass: mat('#1c3858', 0.08, 0.86),
  retro: new THREE.MeshStandardMaterial({ color: '#ffffff', map: RETRO, roughness: 0.12, metalness: 0.75 }),
  dish: new THREE.MeshStandardMaterial({ color: '#dcd9d2', roughness: 0.46, metalness: 0.25, bumpMap: PANELS, bumpScale: 0.22, side: THREE.DoubleSide }),
};
type M = keyof typeof MAT;
type V3 = [number, number, number];

const Box = ({ s, p = [0, 0, 0], r, m = 'white' }: { s: V3; p?: V3; r?: V3; m?: M }) => (
  <mesh position={p} rotation={r} material={MAT[m]} castShadow receiveShadow>
    <boxGeometry args={s} />
  </mesh>
);
const Cyl = ({ a, p = [0, 0, 0], r, m = 'grey' }: { a: [number, number, number, number?]; p?: V3; r?: V3; m?: M }) => (
  <mesh position={p} rotation={r} material={MAT[m]} castShadow>
    <cylinderGeometry args={[a[0], a[1], a[2], a[3] ?? 12]} />
  </mesh>
);

/** A strut between two points. */
function Strut({ from, to, w = 0.035, m = 'grey' }: { from: V3; to: V3; w?: number; m?: M }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return (
    <mesh position={mid} quaternion={q} material={MAT[m]} castShadow>
      <cylinderGeometry args={[w, w, a.distanceTo(b), 6]} />
    </mesh>
  );
}

/** A shallow parabolic dish whose open side faces local +y. */
const Dish = ({ radius, p = [0, 0, 0], r, m = 'dish' }: { radius: number; p?: V3; r?: V3; m?: M }) => (
  <mesh position={p} rotation={r} material={MAT[m]} castShadow>
    <sphereGeometry args={[radius * 1.25, 24, 8, 0, Math.PI * 2, Math.PI - 0.92, 0.92]} />
  </mesh>
);

const Wheels = ({ x, zs, y, r, w = 0.2, m = 'dark' }: { x: number; zs: number[]; y: number; r: number; w?: number; m?: M }) => (
  <>
    {zs.flatMap((z) => [-x, x].map((sx) => <Cyl key={`${sx}${z}`} a={[r, r, w, 14]} p={[sx, y, z]} r={[0, 0, Math.PI / 2]} m={m} />))}
  </>
);

function LanderLeg({ angle, top, foot, r }: { angle: number; top: number; foot: number; r: number }) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return (
    <>
      <Strut from={[c * r * 0.45, top, s * r * 0.45]} to={[c * r, foot + 0.05, s * r]} />
      <Strut from={[c * r * 0.5, top + 0.35, s * r * 0.5]} to={[c * r, foot + 0.05, s * r]} w={0.022} />
      <Cyl a={[0.2, 0.26, 0.07, 14]} p={[c * r, foot + 0.04, s * r]} m="foil" />
    </>
  );
}

const Orb = ({ r, p, m = 'steel' }: { r: number; p: V3; m?: M }) => (
  <mesh position={p} material={MAT[m]} castShadow>
    <sphereGeometry args={[r, 18, 14]} />
  </mesh>
);

const Ranger = () => (
  <group position={[0, 1.2, 0]}>
    <Cyl a={[0.62, 0.62, 0.36, 6]} m="gold" />
    {[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i * Math.PI) / 3 + Math.PI / 6;
      return (
        <group key={i}>
          <Box s={[0.42, 0.26, 0.08]} p={[Math.cos(a) * 0.56, 0, Math.sin(a) * 0.56]} r={[0, -a + Math.PI / 2, 0]} m={i % 2 ? 'silver' : 'foil'} />
          <Box s={[0.28, 0.03, 0.025]} p={[Math.cos(a) * 0.61, 0.06, Math.sin(a) * 0.61]} r={[0, -a + Math.PI / 2, 0]} m="louver" />
          <Box s={[0.28, 0.03, 0.025]} p={[Math.cos(a) * 0.61, -0.05, Math.sin(a) * 0.61]} r={[0, -a + Math.PI / 2, 0]} m="louver" />
        </group>
      );
    })}
    <Cyl a={[0.56, 0.5, 0.05, 6]} p={[0, 0.2, 0]} m="steel" />
    <Cyl a={[0.2, 0.5, 1.15, 16]} p={[0, 0.78, 0]} m="silver" />
    <Cyl a={[0.2, 0.2, 0.42, 16]} p={[0, 1.55, 0]} m="white" />
    {/* Six-camera TV aperture window & bezel */}
    <Box s={[0.22, 0.24, 0.08]} p={[0, 1.05, 0.34]} r={[-0.25, 0, 0]} m="dark" />
    <Cyl a={[0.045, 0.045, 0.06, 12]} p={[0, 1.05, 0.38]} r={[Math.PI / 2 - 0.25, 0, 0]} m="glass" />
    {[0, 1.05, 2.1, 3.15, 4.2, 5.25].map((a) => <Cyl key={a} a={[0.045, 0.06, 0.14, 10]} p={[Math.cos(a) * 0.2, 1.38, Math.sin(a) * 0.2]} r={[Math.PI / 2 - 0.5, 0, -a + Math.PI / 2]} m="nozzle" />)}
    <Strut from={[0, 1.76, 0]} to={[0, 2.28, 0]} w={0.014} m="steel" />
    <Cyl a={[0.045, 0.045, 0.1, 10]} p={[0, 2.3, 0]} m="white" />
    {[-1, 1].map((s) => (
      <group key={s}>
        <Box s={[1.5, 0.03, 0.82]} p={[s * 1.42, 0, 0]} m="solar" />
        <Box s={[1.54, 0.014, 0.86]} p={[s * 1.42, -0.024, 0]} m="grey" />
        <Strut from={[s * 0.6, 0, 0.2]} to={[s * 0.8, 0, 0.3]} w={0.018} m="steel" />
        <Strut from={[s * 0.6, 0, -0.2]} to={[s * 0.8, 0, -0.3]} w={0.018} m="steel" />
      </group>
    ))}
    <Strut from={[0.2, -0.18, 0.2]} to={[0.42, -0.86, 0.34]} w={0.022} m="steel" />
    <group position={[0.42, -0.92, 0.34]} rotation={[Math.PI + 0.35, 0, 0.2]}>
      <Dish radius={0.55} />
      <Strut from={[0, 0, 0]} to={[0, 0.42, 0]} w={0.012} m="steel" />
      <Orb r={0.04} p={[0, 0.44, 0]} m="gold" />
    </group>
    <Cyl a={[0.1, 0.15, 0.22, 14]} p={[0, -0.3, 0]} m="nozzle" />
  </group>
);

/** A wheel with raised cleats, axle along X. */
const CleatWheel = ({ p, r, w, m = 'grey', cleats = 12 }: { p: V3; r: number; w: number; m?: M; cleats?: number }) => (
  <group position={p}>
    <Cyl a={[r, r, w, 20]} r={[0, 0, Math.PI / 2]} m={m} />
    <Cyl a={[r * 0.5, r * 0.5, w * 1.1, 14]} r={[0, 0, Math.PI / 2]} m="steel" />
    {Array.from({ length: cleats }, (_, i) => (i / cleats) * Math.PI * 2).map((a) => (
      <mesh key={a} position={[0, Math.cos(a) * r, Math.sin(a) * r]} rotation={[-a, 0, 0]} material={MAT.dark} castShadow>
        <boxGeometry args={[w * 1.02, r * 0.1, r * 0.14]} />
      </mesh>
    ))}
  </group>
);

/** Bell nozzle, opening downward. */
const Nozzle = ({ p, size = 1 }: { p: V3; size?: number }) => (
  <group position={p} scale={size}>
    <Cyl a={[0.055, 0.15, 0.26, 18]} p={[0, -0.05, 0]} m="nozzle" />
    <Cyl a={[0.1, 0.075, 0.1, 14]} p={[0, 0.13, 0]} m="steel" />
  </group>
);

const on = (angle: number, r: number, y: number): V3 => [Math.cos(angle) * r, y, Math.sin(angle) * r];

const SURVEYOR_ENGINES = [1.55, 3.65, 5.75];
const VIKING_ENGINES = [1.55, 3.65, 5.75];

export type EngineVehicle = 'surveyor' | 'viking';

/** Where each engine's exhaust begins, in the lander's own coordinates. */
export const ENGINE_MOUNTS: Record<EngineVehicle, { x: number; y: number; z: number }[]> = {
  surveyor: SURVEYOR_ENGINES.map((a) => ({ x: Math.cos(a) * 0.62, y: 0.73, z: Math.sin(a) * 0.62 })),
  viking: VIKING_ENGINES.map((a) => ({ x: Math.cos(a) * 0.56, y: 0.66, z: Math.sin(a) * 0.56 })),
};

const Surveyor = () => {
  const legs = [0.5, 2.6, 4.7];
  return (
    <group>
      {/* Triangular spaceframe */}
      {legs.map((a, i) => {
        const next = legs[(i + 1) % 3];
        return (
          <group key={a}>
            <Strut from={on(a, 0.72, 0.98)} to={on(next, 0.72, 0.98)} w={0.03} m="steel" />
            <Strut from={on(a, 0.42, 1.62)} to={on(next, 0.42, 1.62)} w={0.024} m="steel" />
            <Strut from={on(a, 0.72, 0.98)} to={on(a, 0.42, 1.62)} w={0.024} m="steel" />
            <Strut from={on(next, 0.72, 0.98)} to={on(a, 0.42, 1.62)} w={0.016} m="steel" />
            <LanderLeg angle={a} top={1.02} foot={0} r={1.5} />
            <Strut from={on(a, 0.6, 0.98)} to={on(a, 1.02, 0.42)} w={0.04} m="grey" />
          </group>
        );
      })}
      <Cyl a={[0.32, 0.32, 0.05, 24]} p={[0, 1.0, 0]} m="steel" />

      {/* Three vernier engines, each with its propellant tanks */}
      {SURVEYOR_ENGINES.map((a) => (
        <group key={a}>
          <Nozzle p={on(a, 0.62, 0.85)} />
          <Orb r={0.13} p={on(a + 0.32, 0.5, 1.12)} />
          <Orb r={0.13} p={on(a - 0.32, 0.5, 1.12)} m="silver" />
        </group>
      ))}

      {/* Thermal compartments with radiator louvers */}
      <group position={on(1.0, 0.56, 1.52)} rotation={[0, -1.0, 0]}>
        <Box s={[0.46, 0.26, 0.34]} m="foil" />
        <Box s={[0.48, 0.02, 0.36]} p={[0, 0.14, 0]} m="white" />
        {[-0.12, 0, 0.12].map((dx) => <Box key={dx} s={[0.06, 0.025, 0.32]} p={[dx, 0.158, 0]} m="louver" />)}
      </group>
      <group position={on(4.1, 0.56, 1.52)} rotation={[0, -4.1, 0]}>
        <Box s={[0.46, 0.22, 0.34]} m="gold" />
        <Box s={[0.48, 0.02, 0.36]} p={[0, 0.12, 0]} m="white" />
        {[-0.12, 0, 0.12].map((dx) => <Box key={dx} s={[0.06, 0.025, 0.32]} p={[dx, 0.138, 0]} m="louver" />)}
      </group>

      {/* Television camera with optical glass & mirror hood */}
      <group position={on(2.6, 0.5, 1.62)} rotation={[0.25, 0, -0.18]}>
        <Cyl a={[0.085, 0.085, 0.48, 14]} p={[0, 0.2, 0]} m="white" />
        <Cyl a={[0.095, 0.095, 0.04, 14]} p={[0, 0.44, 0]} m="dark" />
        <Box s={[0.16, 0.12, 0.13]} p={[0.02, 0.49, 0.05]} r={[0.5, 0, 0]} m="silver" />
        <Cyl a={[0.052, 0.052, 0.04, 12]} p={[0.02, 0.52, 0.09]} r={[1.1, 0, 0]} m="glass" />
      </group>

      {/* Mast, framed solar array, and flat high-gain array antenna */}
      <Strut from={[0, 1.0, 0]} to={[0, 3.15, 0]} w={0.042} m="steel" />
      <group position={[0, 3.15, 0]} rotation={[0.52, 0, 0]}>
        <Box s={[0.98, 0.025, 0.74]} m="solar" />
        <Box s={[1.02, 0.015, 0.78]} p={[0, -0.018, 0]} m="steel" />
      </group>
      <group position={[0.34, 2.55, -0.08]} rotation={[-0.55, 0, 0.35]}>
        <Box s={[0.56, 0.018, 0.56]} m="dish" />
        <Box s={[0.6, 0.012, 0.6]} p={[0, -0.012, 0]} m="steel" />
        <Strut from={[0, 0, 0]} to={[-0.32, 0.02, 0.08]} w={0.018} />
      </group>
      <Cyl a={[0.01, 0.01, 0.9, 6]} p={[-0.28, 2.0, 0.18]} />

      {/* Soil scoop arm */}
      <Strut from={on(5.6, 0.62, 1.0)} to={on(5.6, 1.12, 0.74)} w={0.026} m="steel" />
      <Strut from={on(5.6, 1.12, 0.74)} to={on(5.6, 1.5, 0.42)} w={0.02} m="steel" />
      <Box s={[0.14, 0.1, 0.18]} p={on(5.6, 1.54, 0.37)} r={[0.3, 0.6, 0]} m="steel" />
    </group>
  );
};

const Descent = () => (
  <group>
    <Cyl a={[1.05, 1.05, 1.0, 8]} p={[0, 1.3, 0]} m="gold" />
    <Cyl a={[1.08, 1.08, 0.14, 8]} p={[0, 0.85, 0]} m="foil" />
    <Box s={[1.6, 0.05, 1.6]} p={[0, 1.83, 0]} m="foil" />
    {[0.78, 2.35, 3.93, 5.5].map((a) => (
      <group key={a}>
        <LanderLeg angle={a} top={1.05} foot={0} r={2.05} />
        <Strut from={[Math.cos(a) * 0.9, 1.3, Math.sin(a) * 0.9]} to={[Math.cos(a) * 1.45, 0.65, Math.sin(a) * 1.45]} w={0.025} m="gold" />
      </group>
    ))}
    <Cyl a={[0.38, 0.62, 0.54, 16]} p={[0, 0.58, 0]} m="nozzle" />
    <Box s={[0.44, 0.02, 0.28]} p={[1.05, 1.3, 0]} r={[0, 0, Math.PI / 2]} m="grey" />
    <Strut from={[0.92, 0.05, -0.92]} to={[0.92, 0.98, -0.92]} w={0.018} m="silver" />
  </group>
);

const Lrrr = () => (
  <group scale={1.6} position={[0, 0.02, 0]}>
    <Box s={[0.72, 0.04, 0.52]} p={[0, 0.03, 0]} m="foil" />
    <Strut from={[-0.2, 0.05, -0.1]} to={[-0.2, 0.42, -0.1]} m="steel" />
    <Strut from={[0.2, 0.05, -0.1]} to={[0.2, 0.42, -0.1]} m="steel" />
    <Strut from={[0, 0.05, 0.12]} to={[0, 0.38, -0.04]} w={0.02} m="steel" />
    {/* Sun-compass shadow gnomon & leveling dial */}
    <Cyl a={[0.055, 0.065, 0.03, 12]} p={[-0.26, 0.06, 0.16]} m="gold" />
    <Strut from={[-0.26, 0.075, 0.16]} to={[-0.26, 0.22, 0.16]} w={0.008} m="steel" />
    <group position={[0, 0.5, 0]} rotation={[-0.6, 0, 0]}>
      <Box s={[0.88, 0.09, 0.88]} m="grey" />
      <Box s={[0.8, 0.018, 0.8]} p={[0, 0.048, 0]} m="retro" />
      <Strut from={[-0.44, 0, -0.44]} to={[-0.44, 0.14, -0.44]} w={0.014} m="steel" />
      <Strut from={[0.44, 0, -0.44]} to={[0.44, 0.14, -0.44]} w={0.014} m="steel" />
      <Strut from={[-0.44, 0.14, -0.44]} to={[0.44, 0.14, -0.44]} w={0.014} m="steel" />
    </group>
  </group>
);

const Lrv = () => (
  <group>
    {[-1.2, 1.2].flatMap((z) => [-1, 1].map((x) => (
      <group key={`${x}${z}`}>
        <CleatWheel p={[x * 0.98, 0.42, z]} r={0.42} w={0.24} m="silver" cleats={18} />
        <Cyl a={[0.15, 0.15, 0.28, 16]} p={[x * 0.98, 0.42, z]} r={[0, 0, Math.PI / 2]} m="dark" />
        <Cyl a={[0.095, 0.095, 0.31, 12]} p={[x * 0.98, 0.42, z]} r={[0, 0, Math.PI / 2]} m="steel" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <Orb key={i} r={0.025} p={[x * 0.98 + Math.cos(a) * 0.11, 0.42 + Math.sin(a) * 0.11, z + Math.sign(z) * 0.16]} m="gold" />;
        })}
        <mesh position={[x * 0.98, 0.44, z]} rotation={[0, 0, Math.PI / 2]} material={MAT.gold} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.3, 20, 1, true, Math.PI * 0.62, Math.PI * 0.76]} />
        </mesh>
        <Strut from={[x * 0.74, 0.42, z]} to={[x * 0.98, 0.42, z]} w={0.055} m="steel" />
      </group>
    )))}
    <Box s={[1.25, 0.08, 3]} p={[0, 0.72, 0]} m="steel" />
    <Box s={[1.12, 0.035, 2.78]} p={[0, 0.775, 0]} m="grey" />
    {[-0.48, -0.24, 0, 0.24, 0.48].map((x) => <Strut key={`deck-${x}`} from={[x, 0.8, -1.32]} to={[x, 0.8, 1.32]} w={0.008} m="silver" />)}
    <Box s={[0.1, 0.16, 3]} p={[-0.62, 0.72, 0]} m="grey" />
    <Box s={[0.1, 0.16, 3]} p={[0.62, 0.72, 0]} m="grey" />
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <Strut key={`suspension-${x}-${z}`} from={[x * 0.68, 0.69, z * 0.72]} to={[x * 0.98, 0.42, z * 1.2]} w={0.045} m="steel" />))}
    {[-1, 1].map((x) => (
      <group key={x} position={[x * 0.32, 0, 0.2]}>
        <Box s={[0.52, 0.06, 0.5]} p={[0, 0.95, 0]} m="dark" />
        <Box s={[0.52, 0.5, 0.05]} p={[0, 1.2, 0.27]} m="dark" />
        <Strut from={[-0.26, 0.76, 0.2]} to={[-0.26, 1.42, 0.3]} w={0.02} m="steel" />
        <Strut from={[0.26, 0.76, 0.2]} to={[0.26, 1.42, 0.3]} w={0.02} m="steel" />
        <Strut from={[-0.26, 1.42, 0.3]} to={[0.26, 1.42, 0.3]} w={0.02} m="steel" />
      </group>
    ))}
    <Box s={[0.34, 0.22, 0.12]} p={[0, 1.14, -0.32]} r={[0.5, 0, 0]} m="grey" />
    <Box s={[0.36, 0.24, 0.025]} p={[0, 1.17, -0.39]} r={[0.5, 0, 0]} m="dark" />
    {[-0.11, 0, 0.11].map((x) => <Box key={`display-${x}`} s={[0.055, 0.02, 0.012]} p={[x, 1.18, -0.415]} r={[0.5, 0, 0]} m={x === 0 ? 'gold' : 'solar'} />)}
    <Strut from={[0, 0.76, -0.2]} to={[0, 1.02, -0.3]} w={0.03} m="steel" />
    <Strut from={[0, 0.98, -0.1]} to={[0, 1.2, -0.04]} w={0.02} m="dark" />
    {[-0.17, 0.17].map((x) => <group key={`control-${x}`}>
      <Strut from={[x, 0.98, 0.04]} to={[x, 1.16, 0.02]} w={0.025} m="steel" />
      <Orb r={0.055} p={[x, 1.17, 0.02]} m="dark" />
      <Orb r={0.018} p={[x, 1.19, 0.02]} m="gold" />
    </group>)}
    <Box s={[1.06, 0.46, 0.5]} p={[0, 1.0, -1.1]} m="foil" />
    <Box s={[1.08, 0.03, 0.52]} p={[0, 1.25, -1.1]} m="white" />
    <Strut from={[-0.4, 1.25, -1.15]} to={[-0.4, 2.3, -1.15]} w={0.02} m="steel" />
    <Dish radius={0.62} p={[-0.4, 2.32, -1.15]} r={[0.75, 0.5, 0]} />
    <Strut from={[0.34, 1.25, -1.2]} to={[0.34, 1.95, -1.2]} w={0.022} m="steel" />
    <Box s={[0.2, 0.15, 0.32]} p={[0.34, 2.0, -1.24]} m="white" />
    <Cyl a={[0.06, 0.06, 0.1, 12]} p={[0.34, 2.0, -1.44]} r={[Math.PI / 2, 0, 0]} m="glass" />
    <Cyl a={[0.09, 0.09, 0.08, 12]} p={[0.34, 2.0, -1.37]} r={[Math.PI / 2, 0, 0]} m="steel" />
    <Strut from={[0.20, 1.24, -1.15]} to={[0.20, 1.85, -1.15]} w={0.018} m="steel" />
    <Strut from={[0.48, 1.24, -1.15]} to={[0.48, 1.85, -1.15]} w={0.018} m="steel" />
    <Strut from={[0.20, 1.85, -1.15]} to={[0.48, 1.85, -1.15]} w={0.018} m="steel" />
    <Strut from={[0.54, 1.25, -1.0]} to={[0.54, 2.2, -1.0]} w={0.007} />
    <Box s={[1.1, 0.42, 0.52]} p={[0, 0.98, 1.2]} m="silver" />
    <Box s={[0.86, 0.025, 0.42]} p={[0, 1.205, 1.2]} m="white" />
    {[-0.3, -0.1, 0.1, 0.3].map((x) => <Box key={`tool-${x}`} s={[0.045, 0.015, 0.3]} p={[x, 1.23, 1.2]} m="dark" />)}
    {[-0.3, 0, 0.3].map((x) => <Strut key={x} from={[x, 1.2, 1.2]} to={[x, 1.72, 1.36]} w={0.016} m="steel" />)}
    <Box s={[0.14, 0.42, 0.16]} p={[-0.42, 0.97, 1.22]} m="dark" />
    <Box s={[0.14, 0.42, 0.16]} p={[0.42, 0.97, 1.22]} m="dark" />
  </group>
);

const Pioneer = () => (
  <group position={[0, 1.3, 0]}>
    <Dish radius={1.35} p={[0, 0.2, 0]} />
    {[0, 2.09, 4.18].map((a) => <Strut key={a} from={[Math.cos(a) * 0.9, 0.35, Math.sin(a) * 0.9]} to={[0, 1.2, 0]} w={0.018} m="steel" />)}
    <Cyl a={[0.1, 0.14, 0.16, 12]} p={[0, 1.22, 0]} m="white" />
    <Cyl a={[0.45, 0.45, 0.4, 6]} p={[0, -0.25, 0]} m="foil" />
    <Strut from={[0.3, -0.25, 0]} to={[1.9, -0.25, 0.6]} m="steel" />
    <Cyl a={[0.14, 0.14, 0.6, 10]} p={[1.9, -0.25, 0.6]} r={[0, 0, Math.PI / 2]} m="dark" />
    <Strut from={[-0.3, -0.25, 0]} to={[-1.9, -0.25, 0.6]} m="steel" />
    <Cyl a={[0.14, 0.14, 0.6, 10]} p={[-1.9, -0.25, 0.6]} r={[0, 0, Math.PI / 2]} m="dark" />
    <Strut from={[0, -0.25, -0.3]} to={[0, -0.25, -2.8]} w={0.02} m="steel" />
  </group>
);

const Voyager = () => (
  <group position={[0, 1.3, 0]}>
    <Dish radius={1.5} p={[0, 0.55, 0]} />
    {[0, 2.09, 4.18].map((a) => <Strut key={a} from={[Math.cos(a) * 1.0, 0.72, Math.sin(a) * 1.0]} to={[0, 1.44, 0]} w={0.018} m="steel" />)}
    <Cyl a={[0.11, 0.16, 0.14, 12]} p={[0, 1.46, 0]} m="white" />
    <Cyl a={[0.6, 0.6, 0.36, 10]} p={[0, 0, 0]} m="foil" />
    <mesh position={[0, 0, 0.61]} material={MAT.gold}>
      <circleGeometry args={[0.2, 24]} />
    </mesh>
    <Strut from={[0.5, 0, 0]} to={[2.1, -0.1, 0.1]} m="steel" />
    {[1.6, 1.85, 2.1].map((x) => <Cyl key={x} a={[0.13, 0.13, 0.2, 10]} p={[x, -0.1, 0.1]} r={[0, 0, Math.PI / 2]} m="dark" />)}
    <Strut from={[-0.5, 0, 0]} to={[-2.0, -0.2, 0]} m="steel" />
    <Box s={[0.3, 0.25, 0.3]} p={[-2.0, -0.2, 0]} m="white" />
    <Cyl a={[0.04, 0.04, 0.12, 10]} p={[-2.16, -0.2, 0]} r={[0, 0, Math.PI / 2]} m="glass" />
    <Strut from={[0, -0.1, -0.4]} to={[0, -0.8, -3.6]} w={0.016} m="steel" />
    <Strut from={[0, -0.2, 0]} to={[0, -2.1, 0.7]} w={0.012} m="steel" />
  </group>
);

const Viking = () => (
  <group>
    <Cyl a={[0.76, 0.72, 0.36, 6]} p={[0, 1.0, 0]} m="silver" />
    <Cyl a={[0.72, 0.72, 0.02, 6]} p={[0, 1.19, 0]} m="grey" />
    {[0.5, 2.6, 4.7].map((a) => <LanderLeg key={a} angle={a} top={0.9} foot={0} r={1.45} />)}
    {VIKING_ENGINES.map((a) => (
      <group key={a}>
        <Nozzle p={on(a, 0.56, 0.78)} size={1.05} />
        <Orb r={0.16} p={on(a + 0.55, 0.46, 0.76)} />
      </group>
    ))}
    <Strut from={[0, 1.2, 0]} to={[0, 1.75, 0]} w={0.05} m="steel" />
    <Dish radius={0.48} p={[0, 1.78, 0]} r={[0.6, 0.5, 0]} />
    <Cyl a={[0.1, 0.1, 0.5, 14]} p={[0.4, 1.42, 0.25]} m="white" />
    <Cyl a={[0.1, 0.1, 0.5, 14]} p={[-0.2, 1.42, 0.42]} m="white" />
    <Box s={[0.3, 0.38, 0.4]} p={[0.5, 1.4, -0.3]} m="foil" />
    <Box s={[0.34, 0.2, 0.26]} p={[-0.42, 1.3, -0.2]} m="gold" />
    <Strut from={[-0.5, 1.2, 0]} to={[-1.5, 0.6, 0.7]} m="steel" />
    <Box s={[0.2, 0.12, 0.2]} p={[-1.5, 0.55, 0.7]} m="dark" />
    <Strut from={[0.2, 1.2, -0.4]} to={[0.2, 2.1, -0.5]} w={0.018} />
    <Box s={[0.14, 0.14, 0.14]} p={[0.2, 2.15, -0.5]} m="white" />
  </group>
);

const Sojourner = () => (
  <group scale={1.5}>
    {[-1, 1].map((side) => (
      <group key={side}>
        <CleatWheel p={[side * 0.52, 0.14, -0.55]} r={0.14} w={0.13} m="silver" />
        <CleatWheel p={[side * 0.52, 0.14, 0]} r={0.14} w={0.13} m="silver" />
        <CleatWheel p={[side * 0.52, 0.14, 0.55]} r={0.14} w={0.13} m="silver" />
        <Strut from={[side * 0.42, 0.32, -0.1]} to={[side * 0.5, 0.14, 0.55]} w={0.016} m="steel" />
        <Strut from={[side * 0.42, 0.32, -0.1]} to={[side * 0.5, 0.26, -0.3]} w={0.016} m="steel" />
        <Strut from={[side * 0.5, 0.26, -0.3]} to={[side * 0.5, 0.14, -0.55]} w={0.014} m="steel" />
        <Strut from={[side * 0.5, 0.26, -0.3]} to={[side * 0.5, 0.14, 0]} w={0.014} m="steel" />
      </group>
    ))}
    <Cyl a={[0.014, 0.014, 0.9, 8]} p={[0, 0.32, -0.1]} r={[0, 0, Math.PI / 2]} m="steel" />
    {/* Differential linkage */}
    <Box s={[0.68, 0.22, 0.88]} p={[0, 0.39, 0]} m="foil" />
    <Box s={[0.62, 0.18, 0.82]} p={[0, 0.4, 0]} m="gold" />
    <Box s={[0.94, 0.02, 1.22]} p={[0, 0.54, 0]} m="solar" />
    <Box s={[0.97, 0.014, 1.25]} p={[0, 0.525, 0]} m="steel" />
    <Strut from={[0.28, 0.55, 0.18]} to={[0.28, 1.02, 0.18]} w={0.008} m="steel" />
    <Orb r={0.02} p={[0.28, 1.03, 0.18]} m="white" />
    {/* Stereo Hazcams */}
    <Box s={[0.28, 0.08, 0.08]} p={[0, 0.36, -0.46]} m="white" />
    {[-0.08, 0.08].map((x) => <Cyl key={x} a={[0.024, 0.024, 0.05, 10]} p={[x, 0.36, -0.52]} r={[Math.PI / 2, 0, 0]} m="glass" />)}
    {/* Rear APXS head */}
    <Strut from={[0, 0.34, 0.44]} to={[0, 0.2, 0.68]} w={0.014} m="steel" />
    <Cyl a={[0.05, 0.05, 0.1, 12]} p={[0, 0.17, 0.72]} m="gold" />
    <Cyl a={[0.036, 0.036, 0.04, 12]} p={[0, 0.12, 0.72]} m="dark" />
  </group>
);

const Mer = () => (
  <group>
    <Wheels x={0.95} zs={[-0.85, 0, 0.85]} y={0.26} r={0.26} w={0.24} m="grey" />
    <Box s={[1.2, 0.5, 1.5]} p={[0, 0.78, 0]} m="white" />
    <Box s={[2.9, 0.04, 1.9]} p={[0, 1.08, 0.1]} m="solar" />
    <Box s={[1.2, 0.03, 0.75]} p={[0, 1.1, 1.45]} m="solar" />
    <Strut from={[0.72, 0.7, 0]} to={[0.95, 0.26, 0.85]} />
    <Strut from={[-0.72, 0.7, 0]} to={[-0.95, 0.26, 0.85]} />
    <Strut from={[0, 1.1, -0.65]} to={[0, 2.2, -0.65]} w={0.05} />
    <Box s={[0.52, 0.16, 0.14]} p={[0, 2.25, -0.65]} m="white" />
    <Strut from={[0.3, 0.7, -0.8]} to={[0.8, 0.7, -1.4]} />
    <Box s={[0.18, 0.18, 0.18]} p={[0.85, 0.62, -1.45]} m="dark" />
  </group>
);

const Curiosity = () => (
  <group scale={1.15}>
    <Wheels x={1.1} zs={[-1.05, 0, 1.05]} y={0.32} r={0.32} w={0.3} m="grey" />
    <Box s={[1.4, 0.55, 1.9]} p={[0, 0.98, 0]} m="white" />
    <Box s={[1.55, 0.05, 2.1]} p={[0, 1.29, 0]} m="grey" />
    <Strut from={[0.72, 0.85, 0]} to={[1.1, 0.32, 1.05]} w={0.05} />
    <Strut from={[-0.72, 0.85, 0]} to={[-1.1, 0.32, 1.05]} w={0.05} />
    <Strut from={[0.72, 0.85, 0]} to={[1.1, 0.32, -1.05]} w={0.05} />
    <Strut from={[-0.72, 0.85, 0]} to={[-1.1, 0.32, -1.05]} w={0.05} />
    <Cyl a={[0.28, 0.32, 0.8, 10]} p={[0, 1.2, 1.25]} r={[1.1, 0, 0]} m="dark" />
    <Strut from={[0.45, 1.3, -0.75]} to={[0.45, 2.6, -0.75]} w={0.06} />
    <Box s={[0.62, 0.3, 0.28]} p={[0.45, 2.7, -0.75]} m="white" />
    <Cyl a={[0.25, 0.25, 0.05, 16]} p={[-0.45, 1.5, 0.35]} m="dish" />
    <Strut from={[0.5, 0.9, -1]} to={[0.8, 1.05, -1.8]} w={0.05} />
    <Box s={[0.32, 0.3, 0.32]} p={[0.8, 0.95, -1.9]} m="dark" />
  </group>
);

const Ingenuity = () => (
  <group scale={1.8}>
    <Box s={[0.32, 0.26, 0.32]} p={[0, 0.5, 0]} m="foil" />
    <Cyl a={[0.012, 0.012, 0.75, 8]} p={[0, 0.9, 0]} />
    <Box s={[1.5, 0.012, 0.12]} p={[0, 0.82, 0]} m="white" />
    <Box s={[1.5, 0.012, 0.12]} p={[0, 1.0, 0]} r={[0, 1.2, 0]} m="white" />
    <Box s={[0.42, 0.012, 0.32]} p={[0, 1.28, 0]} m="solar" />
    {[0.78, 2.35, 3.93, 5.5].map((a) => <Strut key={a} from={[Math.cos(a) * 0.12, 0.42, Math.sin(a) * 0.12]} to={[Math.cos(a) * 0.46, 0.015, Math.sin(a) * 0.46]} w={0.009} />)}
  </group>
);

const NewHorizons = () => (
  <group position={[0, 1.3, 0]}>
    <Dish radius={1.05} p={[0, 0.45, 0]} />
    <Strut from={[0, 0.4, 0]} to={[0, 1.2, 0]} w={0.03} />
    <mesh position={[0, 0, 0]} material={MAT.gold} castShadow>
      <cylinderGeometry args={[0.9, 0.9, 0.55, 3]} />
    </mesh>
    <Strut from={[-0.6, 0, 0]} to={[-1.5, -0.1, 0.1]} w={0.05} />
    <Cyl a={[0.2, 0.2, 0.85, 10]} p={[-1.7, -0.1, 0.1]} r={[0, 0, Math.PI / 2]} m="dark" />
    <Box s={[0.28, 0.24, 0.34]} p={[0.7, 0.05, 0.1]} m="white" />
  </group>
);

const PROCEDURAL: Record<ModelId, () => ReactNode> = {
  ranger: Ranger, surveyor: Surveyor, descent: Descent, lrrr: Lrrr, lrv: Lrv, pioneer: Pioneer, voyager: Voyager, viking: Viking,
  sojourner: Sojourner, mer: Mer, curiosity: Curiosity, perseverance: Curiosity, ingenuity: Ingenuity, newhorizons: NewHorizons,
};

/** NASA's published models. `span` is the size of the largest side in scene units. */
const ASSETS: Partial<Record<ModelId, { span: number; float?: boolean; turnY?: number; keepBelow?: number }>> = {
  // NASA's rovers face +z in their files; the game drives toward -z.
  lrv: { span: 2.7 },
  curiosity: { span: 4.4, turnY: Math.PI },
  perseverance: { span: 4.4, turnY: Math.PI },
  mer: { span: 3.4, turnY: Math.PI },
  ingenuity: { span: 3.2 },
  viking: { span: 3.1 },
  descent: { span: 4.4, keepBelow: 0.5 }, // only the lower stage stayed on the Moon
  pioneer: { span: 5.2, float: true },
  voyager: { span: 8, float: true },
  newhorizons: { span: 3.6, float: true },
};

const FLOAT_HEIGHT = 1.3;

function visibleBounds(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  root.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh) box.union(part.setFromObject(o, true));
  });
  return box;
}

function NasaModel({ id, variant }: { id: ModelId; variant?: 'home' }) {
  const asset = ASSETS[id]!;
  const urlId = variant === 'home' && id === 'lrv' ? 'lrv-home' : id;
  const { scene } = useGLTF(modelUrl(urlId), false, true);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    if (asset.keepBelow !== undefined) {
      copy.updateMatrixWorld(true);
      const whole = new THREE.Box3().setFromObject(copy, true);
      const cutoff = whole.min.y + (whole.max.y - whole.min.y) * asset.keepBelow;
      const part = new THREE.Box3();
      copy.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && part.setFromObject(o, true).getCenter(new THREE.Vector3()).y > cutoff) o.visible = false;
      });
    }
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox();
      const msize = mesh.geometry.boundingBox ? mesh.geometry.boundingBox.getSize(new THREE.Vector3()) : null;
      // Micro-screws and thin harnesses don't cast visible 1024px shadows; skipping them keeps frame times fast.
      mesh.castShadow = !msize || Math.max(msize.x, msize.y, msize.z) >= 0.08;
      mesh.receiveShadow = true;
      // Without a reflection map, fully metallic surfaces would render nearly black.
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material.isMeshStandardMaterial && material.metalness > 0.65) material.metalness = 0.65;
    });
    if (asset.turnY) copy.rotation.y = asset.turnY;
    copy.updateMatrixWorld(true);
    const box = visibleBounds(copy);
    const size = box.getSize(new THREE.Vector3());
    const k = asset.span / Math.max(size.x, size.y, size.z);
    const center = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    holder.add(copy);
    // The LRV export is centered on its wheels, not its asymmetric antenna bounds.
    copy.position.set(id === 'lrv' ? 0 : -center.x, asset.float ? -center.y : -box.min.y, id === 'lrv' ? 0 : -center.z);
    holder.scale.setScalar(k);
    return holder;
  }, [scene, asset, id]);
  return <primitive object={model} position={asset.float ? [0, FLOAT_HEIGHT, 0] : [0, 0, 0]} />;
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function HardwareModel({ id, variant }: { id: ModelId; variant?: 'home' }) {
  const Fallback = PROCEDURAL[id];
  const quality = useGame((s) => s.quality);
  if (!ASSETS[id] || (id === 'lrv' && quality === 'low')) return <Fallback />;
  return (
    <ModelBoundary fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}>
        <NasaModel id={id} variant={variant} />
      </Suspense>
    </ModelBoundary>
  );
}
