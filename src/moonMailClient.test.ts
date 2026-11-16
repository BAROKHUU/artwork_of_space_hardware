import { describe, expect, it } from 'vitest';
import { moonMailRequest, readMoonMailReply } from './moonMailClient';

const letter = { message: 'Dear Moon, hi!', lang: 'vi', mode: 'lantern', trap: '' };
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('moon mail requests', () => {
  it('posts to FormSubmit when a form ID is configured', () => {
    const { url, init } = moonMailRequest(letter, { formSubmitId: ' abc123 ', apiUrl: 'https://api.example.com' });
    expect(url).toBe('https://formsubmit.co/ajax/abc123');
    expect(init.headers).toMatchObject({ Accept: 'application/json' });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ message: 'Dear Moon, hi!', language: 'vi', story_mode: 'lantern', _honey: '', _captcha: 'false' });
  });
  it('falls back to the app API without a form ID', () => {
    expect(moonMailRequest(letter, { base: './' }).url).toBe('./api/moon-message');
    expect(moonMailRequest(letter, { apiUrl: 'https://api.example.com/' }).url).toBe('https://api.example.com/api/moon-message');
    expect(JSON.parse(String(moonMailRequest(letter, {}).init.body))).toMatchObject({ message: 'Dear Moon, hi!', website: '' });
  });
});

describe('moon mail replies', () => {
  it('counts only an explicit FormSubmit success as sent', async () => {
    expect(await readMoonMailReply(reply(200, { success: 'true', message: 'The form was submitted successfully.' }), true)).toBe('sent');
    expect(await readMoonMailReply(reply(200, { success: 'false', message: 'This form needs Activation. We\'ve sent you an email.' }), true)).toBe('not_configured');
    expect(await readMoonMailReply(reply(200, { success: 'false', message: 'Something else' }), true)).toBe('failed');
    expect(await readMoonMailReply(reply(500, null), true)).toBe('failed');
    expect(await readMoonMailReply(reply(429, null), true)).toBe('too_many');
  });
  it('maps the app API status codes', async () => {
    expect(await readMoonMailReply(reply(200, { ok: true }), false)).toBe('sent');
    expect(await readMoonMailReply(reply(503, {}), false)).toBe('not_configured');
    expect(await readMoonMailReply(reply(429, {}), false)).toBe('too_many');
    expect(await readMoonMailReply(reply(502, {}), false)).toBe('failed');
  });
});
