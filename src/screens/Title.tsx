import { Suspense, lazy, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { chapters } from '../data';
import { useGame } from '../state/store';

gsap.registerPlugin(useGSAP);

const TitleScene = lazy(() => import('./TitleScene'));

export function Title() {
  const { t } = useTranslation();
  const completed = useGame((s) => s.completed);
  const beat = useGame((s) => s.beat);
  const update = useGame((s) => s.update);
  const root = useRef<HTMLElement>(null);
  const started = Object.keys(completed).length > 0 || Object.values(beat).some((b) => b > 0);
  const nextChapter = chapters.find((c) => !completed[c.id]) ?? chapters[0];

  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.reveal', { y: 26, autoAlpha: 0, duration: 0.9, stagger: 0.13, ease: 'power3.out', delay: 0.15 });
      });
    },
    { scope: root },
  );

  return (
    <main className="title" ref={root}>
      <div className="title-scene">
        <Suspense fallback={null}>
          <TitleScene />
        </Suspense>
      </div>
      <div className="title-copy">
        <p className="eyebrow reveal">{t('app.challenge')}</p>
        <h1 className="reveal">{t('app.title')}</h1>
        <p className="title-sub reveal">{t('app.subtitle')}</p>
        <p className="title-hook reveal">{t('app.hook')}</p>
        <div className="row reveal">
          <Link className="btn primary big" to={started ? `/chapter/${nextChapter.id}` : '/chapter/ch0'}>{started ? t('app.continue') : t('app.begin')}</Link>
          <Link className="btn ghost big" to="/map">{t('nav.map')}</Link>
        </div>
        <nav className="title-links reveal" aria-label="More">
          <Link to="/logbook">{t('nav.logbook')}</Link>
          <Link to="/atlas">{t('nav.atlas')}</Link>
          <Link to="/lab">{t('nav.lab')}</Link>
          <Link to="/sources">{t('nav.sources')}</Link>
          <Link to="/cuoi-preview">{t('cuoiPreview.link')}</Link>
          <button type="button" onClick={() => update({ settingsOpen: true })}>{t('nav.settings')}</button>
        </nav>
      </div>
    </main>
  );
}
