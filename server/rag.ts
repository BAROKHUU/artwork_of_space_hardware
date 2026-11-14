import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import documents from '../knowledge/nasa.json' with { type: 'json' };

export type Document = { id: string; title: string; aliases: string[]; text: string; sources: string[] };
type Index = { model: string; dimension: number; documentHash: string; vectors: number[][] };
export const EMBED_MODEL = 'embed-v4.0';
export const DIMENSION = 512;
export const knowledge: Document[] = documents;
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
  return docs.map((doc) => words.reduce((score, word) => {
    const frequency = doc.filter((token) => token === word).length;
    if (!frequency) return score;
    const df = docs.filter((item) => item.includes(word)).length;
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

export async function loadIndex(): Promise<Index> {
  const index = JSON.parse(await readFile(resolve(process.cwd(), 'knowledge/index.json'), 'utf8')) as Index;
  if (index.model !== EMBED_MODEL || index.dimension !== DIMENSION || index.documentHash !== documentHash(knowledge) ||
      !Array.isArray(index.vectors) || index.vectors.length !== knowledge.length ||
      !index.vectors.every((v) => Array.isArray(v) && v.length === DIMENSION && v.every(Number.isFinite))) {
    throw new Error('Knowledge index is invalid or out of date; rebuild it');
  }
  return index;
}

export async function retrieve(query: string, key: string, fetcher: typeof fetch = fetch): Promise<{ documents: Document[]; mode: 'hybrid' | 'keyword' }> {
  const texts = knowledge.map(documentText);
  const sparse = bm25(query, texts);
  const lexicalOrder = sparse.map((score, id) => ({ score, id })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.id);
  const fallback = () => ({ documents: lexicalOrder.slice(0, 4).map((id) => knowledge[id]), mode: 'keyword' as const });
  if (!key) return fallback();
  let index: Index;
  try { index = await loadIndex(); } catch { return fallback(); }
  try {
  const embedded = await cohere('embed', { model: EMBED_MODEL, texts: [query], input_type: 'search_query', embedding_types: ['float'], output_dimension: DIMENSION }, key, fetcher) as { embeddings?: { float?: number[][] } };
  const vector = embedded.embeddings?.float?.[0];
  if (!Array.isArray(vector) || vector.length !== DIMENSION || !vector.every(Number.isFinite)) throw new Error('Invalid query embedding');
  const dense = index.vectors.map((v) => cosine(vector, v));
  const denseOrder = dense.map((score, id) => ({ score, id })).sort((a, b) => b.score - a.score).map((x) => x.id);
  const mentioned = findMentioned(query, knowledge);
  const ids = [...new Set([...fuse(lexicalOrder, denseOrder, 10), ...mentioned])];
  const result = await cohere('rerank', { model: 'rerank-v3.5', query, documents: ids.map((id) => texts[id]), top_n: ids.length }, key, fetcher) as { results?: { index: number; relevance_score: number }[] };
  if (!Array.isArray(result.results) || !result.results.every((item) => Number.isInteger(item.index) && item.index >= 0 && item.index < ids.length && Number.isFinite(item.relevance_score))) throw new Error('Invalid reranker response');
  // shortcut: relative score cutoff is heuristic; calibrate it against a labeled NASA question set.
  const cutoff = Math.max(0.05, (result.results[0]?.relevance_score ?? 0) * 0.5);
  return { documents: result.results.filter((item) => item.relevance_score >= cutoff || mentioned.includes(ids[item.index])).slice(0, 6).map((item) => knowledge[ids[item.index]]), mode: 'hybrid' };
  } catch {
    console.warn('Cohere retrieval unavailable; using keyword retrieval.');
    return fallback();
  }
}
