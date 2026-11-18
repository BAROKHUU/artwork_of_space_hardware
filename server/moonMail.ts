import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * "Send a message to the Moon": a child writes a few lines to ROVER at the end of the story,
 * and the server emails them to the team. Nothing is stored; the mail is plain text.
 */

export const MOON_MESSAGE_MAX = 500;
const LANGS = new Set(['en', 'vi', 'zh-CN', 'es', 'ja']);
const MODES = new Set(['watercolor', 'lantern']);

export interface MoonMessage { message: string; lang: string; mode: string }
export interface MailConfig { host: string; port: number; user: string; pass: string; to: string; from: string }
export type SendMail = (mail: { from: string; to: string; subject: string; text: string }) => Promise<unknown>;

/** Reads the server's mail settings. Returns null when anything required is missing. */
export function mailConfigFrom(env: Record<string, string | undefined>): MailConfig | null {
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.trim();
  const to = env.MOON_MAIL_TO?.trim();
  if (!user || !pass || !to) return null;
  const port = Number(env.SMTP_PORT || 465);
  return { host: env.SMTP_HOST?.trim() || 'smtp.gmail.com', port: Number.isInteger(port) ? port : 465, user, pass, to, from: env.SMTP_FROM?.trim() || user };
}

/** Accepts only a short, non-empty message. Control characters are removed; line breaks are kept. */
export function parseMoonMessage(input: unknown): MoonMessage | null {
  if (!input || typeof input !== 'object') return null;
  const body = input as Record<string, unknown>;
  // Bots fill every field; people never see this one.
  if (typeof body.website === 'string' && body.website.trim()) return null;
  if (typeof body.message !== 'string') return null;
  const message = body.message.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
  if (!message || [...message].length > MOON_MESSAGE_MAX) return null;
  const lang = typeof body.lang === 'string' && LANGS.has(body.lang) ? body.lang : 'en';
  const mode = typeof body.mode === 'string' && MODES.has(body.mode) ? body.mode : 'unknown';
  return { message, lang, mode };
}

/** Builds the email. The child's text only ever goes into the plain-text body, never a header. */
export function formatMoonMail(msg: MoonMessage, config: MailConfig, now = new Date()) {
  return {
    from: `Echo Moon Mail <${config.from}>`,
    to: config.to,
    subject: 'A new message to the Moon',
    text: [
      'A reader sent this message to the Moon through ROVER:',
      '',
      msg.message,
      '',
      '---',
      `Language: ${msg.lang}`,
      `Story mode: ${msg.mode}`,
      `Sent: ${now.toISOString()}`,
      'No name, email, or other contact details are collected with this message.',
    ].join('\n'),
  };
}

/** A small in-memory limit per client, so one page cannot flood the inbox. */
export function createRateLimiter(limit: number, windowMs: number, clock = () => Date.now()) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = clock();
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.delete(hits.keys().next().value!);
    return true;
  };
}

async function smtpSender(config: MailConfig): Promise<SendMail> {
  const { createTransport } = await import('nodemailer');
  const transport = createTransport({ host: config.host, port: config.port, secure: config.port === 465, auth: { user: config.user, pass: config.pass } });
  return (mail) => transport.sendMail(mail);
}

type MoonRequest = IncomingMessage & { body?: unknown };

export function moonMailHandler(config: MailConfig | null, send?: SendMail, allow = createRateLimiter(3, 10 * 60 * 1000)) {
  let sender: Promise<SendMail> | null = send ? Promise.resolve(send) : null;
  return async (req: MoonRequest, res: ServerResponse) => {
    const reply = (status: number, data: object) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    if (!config) return reply(503, { error: 'not_configured' });
    try {
      let raw: unknown = req.body;
      if (raw === undefined) {
        let text = '';
        for await (const chunk of req) {
          text += chunk.toString();
          if (text.length > 8000) return reply(413, { error: 'too_large' });
        }
        raw = JSON.parse(text);
      } else if (typeof raw === 'string') {
        raw = JSON.parse(raw);
      }
      const msg = parseMoonMessage(raw);
      if (!msg) return reply(400, { error: 'invalid_message' });
      const forwarded = req.headers['x-forwarded-for'];
      const client = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
      if (!allow(client)) return reply(429, { error: 'too_many' });
      sender ??= smtpSender(config);
      await (await sender)(formatMoonMail(msg, config));
      return reply(200, { ok: true });
    } catch (error) {
      if (error instanceof SyntaxError) return reply(400, { error: 'invalid_json' });
      console.error('Moon mail failed:', error instanceof Error ? error.message : error);
      return reply(502, { error: 'send_failed' });
    }
  };
}

export function moonMailPlugin(env: Record<string, string | undefined>): Plugin {
  const handle = moonMailHandler(mailConfigFrom(env));
  const attach = (server: { middlewares: { use: (path: string, callback: (req: IncomingMessage, res: ServerResponse) => void) => unknown } }) => {
    server.middlewares.use('/api/moon-message', (req, res) => { void handle(req, res); });
  };
  return { name: 'moon-mail', configureServer: attach, configurePreviewServer: attach };
}
