import { afterEach, describe, expect, it, vi } from 'vitest';
import assess from '../api/assess';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const post = (body: unknown) => assess(new Request('http://localhost/api/assess', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('assessment endpoint', () => {
  it.each([null, [], 'text'])('rejects non-object JSON bodies: %j', async (body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_input' });
  });

  it('rejects inherited property names as unknown questions', async () => {
    const response = await post({ questionId: 'toString', answer: 'A reasonable answer.' });
    expect(response.status).toBe(400);
  });

  it('falls back locally when Gemini returns inconsistent rubric scores', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ score: 4, criteria: [{ key: 'data', score: 2, max: 2 }, { key: 'continuation', score: 2, max: 2 }, { key: 'own_words', score: 1, max: 1 }], concepts: [] }) }] } }] }), { status: 200 })));
    const response = await post({ questionId: 'r2', answer: 'The data record helps scientists study the moon today.' });
    expect((await response.json()).source).toBe('local');
  });

  it('falls back locally when Gemini exceeds the request timeout', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      throw new DOMException('timed out', 'AbortError');
    }));
    const response = await post({ questionId: 'r2', answer: 'The data record helps scientists study the moon today.' });
    expect(timeout).toHaveBeenCalledWith(8000);
    expect((await response.json()).source).toBe('local');
  });
});
