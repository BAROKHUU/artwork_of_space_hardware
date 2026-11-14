import { encode } from 'gpt-tokenizer/encoding/o200k_harmony';

export const MAX_QUESTION_TOKENS = 512;
export const MAX_HISTORY_TOKENS = 2048;
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export class InputLimitError extends Error {}

export function countTokens(text: string): number {
  return encode(text, { disallowedSpecial: new Set() }).length;
}

export function limitHistory(messages: ChatMessage[]): ChatMessage[] {
  const last = messages.at(-1);
  if (!last || countTokens(last.content) > MAX_QUESTION_TOKENS) throw new InputLimitError('Question exceeds token limit');
  let total = 0;
  const kept: ChatMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const count = countTokens(messages[i].content);
    if (total + count > MAX_HISTORY_TOKENS) break;
    total += count;
    kept.unshift(messages[i]);
  }
  return kept;
}
