import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hardware, hardwareById, photoUrl, sources } from '../data';
import type { Fate, World } from '../data/types';
import { useGame } from '../state/store';
import { GameCanvas } from '../three/GameCanvas';
import { Turntable } from '../three/Scenery';
import { Facts, FateBadge, Photo } from '../components/HardwareInfo';

export function HardwareDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [view, setView] = useState<'photo' | 'model'>('photo');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (id && !d.open) d.showModal();
    if (!id && d.open) d.close();
    setView('photo');
  }, [id]);
  const item = id ? hardwareById[id] : null;
  return (
    <dialog ref={ref} className="record" onClose={onClose} aria-label={item ? t(`hardware:${item.id}.name`) : undefined}>
      {item && (
        <div className="record-grid">
          <div className="record-media">
            <div className="choice" role="tablist">
              <button type="button" role="tab" aria-selected={view === 'photo'} className={view === 'photo' ? 'on' : ''} onClick={() => setView('photo')}>{t('logbook.photo')}</button>
              <button type="button" role="tab" aria-selected={view === 'model'} className={view === 'model' ? 'on' : ''} onClick={() => setView('model')}>{t('logbook.model')}</button>
            </div>
            {view === 'photo' ? <Photo item={item} /> : (
              <div className="turntable">
                <GameCanvas camera={{ position: [6, 4, 8], fov: 42 }}>
                  <Turntable model={item.model} world={item.world} />
                </GameCanvas>
              </div>
            )}
          </div>
          <div className="record-body">
            <button type="button" className="btn ghost close" onClick={onClose}>{t('logbook.close')}</button>
            <h2>{t(`hardware:${item.id}.name`)}</h2>
            <p className="where">{t(`hardware:${item.id}.where`)} <FateBadge fate={item.fate} /></p>
            <Facts item={item} />
            <p className="checked">{t('fate.checked')}</p>
            <h3>{t('logbook.sources')}</h3>
            <ul className="source-list">
              {item.sources.map((s) => <li key={s}><a href={sources[s].url} target="_blank" rel="noreferrer">{sources[s].title}</a></li>)}
            </ul>
          </div>
        </div>
      )}
    </dialog>
  );
}

export function Logbook() {
  const { t } = useTranslation();
  const { unlocked, explorer } = useGame();
  const [world, setWorld] = useState<World | 'all'>('all');
  const [fate, setFate] = useState<Fate | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const found = hardware.filter((h) => unlocked[h.id]).length;
  const shown = hardware.filter((h) => (world === 'all' || h.world === world) && (fate === 'all' || h.fate === fate));
  const worlds: (World | 'all')[] = ['all', 'moon', 'mars', 'deep'];
  const fates: (Fate | 'all')[] = ['all', 'operating', 'silent', 'retired', 'drifting'];
  return (
    <main className="page">
      <header className="page-head">
        <h1>{t('logbook.heading')}</h1>
        <p>{t('logbook.sub', { n: found, total: hardware.length })}</p>
      </header>
      <div className="filters">
        <div className="choice">{worlds.map((w) => <button type="button" key={w} className={world === w ? 'on' : ''} onClick={() => setWorld(w)}>{t(`world.${w}`)}</button>)}</div>
        <div className="choice">{fates.map((f) => <button type="button" key={f} className={fate === f ? 'on' : ''} onClick={() => setFate(f)}>{f === 'all' ? t('logbook.allFates') : t(`fate.${f}`)}</button>)}</div>
      </div>
      <ul className="cards">
        {shown.map((h) => {
          const known = unlocked[h.id] || explorer;
          return (
            <li key={h.id} className={known ? '' : 'unknown'}>
              <button type="button" disabled={!known} onClick={() => setOpen(h.id)}>
                <span className="card-img" style={{ backgroundImage: known ? `url(${photoUrl(h.photo)})` : undefined }} aria-hidden="true" />
                <span className="card-body">
                  <strong>{known ? t(`hardware:${h.id}.name`) : t('logbook.lockedName')}</strong>
                  {known && <FateBadge fate={h.fate} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <HardwareDialog id={open} onClose={() => setOpen(null)} />
    </main>
  );
}
