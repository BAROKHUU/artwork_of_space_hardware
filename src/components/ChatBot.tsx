import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BOT_SIZE, clampPosition } from './chatPosition';

type Message = { role: 'user' | 'bot'; text: string; sources?: { title: string; url: string }[]; retrieval?: 'hybrid' | 'keyword' | 'none' };

export function ChatBot() {
  const { t } = useTranslation();
  const [position, setPosition] = useState(() => clampPosition({ x: window.innerWidth - 112, y: window.innerHeight - 112 }, window.innerWidth, window.innerHeight));
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
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
    const resize = () => setPosition((p) => clampPosition(p, window.innerWidth, window.innerHeight));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [modal]);

  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight });
  }, [messages, open]);

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
  const send = async () => {
    const text = input.trim();
    if (!text || busy.current) return;
    busy.current = true;
    const next: Message[] = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setError('');
    setPending(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/chat`, {
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
      setMessages((items) => [...items, { role: 'bot', text: data.reply as string, sources, retrieval }]);
    } catch (cause) {
      setMessages((items) => items.slice(0, -1));
      setInput((draft) => draft || text);
      setError(t(cause instanceof Error && cause.message === 'limit' ? 'chat.inputLimit' : 'chat.error'));
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const panelWidth = Math.min(340, window.innerWidth - 16);
  const panelHeight = Math.min(400, window.innerHeight - BOT_SIZE - 24);
  const panelX = Math.max(8, Math.min(position.x + BOT_SIZE / 2 - panelWidth / 2, window.innerWidth - panelWidth - 8));
  const panelY = position.y > window.innerHeight / 2
    ? Math.max(8, position.y - panelHeight - 8)
    : Math.min(position.y + BOT_SIZE + 8, window.innerHeight - panelHeight - 8);

  return createPortal(
    <div ref={layer} popover="manual" className="chat-layer">
      {open && <section className="chat-panel" aria-label={t('chat.title')} style={{ left: panelX, top: panelY }}>
        <header className="chat-header"><div><span className="eyebrow">{t('chat.eyebrow')}</span><h2>{t('chat.title')}</h2></div><button type="button" className="chat-close" aria-label={t('chat.close')} onClick={() => setOpen(false)}>×</button></header>
        <div ref={transcript} className="chat-messages" role="log" aria-live="polite" aria-label={t('chat.history')}>
          <p className="chat-message bot">{t('chat.greeting')}</p>
          {messages.map((message, i) => <div key={i} className={`chat-message ${message.role}`}><p>{message.text}</p>{message.retrieval === 'keyword' && <small>{t('chat.keywordFallback')}</small>}{!!message.sources?.length && <div className="chat-sources"><strong>{t('chat.sources')}</strong>{message.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>)}</div>}</div>)}
          {pending && <p className="chat-message bot" role="status">{t('chat.pending')}</p>}
          {error && <p className="chat-error" role="alert">{error}</p>}
        </div>
        <form className="chat-form" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <input aria-label={t('chat.input')} placeholder={t('chat.input')} value={input} onChange={(event) => setInput(event.target.value)} maxLength={8000} />
          <button className="btn primary" type="submit" disabled={!input.trim() || pending}>{t('chat.send')}</button>
        </form>
      </section>}
      <button type="button" className="chat-bot" style={{ left: position.x, top: position.y }} aria-label={t('chat.botLabel')} aria-expanded={open} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; dragged.current = true; }} onClick={() => { if (!dragged.current) setOpen((value) => !value); dragged.current = false; }} onKeyDown={(event) => {
        const step = event.shiftKey ? 40 : 10;
        const direction: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const delta = direction[event.key];
        if (delta) { event.preventDefault(); move(position.x + delta[0], position.y + delta[1]); }
        if (event.key === 'Escape') setOpen(false);
      }}><span className={`chat-bot-image ${pending || input.trim() ? 'thinking' : open ? 'greeting' : 'idle'}`} style={{ backgroundImage: `url("${import.meta.env.BASE_URL}assets/chat_bot/Lunar%20Bot%20Sticker%20Expression%20Sheet.png")` }} aria-hidden="true" /></button>
    </div>, modal ?? document.body
  );
}
