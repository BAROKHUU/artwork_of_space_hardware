import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

type Message = { role: 'user' | 'assistant'; content: string };

export async function requestGroq(input: unknown, key: string, fetcher = fetch): Promise<string> {
  if (!Array.isArray(input) || input.length < 1 || input.length > 20 || !input.every((item): item is Message =>
    item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string' && item.content.trim().length > 0 && item.content.length <= 4000
  ) || input[input.length - 1].role !== 'user') throw new Error('Invalid messages');
  const response = await fetcher('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'openai/gpt-oss-20b', max_completion_tokens: 1024, messages: [
      { role: 'system', content: 'You are Lunar Bot, a friendly guide for the ECHO space exploration game. Help users learn about NASA missions and hardware. Answer in the user’s language, be concise, and acknowledge uncertainty.' },
      ...input,
    ] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('Groq request failed');
  const data = await response.json() as { choices?: { message?: { content?: unknown } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Empty response');
  return text;
}

function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function groqPlugin(key: string, password: string): Plugin {
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, data: object) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
    if (!key || !password) return reply(503, { error: 'Chat is not configured' });
    const provided = req.headers['x-chat-password'];
    if (typeof provided !== 'string' || !sameSecret(provided, password)) return reply(401, { error: 'Invalid access code' });
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > 50000) return reply(413, { error: 'Request too large' });
      }
      const parsed = JSON.parse(body) as { messages?: unknown };
      const text = await requestGroq(parsed.messages, key);
      return reply(200, { reply: text });
    } catch {
      return reply(502, { error: 'Could not get a response' });
    }
  };
  const attach = (server: { middlewares: { use: (path: string, callback: (req: IncomingMessage, res: ServerResponse) => void) => unknown } }) => {
    server.middlewares.use('/api/chat', (req, res) => { void handle(req, res); });
  };
  return { name: 'groq-chat', configureServer: attach, configurePreviewServer: attach };
}
