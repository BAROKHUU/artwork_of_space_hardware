export const MAX_CHUNK_WORDS = 120;
export const MIN_CHUNK_WORDS = 24;
export const OVERLAP_WORDS = 8;
export const SEMANTIC_THRESHOLD = 0.62;
const MAX_SENTENCE_WORDS = MAX_CHUNK_WORDS - OVERLAP_WORDS;

export type KnowledgeDocument = { id: string; title: string; aliases: string[]; text: string; sources: string[] };
export type KnowledgeChunk = KnowledgeDocument & { chunkId: string };

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
export const splitSentences = (text: string): string[] => [...segmenter.segment(text.replace(/\r/gu, ' '))]
  .flatMap(({ segment }) => {
    const words = segment.trim().split(/\s+/u).filter(Boolean);
    if (words.length <= MAX_SENTENCE_WORDS) return words.length ? [words.join(' ')] : [];
    return Array.from({ length: Math.ceil(words.length / MAX_SENTENCE_WORDS) }, (_, i) => {
      const part = words.slice(i * MAX_SENTENCE_WORDS, (i + 1) * MAX_SENTENCE_WORDS);
      return part.join(' ');
    });
  });

export function buildSemanticChunks(documents: KnowledgeDocument[], similaritiesByDoc: Record<string, number[]>): KnowledgeChunk[] {
  return documents.flatMap((doc) => {
    const sentences = splitSentences(doc.text);
    const similarities = similaritiesByDoc[doc.id];
    if (!similarities || similarities.length !== sentences.length - 1 || similarities.some((score) => !Number.isFinite(score))) {
      throw new Error(`Invalid semantic similarity scores for ${doc.id}`);
    }

    const chunks: KnowledgeChunk[] = [];
    let current: string[] = [];
    let overlap = '';
    let wordCount = 0;
    const save = () => {
      if (!current.length) return;
      chunks.push({ ...doc, chunkId: `${doc.id}:${chunks.length}`, text: [overlap, ...current].filter(Boolean).join(' ') });
    };

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const words = sentence.split(/\s+/u).length;
      const semanticBreak = i > 0 && similarities[i - 1] < SEMANTIC_THRESHOLD && wordCount >= MIN_CHUNK_WORDS;
      const sizeBreak = current.length > 0 && wordCount + words > MAX_CHUNK_WORDS;
      if (semanticBreak || sizeBreak) {
        const previousText = current.join(' ');
        save();
        overlap = sizeBreak ? previousText.split(/\s+/u).slice(-OVERLAP_WORDS).join(' ') : '';
        wordCount = overlap ? OVERLAP_WORDS : 0;
        current = [];
      }
      current.push(sentence);
      wordCount += words;
    }
    save();
    return chunks;
  });
}
