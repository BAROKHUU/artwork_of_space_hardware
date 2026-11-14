import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { calculateMmls, type AssessmentProgress } from '../assessment';
import { useGame } from '../state/store';

function formatPercent(value: number | null) {
  return value === null ? '—' : `${Math.round(value)}%`;
}

function band(value: number | null, t: (key: string) => string) {
  if (value === null) return t('learn.progress.bands.starting');
  if (value < 25) return t('learn.progress.bands.exploring');
  if (value < 50) return t('learn.progress.bands.steady');
  if (value < 80) return t('learn.progress.bands.strong');
  return t('learn.progress.bands.keeper');
}

export function Learning() {
  const { t } = useTranslation();
  const assessment = useGame((state) => state.assessment);
  const mmls = calculateMmls(assessment);
  const hasWork = Object.keys(assessment.quizzes).length > 0 || Object.keys(assessment.applications).length > 0 || Object.keys(assessment.reflections).length > 0;

  return (
    <main className="page learning">
      <header className="page-head">
        <p className="eyebrow ok">{t('learn.progress.grownups')}</p>
        <h1>{t('learn.progress.heading')}</h1>
        <p>{t('learn.progress.sub')}</p>
      </header>
      {!hasWork ? <section className="panel learning-empty"><p className="lede">{t('learn.progress.empty')}</p><Link className="btn primary" to="/map">{t('common.backToMap')}</Link></section> : (
        <>
          <section className="learning-hero panel">
            <div><p className="eyebrow">{t('learn.grownups.mmls')}</p><strong>{formatPercent(mmls.overall)}</strong><p>{band(mmls.overall, t)}</p></div>
            <div className="learning-gain"><span>{t('learn.grownups.gain')}</span><b>{formatPercent(mmls.learningGain)}</b></div>
          </section>
          <section className="learning-components" aria-label={t('learn.progress.components.quiz')}>
            {([
              ['quiz', mmls.quiz, 'learn.grownups.quiz'],
              ['open', mmls.open, 'learn.grownups.open'],
              ['apply', mmls.apply, 'learn.grownups.apply'],
            ] as const).map(([key, value, label]) => <article className="panel learning-card" key={key}><p className="eyebrow">{t(label)}</p><strong>{formatPercent(value)}</strong><div className="learning-bar"><i style={{ width: `${value ?? 0}%` }} /></div><p className="hint">{value === null ? t('learn.grownups.missing') : band(value, t)}</p></article>)}
          </section>
          <section className="panel learning-details">
            <h2>{t('learn.grownups.responses')}</h2>
            {Object.entries(assessment.reflections).length === 0 ? <p className="hint">{t('learn.grownups.none')}</p> : <div className="reflection-list">{Object.entries(assessment.reflections).map(([key, value]) => <article key={key}><p className="eyebrow">{t(`learn.reflect.prompts.${key}.question`)}</p><p>{value.answer || t('learn.grownups.missing')}</p><p className="hint">{value.review ? `${value.review.source === 'gemini' ? t('learn.grownups.source.ai') : t('learn.grownups.source.fallback')} · ${t('learn.grownups.score', { score: value.review.score, max: value.review.max })}` : t('learn.grownups.source.pending')}</p></article>)}</div>}
            <p className="small-note">{t('learn.grownups.privacy')}</p>
          </section>
        </>
      )}
      <div className="row learning-links"><Link className="btn ghost" to="/map">{t('learn.grownups.back')}</Link><Link className="btn ghost" to="/sources">{t('nav.sources')}</Link></div>
    </main>
  );
}

export function LearningData({ progress }: { progress: AssessmentProgress }) {
  return calculateMmls(progress);
}
