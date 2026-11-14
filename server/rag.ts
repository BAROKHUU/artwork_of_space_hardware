import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import documents from '../knowledge/nasa.json' with { type: 'json' };
import crawled from '../knowledge/crawled.json' with { type: 'json' };
import chunkData from '../knowledge/chunks.json' with { type: 'json' };
import { MAX_CHUNK_WORDS, OVERLAP_WORDS, SEMANTIC_THRESHOLD, type KnowledgeChunk, type KnowledgeDocument } from '../knowledge/chunks.ts';

export type Document = KnowledgeDocument;
type Index = { version: number; model: string; dimension: number; documentHash: string; chunkHash: string; chunkIds: string[]; chunking: { maxWords: number; overlapWords: number; semanticThreshold: number }; vectors: number[][] };
export const EMBED_MODEL = 'embed-v4.0';
export const DIMENSION = 512;
export const knowledge: Document[] = [...documents, ...crawled];
export const knowledgeChunks: KnowledgeChunk[] = chunkData;
export const documentText = (doc: Document) => `${doc.title}\n${doc.aliases.join(', ')}\n${doc.text}`;
export const documentHash = (docs: Document[]) => createHash('sha256').update(JSON.stringify(docs)).digest('hex');
export const tokenize = (text: string): string[] => (text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').match(/[\p{L}\p{N}]+/gu) ?? []);
export const isGreeting = (text: string) => /^(hi|hello|hey|xin chao|chao|cam on|thank you|thanks|tam biet|goodbye)[\s!?.,]*$/.test(tokenize(text).join(' '));
export function findMentioned(query: string, docs: Document[]): number[] {
  const normalized = ` ${tokenize(query).join(' ')} `;
  return docs.flatMap((doc, id) => doc.aliases.some((alias) => {
    const name = tokenize(alias).join(' ');
    return name.length >= 4 && normalized.includes(` ${name} `);
  }) ? [id] : []);
}

export function bm25(query: string, texts: string[]): number[] {
  const docs = texts.map(tokenize);
  const words = [...new Set(tokenize(query))];
  const average = docs.reduce((n, doc) => n + doc.length, 0) / (docs.length || 1);
  const frequencies = new Map(words.map((word) => [word, docs.filter((doc) => doc.includes(word)).length]));
  return docs.map((doc) => words.reduce((score, word) => {
    const frequency = doc.filter((token) => token === word).length;
    if (!frequency) return score;
    const df = frequencies.get(word) ?? 0;
    const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
    return score + idf * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * doc.length / average));
  }, 0));
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) throw new Error('Embedding dimensions do not match');
  let dot = 0, a2 = 0, b2 = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; a2 += a[i] ** 2; b2 += b[i] ** 2; }
  if (!a2 || !b2) throw new Error('Invalid embedding');
  return dot / Math.sqrt(a2 * b2);
}

export function fuse(sparse: number[], dense: number[], limit: number): number[] {
  const scores = new Map<number, number>();
  for (const ranking of [sparse, dense]) ranking.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (60 + rank + 1)));
  return [...scores].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, limit).map(([id]) => id);
}

export async function cohere(path: string, body: object, key: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const response = await fetcher(`https://api.cohere.com/v2/${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Cohere ${path} failed (${response.status})`);
  return response.json();
}

async function queryQdrant(vector: number[], fetcher: typeof fetch): Promise<number[] | null> {
  const url = (process.env.QDRANT_URL ?? '').replace(/\/$/, '');
  if (!url) return null;
  const collection = encodeURIComponent(process.env.QDRANT_COLLECTION ?? 'nasa_knowledge');
  const key = process.env.QDRANT_API_KEY ?? '';
  const response = await fetcher(`${url}/collections/${collection}/points/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'api-key': key } : {}) },
    body: JSON.stringify({ query: vector, limit: 50, with_payload: ['chunk_index'] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Qdrant query failed (${response.status})`);
  const data = await response.json() as { result?: { points?: { id?: unknown; payload?: { chunk_index?: unknown } }[] } };
  const points = data.result?.points;
  if (!Array.isArray(points)) throw new Error('Invalid Qdrant response');
  const ids = points.map((point) => point.payload?.chunk_index ?? point.id);
  if (!ids.every((id): id is number => Number.isInteger(id) && (id as number) >= 0 && (id as number) < knowledgeChunks.length)) {
    throw new Error('Invalid Qdrant point IDs');
  }
  return ids;
}

export async function loadIndex(): Promise<Index> {
  const index = JSON.parse(await readFile(resolve(process.cwd(), 'knowledge/index.json'), 'utf8')) as Index;
  const chunkHash = createHash('sha256').update(JSON.stringify(knowledgeChunks.map(({ chunkId, id, title, aliases, text, sources }) => [chunkId, id, title, aliases, text, sources]))).digest('hex');
  if (index.version !== 3 || index.model !== EMBED_MODEL || index.dimension !== DIMENSION || index.documentHash !== documentHash(knowledge) ||
      index.chunkHash !== chunkHash || index.chunking?.maxWords !== MAX_CHUNK_WORDS || index.chunking?.overlapWords !== OVERLAP_WORDS || index.chunking?.semanticThreshold !== SEMANTIC_THRESHOLD ||
      !Array.isArray(index.chunkIds) || index.chunkIds.length !== knowledgeChunks.length || !index.chunkIds.every((id, i) => id === knowledgeChunks[i].chunkId) ||
      !Array.isArray(index.vectors) || index.vectors.length !== knowledgeChunks.length ||
      !index.vectors.every((v) => Array.isArray(v) && v.length === DIMENSION && v.every(Number.isFinite))) {
    throw new Error('Knowledge index is invalid or out of date; rebuild it');
  }
  return index;
}

export async function retrieve(query: string, key: string, fetcher: typeof fetch = fetch): Promise<{ documents: Document[]; mode: 'hybrid' | 'keyword' }> {
  const texts = knowledgeChunks.map(documentText);
  const sparse = bm25(query, texts);
  const lexicalOrder = sparse.map((score, id) => ({ score, id })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.id);
  const fallback = () => ({ documents: lexicalOrder.slice(0, 4).map((id) => knowledgeChunks[id]), mode: 'keyword' as const });
  if (!key) return fallback();
  try {
  const embedded = await cohere('embed', { model: EMBED_MODEL, texts: [query], input_type: 'search_query', embedding_types: ['float'], output_dimension: DIMENSION }, key, fetcher) as { embeddings?: { float?: number[][] } };
  const vector = embedded.embeddings?.float?.[0];
  if (!Array.isArray(vector) || vector.length !== DIMENSION || !vector.every(Number.isFinite)) throw new Error('Invalid query embedding');
  let denseOrder: number[] | null = null;
  try { denseOrder = await queryQdrant(vector, fetcher); } catch { console.warn('Qdrant unavailable; using the local vector index.'); }
  if (!denseOrder) {
    const index = await loadIndex();
    const dense = index.vectors.map((v) => cosine(vector, v));
    denseOrder = dense.map((score, id) => ({ score, id })).sort((a, b) => b.score - a.score).map((x) => x.id);
  }
  const mentioned = new Set(findMentioned(query, knowledge).map((id) => knowledge[id].id));
  const ranked = fuse(lexicalOrder, denseOrder, knowledgeChunks.length);
  const mentionedChunks = ranked.filter((id) => mentioned.has(knowledgeChunks[id].id));
  const perDocument = new Map<string, number>();
  const boundedMentions = mentionedChunks.filter((id) => {
    const documentId = knowledgeChunks[id].id;
    const count = perDocument.get(documentId) ?? 0;
    perDocument.set(documentId, count + 1);
    return count < 3;
  });
  const ids = [...new Set([...ranked.slice(0, 10), ...boundedMentions])];
  const result = await cohere('rerank', { model: 'rerank-v3.5', query, documents: ids.map((id) => texts[id]), top_n: ids.length }, key, fetcher) as { results?: { index: number; relevance_score: number }[] };
  if (!Array.isArray(result.results) || !result.results.every((item) => Number.isInteger(item.index) && item.index >= 0 && item.index < ids.length && Number.isFinite(item.relevance_score))) throw new Error('Invalid reranker response');
  // shortcut: relative score cutoff is heuristic; calibrate it against a labeled NASA question set.
  const cutoff = Math.max(0.05, (result.results[0]?.relevance_score ?? 0) * 0.5);
  const selected: Document[] = [];
  for (const item of result.results) {
    const chunk = knowledgeChunks[ids[item.index]];
    if ((item.relevance_score >= cutoff || mentioned.has(chunk.id)) && selected.filter((doc) => doc.id === chunk.id).length < 2) selected.push(chunk);
    if (selected.length === 6) break;
  }
  return { documents: selected, mode: 'hybrid' };
  } catch {
    console.warn('Cohere retrieval unavailable; using keyword retrieval.');
    return fallback();
  }
}
