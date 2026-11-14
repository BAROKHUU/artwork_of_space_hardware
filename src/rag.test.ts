import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { bm25, cosine, findMentioned, fuse, isGreeting, knowledge, retrieve, tokenize } from '../server/rag';

describe('NASA retrieval', () => {
  it('matches Vietnamese accents and rewards relevant missions', () => {
    expect(tokenize('Địa chấn')).toEqual(tokenize('dia chan'));
    const scores = bm25('địa chấn InSight', ['InSight dia chan sao hoa', 'Kepler exoplanet transit']);
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });
  it('combines sparse and dense rankings and computes cosine', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(fuse([0, 1, 2], [1, 2, 0], 3)[0]).toBe(1);
  });
  it('skips retrieval only for simple greetings', () => {
    expect(isGreeting('Xin chào!')).toBe(true);
    expect(isGreeting('Xin chào, InSight là gì?')).toBe(false);
  });
  it('preserves both explicitly mentioned missions in a comparison', () => {
    expect(findMentioned('So sánh Spirit và Opportunity', knowledge).map((id) => knowledge[id].id)).toEqual(['spirit', 'opportunity']);
  });
  it('clearly falls back to keyword search if Cohere is not configured', async () => {
    const result = await retrieve('InSight địa chấn', '');
    expect(result.mode).toBe('keyword');
    expect(result.documents[0].id).toBe('insight');
  });
  it('embeds the query, fuses rankings and reranks NASA passages', async () => {
    const index = JSON.parse(readFileSync('knowledge/index.json', 'utf8')) as { vectors: number[][] };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ embeddings: { float: [index.vectors[0]] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ index: 0, relevance_score: 0.9 }] }), { status: 200 }));
    const result = await retrieve('Apollo 11 Eagle', 'test-key', fetcher);
    expect(result.mode).toBe('hybrid');
    expect(result.documents[0].id).toBe('apollo11_descent');
    expect(JSON.parse(fetcher.mock.calls[0][1].body).input_type).toBe('search_query');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
