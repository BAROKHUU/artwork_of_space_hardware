import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { MOON_MESSAGE_MAX, createRateLimiter, formatMoonMail, mailConfigFrom, moonMailHandler, parseMoonMessage } from '../server/moonMail';

const config = mailConfigFrom({ SMTP_USER: 'sender@example.com', SMTP_PASS: 'app-password', MOON_MAIL_TO: 'team@example.com' })!;

function request(body: unknown, ip = '1.2.3.4', method = 'POST') {
  const req = Readable.from([typeof body === 'string' ? body : JSON.stringify(body)]) as unknown as IncomingMessage;
  Object.assign(req, { method, headers: { 'x-forwarded-for': ip }, socket: {} });
  return req;
}

function response() {
  const res = { status: 0, body: '' } as { status: number; body: string; writeHead: (s: number) => void; end: (b: string) => void };
  res.writeHead = (status) => { res.status = status; };
  res.end = (body) => { res.body = body; };
  return res;
}

const run = async (handler: ReturnType<typeof moonMailHandler>, req: IncomingMessage) => {
  const res = response();
  await handler(req, res as unknown as ServerResponse);
  return { status: res.status, body: JSON.parse(res.body) as Record<string, unknown> };
};

describe('moon mail', () => {
  it('needs a sender, a password and a recipient before it is enabled', () => {
    expect(mailConfigFrom({})).toBeNull();
    expect(mailConfigFrom({ SMTP_USER: 'a@b.c', SMTP_PASS: 'x' })).toBeNull();
    expect(config).toMatchObject({ host: 'smtp.gmail.com', port: 465, to: 'team@example.com', from: 'sender@example.com' });
  });

  it('accepts short messages and rejects empty, long, odd or bot-filled ones', () => {
    expect(parseMoonMessage({ message: '  Hello Moon!\r\nI miss you.  ', lang: 'vi', mode: 'lantern' })).toEqual({ message: 'Hello Moon!\nI miss you.', lang: 'vi', mode: 'lantern' });
    expect(parseMoonMessage({ message: 'hi', lang: 'xx', mode: 'other' })).toEqual({ message: 'hi', lang: 'en', mode: 'unknown' });
    expect(parseMoonMessage({ message: 'a\u0000b\u0007c' })?.message).toBe('abc');
    expect(parseMoonMessage({ message: '   ' })).toBeNull();
    expect(parseMoonMessage({ message: 'x'.repeat(MOON_MESSAGE_MAX + 1) })).toBeNull();
    expect(parseMoonMessage({ message: '🌕'.repeat(MOON_MESSAGE_MAX) })).not.toBeNull();
    expect(parseMoonMessage({ message: 42 })).toBeNull();
    expect(parseMoonMessage({ message: 'buy now', website: 'spam.example' })).toBeNull();
    expect(parseMoonMessage(null)).toBeNull();
  });

  it('keeps the child text out of the mail headers', () => {
    const mail = formatMoonMail({ message: 'Hi\nBcc: evil@example.com', lang: 'en', mode: 'watercolor' }, config, new Date('2026-11-16T00:00:00Z'));
    expect(mail.subject).toBe('A new message to the Moon');
    expect(mail.to).toBe('team@example.com');
    expect(mail.text).toContain('Hi\nBcc: evil@example.com');
    expect(mail.text).toContain('Story mode: watercolor');
  });

  it('limits how often one client can send', () => {
    let now = 0;
    const allow = createRateLimiter(2, 1000, () => now);
    expect([allow('a'), allow('a'), allow('a'), allow('b')]).toEqual([true, true, false, true]);
    now = 1000;
    expect(allow('a')).toBe(true);
  });

  it('sends a valid message and reports each kind of failure', async () => {
    const send = vi.fn().mockResolvedValue({});
    const handler = moonMailHandler(config, send, createRateLimiter(1, 60_000));
    expect(await run(handler, request({ message: 'I love the Moon', lang: 'en', mode: 'lantern' }))).toEqual({ status: 200, body: { ok: true } });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'team@example.com' });
    expect((await run(handler, request({ message: 'again' }))).status).toBe(429);
    expect((await run(handler, request({ message: '' }, '5.6.7.8'))).status).toBe(400);
    expect((await run(handler, request('{not json', '5.6.7.8'))).status).toBe(400);
    expect((await run(handler, request({ message: 'hi' }, '5.6.7.8', 'GET'))).status).toBe(405);
    expect((await run(moonMailHandler(null), request({ message: 'hi' }))).status).toBe(503);
    const failing = moonMailHandler(config, vi.fn().mockRejectedValue(new Error('smtp down')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await run(failing, request({ message: 'hi' }))).status).toBe(502);
  });
});
