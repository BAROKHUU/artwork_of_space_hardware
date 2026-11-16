import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { clampPosition, panelLayout } from './chatPosition';
import { mediaUrl } from '../media';

type Grounding = 'nasa' | 'mixed' | 'general';
type Message = { role: 'user' | 'bot'; text: string; sources?: { title: string; url: string }[]; retrieval?: 'hybrid' | 'keyword' | 'none'; grounding?: Grounding };

const EXPANDED_KEY = 'echo.chat.expanded';
const supportsFieldSizing = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');

function readExpanded() {
  try { return localStorage.getItem(EXPANDED_KEY) === '1'; } catch { return false; }
}

const MessageList = memo(function MessageList({ messages, pending, error }: { messages: Message[]; pending: boolean; error: string }) {
  const { t } = useTranslation();
  return (
    <>
      <p className="chat-message bot">{t('chat.greeting')}</p>
      {messages.map((message, i) => (
        <div key={i} className={`chat-message ${message.role}`}>
          <p>{message.text}</p>
          {(message.grounding === 'general' || message.grounding === 'mixed') && (
            <p className={`chat-grounding ${message.grounding}`}><span aria-hidden="true">ⓘ</span> {t(message.grounding === 'general' ? 'chat.generalNote' : 'chat.mixedNote')}</p>
          )}
          {message.retrieval === 'keyword' && message.grounding !== 'general' && <small>{t('chat.keywordFallback')}</small>}
          {!!message.sources?.length && <div className="chat-sources"><strong>{t('chat.sources')}</strong>{message.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>)}</div>}
        </div>
      ))}
      {pending && <p className="chat-message bot chat-pending" role="status"><span className="chat-dots" aria-hidden="true"><i /><i /><i /></span><span className="visually-hidden">{t('chat.pending')}</span></p>}
      {error && <p className="chat-error" role="alert">{error}</p>}
    </>
  );
});

/** Keeps the draft in its own state so typing never re-renders the transcript. */
const Composer = memo(function Composer({ busy, onSend, onTyping, restore }: { busy: boolean; onSend: (text: string) => void; onTyping: (typing: boolean) => void; restore: { text: string; id: number } | null }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const typing = draft.trim().length > 0;

  useEffect(() => { onTyping(typing); }, [typing, onTyping]);
  useEffect(() => { if (restore) setDraft((current) => current || restore.text); }, [restore]);
  useEffect(() => { field.current?.focus({ preventScroll: true }); }, []);
  useLayoutEffect(() => {
    const el = field.current;
    if (!el || supportsFieldSizing) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    onSend(text);
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };
  return (
    <form className="chat-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <textarea ref={field} rows={1} aria-label={t('chat.input')} placeholder={t('chat.input')} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={keyDown} maxLength={8000} />
      <button className="btn primary" type="submit" disabled={!typing || busy}>{t('chat.send')}</button>
    </form>
  );
});

export function ChatBot() {
  const { t } = useTranslation();
  const [position, setPosition] = useState(() => clampPosition({ x: window.innerWidth - 112, y: window.innerHeight - 112 }, window.innerWidth, window.innerHeight));
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(readExpanded);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [restore, setRestore] = useState<{ text: string; id: number } | null>(null);
  const history = useRef<Message[]>([]);
  const busy = useRef(false);
  const [modal, setModal] = useState<HTMLDialogElement | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateModal = () => {
      const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog:modal');
      setModal(dialogs[dialogs.length - 1] ?? null);
    };
    const observer = new MutationObserver(updateModal);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    updateModal();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    layer.current?.showPopover?.();
    const resize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setPosition((p) => clampPosition(p, window.innerWidth, window.innerHeight));
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [modal]);

  useEffect(() => {
    try { localStorage.setItem(EXPANDED_KEY, expanded ? '1' : '0'); } catch { /* storage unavailable */ }
  }, [expanded]);

  useEffect(() => {
    const el = transcript.current;
    if (!el) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, [messages, pending, open, expanded]);

  const move = (x: number, y: number) => setPosition(clampPosition({ x, y }, window.innerWidth, window.innerHeight));
  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    dragged.current = false;
    drag.current = { x: event.clientX, y: event.clientY, originX: position.x, originY: position.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (Math.hypot(dx, dy) > 5) d.moved = true;
    if (d.moved) move(d.originX + dx, d.originY + dy);
  };
  const pointerUp = () => {
    dragged.current = drag.current?.moved ?? false;
    drag.current = null;
  };

  const send = useCallback(async (text: string) => {
    if (busy.current) return;
    busy.current = true;
    const next: Message[] = [...history.current, { role: 'user', text }];
    history.current = next;
    setMessages(next);
    setError('');
    setPending(true);
    try {
      const configuredApi = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
      const chatEndpoint = configuredApi ? `${configuredApi}/api/chat` : `${import.meta.env.BASE_URL}api/chat`;
      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-20).map((item) => ({ role: item.role === 'bot' ? 'assistant' : 'user', content: item.text })) }),
      });
      if (!response.ok) throw new Error(response.status === 413 ? 'limit' : 'request');
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('reply' in data) || typeof data.reply !== 'string') throw new Error('request');
      const sources = 'sources' in data && Array.isArray(data.sources)
        ? data.sources.filter((source): source is { title: string; url: string } => source && typeof source.title === 'string' && typeof source.url === 'string' && /^https:\/\/(?:[a-z0-9-]+\.)*nasa\.gov\//i.test(source.url))
        : [];
      const retrieval = 'retrieval' in data && (data.retrieval === 'hybrid' || data.retrieval === 'keyword') ? data.retrieval : 'none';
      const grounding: Grounding = 'grounding' in data && (data.grounding === 'mixed' || data.grounding === 'general') ? data.grounding : 'nasa';
      history.current = [...history.current, { role: 'bot', text: data.reply, sources, retrieval, grounding }];
      setMessages(history.current);
    } catch (cause) {
      history.current = history.current.slice(0, -1);
      setMessages(history.current);
      setRestore({ text, id: Date.now() });
      setError(t(cause instanceof Error && cause.message === 'limit' ? 'chat.inputLimit' : 'chat.error'));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, [t]);
  const sendMessage = useCallback((text: string) => { void send(text); }, [send]);

  const panel = panelLayout(position, viewport.width, viewport.height, expanded);
  const mood = pending || typing ? 'thinking' : open ? 'greeting' : 'idle';

  return createPortal(
    <div ref={layer} popover="manual" className="chat-layer">
      {open && <section className={`chat-panel${expanded ? ' expanded' : ''}`} aria-label={t('chat.title')} style={{ left: panel.x, top: panel.y, width: panel.width, height: panel.height }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
        <header className="chat-header">
          <div><span className="eyebrow">{t('chat.eyebrow')}</span><h2>{t('chat.title')}</h2></div>
          <div className="chat-actions">
            <button type="button" className="chat-icon" aria-label={t(expanded ? 'chat.shrink' : 'chat.expand')} title={t(expanded ? 'chat.shrink' : 'chat.expand')} aria-pressed={expanded} onClick={() => setExpanded((value) => !value)}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {expanded ? <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /> : <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />}
              </svg>
            </button>
            <button type="button" className="chat-icon" aria-label={t('chat.close')} title={t('chat.close')} onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </header>
        <div ref={transcript} className="chat-messages" role="log" aria-live="polite" aria-label={t('chat.history')}>
          <MessageList messages={messages} pending={pending} error={error} />
        </div>
        <Composer busy={pending} onSend={sendMessage} onTyping={setTyping} restore={restore} />
      </section>}
      <button type="button" className="chat-bot" style={{ left: position.x, top: position.y }} aria-label={t('chat.botLabel')} aria-expanded={open} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; dragged.current = true; }} onClick={() => { if (!dragged.current) setOpen((value) => !value); dragged.current = false; }} onKeyDown={(event) => {
        const step = event.shiftKey ? 40 : 10;
        const direction: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const delta = direction[event.key];
        if (delta) { event.preventDefault(); move(position.x + delta[0], position.y + delta[1]); }
        if (event.key === 'Escape') setOpen(false);
      }}><span className={`chat-bot-image ${mood}`} style={{ backgroundImage: `url("${mediaUrl('assets/chat_bot/Lunar Bot Sticker Expression Sheet.png')}")` }} aria-hidden="true" /></button>
    </div>, modal ?? document.body
  );
}
