import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hardware, hardwareById, photoUrl, sources } from '../data';
import { hardwareMastery } from '../data/mastery';
import type { Fate, World } from '../data/types';
import { useGame } from '../state/store';
import { GameCanvas } from '../three/GameCanvas';
import { Turntable } from '../three/Scenery';
import { Facts, FateBadge, Photo } from '../components/HardwareInfo';
import { useDismissibleDialog } from '../components/useDismissibleDialog';

export function HardwareDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const stars = useGame((s) => s.stars);
  const [view, setView] = useState<'photo' | 'model'>('photo');
  const close = useCallback(onClose, [onClose]);
  const dialog = useDismissibleDialog(Boolean(id), close);
  useEffect(() => {
    setView('photo');
  }, [id]);
  const item = id ? hardwareById[id] : null;
  const mastery = item ? hardwareMastery(item.id, stars) : { stars: 0, mastered: false };
  return (
    <dialog {...dialog} className="record" onClose={close} aria-label={item ? t(`hardware:${item.id}.name`) : undefined}>
      {item && (
        <div className="record-grid">
          <div className="record-media">
            <div className="choice" role="tablist">
              <button type="button" role="tab" aria-selected={view === 'photo'} className={view === 'photo' ? 'on' : ''} onClick={() => setView('photo')}>{t('logbook.photo')}</button>
              {item.model && <button type="button" role="tab" aria-selected={view === 'model'} className={view === 'model' ? 'on' : ''} onClick={() => setView('model')}>{t('logbook.model')}</button>}
            </div>
            {view === 'photo' || !item.model ? <Photo item={item} /> : (
              <div className="turntable">
                <GameCanvas camera={{ position: [6, 4, 8], fov: 42 }}>
                  <Turntable model={item.model} world={item.world} />
                </GameCanvas>
              </div>
            )}
          </div>
          <div className="record-body">
            <button type="button" className="btn ghost close" onClick={close}>{t('logbook.close')}</button>
            <h2>{t(`hardware:${item.id}.name`)}</h2>
            <p className="where">
              {t(`hardware:${item.id}.where`)} <FateBadge fate={item.fate} />
              {mastery.stars > 0 && (
                <span className={`mastery${mastery.mastered ? ' mastered' : ''}`} aria-label={t('logbook.stars', { n: mastery.stars })}>
                  {'★'.repeat(mastery.stars)}{mastery.mastered ? ` ${t('logbook.mastered')}` : ''}
                </span>
              )}
            </p>
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
  const { unlocked, stars, explorer } = useGame();
  const [world, setWorld] = useState<World | 'all'>('all');
  const [fate, setFate] = useState<Fate | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const found = hardware.filter((h) => unlocked[h.id]).length;
  const masteredCount = hardware.filter((h) => hardwareMastery(h.id, stars).mastered).length;
  const shown = hardware.filter((h) => (world === 'all' || h.world === world) && (fate === 'all' || h.fate === fate));
  const worlds: (World | 'all')[] = ['all', 'moon', 'mars', 'deep'];
  const fates: (Fate | 'all')[] = ['all', 'operating', 'silent', 'retired', 'drifting'];
  return (
    <main className="page">
      <header className="page-head">
        <h1>{t('logbook.heading')}</h1>
        <p>{t('logbook.sub', { n: found, total: hardware.length })} · {t('logbook.masteredCount', { n: masteredCount, total: hardware.length })}</p>
      </header>
      <div className="filters">
        <div className="choice">{worlds.map((w) => <button type="button" key={w} className={world === w ? 'on' : ''} onClick={() => setWorld(w)}>{t(`world.${w}`)}</button>)}</div>
        <div className="choice">{fates.map((f) => <button type="button" key={f} className={fate === f ? 'on' : ''} onClick={() => setFate(f)}>{f === 'all' ? t('logbook.allFates') : t(`fate.${f}`)}</button>)}</div>
      </div>
      <ul className="cards">
        {shown.map((h) => {
          const known = unlocked[h.id] || explorer;
          const mastery = hardwareMastery(h.id, stars);
          return (
            <li key={h.id} className={known ? '' : 'unknown'}>
              <button type="button" disabled={!known} onClick={() => setOpen(h.id)}>
                <span className="card-img" style={{ backgroundImage: known ? `url(${photoUrl(h.photo)})` : undefined }} aria-hidden="true" />
                <span className="card-body">
                  <strong>{known ? t(`hardware:${h.id}.name`) : t('logbook.lockedName')}</strong>
                  {known && (
                    <span className="card-badges">
                      <FateBadge fate={h.fate} />
                      {mastery.stars > 0 && (
                        <span className={`mastery${mastery.mastered ? ' mastered' : ''}`} aria-label={t('logbook.stars', { n: mastery.stars })}>
                          {'★'.repeat(mastery.stars)}{mastery.mastered ? ` ${t('logbook.mastered')}` : ''}
                        </span>
                      )}
                    </span>
                  )}
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
