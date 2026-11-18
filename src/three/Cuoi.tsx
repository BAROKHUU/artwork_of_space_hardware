import { useRef, type RefObject } from 'react';
import { RoundedBox, useTexture } from '@react-three/drei';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import { mediaUrl } from '../media';
import * as THREE from 'three';
import { prefersReducedMotion } from './GameCanvas';

// Shared matte materials and modestly segmented forms match Echo's handcrafted look.
const material = (color: string, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness, flatShading: true });
const skin = material('#c89270'), hair = material('#211b19'), shirt = material('#75503d');
const dark = material('#382621'), pants = material('#392b28'), sash = material('#4b2826');
const white = material('#eee6d4'), black = material('#242321'), wood = material('#c29a66');
const iron = material('#535353', 0.65), lip = material('#945e50'), patch = material('#997756');

// Sweep a single folded ribbon from the front hem, over the shoulder, to the back hem.
// The two surfaces share an outline closed by side and end faces, giving the cloth thickness.
function makeScarfGeometry() {
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.30, 1.08, 0.29),
    new THREE.Vector3(0.29, 1.31, 0.275),
    new THREE.Vector3(0.28, 1.56, 0.27),
    new THREE.Vector3(0.28, 1.69, 0.23),
    new THREE.Vector3(0.28, 1.76, 0.12),
    new THREE.Vector3(0.29, 1.77, -0.02),
    new THREE.Vector3(0.30, 1.73, -0.17),
    new THREE.Vector3(0.31, 1.61, -0.255),
    new THREE.Vector3(0.33, 1.38, -0.27),
    new THREE.Vector3(0.34, 1.21, -0.29),
  ]);
  const rows = 80, columns = 12, stride = columns + 1;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let layer = 0; layer < 2; layer++) {
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const center = path.getPointAt(t);
      const tangent = path.getTangentAt(t);
      const normal = new THREE.Vector3(0, -tangent.z, tangent.y).normalize();
      for (let col = 0; col <= columns; col++) {
        const u = col / columns;
        const width = 0.215 + 0.018 * Math.sin(t * Math.PI * 1.5);
        // Long, shallow folds and a softly uneven hem keep the cloth from reading as a board.
        const folds = 0.009 * Math.sin(u * Math.PI * 5 + t * 2) + 0.004 * Math.sin(t * 22 + u * 4);
        const end = Math.pow(Math.abs(2 * t - 1), 16);
        const p = center.clone().addScaledVector(normal, folds + (layer === 0 ? 0.006 : -0.006));
        p.x += (u - 0.5) * width;
        p.y += end * 0.012 * Math.sin(u * Math.PI * 2 + t * 3);
        positions.push(p.x, p.y, p.z);
        uvs.push(u, t * 8);
      }
    }
  }
  const layerSize = (rows + 1) * stride;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * stride + col, b = a + stride;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
    indices.push(a + layerSize, b + layerSize, a + 1 + layerSize, a + 1 + layerSize, b + layerSize, b + 1 + layerSize);
  }
  // Join the two layers around the entire perimeter.
  const edge = (a: number, b: number) => indices.push(a, b, a + layerSize, b, b + layerSize, a + layerSize);
  for (let row = 0; row < rows; row++) {
    edge(row * stride, (row + 1) * stride);
    edge((row + 1) * stride + columns, row * stride + columns);
  }
  for (let col = 0; col < columns; col++) {
    edge(col + 1, col);
    edge(rows * stride + col, rows * stride + col + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const scarfGeometry = makeScarfGeometry();

function Limb({ from, to, radius, surface }: { from: [number, number, number]; to: [number, number, number]; radius: number; surface: THREE.Material }) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  return <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={q} material={surface} castShadow><cylinderGeometry args={[radius * 0.9, radius, delta.length(), 8]} /></mesh>;
}

function Foot() {
  return <group name="wooden-sandal" position={[0, -0.28, 0]}>
    <RoundedBox args={[0.25, 0.08, 0.45]} radius={0.04} position={[0, 0.09, 0.07]} material={wood} castShadow />
    <RoundedBox args={[0.19, 0.07, 0.15]} radius={0.02} position={[0, 0.035, -0.07]} material={wood} />
    <mesh position={[0, 0.16, 0.08]} scale={[0.105, 0.065, 0.18]} material={skin}><sphereGeometry args={[1, 12, 8]} /></mesh>
    <RoundedBox args={[0.26, 0.045, 0.13]} radius={0.02} position={[0, 0.19, 0.07]} material={black} />
    {[-1, 1].map((s) => <mesh key={s} position={[s * 0.12, 0.16, 0.07]} rotation={[0, 0, Math.PI / 2]} material={iron}><cylinderGeometry args={[0.012, 0.012, 0.008, 8]} /></mesh>)}
  </group>;
}

function Head({ headRef, tailRef }: { headRef?: RefObject<THREE.Group | null>; tailRef?: RefObject<THREE.Group | null> }) {
  return <group ref={headRef} name="head" position={[0, 2.07, 0]}>
    <RoundedBox args={[0.51, 0.61, 0.43]} radius={0.14} smoothness={3} material={skin} castShadow />
    {[-1, 1].map((s) => <group key={s}>
      <mesh position={[s * 0.26, -0.02, 0]} scale={[0.055, 0.09, 0.05]} material={skin}><sphereGeometry args={[1, 10, 8]} /></mesh>
      <mesh position={[s * 0.105, 0.025, 0.216]} scale={[0.06, 0.035, 0.018]} material={white}><sphereGeometry args={[1, 12, 8]} /></mesh>
      <mesh position={[s * 0.105, 0.025, 0.232]} scale={[0.027, 0.028, 0.012]} material={hair}><sphereGeometry args={[1, 12, 8]} /></mesh>
      <mesh position={[s * 0.105, 0.10, 0.219]} rotation={[0, 0, -s * 0.06]} material={hair}><boxGeometry args={[0.12, 0.018, 0.015]} /></mesh>
    </group>)}
    <mesh position={[0, -0.04, 0.23]} scale={[0.04, 0.07, 0.045]} material={skin}><sphereGeometry args={[1, 10, 8]} /></mesh>
    <mesh position={[0, -0.14, 0.216]} scale={[0.075, 0.015, 0.012]} material={lip}><sphereGeometry args={[1, 12, 8]} /></mesh>
    <mesh name="hair" position={[0, 0.26, -0.015]} scale={[0.27, 0.16, 0.23]} material={hair}><sphereGeometry args={[1, 12, 8]} /></mesh>
    <RoundedBox name="headband" args={[0.54, 0.08, 0.46]} radius={0.035} position={[0, 0.18, 0]} material={dark} />
    <group ref={tailRef} position={[0.15, 0.16, -0.23]} rotation={[0.2, 0, 0.25]}>
      <mesh name="headband-tail" position={[0, -0.12, 0]} material={dark}><boxGeometry args={[0.09, 0.32, 0.025]} /></mesh>
    </group>
  </group>;
}

function Axe() {
  return <group name="axe">
    <Limb from={[-0.66, 1.66, 0.28]} to={[0.20, 1.91, -0.30]} radius={0.04} surface={wood} />
    <mesh name="axe-head" position={[0.19, 1.91, -0.30]} rotation={[0, 0.45, -0.2]} material={iron} castShadow><boxGeometry args={[0.13, 0.28, 0.27]} /></mesh>
    <mesh position={[0.20, 1.91, -0.45]} rotation={[0, 0.45, -0.2]} material={iron}><boxGeometry args={[0.11, 0.36, 0.05]} /></mesh>
  </group>;
}

export function Cuoi({
  movingRef,
  workingRef,
  runningRef,
  sprintingRef,
  handRef,
  ...props
}: ThreeElements['group'] & {
  movingRef?: RefObject<boolean>;
  workingRef?: RefObject<boolean>;
  runningRef?: RefObject<boolean>;
  sprintingRef?: RefObject<boolean>;
  handRef?: RefObject<THREE.Group | null>;
}) {
  const body = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftFoot = useRef<THREE.Group>(null);
  const rightFoot = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);
  const moveBlend = useRef(0);
  const runBlend = useRef(0);
  const flyBlend = useRef(0);
  const scarfTexture = useTexture(mediaUrl('assets/textures/khan-ran-weave.png'));
  scarfTexture.colorSpace = THREE.SRGBColorSpace;
  scarfTexture.wrapS = scarfTexture.wrapT = THREE.RepeatWrapping;
  scarfTexture.repeat.set(0.5, 0.5);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const moving = movingRef?.current ?? false;
    const working = workingRef?.current ?? false;
    const sprinting = !working && (sprintingRef?.current ?? false);
    const running = moving && !sprinting && (runningRef?.current ?? false);
    const reduced = prefersReducedMotion();
    const k = 1 - Math.exp(-10 * dt);
    const flyRate = 1 - Math.exp(-8 * dt);
    moveBlend.current += ((moving && !sprinting ? 1 : 0) - moveBlend.current) * k;
    runBlend.current += ((running ? 1 : 0) - runBlend.current) * k;
    flyBlend.current += ((sprinting ? 1 : 0) - flyBlend.current) * flyRate;
    const m = moveBlend.current;
    const r = runBlend.current;
    const fly = flyBlend.current;
    const fast = Math.max(r, fly);
    const rate = fly > 0.25 ? 7.5 : THREE.MathUtils.lerp(2.2, THREE.MathUtils.lerp(7.5, 14.8, r), m);
    phaseRef.current += dt * rate;
    const phase = phaseRef.current;

    const stride = THREE.MathUtils.lerp(0.42, 0.94, r) * m;
    const armSwing = THREE.MathUtils.lerp(0.26, 0.88, r) * m;
    const walkLeftHip = Math.sin(phase) * stride;
    const walkRightHip = Math.sin(phase + Math.PI) * stride;
    const walkLeftAnkle = Math.sin(phase - 0.5) * (0.16 * m + 0.34 * r);
    const walkRightAnkle = Math.sin(phase + Math.PI - 0.5) * (0.16 * m + 0.34 * r);
    const walkRightArmX = Math.sin(phase) * armSwing - 0.14 * r * m;
    const walkLeftArmX = Math.sin(phase + Math.PI) * (0.08 * m + 0.14 * r);

    const flutter = reduced ? 0 : Math.sin(phase * 1.15);
    const flyLeftHip = 0.64 + flutter * 0.16;
    const flyRightHip = 0.64 - flutter * 0.16;
    const flyLeftAnkle = 0.28 + flutter * 0.14;
    const flyRightAnkle = 0.28 - flutter * 0.14;

    if (!reduced) {
      const stepBounce = Math.abs(Math.sin(phase)) * (0.055 * m + 0.08 * r) * (1 - fly);
      if (body.current) {
        body.current.position.y = stepBounce;
        body.current.rotation.z = -0.06 * fly;
      }
      if (upper.current) {
        upper.current.position.y = Math.sin(phase) * 0.008 * (1 - Math.max(m, fly));
        upper.current.rotation.x = 0.26 * r * (1 - fly) + 0.46 * fly;
        upper.current.rotation.y = Math.sin(phase) * 0.12 * r * (1 - fly) + 0.04 * fly;
        upper.current.rotation.z = working ? Math.sin(clock.elapsedTime * 5) * 0.035 : -0.05 * fly;
      }
      if (head.current) {
        head.current.rotation.x = -0.18 * r * (1 - fly) - 0.38 * fly;
        head.current.rotation.y = 0.14 * fly + Math.sin(clock.elapsedTime * 2.5) * 0.04 * fly;
        head.current.rotation.z = -0.05 * fly;
      }
      if (tail.current) {
        const wave = fast > 0.08 ? Math.sin(clock.elapsedTime * (fly > 0.4 ? 19 : 14)) * 0.24 * fast : 0;
        tail.current.rotation.x = 0.2 + 0.25 * m + 0.55 * fast + wave;
      }
    } else {
      if (body.current) body.current.rotation.z = -0.04 * fly;
      if (upper.current) {
        upper.current.rotation.x = 0.46 * fly;
        upper.current.rotation.y = 0;
        upper.current.rotation.z = 0;
      }
      if (head.current) {
        head.current.rotation.x = -0.38 * fly;
        head.current.rotation.y = 0.12 * fly;
        head.current.rotation.z = 0;
      }
    }

    if (leftLeg.current) leftLeg.current.rotation.x = THREE.MathUtils.lerp(walkLeftHip, flyLeftHip, fly);
    if (rightLeg.current) rightLeg.current.rotation.x = THREE.MathUtils.lerp(walkRightHip, flyRightHip, fly);
    if (leftFoot.current) leftFoot.current.rotation.x = THREE.MathUtils.lerp(walkLeftAnkle, flyLeftAnkle, fly);
    if (rightFoot.current) rightFoot.current.rotation.x = THREE.MathUtils.lerp(walkRightAnkle, flyRightAnkle, fly);
    if (rightArm.current) {
      rightArm.current.rotation.x = THREE.MathUtils.lerp(walkRightArmX, -0.16, fly);
      rightArm.current.rotation.y = THREE.MathUtils.lerp(0, 0.12, fly);
      rightArm.current.rotation.z = THREE.MathUtils.lerp(0.08 * r * m, 1.38, fly);
    }
    if (leftArm.current) {
      leftArm.current.rotation.x = THREE.MathUtils.lerp(walkLeftArmX, -0.14, fly);
      leftArm.current.rotation.z = THREE.MathUtils.lerp(0.06 * r * m, 0.22, fly);
    }
  });
  return <group name="Cuoi" {...props}>
    <group ref={body}>
      <group name="trousers">
        {[-1, 1].map((s) => <group key={s} ref={s < 0 ? leftLeg : rightLeg} position={[s * 0.19, 0.96, 0]}>
          <RoundedBox args={[0.34, 0.83, 0.34]} radius={0.1} position={[0, -0.31, 0]} material={pants} castShadow />
          {s < 0 && <mesh position={[0, -0.31, 0.176]} rotation={[0, 0, 0.08]} material={patch}><boxGeometry args={[0.20, 0.21, 0.01]} /></mesh>}
          <group ref={s < 0 ? leftFoot : rightFoot} position={[0, -0.68, 0]}>
            <mesh position={[0, -0.07, 0]} material={skin}><cylinderGeometry args={[0.09, 0.08, 0.17, 8]} /></mesh>
            <Foot />
          </group>
        </group>)}
      </group>
      <group ref={upper} name="upper-body">
        <RoundedBox name="tunic" args={[0.75, 0.85, 0.43]} radius={0.1} position={[0, 1.32, 0]} material={shirt} castShadow />
        <Limb from={[-0.20, 1.72, 0.22]} to={[0.18, 1.30, 0.23]} radius={0.022} surface={dark} />
        <Limb from={[0.20, 1.72, 0.22]} to={[0.02, 1.52, 0.24]} radius={0.022} surface={dark} />
        <RoundedBox name="waist-sash" args={[0.77, 0.14, 0.46]} radius={0.035} position={[0, 1.03, 0]} material={sash} />
        <RoundedBox args={[0.13, 0.40, 0.05]} radius={0.02} position={[-0.25, 0.85, 0.24]} rotation={[0, 0, -0.12]} material={sash} />
        <mesh position={[0, 1.78, 0]} material={skin}><cylinderGeometry args={[0.12, 0.13, 0.19, 10]} /></mesh>
        <Head headRef={head} tailRef={tail} />
        <group name="arms">
          <group ref={leftArm} position={[-0.37, 1.62, 0]}>
            <Limb from={[0, 0, 0]} to={[-0.20, -0.27, 0.02]} radius={0.14} surface={shirt} />
            <Limb from={[-0.20, -0.27, 0.02]} to={[-0.18, 0.06, 0.25]} radius={0.085} surface={skin} />
            <mesh position={[-0.18, 0.06, 0.25]} material={skin}><sphereGeometry args={[0.105, 10, 8]} /></mesh>
            <group position={[0.37, -1.62, 0]}><Axe /></group>
          </group>
          <group ref={rightArm} position={[0.37, 1.62, 0]}>
            <Limb from={[0, 0, 0]} to={[0.15, -0.37, 0]} radius={0.14} surface={shirt} />
            <Limb from={[0.15, -0.37, 0]} to={[0.09, -0.60, 0.13]} radius={0.085} surface={skin} />
            <mesh position={[0.09, -0.62, 0.13]} material={skin}><sphereGeometry args={[0.10, 10, 8]} /></mesh>
            <group ref={handRef} position={[0.09, -0.62, 0.13]} />
          </group>
        </group>
        <mesh name="khan-ran" geometry={scarfGeometry} castShadow receiveShadow>
          <meshStandardMaterial map={scarfTexture} roughness={1} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  </group>;
}
