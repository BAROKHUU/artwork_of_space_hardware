import { createServer } from 'node:http';
import { chatHandler } from './groq.ts';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
const handleChat = chatHandler(
  process.env.GROQ_API_KEY ?? '',
  process.env.COHERE_API_KEY ?? '',
  process.env.GROQ_API_KEY_2 ?? '',
);

const server = createServer((req, res) => {
  const origin = req.headers.origin?.replace(/\/$/, '');
  const originAllowed = !origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  if (origin && originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(originAllowed ? 204 : 403);
    return res.end();
  }
  if (!originAllowed) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Origin not allowed' }));
  }

  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }
  if (pathname === '/api/chat') return void handleChat(req, res);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Chat API listening on port ${port}`);
});
