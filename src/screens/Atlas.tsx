import { useState } from 'react';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import { hardware, textureUrl } from '../data';
import type { Hardware, World } from '../data/types';
import { latLonToVec3 } from '../sim/geo';
import { distanceAU, type ProbeId } from '../sim/ephemeris';
import { GameCanvas, prefersReducedMotion } from '../three/GameCanvas';
import { FateBadge } from '../components/HardwareInfo';
import { HardwareDialog } from './Logbook';
const RADIUS = 2.4;
const FATE_COLOR: Record<string, string> = { operating: '#37e6c0', silent: '#ffb25a', retired: '#f4ead7', drifting: '#a78bfa' };

function Globe({ world, items, selected, onSelect }: { world: 'moon' | 'mars'; items: Hardware[]; selected: string | null; onSelect: (id: string) => void }) {
  const map = useTexture(textureUrl(world));
  return (
    <>
      <mesh rotation={[0, -Math.PI / 2, 0]}>
        <sphereGeometry args={[RADIUS, 96, 64]} />
        <meshStandardMaterial map={map} roughness={1} />
      </mesh>
      {items.map((h) => {
        const p = latLonToVec3(h.lat!, h.lon!, RADIUS);
        const tip = latLonToVec3(h.lat!, h.lon!, RADIUS + 0.2);
        const active = selected === h.id;
        return (
          <group key={h.id}>
            <mesh position={p.map((v, i) => (v + tip[i]) / 2) as [number, number, number]} lookAt={undefined}>
              <sphereGeometry args={[0.018, 6, 6]} />
              <meshBasicMaterial color={FATE_COLOR[h.fate]} toneMapped={false} />
            </mesh>
            <mesh
              position={tip}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(h.id);
              }}
              onPointerOver={() => (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = '')}
            >
              <sphereGeometry args={[active ? 0.12 : 0.075, 16, 16]} />
              <meshBasicMaterial color={FATE_COLOR[h.fate]} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

const MARKS = [{ au: 1, key: 'Earth' }, { au: 5.2, key: 'Jupiter' }, { au: 9.6, key: 'Saturn' }, { au: 30, key: 'Neptune' }];
const PROBE_IDS: ProbeId[] = ['new_horizons', 'pioneer10', 'voyager2', 'voyager1'];
const logX = (au: number) => (Math.log10(au) / Math.log10(220)) * 100;

function DeepChart({ onSelect }: { onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const now = new Date();
  return (
    <div className="deep">
      <div className="deep-track">
        {MARKS.map((m) => (
          <span key={m.key} className="deep-mark" style={{ left: `${logX(m.au)}%` }}><i />{m.key}</span>
        ))}
        {PROBE_IDS.map((p, i) => {
          const au = distanceAU(p, now);
          const h = hardware.find((x) => x.id === p)!;
          return (
            <button type="button" key={p} className="deep-probe" style={{ left: `${logX(au)}%`, top: `${14 + i * 21}%`, color: FATE_COLOR[h.fate] }} onClick={() => onSelect(p)}>
              <b>{t(`hardware:${p}.name`)}</b> {t('atlas.au', { v: au.toFixed(1) })}
            </button>
          );
        })}
      </div>
      <p className="deep-note">{t('atlas.deepNote')}</p>
    </div>
  );
}

export function Atlas() {
  const { t } = useTranslation();
  const [world, setWorld] = useState<World>('moon');
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const items = hardware.filter((h) => h.world === world);

  return (
    <main className="page atlas">
      <header className="page-head">
        <h1>{t('atlas.heading')}</h1>
        <p>{t('atlas.sub')}</p>
      </header>
      <div className="choice" role="tablist">
        {(['moon', 'mars', 'deep'] as World[]).map((w) => <button type="button" key={w} role="tab" aria-selected={world === w} className={world === w ? 'on' : ''} onClick={() => { setWorld(w); setSelected(null); }}>{t(`world.${w}`)}</button>)}
      </div>
      <div className="atlas-grid">
        <div className="atlas-view">
          {world === 'deep' ? <DeepChart onSelect={setOpen} /> : (
            <GameCanvas key={world} camera={{ position: [0, 0, 7], fov: 45 }} shadows={false}>
              <color attach="background" args={['#04050b']} />
              <Stars radius={70} depth={30} count={2000} factor={3.5} saturation={0} fade speed={0.2} />
              <ambientLight intensity={1.05} />
              <directionalLight position={[4, 2, 6]} intensity={2.2} />
              <Globe world={world} items={items} selected={selected} onSelect={setSelected} />
              <OrbitControls makeDefault enablePan={false} minDistance={3.4} maxDistance={10} autoRotate={!selected && !prefersReducedMotion()} autoRotateSpeed={0.5} />
            </GameCanvas>
          )}
        </div>
        <ul className="atlas-list">
          {items.map((h) => (
            <li key={h.id} className={selected === h.id ? 'on' : ''}>
              <button type="button" onClick={() => setOpen(h.id)} onMouseEnter={() => setSelected(h.id)} onFocus={() => setSelected(h.id)}>
                <strong>{t(`hardware:${h.id}.name`)}</strong>
                <small>{t(`hardware:${h.id}.where`)}</small>
                <FateBadge fate={h.fate} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <HardwareDialog id={open} onClose={() => setOpen(null)} />
    </main>
  );
}
