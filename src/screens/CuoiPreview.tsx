import { useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import { GameCanvas } from '../three/GameCanvas';
import { Cuoi } from '../three/Cuoi';

const LEGEND_PARAGRAPHS = ['p1', 'p2', 'p3', 'p4'] as const;

export default function CuoiPreview() {
  const { t } = useTranslation();
  const [view, setView] = useState<'face' | 'full'>('full');
  const face = view === 'face';
  const legend = useRef<HTMLElement>(null);
  return (
    <main className="page cuoi-preview">
      <section className="cuoi-stage" aria-labelledby="cuoi-preview-title">
        <div className="page-head">
          <h1 id="cuoi-preview-title">{t('cuoiPreview.title')}</h1>
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
            {/* Wheel zoom is off so scrolling over the model moves the page down to the legend. */}
            <OrbitControls makeDefault target={face ? [0, 2.08, 0] : [0, 1.3, 0]} enablePan={false} enableZoom={false} />
          </GameCanvas>
        </div>
        {/* A button, not an #anchor link: the app uses HashRouter, so a hash link would change the route. */}
        <button type="button" className="cuoi-scroll-cue" onClick={() => legend.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>
          <span>{t('cuoiPreview.scrollCue')}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </button>
      </section>

      <article ref={legend} id="cuoi-legend" className="cuoi-legend" aria-labelledby="cuoi-legend-title">
        <p className="eyebrow">{t('cuoiPreview.legend.eyebrow')}</p>
        <h2 id="cuoi-legend-title">{t('cuoiPreview.legend.title')}</h2>
        {LEGEND_PARAGRAPHS.map((key) => <p key={key}>{t(`cuoiPreview.legend.${key}`)}</p>)}
      </article>
    </main>
  );
}
