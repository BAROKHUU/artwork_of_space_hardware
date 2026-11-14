import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { buildChunks, CHUNK_WORDS, OVERLAP_WORDS } from '../knowledge/chunks.ts';

const MODEL = 'embed-v4.0';
const DIMENSION = 512;
const started = performance.now();
const key = process.env.COHERE_API_KEY;
if (!key) throw new Error('COHERE_API_KEY is missing. Add it to .env.local or the environment.');
const docs = [...JSON.parse(await readFile('knowledge/nasa.json', 'utf8')), ...JSON.parse(await readFile('knowledge/crawled.json', 'utf8'))];
if (!Array.isArray(docs) || !docs.length || docs.some((doc) => !doc.id || !doc.title || !Array.isArray(doc.aliases) || !doc.text || !Array.isArray(doc.sources))) throw new Error('Invalid knowledge documents');
if (new Set(docs.map((doc) => doc.id)).size !== docs.length) throw new Error('Duplicate document IDs');
const chunks = buildChunks(docs);
const texts = chunks.map((chunk) => `${chunk.title}\n${chunk.aliases.join(', ')}\n${chunk.text}`);
console.log(`Indexing ${chunks.length} chunks from ${docs.length} NASA records with ${MODEL}...`);
const vectors = [];
for (let start = 0; start < texts.length; start += 96) {
  const batch = texts.slice(start, start + 96);
  const response = await fetch('https://api.cohere.com/v2/embed', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, texts: batch, input_type: 'search_document', embedding_types: ['float'], output_dimension: DIMENSION }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Cohere embedding request failed with HTTP ${response.status}`);
  const batchVectors = (await response.json()).embeddings?.float;
  if (!Array.isArray(batchVectors) || batchVectors.length !== batch.length || !batchVectors.every((v) => Array.isArray(v) && v.length === DIMENSION && v.every(Number.isFinite))) throw new Error('Cohere returned invalid vectors');
  vectors.push(...batchVectors);
  console.log(`Embedded ${vectors.length}/${texts.length} chunks.`);
}
const index = { version: 2, model: MODEL, dimension: DIMENSION, chunking: { sizeWords: CHUNK_WORDS, overlapWords: OVERLAP_WORDS }, documentHash: createHash('sha256').update(JSON.stringify(docs)).digest('hex'), chunkHash: createHash('sha256').update(JSON.stringify(chunks.map(({ chunkId, text }) => [chunkId, text]))).digest('hex'), chunkIds: chunks.map((chunk) => chunk.chunkId), vectors };
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
