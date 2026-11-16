import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { backdrops, hardware, sources } from '../data';
import type { SourceGroup } from '../data/types';

const GROUPS: SourceGroup[] = ['moon', 'mars', 'deep', 'data'];

const host = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};

function SourceCard({ href, title, meta }: { href: string; title: string; meta: ReactNode }) {
  return (
    <li>
      <a className="source-card" href={href} target="_blank" rel="noreferrer">
        <span className="source-card-title">{title}</span>
        <span className="source-card-meta">{meta}</span>
      </a>
    </li>
  );
}

export function Sources() {
  const { t } = useTranslation();
  const refs = useRef<Partial<Record<string, HTMLElement | null>>>({});
  const byGroup = GROUPS.map((group) => ({ group, items: Object.entries(sources).filter(([, s]) => s.group === group) }));
  const sections = [...GROUPS.map((g) => ({ id: g, label: t(`sources.groups.${g}`) })), { id: 'images', label: t('sources.images') }, { id: 'backgrounds', label: t('sources.backgrounds') }, { id: 'software', label: t('sources.software') }];
  // Buttons, not #anchor links: the app uses HashRouter, so a hash link would change the route.
  const jump = (id: string) => refs.current[id]?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  const keep = (id: string) => (el: HTMLElement | null) => { refs.current[id] = el; };

  return (
    <main className="page sources-page">
      <header className="page-head">
        <h1>{t('sources.heading')}</h1>
        <p>{t('sources.sub')}</p>
      </header>

      <div className="sources-honesty">
        <section className="honesty-card real">
          <h2>{t('sources.real')}</h2>
          <p>{t('sources.realBody')}</p>
        </section>
        <section className="honesty-card simplified">
          <h2>{t('sources.simplified')}</h2>
          <p>{t('sources.simplifiedBody')}</p>
        </section>
      </div>
      <p className="sources-checked">{t('sources.date')} {t('sources.notEndorsed')}</p>

      <nav className="sources-jump" aria-label={t('sources.jump')}>
        {sections.map((s) => <button key={s.id} type="button" onClick={() => jump(s.id)}>{s.label}</button>)}
      </nav>

      <h2 className="sources-heading">{t('sources.listHeading')}</h2>
      {byGroup.map(({ group, items }) => (
        <section key={group} ref={keep(group)} className="sources-group" aria-labelledby={`sources-${group}`}>
          <h3 id={`sources-${group}`}>{t(`sources.groups.${group}`)} <span className="sources-count">{items.length}</span></h3>
          <ul className="source-grid">
            {items.map(([id, s]) => <SourceCard key={id} href={s.url} title={s.title} meta={<><b>{s.org}</b> · {host(s.url)}</>} />)}
          </ul>
        </section>
      ))}

      <section ref={keep('images')} className="sources-group" aria-labelledby="sources-images">
        <h2 id="sources-images" className="sources-heading">{t('sources.images')} <span className="sources-count">{hardware.length}</span></h2>
        <ul className="source-grid compact">
          {hardware.map((h) => <SourceCard key={h.id} href={`https://images.nasa.gov/details/${h.nasaId}`} title={t(`hardware:${h.id}.name`)} meta={<>{h.credit} · {h.nasaId}</>} />)}
        </ul>
      </section>

      <section ref={keep('backgrounds')} className="sources-group" aria-labelledby="sources-backgrounds">
        <h2 id="sources-backgrounds" className="sources-heading">{t('sources.backgrounds')} <span className="sources-count">{Object.keys(backdrops).length}</span></h2>
        <ul className="source-grid compact">
          {Object.entries(backdrops).map(([key, b]) => <SourceCard key={key} href={`https://images.nasa.gov/details/${b.nasaId}`} title={t(`sources.backdrop.${key}`)} meta={<>{b.credit} · {b.nasaId}</>} />)}
        </ul>
      </section>

      <section ref={keep('software')} className="sources-group sources-software" aria-labelledby="sources-software">
        <h2 id="sources-software" className="sources-heading">{t('sources.software')}</h2>
        <p>
          {t('sources.noticeLink')} · <a href={`${import.meta.env.BASE_URL}third-party/MPL-2.0.txt`}>{t('sources.mplLink')}</a> · <a href="https://www.mozilla.org/media/MPL/2.0/index.815ca599c9df.txt" target="_blank" rel="noreferrer">{t('sources.mplOfficial')}</a>
        </p>
      </section>
    </main>
  );
}
