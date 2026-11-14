import { describe, expect, it } from 'vitest';
import { buildChunks, CHUNK_WORDS, OVERLAP_WORDS } from '../knowledge/chunks';
import documents from '../knowledge/nasa.json';

describe('NASA knowledge chunks', () => {
  const makeDoc = (text: string) => ({ id: 'x', title: 'Example', aliases: ['alias'], text, sources: ['https://science.nasa.gov/'] });
  it('overlaps adjacent chunks and keeps document metadata', () => {
    const words = Array.from({ length: CHUNK_WORDS * 2 }, (_, i) => `w${i}`);
    const chunks = buildChunks([makeDoc(words.join(' '))]);
    expect(chunks.length).toBeGreaterThan(1);
    const left = chunks[0].text.split(' ');
    const right = chunks[1].text.split(' ');
    expect(left.slice(-OVERLAP_WORDS)).toEqual(right.slice(0, OVERLAP_WORDS));
    expect(chunks[1]).toMatchObject({ id: 'x', title: 'Example', sources: ['https://science.nasa.gov/'] });
  });
  it('keeps short records whole and does not add duplicate tail chunks', () => {
    expect(buildChunks([makeDoc('A short record.')])).toHaveLength(1);
    expect(buildChunks([makeDoc(Array(CHUNK_WORDS).fill('word').join(' '))])).toHaveLength(1);
  });
  it('prefers a sentence boundary while preserving the overlap', () => {
    const words = Array.from({ length: 60 }, (_, i) => i === 23 ? 'w23.' : `w${i}`);
    const chunks = buildChunks([makeDoc(words.join(' '))]);
    expect(chunks[0].endWord).toBe(24);
    expect(chunks[1].startWord).toBe(24 - OVERLAP_WORDS);
    expect(chunks[1].text.split(' ').slice(0, OVERLAP_WORDS)).toEqual(chunks[0].text.split(' ').slice(-OVERLAP_WORDS));
  });
  it('covers every NASA record without crossing sources', () => {
    const chunks = buildChunks(documents);
    for (const doc of documents) {
      const own = chunks.filter((chunk) => chunk.id === doc.id);
      expect(own.length).toBeGreaterThan(0);
      expect(own[0].startWord).toBe(0);
      expect(own.at(-1)?.endWord).toBe(doc.text.trim().split(/\s+/u).length);
      own.slice(1).forEach((chunk, i) => expect(own[i].endWord - chunk.startWord).toBe(OVERLAP_WORDS));
      own.forEach((chunk) => expect(chunk.sources).toEqual(doc.sources));
    }
  });
});
