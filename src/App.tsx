import { Suspense, lazy, useEffect, type CSSProperties } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from './i18n';
import { useGame } from './state/store';
import { backdropUrl, backdrops, chapterById } from './data';
import { Settings } from './components/Settings';
import { ChatBot } from './components/ChatBot';
import { IntroExperience } from './screens/IntroExperience';
import { storyModeFrom } from './screens/storyModes';
import { mediaUrl } from './media';

const Title = lazy(() => import('./screens/Title').then((m) => ({ default: m.Title })));
const MapScreen = lazy(() => import('./screens/MapScreen').then((m) => ({ default: m.MapScreen })));
const Sources = lazy(() => import('./screens/Sources').then((m) => ({ default: m.Sources })));
const Learning = lazy(() => import('./screens/Learning').then((m) => ({ default: m.Learning })));
const Chapter = lazy(() => import('./screens/Chapter').then((m) => ({ default: m.Chapter })));
const Logbook = lazy(() => import('./screens/Logbook').then((m) => ({ default: m.Logbook })));
const Atlas = lazy(() => import('./screens/Atlas').then((m) => ({ default: m.Atlas })));
const Lab = lazy(() => import('./screens/Lab').then((m) => ({ default: m.Lab })));
const CuoiPreview = lazy(() => import('./screens/CuoiPreview'));
const StoryScreen = lazy(() => import('./screens/StoryScreen').then((m) => ({ default: m.StoryScreen })));

/** The title screen has its own 3D scene; chapters take their backdrop from the world they visit. */
function backdropFor(pathname: string): string | null {
  const chapter = /^\/chapter\/([^/]+)/.exec(pathname);
  if (chapter) return chapterById[chapter[1]]?.world ?? null;
  const page = pathname.slice(1);
  return backdrops[page] ? page : null;
}

function PageBackdrop({ name }: { name: string }) {
  return <div className="page-bg" style={{ backgroundImage: `url(${backdropUrl(name)})`, '--scrim': backdrops[name].scrim } as CSSProperties} aria-hidden="true" />;
}

function TopBar() {
  const { t } = useTranslation();
  const update = useGame((s) => s.update);
  const links = [['/home', 'nav.home'], ['/story', 'nav.story'], ['/map', 'nav.map'], ['/logbook', 'nav.logbook'], ['/progress', 'nav.progress'], ['/atlas', 'nav.atlas'], ['/lab', 'nav.lab'], ['/sources', 'nav.sources']] as const;
  return (
    <header className="topbar">
      <NavLink to="/" className="brand" aria-label={t('nav.home')}>
        <img className="brand-logo" src={mediaUrl('moon-stories-watercolor/assets/images/ask-uncle-cuoi.png')} alt="" aria-hidden="true" />
        <span>Moon Stories</span>
      </NavLink>
      <nav aria-label={t('nav.main')}>
        {links.map(([to, key]) => <NavLink key={to} to={to}>{t(key)}</NavLink>)}
      </nav>
      <button type="button" className="gear" onClick={() => update({ settingsOpen: true })}>{t('nav.settings')}</button>
    </header>
  );
}

export function App() {
  const { t } = useTranslation();
  const language = useGame((s) => s.language);
  const { pathname, search } = useLocation();
  // Once a story mode is chosen it fills the screen and has its own Exit control; the mode picker keeps the top bar.
  const immersive = pathname.startsWith('/chapter') || pathname === '/' || (pathname === '/story' && storyModeFrom(new URLSearchParams(search).get('mode')) !== null);
  const backdrop = backdropFor(pathname);

  useEffect(() => {
    void setLanguage(language);
  }, [language]);

  useEffect(() => {
    document.title = `${t('app.title')} — ${t('app.subtitle')}`;
  }, [language, t]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return (
    <>
      {backdrop && <PageBackdrop key={backdrop} name={backdrop} />}
      {!immersive && <TopBar />}
      <Suspense fallback={<div className="loading" role="status">{t('common.loading')}</div>}>
        <Routes>
          <Route path="/" element={<IntroExperience />} />
          <Route path="/story" element={<StoryScreen />} />
          <Route path="/home" element={<Title />} />
          <Route path="/map" element={<MapScreen />} />
          {/* The old book page told the same story; keep old links working. */}
          <Route path="/book" element={<Navigate to="/story" replace />} />
          <Route path="/chapter/:id" element={<Chapter />} />
          <Route path="/logbook" element={<Logbook />} />
          <Route path="/atlas" element={<Atlas />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/cuoi-preview" element={<CuoiPreview />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/progress" element={<Learning />} />
          <Route path="/grownups" element={<Learning />} />
          <Route path="*" element={<main className="page"><h1>{t('common.notFound')}</h1><NavLink className="btn primary" to="/map">{t('common.backToMap')}</NavLink></main>} />
        </Routes>
      </Suspense>
      <Settings />
      <ChatBot />
    </>
  );
}
