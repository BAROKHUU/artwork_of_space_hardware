import rubric from '../shared/assessment.json';

export type ReviewSource = 'gemini' | 'local';
export interface ReflectionReview {
  score: number;
  max: 5;
  source: ReviewSource;
  criteria: { key: string; score: number; max: number }[];
  concepts: string[];
}

export interface AssessmentProgress {
  precheck?: boolean[];
  postcheck?: boolean[];
  quizzes: Record<string, boolean[]>;
  applications: Record<string, boolean[]>;
  reflections: Record<string, { answer: string; review: ReflectionReview | null; skipped?: boolean }>;
}

const KNOWLEDGE_KEYS = ['m2', 'm3', 'm5'];
const APPLICATION_KEYS = ['a2', 'a3', 'a4', 'a5'];
const WEIGHTS = { quiz: 40, open: 40, apply: 20 } as const;

export const emptyAssessment = (): AssessmentProgress => ({ quizzes: {}, applications: {}, reflections: {} });

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function scoreLocally(questionId: string, answer: string): ReflectionReview {
  const question = rubric.questions[questionId as keyof typeof rubric.questions];
  if (!question) return { score: 0, max: 5, source: 'local', criteria: [], concepts: [] };
  const text = normalize(answer);
  const criteria = question.criteria.map((criterion) => {
    const hits = 'keywords' in criterion && Array.isArray(criterion.keywords) ? criterion.keywords.filter((word) => text.includes(normalize(word))).length : 0;
    const score = criterion.key === 'own_words'
      ? (text.split(' ').filter(Boolean).length >= 4 ? criterion.max : 0)
      : hits === 0 ? 0 : hits > 1 ? criterion.max : Math.ceil(criterion.max / 2);
    return { key: criterion.key, score, max: criterion.max };
  });
  return {
    score: criteria.reduce((sum, item) => sum + item.score, 0),
    max: 5,
    source: 'local',
    criteria,
    concepts: question.concepts.filter((concept) => text.includes(normalize(concept))),
  };
}

export function validateReflectionReview(value: unknown): ReflectionReview | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ReflectionReview>;
  if (!Number.isInteger(candidate.score) || candidate.score! < 0 || candidate.score! > 5 || !Array.isArray(candidate.criteria) || !Array.isArray(candidate.concepts)) return null;
  const criteria = candidate.criteria.filter((item) => item && typeof item.key === 'string' && Number.isInteger(item.score) && Number.isInteger(item.max) && item.score >= 0 && item.score <= item.max);
  if (criteria.length !== candidate.criteria.length) return null;
  return { score: candidate.score!, max: 5, source: 'gemini', criteria, concepts: candidate.concepts.filter((item): item is string => typeof item === 'string').slice(0, 8) };
}

function percent(records: Record<string, boolean[]>, keys: string[]) {
  const values = keys.flatMap((key) => records[key] ?? []);
  return values.length ? values.filter(Boolean).length / values.length * 100 : null;
}

export function calculateMmls(progress: AssessmentProgress) {
  const quiz = percent(progress.quizzes, KNOWLEDGE_KEYS);
  const apply = percent(progress.applications, APPLICATION_KEYS);
  const reviewed = Object.values(progress.reflections).flatMap(({ review }) => review ? [review.score / review.max * 100] : []);
  const open = reviewed.length ? reviewed.reduce((sum, value) => sum + value, 0) / reviewed.length : null;
  const denominator = (quiz === null ? 0 : WEIGHTS.quiz) + (open === null ? 0 : WEIGHTS.open) + (apply === null ? 0 : WEIGHTS.apply);
  return {
    quiz,
    open,
    apply,
    overall: denominator ? ((quiz ?? 0) * WEIGHTS.quiz + (open ?? 0) * WEIGHTS.open + (apply ?? 0) * WEIGHTS.apply) / denominator : null,
    learningGain: progress.precheck?.length && progress.postcheck?.length
      ? (progress.postcheck.filter(Boolean).length - progress.precheck.filter(Boolean).length) / Math.max(1, progress.precheck.length) * 100
      : null,
  };
}

export const validAssessmentKeys = { knowledge: KNOWLEDGE_KEYS, application: APPLICATION_KEYS };
