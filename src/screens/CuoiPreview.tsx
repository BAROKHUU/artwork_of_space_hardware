import { useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import { GameCanvas } from '../three/GameCanvas';
import { Cuoi } from '../three/Cuoi';

export default function CuoiPreview() {
  const { t } = useTranslation();
  const [view, setView] = useState<'face' | 'full'>('full');
  const face = view === 'face';
  return (
    <main className="page cuoi-preview">
      <div className="page-head">
        <h1>{t('cuoiPreview.title')}</h1>
        <p>{t('cuoiPreview.description')}</p>
      </div>
      <div className="row cuoi-preview-controls">
        <button className={`btn ${face ? 'primary' : 'ghost'}`} type="button" aria-pressed={face} onClick={() => setView('face')}>{t('cuoiPreview.face')}</button>
        <button className={`btn ${!face ? 'primary' : 'ghost'}`} type="button" aria-pressed={!face} onClick={() => setView('full')}>{t('cuoiPreview.full')}</button>
      </div>
      <div className="cuoi-preview-canvas">
        <GameCanvas key={view} camera={{ position: face ? [0, 2.12, 2.1] : [0, 1.45, 5], fov: 38 }}>
          <color attach="background" args={['#39303a']} />
          <ambientLight intensity={0.9} color="#ffe5c6" />
          <directionalLight position={[3, 5, 6]} intensity={2.4} color="#ffd6a1" />
          <directionalLight position={[-4, 2, 3]} intensity={0.9} color="#c9d3ff" />
          <Cuoi />
          <OrbitControls makeDefault target={face ? [0, 2.08, 0] : [0, 1.3, 0]} enablePan={false} minDistance={0.8} maxDistance={8} />
        </GameCanvas>
      </div>
    </main>
  );
}
