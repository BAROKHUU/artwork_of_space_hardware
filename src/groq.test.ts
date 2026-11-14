import { describe, expect, it, vi } from 'vitest';
import { requestGroq } from '../server/groq';

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
});
