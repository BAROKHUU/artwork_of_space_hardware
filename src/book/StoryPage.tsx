import { useTranslation } from 'react-i18next';
import type { StoryPageSpec, StorySection } from './types';

interface StoryLine {
  who: 'echo' | 'control' | 'lrv' | 'cuoi' | 'rabbit';
  text: string;
}

interface StoryPageProps {
  chapterId: string;
  section?: StorySection;
  page?: StoryPageSpec;
  lines: StoryLine[];
  pageNumber: number;
  totalPages: number;
  cover?: boolean;
  backCover?: boolean;
}

export function StoryPage({ chapterId, section, page, lines, pageNumber, totalPages, cover = false, backCover = false }: StoryPageProps) {
  const { t } = useTranslation();
  if (cover) {
    return (
      <div className="story-leaf story-cover">
        <div className="story-paper story-cover-paper">
          <span className="story-cover-mark" aria-hidden="true">ECHO</span>
          <p className="story-kicker">{t('book.cover')}</p>
          <h1>{t(`story:${chapterId}.title`)}</h1>
          <p className="story-cover-subtitle">{t(`story:${chapterId}.tagline`)}</p>
          <span className="story-cover-rule" aria-hidden="true" />
        </div>
      </div>
    );
  }
  if (backCover) {
    return <div className="story-leaf story-cover story-back-cover"><div className="story-paper"><span className="story-cover-mark" aria-hidden="true">ECHO</span></div></div>;
  }
  if (!section || !page) return <div className="story-leaf" aria-hidden="true" />;

  const image = page.image;
  const speakerName = (who: StoryLine['who']) => t(`story:speakers.${who}`);
  const pageLabel = t('book.pageOf', { page: pageNumber, total: totalPages });
  return (
    <article className="story-leaf" aria-label={pageLabel}>
      <div className="story-paper">
        <div className="story-page-heading">
          <p className="story-kicker">{section.title}</p>
          <span className="story-page-number" aria-hidden="true">{pageNumber}</span>
        </div>
        <div className="story-page-body">
          {image && <figure className="story-illustration">
            <img src={image.src} alt={image.alt} loading="lazy" />
            {image.credit && <figcaption>{image.credit}</figcaption>}
          </figure>}
          <div className="story-lines">
            {lines.map((line, index) => <p className={`story-line who-${line.who}`} key={`${page.id}-${index}`}>
              <span className="story-speaker">{speakerName(line.who)}</span>
              <span>{line.text}</span>
            </p>)}
          </div>
          {page.fact && <aside className="story-fact"><span className="story-fact-label">{t('book.fact')}</span><p>{page.fact}</p></aside>}
        </div>
        <footer className="story-page-footer"><span>{t(`story:${chapterId}.title`)}</span><span>{pageLabel}</span></footer>
      </div>
    </article>
  );
}
