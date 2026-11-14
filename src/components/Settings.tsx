import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n/languages';
import { useGame, type Quality, type Reading } from '../state/store';

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; text: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="choice" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.text}</button>
      ))}
    </div>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const g = useGame();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (g.settingsOpen && !d.open) d.showModal();
    if (!g.settingsOpen && d.open) d.close();
  }, [g.settingsOpen]);

  const onOff = [{ v: 'on', text: t('settings.on') }, { v: 'off', text: t('settings.off2') }];
  return (
    <dialog ref={ref} className="settings" onClose={() => g.update({ settingsOpen: false })} aria-labelledby="settings-title">
      <div className="settings-head">
        <h2 id="settings-title">{t('settings.heading')}</h2>
        <button type="button" className="btn ghost" onClick={() => g.update({ settingsOpen: false })}>{t('settings.close')}</button>
      </div>

      <label className="field">
        <span>{t('settings.language')}</span>
        <select value={g.language} onChange={(e) => g.update({ language: e.target.value })}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <small>{t('settings.languageNote')}</small>
      </label>

      <div className="field">
        <span>{t('settings.reading')}</span>
        <Choice<Reading> label={t('settings.reading')} value={g.reading} onChange={(reading) => g.update({ reading })} options={[{ v: 'young', text: t('settings.young') }, { v: 'older', text: t('settings.older') }]} />
      </div>

      <div className="field">
        <span>{t('settings.quality')}</span>
        <Choice<Quality> label={t('settings.quality')} value={g.quality} onChange={(quality) => g.update({ quality })} options={[{ v: 'high', text: t('settings.high') }, { v: 'low', text: t('settings.low') }, { v: 'off', text: t('settings.off') }]} />
      </div>

      <div className="field">
        <span>{t('settings.sound')}</span>
        <Choice label={t('settings.sound')} value={g.sound ? 'on' : 'off'} onChange={(v) => g.update({ sound: v === 'on' })} options={onOff} />
      </div>

      <div className="field">
        <span>{t('settings.explorer')}</span>
        <Choice label={t('settings.explorer')} value={g.explorer ? 'on' : 'off'} onChange={(v) => g.update({ explorer: v === 'on' })} options={onOff} />
        <small>{t('settings.explorerNote')}</small>
      </div>

      <div className="field">
        <span>{t('settings.narration')}</span>
        <Choice label={t('settings.narration')} value={g.narration ? 'on' : 'off'} onChange={(v) => g.update({ narration: v === 'on' })} options={onOff} />
        <small>{t('settings.narrationNote')}</small>
      </div>

      <p className="privacy">{t('settings.privacy')}</p>
      <button type="button" className="btn danger" onClick={() => { if (window.confirm(t('settings.resetConfirm'))) g.reset(); }}>{t('settings.reset')}</button>
    </dialog>
  );
}
