import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { GameCanvas } from '../three/GameCanvas';
import { Diorama } from '../three/Scenery';
import { photoUrl } from '../data';
import { Cuoi } from '../three/Cuoi';

/** On wide screens, moves Echo to the right so the title has room. */
function ShiftView() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  useEffect(() => {
    if (width > 800) camera.setViewOffset(width, height, -width * 0.24, 0, width, height);
    else camera.setViewOffset(width, height, 0, height * 0.2, width, height);
    return () => camera.clearViewOffset();
  }, [camera, width, height]);
  return null;
}

export default function TitleScene() {
  return (
    <GameCanvas camera={{ position: [4, 2.6, 5], fov: 48, far: 500 }} fallback={<img className="title-photo" src={photoUrl('lrv')} alt="" />}>
      <ShiftView />
      <Diorama world="moon" model={null} />
      <Cuoi position={[1.15, 0, -0.9]} rotation={[0, 0.7, 0]} />
    </GameCanvas>
  );
}
