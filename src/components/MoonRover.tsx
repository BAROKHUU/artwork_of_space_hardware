import { useCallback, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RoverFigure, type RoverMood } from './RoverFigure';
import { useDismissibleDialog } from './useDismissibleDialog';

/** Same limit as the server (server/moonMail.ts). */
const MAX_LENGTH = 500;

type Status = 'writing' | 'sending' | 'sent' | 'error';
type ErrorKind = 'not_configured' | 'too_many' | 'failed';

function endpoint() {
  const configured = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
  return configured ? `${configured}/api/moon-message` : `${import.meta.env.BASE_URL}api/moon-message`;
}

/**
 * ROVER waits at the end of every story. Children can write how they feel and ROVER "beams" it
 * to the Moon: the server emails it to the team. No name or contact details are asked for.
 */
export function MoonRover({ visible, mode }: { visible: boolean; mode: 'watercolor' | 'lantern' }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [trap, setTrap] = useState('');
  const [status, setStatus] = useState<Status>('writing');
  const [errorKind, setErrorKind] = useState<ErrorKind>('failed');
  const close = useCallback(() => setOpen(false), []);
  const dialog = useDismissibleDialog(open, close);
  const titleId = useId();
  const noteId = useId();

  const openMailbox = () => {
    // A fresh, empty letter each time after a message was sent.
    if (status === 'sent') {
      setMessage('');
      setStatus('writing');
    }
    setOpen(true);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || status === 'sending') return;
    setStatus('sending');
    try {
      const response = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, lang: i18n.resolvedLanguage ?? i18n.language, mode, website: trap }),
      });
      if (response.ok) {
        setStatus('sent');
        return;
      }
      setErrorKind(response.status === 503 ? 'not_configured' : response.status === 429 ? 'too_many' : 'failed');
    } catch {
      setErrorKind('failed');
    }
    setStatus('error');
  };

  const mood: RoverMood = status === 'sending' ? 'sending' : status === 'sent' ? 'happy' : status === 'error' ? 'sad' : message ? 'listening' : 'idle';
  const remaining = MAX_LENGTH - [...message].length;

  return (
    <>
      <button type="button" className={`moon-rover-dock${visible ? ' is-visible' : ''}`} onClick={openMailbox} aria-label={t('roverMail.open')} tabIndex={visible ? 0 : -1} aria-hidden={!visible}>
        <span className="moon-rover-dock__bubble">{t('roverMail.bubble')}</span>
        <RoverFigure mood="idle" className="moon-rover-dock__figure" />
      </button>

      <dialog {...dialog} className="moon-rover-dialog" onClose={close} aria-labelledby={titleId}>
        <button type="button" className="moon-rover-dialog__close" onClick={close} aria-label={t('roverMail.close')}>×</button>
        <div className="moon-rover-dialog__hero">
          <RoverFigure mood={mood} />
          <div className="moon-rover-dialog__moon" aria-hidden="true" />
        </div>
        <h2 id={titleId}>{t('roverMail.title')}</h2>

        {status === 'sent' ? (
          <div className="moon-rover-dialog__done" role="status">
            <p>{t('roverMail.sent')}</p>
            <div className="moon-rover-dialog__actions">
              <button type="button" className="btn ghost" onClick={() => { setMessage(''); setStatus('writing'); }}>{t('roverMail.another')}</button>
              <button type="button" className="btn primary" onClick={close}>{t('roverMail.close')}</button>
            </div>
          </div>
        ) : (
          <form onSubmit={send}>
            <p className="moon-rover-dialog__intro">{t('roverMail.intro')}</p>
            <label className="moon-rover-dialog__field">
              <span className="visually-hidden">{t('roverMail.label')}</span>
              <textarea
                value={message}
                onChange={(event) => { setMessage([...event.target.value].slice(0, MAX_LENGTH).join('')); if (status === 'error') setStatus('writing'); }}
                placeholder={t('roverMail.placeholder')}
                rows={5}
                maxLength={MAX_LENGTH * 2}
                aria-describedby={noteId}
                disabled={status === 'sending'}
                required
              />
              <small aria-live="polite">{t('roverMail.remaining', { n: remaining })}</small>
            </label>
            {/* Hidden from people; bots that fill it are ignored by the server. */}
            <input className="moon-rover-trap" type="text" name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => setTrap(event.target.value)} aria-hidden="true" />
            <p id={noteId} className="moon-rover-dialog__note">{t('roverMail.safety')}</p>
            {status === 'error' && <p className="moon-rover-dialog__error" role="alert">{t(`roverMail.error.${errorKind}`)}</p>}
            <div className="moon-rover-dialog__actions">
              <button type="button" className="btn ghost" onClick={close}>{t('roverMail.cancel')}</button>
              <button type="submit" className="btn primary" disabled={!message.trim() || status === 'sending'}>
                {status === 'sending' ? t('roverMail.sending') : t('roverMail.send')} <span aria-hidden="true">🚀</span>
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
