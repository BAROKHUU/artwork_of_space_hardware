import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { buildSemanticChunks, MAX_CHUNK_WORDS, OVERLAP_WORDS, SEMANTIC_THRESHOLD, splitSentences } from '../knowledge/chunks.ts';
import { retryDelayMs } from './index-knowledge-lib.mjs';

const MODEL = 'embed-v4.0';
const DIMENSION = 512;
const started = performance.now();
const key = process.env.COHERE_API_KEY;
if (!key) throw new Error('COHERE_API_KEY is missing. Add it to .env.local or the environment.');
const docs = [...JSON.parse(await readFile('knowledge/nasa.json', 'utf8')), ...JSON.parse(await readFile('knowledge/crawled.json', 'utf8'))];
if (!Array.isArray(docs) || !docs.length || docs.some((doc) => !doc.id || !doc.title || !Array.isArray(doc.aliases) || !doc.text || !Array.isArray(doc.sources))) throw new Error('Invalid knowledge documents');
if (new Set(docs.map((doc) => doc.id)).size !== docs.length) throw new Error('Duplicate document IDs');

async function embed(texts) {
  const vectors = [];
  for (let start = 0; start < texts.length; start += 96) {
    const batch = texts.slice(start, start + 96);
    let result;
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch('https://api.cohere.com/v2/embed', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, texts: batch, input_type: 'search_document', embedding_types: ['float'], output_dimension: DIMENSION }),
        signal: AbortSignal.timeout(60000),
      });
      if (response.ok) { result = (await response.json()).embeddings?.float; break; }
      if (response.status !== 429 || attempt === 3) throw new Error(`Cohere embedding request failed with HTTP ${response.status}`);
      const delay = retryDelayMs(response.headers, attempt);
      console.warn(`Cohere rate limited; retrying in ${Math.ceil(delay / 1000)} seconds.`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (!Array.isArray(result) || result.length !== batch.length || !result.every((v) => Array.isArray(v) && v.length === DIMENSION && v.every(Number.isFinite))) throw new Error('Cohere returned invalid vectors');
    vectors.push(...result);
    console.log(`Embedded ${vectors.length}/${texts.length} texts.`);
  }
  return vectors;
}

function cosine(a, b) {
  let dot = 0, a2 = 0, b2 = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; a2 += a[i] ** 2; b2 += b[i] ** 2; }
  return dot / Math.sqrt(a2 * b2);
}

async function writeAtomic(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value)}\n`);
    await rename(temporary, path);
  } catch (error) {
    const { unlink } = await import('node:fs/promises');
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

const sentencesByDoc = Object.fromEntries(docs.map((doc) => [doc.id, splitSentences(doc.text)]));
const sentenceCount = Object.values(sentencesByDoc).reduce((sum, sentences) => sum + sentences.length, 0);
const sentenceTexts = docs.flatMap((doc) => sentencesByDoc[doc.id].map((sentence) => `${doc.title}\n${sentence}`));
console.log(`Finding semantic boundaries across ${sentenceCount} sentences...`);
const sentenceVectors = await embed(sentenceTexts);
let sentenceIndex = 0;
const similaritiesByDoc = {};
for (const doc of docs) {
  const vectors = sentenceVectors.slice(sentenceIndex, sentenceIndex + sentencesByDoc[doc.id].length);
  sentenceIndex += vectors.length;
  similaritiesByDoc[doc.id] = vectors.slice(1).map((vector, i) => cosine(vectors[i], vector));
}

const chunks = buildSemanticChunks(docs, similaritiesByDoc);
const chunkTexts = chunks.map((chunk) => `${chunk.title}\n${chunk.aliases.join(', ')}\n${chunk.text}`);
console.log(`Indexing ${chunks.length} semantic chunks from ${docs.length} NASA records with ${MODEL}...`);
const vectors = await embed(chunkTexts);
const chunkHash = createHash('sha256').update(JSON.stringify(chunks.map(({ chunkId, id, title, aliases, text, sources }) => [chunkId, id, title, aliases, text, sources]))).digest('hex');
const index = {
  version: 3,
  model: MODEL,
  dimension: DIMENSION,
  chunking: { maxWords: MAX_CHUNK_WORDS, overlapWords: OVERLAP_WORDS, semanticThreshold: SEMANTIC_THRESHOLD },
  documentHash: createHash('sha256').update(JSON.stringify(docs)).digest('hex'),
  chunkHash,
  chunkIds: chunks.map((chunk) => chunk.chunkId),
  vectors,
};
await writeAtomic('knowledge/chunks.json', chunks);
await writeAtomic('knowledge/index.json', index);
console.log(`Wrote ${chunks.length} semantic chunks and vectors in ${((performance.now() - started) / 1000).toFixed(1)}s.`);
