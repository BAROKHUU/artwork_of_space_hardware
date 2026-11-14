import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { archiveChapters, moonChapters } from '../data';
import { allStorySections, getStorySections } from '../book/content';
import { StoryBook } from '../book/StoryBook';
import { useGame } from '../state/store';

export function Book() {
  const { t } = useTranslation();
  const completed = useGame((state) => state.completed);
  const explorer = useGame((state) => state.explorer);
  const progress = useGame((state) => state.book);
  const markBookOpened = useGame((state) => state.markBookOpened);
  const setReaderChapter = useGame((state) => state.setReaderChapter);
  const availableChapters = useMemo(() => [...moonChapters, ...archiveChapters].filter((chapter) => {
    const arc = chapter.arc === 'moon' ? moonChapters : archiveChapters;
    const previous = arc[arc.findIndex((item) => item.id === chapter.id) - 1];
    return !previous || explorer || completed[previous.id] || completed[chapter.id] || allStorySections.some((section) => section.chapterId === chapter.id && progress.reached[section.id]);
  }), [completed, explorer, progress.reached]);
  const readable = allStorySections.filter((section) => progress.reached[section.id]);
  const selectedChapter = availableChapters.find((chapter) => chapter.id === progress.readerChapter && readable.some((section) => section.chapterId === chapter.id))
    ?? [...availableChapters].reverse().find((chapter) => readable.some((section) => section.chapterId === chapter.id));
  const sections = selectedChapter ? getStorySections(selectedChapter.id).filter((section) => readable.some((item) => item.id === section.id)) : [];
  const activeSectionId = selectedChapter
    ? (sections.find((section) => section.id === progress.readerSections[selectedChapter.id])?.id ?? sections[0]?.id)
    : undefined;

  useEffect(() => {
    if (!selectedChapter) return;
    markBookOpened(selectedChapter.id);
    if (progress.readerChapter !== selectedChapter.id) setReaderChapter(selectedChapter.id);
  }, [markBookOpened, progress.readerChapter, selectedChapter, setReaderChapter]);

  const openChapter = (chapterId: string) => {
    setReaderChapter(chapterId);
    markBookOpened(chapterId);
  };

  return (
    <main className="page prose story-reader">
      <header className="page-head">
        <h1>{t('book.reading')}</h1>
        <p>{t('book.readerIntro')}</p>
      </header>
      {availableChapters.length > 0 && <nav className="row" aria-label={t('book.chapters')}>
        {availableChapters.map((chapter) => {
          const available = readable.some((section) => section.chapterId === chapter.id);
          return <button key={chapter.id} type="button" className={`btn ${selectedChapter?.id === chapter.id ? 'primary' : 'ghost'}`} disabled={!available} onClick={() => openChapter(chapter.id)}>{t(`story:${chapter.id}.title`)}{!available ? ` · ${t('book.locked')}` : ''}</button>;
        })}
      </nav>}
      {selectedChapter && sections.length > 0 ? (
        <StoryBook chapter={selectedChapter} sections={sections} mode="reader" activeSectionId={activeSectionId} />
      ) : (
        <section className="panel brief"><p>{t('book.empty')}</p><Link className="btn primary" to="/map">{t('common.backToMap')}</Link></section>
      )}
    </main>
  );
}
