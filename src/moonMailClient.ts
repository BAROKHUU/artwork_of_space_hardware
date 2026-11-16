/**
 * Where ROVER's Moon mail goes from the browser.
 *
 * With `VITE_FORMSUBMIT_ID` set, the letter is posted straight to FormSubmit (formsubmit.co), which
 * emails it to the team: no server or mail password needed. Use the random ID FormSubmit sends after
 * activation, not the email address itself, because this value ships inside the public bundle.
 * Without it, the letter goes to this app's own `/api/moon-message` route (SMTP, server/moonMail.ts).
 */

export interface MoonLetter { message: string; lang: string; mode: string; trap: string }
export type MoonMailResult = 'sent' | 'not_configured' | 'too_many' | 'failed';

const FORMSUBMIT = 'https://formsubmit.co/ajax/';

export function moonMailRequest(letter: MoonLetter, env: { formSubmitId?: string; apiUrl?: string; base?: string }): { url: string; init: RequestInit } {
  const formId = env.formSubmitId?.trim();
  if (formId) {
    return {
      url: FORMSUBMIT + encodeURIComponent(formId),
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: 'A new message to the Moon',
          _template: 'box',
          _captcha: 'false',
          // FormSubmit drops any submission whose `_honey` field is filled: only bots fill it.
          _honey: letter.trap,
          message: letter.message,
          language: letter.lang,
          story_mode: letter.mode,
          note: 'No name, email, or other contact details are collected with this message.',
        }),
      },
    };
  }
  const api = env.apiUrl?.trim().replace(/\/$/, '');
  return {
    url: api ? `${api}/api/moon-message` : `${env.base ?? '/'}api/moon-message`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: letter.message, lang: letter.lang, mode: letter.mode, website: letter.trap }),
    },
  };
}

/**
 * FormSubmit answers 200 even when it refuses a letter, with `success: "false"` and a message,
 * for example when the form has not been activated yet. Only an explicit success counts as sent.
 */
export async function readMoonMailReply(response: Pick<Response, 'ok' | 'status' | 'json'>, viaFormSubmit: boolean): Promise<MoonMailResult> {
  if (!viaFormSubmit) {
    if (response.ok) return 'sent';
    return response.status === 503 ? 'not_configured' : response.status === 429 ? 'too_many' : 'failed';
  }
  if (response.status === 429) return 'too_many';
  const data = (await response.json().catch(() => null)) as { success?: unknown; message?: unknown } | null;
  if (response.ok && (data?.success === true || data?.success === 'true')) return 'sent';
  if (typeof data?.message === 'string' && /activat/i.test(data.message)) return 'not_configured';
  return 'failed';
}
