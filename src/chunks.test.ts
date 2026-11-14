import { describe, expect, it } from 'vitest';
import { buildSemanticChunks, splitSentences, SEMANTIC_THRESHOLD } from '../knowledge/chunks';

describe('NASA semantic chunks', () => {
  const makeDoc = (text: string) => ({ id: 'x', title: 'Example', aliases: ['alias'], text, sources: ['https://science.nasa.gov/'] });

  it('splits at low-similarity sentence boundaries and keeps related sentences together', () => {
    const doc = makeDoc('Apollo descent module carried two astronauts safely down to the lunar surface in 1969. The lunar landing vehicle returned them safely to the waiting command module in lunar orbit. Kepler searched for exoplanets by measuring repeated changes in the brightness of distant stars. It observed stars for transits to find candidate worlds beyond our solar system.');
    const chunks = buildSemanticChunks([doc], { x: [0.91, 0.2, 0.89] });
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      'Apollo descent module carried two astronauts safely down to the lunar surface in 1969. The lunar landing vehicle returned them safely to the waiting command module in lunar orbit.',
      'Kepler searched for exoplanets by measuring repeated changes in the brightness of distant stars. It observed stars for transits to find candidate worlds beyond our solar system.',
    ]);
    expect(chunks[0]).toMatchObject({ id: 'x', title: 'Example', sources: ['https://science.nasa.gov/'] });
  });

  it('splits source text into sentences without splitting on decimal points', () => {
    expect(splitSentences('A 3.5 kg lander reached Mars. It sent data.')).toEqual(['A 3.5 kg lander reached Mars.', 'It sent data.']);
  });

  it('keeps short records whole and caps long semantic groups', () => {
    const sentences = Array.from({ length: 20 }, (_, i) => `Sentence ${i} contains seven useful science words here.`);
    const chunks = buildSemanticChunks([makeDoc(sentences.join(' '))], { x: Array(19).fill(0.99) });
    expect(chunks.every((chunk) => chunk.text.trim().split(/\s+/u).length <= 120)).toBe(true);
    expect(chunks[1].text.split(/\s+/u).slice(0, 8)).toEqual(chunks[0].text.split(/\s+/u).slice(-8));
    expect(chunks.map((chunk) => chunk.text).join(' ')).toContain('Sentence 9');
    expect(chunks.map((chunk) => chunk.text).join(' ')).toContain('Sentence 19');
    expect(SEMANTIC_THRESHOLD).toBeGreaterThan(0);
  });

  it('splits unusually long individual sentences to stay within the chunk limit', () => {
    const longSentence = `${Array.from({ length: 150 }, (_, i) => `word${i}`).join(' ')}.`;
    const chunks = buildSemanticChunks([makeDoc(longSentence)], { x: [0.99] });
    expect(chunks.every((chunk) => chunk.text.split(/\s+/u).length <= 120)).toBe(true);
    expect(chunks[1].text.split(/\s+/u).slice(0, 8)).toEqual(chunks[0].text.split(/\s+/u).slice(-8));
    expect(chunks.at(-1)?.text).toContain('word149.');
  });

  it('requires one semantic similarity score between each sentence pair', () => {
    expect(() => buildSemanticChunks([makeDoc('First sentence. Second sentence.')], { x: [] })).toThrow(/similarity/i);
  });
});
