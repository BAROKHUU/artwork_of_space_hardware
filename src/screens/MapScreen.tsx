import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { chapters, hardwareById, photoUrl, textureUrl } from '../data';
import type { Chapter } from '../data/types';
import { useGame } from '../state/store';

function chapterImage(c: Chapter) {
  const memory = c.beats.find((b) => b.kind === 'memory');
  return memory && memory.kind === 'memory' ? photoUrl(hardwareById[memory.hardware].photo) : textureUrl('moon');
}

export function MapScreen() {
  const { t } = useTranslation();
  const { completed, beat, explorer } = useGame();
  const done = chapters.filter((c) => completed[c.id]).length;
  return (
    <main className="page">
      <header className="page-head">
        <h1>{t('map.heading')}</h1>
        <p>{t('map.sub')} <b>{t('map.progress', { done, total: chapters.length })}</b></p>
      </header>
      <ol className="trail">
        {chapters.map((c, i) => {
          const open = i === 0 || explorer || completed[chapters[i - 1].id] || completed[c.id];
          const label = completed[c.id] ? t('map.replay') : (beat[c.id] ?? 0) > 0 ? t('map.resume') : t('map.play');
          const body = (
            <>
              <span className="stop-era">{c.era}</span>
              <span className={`stop-world w-${c.world}`}>{t(`world.${c.world}`)}</span>
              <h2>{t(`story:${c.id}.title`)}</h2>
              <p>{t(`story:${c.id}.tagline`)}</p>
              <span className="stop-cta">{open ? label : t('map.locked')}</span>
            </>
          );
          return (
            <li key={c.id} className={`stop${open ? '' : ' locked'}${completed[c.id] ? ' done' : ''}`}>
              <div className="stop-img" style={{ backgroundImage: `url(${chapterImage(c)})` }} aria-hidden="true" />
              {open ? <Link to={`/chapter/${c.id}`}>{body}</Link> : <div className="stop-inner">{body}</div>}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
