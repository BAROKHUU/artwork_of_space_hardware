import { describe, expect, it, vi } from 'vitest';
import { chatHandler, requestGroq } from '../server/groq';

describe('Groq chat', () => {
  it('sends validated conversation and returns the response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Hello Moon!' } }] }), { status: 200 }));
    const result = await requestGroq([{ role: 'user', content: 'Hello' }], 'test-key', fetcher);
    expect(result).toBe('Hello Moon!');
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('rejects invalid conversation and upstream failures', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    await expect(requestGroq([{ role: 'system', content: 'bad' }], 'test-key', fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await expect(requestGroq([{ role: 'user', content: 'Hi' }], 'test-key', fetcher)).rejects.toThrow();
  });
  it('includes only retrieved NASA context in the system instructions', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'InSight' } }] }), { status: 200 }));
    await requestGroq([{ role: 'user', content: 'What detected marsquakes?' }], 'test-key', fetcher, [{ id: 'insight', title: 'InSight', aliases: [], text: 'InSight detected marsquakes.', sources: ['https://science.nasa.gov/mission/insight/'] }]);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('InSight detected marsquakes.');
    expect(body.messages[0].content).toContain('https://science.nasa.gov/mission/insight/');
  });
  it('rejects oversized questions before contacting an API', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const writeHead = vi.fn();
    const end = vi.fn();
    const request = { method: 'POST', headers: {}, body: { messages: [{ role: 'user', content: 'hello '.repeat(530) }] } };
    await chatHandler('test-key', '')(request as never, { writeHead, end } as never);
    expect(writeHead).toHaveBeenCalledWith(413, expect.any(Object));
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRestore();
  });
  it('uses the backup key when the primary hits the rate limit', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'Backup reply' } }] }), { status: 200 }));
    expect(await requestGroq([{ role: 'user', content: 'Hi' }], 'primary', fetcher, undefined, 'backup')).toBe('Backup reply');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer primary');
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer backup');
  });
  it('does not retry invalid requests or retry without a backup key', async () => {
    const badRequest = vi.fn().mockResolvedValue(new Response('', { status: 400 }));
    await expect(requestGroq([{ role: 'user', content: 'Hi' }], 'primary', badRequest, undefined, 'backup')).rejects.toThrow();
    expect(badRequest).toHaveBeenCalledTimes(1);
    const limited = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    await expect(requestGroq([{ role: 'user', content: 'Hi' }], 'primary', limited)).rejects.toThrow();
    expect(limited).toHaveBeenCalledTimes(1);
  });
  it('reports failure when both keys are exhausted', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    await expect(requestGroq([{ role: 'user', content: 'Hi' }], 'primary', fetcher, undefined, 'backup')).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
