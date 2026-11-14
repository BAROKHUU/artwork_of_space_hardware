import { describe, expect, it } from 'vitest';
import { calculateMmls, emptyAssessment, scoreLocally, validateReflectionReview } from './assessment';

describe('Moon assessment', () => {
  it('renormalizes MMLS across available components and calculates learning gain', () => {
    const progress = { ...emptyAssessment(), precheck: [false, false, true], postcheck: [true, true, true], quizzes: { m2: [true, false] } };
    expect(calculateMmls(progress)).toMatchObject({ quiz: 50, open: null, apply: null, overall: 50, learningGain: 66.66666666666666 });
  });

  it('scores skipped answers locally without treating them as AI-reviewed', () => {
    const result = scoreLocally('r2', 'Scientists study the data record to learn about moonquakes today.');
    expect(result.source).toBe('local');
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(5);
  });

  it('rejects malformed model responses and clamps no invalid values through', () => {
    expect(validateReflectionReview({ score: 9, criteria: [], concepts: [] })).toBeNull();
    expect(validateReflectionReview({ score: 4, criteria: [{ key: 'data', score: 2, max: 2 }], concepts: ['data'] })).toMatchObject({ source: 'gemini', score: 4 });
  });
});
