export const CHUNK_WORDS = 32;
export const OVERLAP_WORDS = 8;

export type KnowledgeDocument = { id: string; title: string; aliases: string[]; text: string; sources: string[] };
export type KnowledgeChunk = KnowledgeDocument & { chunkId: string; startWord: number; endWord: number };

export function buildChunks(documents: KnowledgeDocument[]): KnowledgeChunk[] {
  return documents.flatMap((doc) => {
    const words = doc.text.trim().split(/\s+/u).filter(Boolean);
    const chunks: KnowledgeChunk[] = [];
    for (let start = 0; start < words.length;) {
      let end = Math.min(start + CHUNK_WORDS, words.length);
      if (end < words.length) {
        for (let candidate = end; candidate >= start + Math.floor(CHUNK_WORDS * 0.6); candidate--) {
          if (/[.!?]["'\u201d\u2019)\]]*$/u.test(words[candidate - 1])) { end = candidate; break; }
        }
      }
      chunks.push({ ...doc, chunkId: `${doc.id}:${start}`, startWord: start, endWord: end, text: words.slice(start, end).join(' ') });
      if (end === words.length) break;
      start = end - OVERLAP_WORDS;
    }
    return chunks;
  });
}
