import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { ModelId } from '../data/types';

const mat = (color: string, roughness = 0.5, metalness = 0.1, side: THREE.Side = THREE.FrontSide) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side });

const MAT = {
  white: mat('#e7e4dc'),
  grey: mat('#8d9096', 0.4, 0.6),
  dark: mat('#2a2c33', 0.75),
  gold: mat('#cf9a3a', 0.28, 0.85),
  foil: mat('#b98a3e', 0.4, 0.7),
  solar: mat('#18305f', 0.22, 0.65),
  copper: mat('#a86a3c', 0.4, 0.7),
  glass: mat('#6d7a8c', 0.15, 0.8),
  dish: mat('#d8d6d0', 0.5, 0.2, THREE.DoubleSide),
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

const Ranger = () => (
  <group position={[0, 1.2, 0]}>
    <Cyl a={[0.6, 0.6, 0.4, 6]} m="gold" />
    <Cyl a={[0.2, 0.55, 1.5, 12]} p={[0, 0.95, 0]} m="white" />
    <Box s={[1.5, 0.04, 0.8]} p={[-1.35, 0, 0]} m="solar" />
    <Box s={[1.5, 0.04, 0.8]} p={[1.35, 0, 0]} m="solar" />
    <Dish radius={0.55} p={[0, -0.9, 0]} r={[Math.PI, 0, 0]} />
    <Strut from={[0, -0.2, 0]} to={[0, -0.8, 0]} />
  </group>
);

const Surveyor = () => (
  <group>
    <Cyl a={[0.3, 0.42, 0.55, 6]} p={[0, 1.2, 0]} m="foil" />
    {[0.5, 2.6, 4.7].map((a) => <LanderLeg key={a} angle={a} top={1.05} foot={0} r={1.35} />)}
    <Strut from={[0, 1.45, 0]} to={[0, 3.1, 0]} w={0.05} />
    <Box s={[0.95, 0.03, 0.75]} p={[0, 3.1, 0]} r={[0.55, 0, 0]} m="solar" />
    <Box s={[0.5, 0.03, 0.5]} p={[0.55, 2.55, 0.25]} r={[0.2, 0, 0.3]} m="dish" />
    <Cyl a={[0.1, 0.1, 0.42, 10]} p={[-0.45, 1.75, 0.3]} m="white" r={[0.3, 0, 0]} />
    <Box s={[0.28, 0.4, 0.28]} p={[0.45, 1.65, -0.35]} m="white" />
  </group>
);

const Descent = () => (
  <group>
    <Cyl a={[1.05, 1.05, 1.0, 8]} p={[0, 1.3, 0]} m="gold" />
    <Box s={[1.6, 0.05, 1.6]} p={[0, 1.83, 0]} m="foil" />
    {[0.78, 2.35, 3.93, 5.5].map((a) => <LanderLeg key={a} angle={a} top={1.05} foot={0} r={2.05} />)}
    <Cyl a={[0.4, 0.6, 0.5, 14]} p={[0, 0.58, 0]} m="dark" />
    <Box s={[0.44, 0.02, 0.28]} p={[1.05, 1.3, 0]} r={[0, 0, Math.PI / 2]} m="grey" />
  </group>
);

const Lrrr = () => (
  <group scale={1.6} position={[0, 0.02, 0]}>
    <Box s={[0.7, 0.04, 0.5]} p={[0, 0.03, 0]} m="foil" />
    <Strut from={[-0.2, 0.05, -0.1]} to={[-0.2, 0.42, -0.1]} />
    <Strut from={[0.2, 0.05, -0.1]} to={[0.2, 0.42, -0.1]} />
    <group position={[0, 0.5, 0]} rotation={[-0.6, 0, 0]}>
      <Box s={[0.84, 0.08, 0.84]} m="grey" />
      {Array.from({ length: 10 }).flatMap((_, i) =>
        Array.from({ length: 10 }).map((__, j) => (
          <mesh key={`${i}-${j}`} position={[-0.36 + i * 0.08, 0.042, -0.36 + j * 0.08]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.glass}>
            <circleGeometry args={[0.034, 10]} />
          </mesh>
        )),
      )}
    </group>
  </group>
);

const Lrv = () => (
  <group>
    <Wheels x={0.95} zs={[-1.15, 1.15]} y={0.42} r={0.42} w={0.24} m="foil" />
    <Box s={[1.4, 0.1, 2.8]} p={[0, 0.72, 0]} m="grey" />
    <Box s={[0.55, 0.08, 0.5]} p={[-0.34, 0.92, 0.1]} m="dark" />
    <Box s={[0.55, 0.08, 0.5]} p={[0.34, 0.92, 0.1]} m="dark" />
    <Box s={[0.55, 0.5, 0.06]} p={[-0.34, 1.16, 0.36]} m="dark" />
    <Box s={[0.55, 0.5, 0.06]} p={[0.34, 1.16, 0.36]} m="dark" />
    <Box s={[1.0, 0.4, 0.5]} p={[0, 0.98, -1.05]} m="foil" />
    <Strut from={[0, 0.8, -0.55]} to={[0, 1.5, -0.55]} />
    <Box s={[0.3, 0.2, 0.1]} p={[0, 1.55, -0.55]} m="dark" />
    <Strut from={[0.55, 1.1, -0.9]} to={[0.55, 2, -0.9]} />
    <Dish radius={0.5} p={[0.55, 2, -0.9]} r={[0.8, 0, 0]} />
    <Box s={[0.8, 0.5, 0.5]} p={[0, 0.98, 1.15]} m="grey" />
  </group>
);

const Pioneer = () => (
  <group position={[0, 1.3, 0]}>
    <Dish radius={1.35} p={[0, 0.2, 0]} />
    <Cyl a={[0.45, 0.45, 0.4, 6]} p={[0, -0.25, 0]} m="foil" />
    <Strut from={[0, 0.2, 0]} to={[0, 1.2, 0]} w={0.03} />
    <Strut from={[0.3, -0.25, 0]} to={[1.9, -0.25, 0.6]} />
    <Cyl a={[0.14, 0.14, 0.6, 10]} p={[1.9, -0.25, 0.6]} r={[0, 0, Math.PI / 2]} m="dark" />
    <Strut from={[-0.3, -0.25, 0]} to={[-1.9, -0.25, 0.6]} />
    <Cyl a={[0.14, 0.14, 0.6, 10]} p={[-1.9, -0.25, 0.6]} r={[0, 0, Math.PI / 2]} m="dark" />
    <Strut from={[0, -0.25, -0.3]} to={[0, -0.25, -2.8]} w={0.02} />
  </group>
);

const Voyager = () => (
  <group position={[0, 1.3, 0]}>
    <Dish radius={1.5} p={[0, 0.55, 0]} />
    <Strut from={[0, 0.5, 0]} to={[0, 1.4, 0]} w={0.03} />
    <Cyl a={[0.6, 0.6, 0.36, 10]} p={[0, 0, 0]} m="foil" />
    <mesh position={[0, 0, 0.61]} material={MAT.gold}>
      <circleGeometry args={[0.2, 24]} />
    </mesh>
    <Strut from={[0.5, 0, 0]} to={[2.1, -0.1, 0.1]} />
    {[1.6, 1.85, 2.1].map((x) => <Cyl key={x} a={[0.13, 0.13, 0.2, 10]} p={[x, -0.1, 0.1]} r={[0, 0, Math.PI / 2]} m="dark" />)}
    <Strut from={[-0.5, 0, 0]} to={[-2.0, -0.2, 0]} />
    <Box s={[0.3, 0.25, 0.3]} p={[-2.0, -0.2, 0]} m="white" />
    <Strut from={[0, -0.1, -0.4]} to={[0, -0.8, -3.6]} w={0.016} />
    <Strut from={[0, -0.2, 0]} to={[0, -2.1, 0.7]} w={0.012} />
  </group>
);

const Viking = () => (
  <group>
    <Cyl a={[0.72, 0.72, 0.36, 6]} p={[0, 1.0, 0]} m="grey" />
    {[0.5, 2.6, 4.7].map((a) => <LanderLeg key={a} angle={a} top={0.9} foot={0} r={1.45} />)}
    <Strut from={[0, 1.2, 0]} to={[0, 1.75, 0]} w={0.05} />
    <Dish radius={0.48} p={[0, 1.78, 0]} r={[0.6, 0.5, 0]} />
    <Cyl a={[0.1, 0.1, 0.5, 10]} p={[0.4, 1.42, 0.25]} m="white" />
    <Cyl a={[0.1, 0.1, 0.5, 10]} p={[-0.2, 1.42, 0.42]} m="white" />
    <Box s={[0.3, 0.38, 0.4]} p={[0.5, 1.24, -0.3]} m="dark" />
    <Strut from={[-0.5, 1.2, 0]} to={[-1.5, 0.6, 0.7]} />
    <Box s={[0.2, 0.12, 0.2]} p={[-1.5, 0.55, 0.7]} m="dark" />
    <Strut from={[0.2, 1.2, -0.4]} to={[0.2, 2.1, -0.5]} w={0.018} />
    <Box s={[0.14, 0.14, 0.14]} p={[0.2, 2.15, -0.5]} m="white" />
  </group>
);

const Sojourner = () => (
  <group scale={1.5}>
    <Wheels x={0.52} zs={[-0.55, 0, 0.55]} y={0.14} r={0.14} w={0.13} m="grey" />
    <Box s={[0.72, 0.22, 0.9]} p={[0, 0.38, 0]} m="foil" />
    <Box s={[0.92, 0.03, 1.2]} p={[0, 0.54, 0]} m="solar" />
    <Strut from={[0.38, 0.28, 0]} to={[0.52, 0.14, 0.55]} />
    <Strut from={[-0.38, 0.28, 0]} to={[-0.52, 0.14, 0.55]} />
    <Strut from={[0.25, 0.52, -0.1]} to={[0.25, 1.0, -0.1]} w={0.012} />
    <Box s={[0.14, 0.09, 0.12]} p={[0, 0.34, -0.55]} m="white" />
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

const MODELS: Record<ModelId, () => ReactNode> = {
  ranger: Ranger, surveyor: Surveyor, descent: Descent, lrrr: Lrrr, lrv: Lrv, pioneer: Pioneer, voyager: Voyager, viking: Viking,
  sojourner: Sojourner, mer: Mer, curiosity: Curiosity, ingenuity: Ingenuity, newhorizons: NewHorizons,
};

export function HardwareModel({ id }: { id: ModelId }) {
  const M = MODELS[id];
  return <M />;
}
