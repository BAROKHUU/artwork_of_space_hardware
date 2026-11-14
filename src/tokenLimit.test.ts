import { describe, expect, it } from 'vitest';
import { limitHistory, MAX_QUESTION_TOKENS, MAX_HISTORY_TOKENS, countTokens } from '../server/tokenLimit';

describe('chat input token limits', () => {
  it('accepts questions within the limit and rejects those over it', () => {
    const question = 'hello '.repeat(MAX_QUESTION_TOKENS + 10).trim();
    expect(countTokens(question)).toBeGreaterThan(MAX_QUESTION_TOKENS);
    expect(() => limitHistory([{ role: 'user', content: question }])).toThrow('Question exceeds token limit');
    expect(limitHistory([{ role: 'user', content: 'Xin chào' }])).toHaveLength(1);
  });
  it('keeps the latest question and trims old history to the budget', () => {
    const messages = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' as const : 'user' as const, content: 'hello '.repeat(350) }));
    messages.push({ role: 'user', content: 'InSight?' });
    const result = limitHistory(messages);
    expect(result.at(-1)?.content).toBe('InSight?');
    expect(result.length).toBeLessThan(messages.length);
    expect(result.reduce((n, m) => n + countTokens(m.content), 0)).toBeLessThanOrEqual(MAX_HISTORY_TOKENS);
  });
});
