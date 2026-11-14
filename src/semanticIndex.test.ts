import { describe, expect, it } from 'vitest';
import { retryDelayMs } from '../scripts/index-knowledge-lib.mjs';

describe('semantic index rate-limit retry', () => {
  it('honors the Cohere Retry-After header', () => {
    expect(retryDelayMs(new Headers({ 'retry-after': '7' }), 0)).toBe(7000);
  });
  it('uses capped exponential backoff when Retry-After is missing', () => {
    expect(retryDelayMs(new Headers(), 3)).toBe(8000);
    expect(retryDelayMs(new Headers(), 9)).toBe(60000);
  });
});
