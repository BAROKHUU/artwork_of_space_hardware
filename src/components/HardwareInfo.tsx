import { useTranslation } from 'react-i18next';
import { photoUrl } from '../data';
import type { Fate, Hardware } from '../data/types';
import { useGame } from '../state/store';

export function FateBadge({ fate }: { fate: Fate }) {
  const { t } = useTranslation();
  return <span className={`fate fate-${fate}`}>{t(`fate.${fate}`)}</span>;
}

/** Dates may be YYYY, YYYY-MM, or YYYY-MM-DD. Only the given precision is shown. */
export function formatDate(value: string, locale: string): string {
  const parts = value.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1));
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', timeZone: 'UTC' };
  if (parts[1]) options.month = 'long';
  if (parts[2]) options.day = 'numeric';
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function Facts({ item }: { item: Hardware }) {
  const { t, i18n } = useTranslation();
  const reading = useGame((s) => s.reading);
  return (
    <>
      <p className="lede">{t(`hardware:${item.id}.${reading}`)}</p>
      <dl className="facts">
        <dt>{t('memory.learned')}</dt>
        <dd>{t(`hardware:${item.id}.learned`)}</dd>
        <dt>{t('memory.now')}</dt>
        <dd>{t(`hardware:${item.id}.now`)}</dd>
      </dl>
      <ul className="dates">
        {Object.entries(item.dates).map(([k, v]) => (
          <li key={k}><span>{t(`dates.${k}`)}</span>{formatDate(v, i18n.language)}</li>
        ))}
      </ul>
    </>
  );
}

export function Photo({ item }: { item: Hardware }) {
  const { t } = useTranslation();
  return (
    <figure className="photo">
      <img src={photoUrl(item.photo)} alt={t(`hardware:${item.id}.name`)} loading="lazy" />
      <figcaption>{t('logbook.credit', { credit: item.credit, id: item.nasaId })}</figcaption>
    </figure>
  );
}
