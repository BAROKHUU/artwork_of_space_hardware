import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { GameCanvas } from '../three/GameCanvas';
import { Diorama } from '../three/Scenery';
import { photoUrl } from '../data';
import { Cuoi } from '../three/Cuoi';
import { BanyanTree, MoonRabbit } from '../three/MoonCharacters';

/** The scene is composed for a 16:9 screen; narrower screens zoom out so it still fits. */
const WIDE_ASPECT = 16 / 9;
const PHONE_ASPECT = 390 / 844;

/** Frames the rover, the rabbit and Cuội on any screen, beside the title or above it. */
function ShiftView() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  useEffect(() => {
    const aspect = width / height;
    const stacked = width <= 800 || aspect < 1.1;
    // Seen beside the title, the scene only gets the right half, so it shrinks faster than the screen narrows.
    camera.zoom = stacked
      ? 0.55 * Math.min(1.2, aspect / PHONE_ASPECT)
      : Math.max(0.55, Math.min(0.92, 0.92 * (aspect / WIDE_ASPECT) ** 2));
    if (stacked) camera.setViewOffset(width, height, width * 0.2, height * 0.24, width, height);
    else camera.setViewOffset(width, height, -width * 0.2, 0, width, height);
    camera.updateProjectionMatrix();
    return () => {
      camera.zoom = 1;
      camera.clearViewOffset();
    };
  }, [camera, width, height]);
  return null;
}

export default function TitleScene() {
  return (
    <GameCanvas camera={{ position: [4, 2.6, 5], fov: 48, far: 500 }} fallback={<img className="title-photo" src={photoUrl('lrv')} alt="" />}>
      <ShiftView />
      <Diorama world="moon" model={null} home />
      <BanyanTree position={[-1.45, 0, -2.4]} scale={1.05} rotation={[0, 0.25, 0]} />
      <Cuoi position={[1.0, 0, -0.9]} rotation={[0, 0.7, 0]} />
      <MoonRabbit position={[-1.25, 0, 0.65]} rotation={[0, -0.45, 0]} scale={0.9} />
    </GameCanvas>
  );
}
