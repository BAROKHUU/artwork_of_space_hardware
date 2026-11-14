import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const MODEL = 'embed-v4.0';
const DIMENSION = 512;
const started = performance.now();
const key = process.env.COHERE_API_KEY;
if (!key) throw new Error('COHERE_API_KEY is missing. Add it to .env.local or the environment.');
const docs = JSON.parse(await readFile('knowledge/nasa.json', 'utf8'));
if (!Array.isArray(docs) || !docs.length || docs.some((doc) => !doc.id || !doc.title || !Array.isArray(doc.aliases) || !doc.text || !Array.isArray(doc.sources))) throw new Error('Invalid knowledge documents');
const texts = docs.map((doc) => `${doc.title}\n${doc.aliases.join(', ')}\n${doc.text}`);
console.log(`Indexing ${texts.length} NASA records with ${MODEL}...`);
const response = await fetch('https://api.cohere.com/v2/embed', {
  method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: MODEL, texts, input_type: 'search_document', embedding_types: ['float'], output_dimension: DIMENSION }),
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Cohere embedding request failed with HTTP ${response.status}`);
const data = await response.json();
const vectors = data.embeddings?.float;
if (!Array.isArray(vectors) || vectors.length !== docs.length || !vectors.every((v) => Array.isArray(v) && v.length === DIMENSION && v.every(Number.isFinite))) throw new Error('Cohere returned invalid vectors');
const index = { model: MODEL, dimension: DIMENSION, documentHash: createHash('sha256').update(JSON.stringify(docs)).digest('hex'), vectors };
const temporary = `knowledge/index.${process.pid}.tmp`;
try {
  await writeFile(temporary, `${JSON.stringify(index)}\n`);
  await rename(temporary, 'knowledge/index.json');
} catch (error) {
  const { unlink } = await import('node:fs/promises');
  await unlink(temporary).catch(() => {});
  throw error;
}
console.log(`Wrote ${vectors.length} vectors to knowledge/index.json in ${((performance.now() - started) / 1000).toFixed(1)}s.`);
