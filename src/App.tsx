import { Suspense, lazy, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from './i18n';
import { useGame } from './state/store';
import { Settings } from './components/Settings';
import { Title } from './screens/Title';
import { MapScreen } from './screens/MapScreen';
import { Sources } from './screens/Sources';

const Chapter = lazy(() => import('./screens/Chapter').then((m) => ({ default: m.Chapter })));
const Logbook = lazy(() => import('./screens/Logbook').then((m) => ({ default: m.Logbook })));
const Atlas = lazy(() => import('./screens/Atlas').then((m) => ({ default: m.Atlas })));
const Lab = lazy(() => import('./screens/Lab').then((m) => ({ default: m.Lab })));

function TopBar() {
  const { t } = useTranslation();
  const update = useGame((s) => s.update);
  const links = [['/map', 'nav.map'], ['/logbook', 'nav.logbook'], ['/atlas', 'nav.atlas'], ['/lab', 'nav.lab'], ['/sources', 'nav.sources']] as const;
  return (
    <header className="topbar">
      <NavLink to="/" className="brand" aria-label={t('nav.home')}>
        <i aria-hidden="true" /> ECHO
      </NavLink>
      <nav aria-label="Main">
        {links.map(([to, key]) => <NavLink key={to} to={to}>{t(key)}</NavLink>)}
      </nav>
      <button type="button" className="gear" onClick={() => update({ settingsOpen: true })}>{t('nav.settings')}</button>
    </header>
  );
}

export function App() {
  const { t } = useTranslation();
  const language = useGame((s) => s.language);
  const { pathname } = useLocation();
  const immersive = pathname.startsWith('/chapter') || pathname === '/';

  useEffect(() => {
    void setLanguage(language);
  }, [language]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      {!immersive && <TopBar />}
      <Suspense fallback={<div className="loading" role="status">{t('common.loading')}</div>}>
        <Routes>
          <Route path="/" element={<Title />} />
          <Route path="/map" element={<MapScreen />} />
          <Route path="/chapter/:id" element={<Chapter />} />
          <Route path="/logbook" element={<Logbook />} />
          <Route path="/atlas" element={<Atlas />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="*" element={<main className="page"><h1>{t('common.notFound')}</h1><NavLink className="btn primary" to="/map">{t('common.backToMap')}</NavLink></main>} />
        </Routes>
      </Suspense>
      <Settings />
    </>
  );
}
