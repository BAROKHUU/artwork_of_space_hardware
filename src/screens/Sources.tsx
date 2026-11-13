import { useTranslation } from 'react-i18next';
import { backdrops, hardware, sources } from '../data';

export function Sources() {
  const { t } = useTranslation();
  return (
    <main className="page prose">
      <header className="page-head">
        <h1>{t('sources.heading')}</h1>
        <p>{t('sources.sub')}</p>
      </header>
      <div className="two-col">
        <section>
          <h2>{t('sources.real')}</h2>
          <p>{t('sources.realBody')}</p>
        </section>
        <section>
          <h2>{t('sources.simplified')}</h2>
          <p>{t('sources.simplifiedBody')}</p>
        </section>
      </div>
      <p className="checked">{t('sources.date')} {t('sources.notEndorsed')}</p>
      <h2>{t('sources.listHeading')}</h2>
      <h2>{t('sources.software')}</h2>
      <p>{t('sources.flipbookNotice')} <a href="/third-party/NOTICE.txt">{t('sources.noticeLink')}</a> · <a href="/third-party/MPL-2.0.txt">{t('sources.mplLink')}</a></p>
      <ul className="source-list wide">
        <li><a href="https://www.npmjs.com/package/@gullabs/react-flipbook/v/3.2.2" target="_blank" rel="noreferrer">@gullabs/react-flipbook 3.2.2</a> <small>MIT · <a href="https://github.com/gul-labs/flipbook/tree/main/packages/react" target="_blank" rel="noreferrer">{t('sources.wrapperSource')}</a></small></li>
        <li><a href="https://www.npmjs.com/package/@gullabs/flipbook-core/v/3.2.2" target="_blank" rel="noreferrer">@gullabs/flipbook-core 3.2.2</a> <small>MPL-2.0 · <a href="https://github.com/gul-labs/flipbook/tree/main/packages/core" target="_blank" rel="noreferrer">{t('sources.coreSource')}</a></small></li>
        <li><a href="https://www.mozilla.org/media/MPL/2.0/index.815ca599c9df.txt" target="_blank" rel="noreferrer">{t('sources.mplOfficial')}</a></li>
      </ul>
      <ul className="source-list wide">
        {Object.entries(sources).map(([id, s]) => <li key={id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> <small>{s.org}</small></li>)}
      </ul>
      <h2>{t('sources.images')}</h2>
      <ul className="source-list wide">
        {hardware.map((h) => (
          <li key={h.id}>
            <a href={`https://images.nasa.gov/details/${h.nasaId}`} target="_blank" rel="noreferrer">{t(`hardware:${h.id}.name`)}</a> <small>{h.credit} · {h.nasaId}</small>
          </li>
        ))}
      </ul>
      <h2>{t('sources.backgrounds')}</h2>
      <ul className="source-list wide">
        {Object.entries(backdrops).map(([key, b]) => (
          <li key={key}>
            <a href={`https://images.nasa.gov/details/${b.nasaId}`} target="_blank" rel="noreferrer">{t(`sources.backdrop.${key}`)}</a> <small>{b.credit} · {b.nasaId}</small>
          </li>
        ))}
      </ul>
    </main>
  );
}
