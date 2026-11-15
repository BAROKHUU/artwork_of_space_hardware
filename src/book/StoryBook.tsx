import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import type { Chapter, ModelId } from '../data/types';
import { backdrops, backdropUrl, hardwareById, photoUrl } from '../data';
import { useGame } from '../state/store';
import { play } from '../audio/sfx';
import { HardwareModel } from '../three/models';
import { MoonCuoi, MoonRabbit } from '../three/MoonCharacters';
import type { StorySection } from './types';
import './book.css';

interface StoryBookProps {
  chapter: Chapter;
  sections: StorySection[];
  mode: 'game' | 'reader';
  activeSectionId?: string;
  onContinue?: () => void;
  onSkip?: () => void;
}

interface StoryLine { who: 'echo' | 'control' | 'lrv' | 'cuoi' | 'rabbit'; text: string }
type Viewpoint = 'wide' | 'cuoi' | 'rover';

function FaceCamera({ children, position, rotation = 0 }: { children: ReactNode; position: [number, number, number]; rotation?: number }) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useFrame(() => {
    if (!ref.current) return;
    const dx = camera.position.x - ref.current.position.x;
    const dz = camera.position.z - ref.current.position.z;
    ref.current.rotation.y = Math.atan2(dx, dz) + rotation;
  });
  return <group ref={ref} position={position}>{children}</group>;
}

function CameraView({ viewpoint }: { viewpoint: Viewpoint }) {
  const { camera } = useThree();
  const destination = useRef(new THREE.Vector3(0, 4.8, 10));
  const lookAt = useRef(new THREE.Vector3(0, 1.1, 0));
  useEffect(() => {
    const views: Record<Viewpoint, { position: [number, number, number]; target: [number, number, number] }> = {
      wide: { position: [0, 4.8, 10], target: [0, 1.1, 0] },
      cuoi: { position: [4.2, 2.4, 4.3], target: [1.4, 1.05, 0] },
      rover: { position: [-4.6, 2.6, 2.2], target: [-1.3, 1.05, 0] },
    };
    destination.current.set(...views[viewpoint].position);
    lookAt.current.set(...views[viewpoint].target);
  }, [camera, viewpoint]);
  useFrame((_, delta) => {
    camera.position.lerp(destination.current, 1 - Math.exp(-3.5 * delta));
    camera.lookAt(lookAt.current);
  });
  return null;
}

function StoryStage({ viewpoint, model, chapter, imageAlt }: { viewpoint: Viewpoint; model?: ModelId; chapter: Chapter; imageAlt: string }) {
  const moonSurface = useLoader(THREE.TextureLoader, '/intro/Image/1.jpg');
  moonSurface.colorSpace = THREE.SRGBColorSpace;

  return <Canvas camera={{ position: [0, 4.8, 10], fov: 42 }} dpr={[1, 1.5]} role="img" aria-label={imageAlt}>
    <CameraView viewpoint={viewpoint} />
    <ambientLight intensity={1.7} />
    <directionalLight position={[-5, 8, 5]} intensity={3} castShadow />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
      <planeGeometry args={[24, 24]} />
      <meshStandardMaterial map={chapter.world === 'moon' ? moonSurface : undefined} color={chapter.world === 'moon' ? '#ffffff' : '#77766e'} roughness={1} />
    </mesh>
    {chapter.world === 'moon' && <>
      <mesh position={[-3.8, 0.02, -2.5]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.2, 24]} /><meshStandardMaterial color="#4c4b4d" roughness={1} /></mesh>
      <mesh position={[3.7, 0.02, -4]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.8, 28]} /><meshStandardMaterial color="#5b5a55" roughness={1} /></mesh>
      <mesh position={[0, 0.01, -5.5]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.1, 1.55, 28]} /><meshStandardMaterial color="#69686a" roughness={1} /></mesh>
    </>}
    {model && <FaceCamera position={[-1.35, 0, 0]} rotation={Math.PI}><group scale={0.62}><HardwareModel id={model} /></group></FaceCamera>}
    {chapter.world === 'moon' && <>
      <FaceCamera position={[1.65, 0, 0.1]}><MoonCuoi scale={0.95} /></FaceCamera>
      <FaceCamera position={[3.1, 0, -1]} rotation={Math.PI}><MoonRabbit scale={0.78} /></FaceCamera>
    </>}
  </Canvas>;
}

export function StoryBook({ chapter, sections, mode, activeSectionId, onContinue, onSkip }: StoryBookProps) {
  const { t } = useTranslation();
  const markBookOpened = useGame((state) => state.markBookOpened);
  const setBookPage = useGame((state) => state.setBookPage);
  const enterStory = useGame((state) => state.enterStory);
  const setReaderChapter = useGame((state) => state.setReaderChapter);
  const clearGameBookPage = useGame((state) => state.clearGameBookPage);
  const gamePages = useGame((state) => state.book.gamePages);
  const readerPages = useGame((state) => state.book.readerPages);
  const savedReaderSection = useGame((state) => state.book.readerSections[chapter.id]);
  const narration = useGame((state) => state.narration);
  const [viewpoint, setViewpoint] = useState<Viewpoint>('wide');
  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);

  const visibleSections = useMemo(() => {
    const candidates = sections.filter((section) => section.chapterId === chapter.id);
    return mode === 'game' && activeSectionId ? candidates.filter((section) => section.id === activeSectionId) : candidates;
  }, [sections, chapter.id, mode, activeSectionId]);
  const pages = useMemo(() => visibleSections.flatMap((section) => {
    const lines = t(`story:${section.chapterId}.${section.key}`, { returnObjects: true }) as unknown as StoryLine[];
    return section.pages.map((page) => ({ section, page, lines: lines.slice(page.start, page.end) }));
  }), [visibleSections, t]);
  const startIndex = useMemo(() => {
    const requestedSection = mode === 'game'
      ? activeSectionId
      : savedReaderSection ?? visibleSections.find((section) => readerPages[section.id])?.id;
    const requestedPage = requestedSection ? (mode === 'game' ? gamePages[requestedSection] : readerPages[requestedSection]) : undefined;
    const found = pages.findIndex(({ section, page }) => section.id === requestedSection && page.id === requestedPage);
    if (found >= 0) return found;
    return pages.findIndex(({ section }) => section.id === requestedSection);
  }, [activeSectionId, gamePages, mode, pages, readerPages, savedReaderSection, visibleSections]);
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => setPageIndex(Math.max(0, startIndex)), [chapter.id, activeSectionId, startIndex]);
  const current = pages[pageIndex];
  const currentLine = current?.lines[lineIndex] ?? current?.lines[0];
  const backdrop = backdrops[chapter.world];
  const hardware = current ? hardwareById[current.page.focus] : undefined;
  const image = current?.page.image?.src ?? (hardware ? photoUrl(hardware.photo) : backdropUrl(chapter.world));
  const imageAlt = current?.page.image?.alt ?? (hardware ? t(`hardware:${hardware.id}.name`) : t(`world.${chapter.world}`));
  const sceneModel = hardware?.model ?? (chapter.world === 'moon' ? 'lrv' : undefined);
  const isFinal = pageIndex >= pages.length - 1;

  useEffect(() => {
    setLineIndex(0);
  }, [pageIndex]);

  useEffect(() => {
    if (!currentLine) return;
    setTyped('');
    setTypingDone(false);
    const text = currentLine.text;
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTyped(text.slice(0, index));
      if (index % 2 === 0) play('type');
      if (index >= text.length) {
        window.clearInterval(timer);
        setTypingDone(true);
      }
    }, 28);
    return () => window.clearInterval(timer);
  }, [currentLine]);

  useEffect(() => {
    if (!currentLine) return;
    const nextView: Viewpoint = currentLine.who === 'cuoi' || currentLine.who === 'rabbit' ? 'cuoi' : currentLine.who === 'lrv' || currentLine.who === 'echo' ? 'rover' : 'wide';
    setViewpoint(nextView);
  }, [currentLine]);

  useGSAP(() => {
    gsap.fromTo(sceneRef.current, { autoAlpha: 0, scale: 1.015 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'power2.out' });
  }, { scope: sceneRef, dependencies: [pageIndex], revertOnUpdate: true });

  useEffect(() => {
    markBookOpened(chapter.id);
    if (mode === 'game' && activeSectionId) enterStory(activeSectionId);
  }, [activeSectionId, chapter.id, enterStory, markBookOpened, mode]);
  useEffect(() => {
    if (!current) return;
    setBookPage(mode, current.section.id, current.page.id);
    if (mode === 'reader') setReaderChapter(chapter.id);
  }, [chapter.id, current, mode, setBookPage, setReaderChapter]);
  useEffect(() => {
    if (!narration || !currentLine || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${t(`story:speakers.${currentLine.who}`)}. ${currentLine.text}`);
    utterance.lang = document.documentElement.lang || 'en';
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [currentLine, narration, t]);

  const moveTo = useCallback((next: number) => {
    const bounded = Math.max(0, Math.min(pages.length - 1, next));
    setPageIndex(bounded);
    const destination = pages[bounded];
    if (destination) {
      setBookPage(mode, destination.section.id, destination.page.id);
      if (mode === 'reader') setReaderChapter(chapter.id);
    }
    play('page');
  }, [chapter.id, mode, pages, setBookPage, setReaderChapter]);
  const finish = useCallback((skip = false) => {
    if (mode === 'game' && activeSectionId) clearGameBookPage(activeSectionId);
    (skip ? onSkip : onContinue)?.();
  }, [activeSectionId, clearGameBookPage, mode, onContinue, onSkip]);
  const advanceDialogue = useCallback(() => {
    if (!typingDone) {
      if (currentLine) setTyped(currentLine.text);
      setTypingDone(true);
    } else if (current && lineIndex < current.lines.length - 1) {
      setLineIndex((value) => value + 1);
    } else if (isFinal && mode === 'game') {
      finish();
    } else {
      moveTo(pageIndex + 1);
    }
  }, [current, currentLine, finish, isFinal, lineIndex, mode, moveTo, pageIndex, typingDone]);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName))) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); moveTo(pageIndex + 1); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); moveTo(pageIndex - 1); }
  };

  if (!current) return <section className="story-book-fallback" aria-label={t('book.reading')}>
    <p>{t(`story:${chapter.id}.title`)}</p>{mode === 'game' && <button type="button" className="btn ghost" onClick={() => finish(true)}>{t('book.skip')}</button>}
  </section>;

  return <section className="story-book-shell" onKeyDown={onKeyDown} aria-label={t('book.reading')} tabIndex={0}>
    <header className="story-cinematic-header">
      <div><p className="story-kicker">{t('book.section')}</p><h2>{current.section.title}</h2></div>
    </header>
    <div className="story-cinematic-scene" ref={sceneRef} style={{ backgroundImage: `linear-gradient(180deg, rgb(13 22 29 / 8%), rgb(13 22 29 / 62%)), url("${image}")` }}>
      <div className="story-cinematic-credit">{current.page.image?.credit ?? t('logbook.credit', { credit: hardware?.credit ?? backdrop.credit, id: hardware?.nasaId ?? backdrop.nasaId })}</div>
      <StoryStage viewpoint={viewpoint} model={sceneModel} chapter={chapter} imageAlt={imageAlt} />
      {currentLine && <div className={`story-dialogue-overlay who-${currentLine.who}`} aria-live="polite" onClick={advanceDialogue}>
        <strong>{t(`story:speakers.${currentLine.who}`)}</strong>
        <p>{typed}<span className="type-caret" aria-hidden="true">▌</span></p>
        <small>{typingDone ? t('book.next') : t('book.tapToFinish')}</small>
      </div>}
    </div>
    {current.page.fact && <aside className="story-fact"><span className="story-fact-label">{t('book.fact')}</span><p>{current.page.fact}</p></aside>}
    <nav className="story-actions" aria-label={t('book.reading')}>
      <button className="btn ghost" type="button" onClick={() => moveTo(pageIndex - 1)} disabled={pageIndex === 0}>{t('book.previous')}</button>
      {mode === 'game' && <button className="btn ghost" type="button" onClick={() => finish(true)}>{t('book.skip')}</button>}
      {isFinal && mode === 'game'
        ? <button className="btn primary" type="button" onClick={advanceDialogue} disabled={!typingDone}>{t('book.continue')}</button>
        : <button className="btn primary" type="button" onClick={advanceDialogue} disabled={!typingDone}>{t('book.next')}</button>}
    </nav>
  </section>;
}
