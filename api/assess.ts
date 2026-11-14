import rubric from '../shared/assessment.json';

type Review = { score: number; max: 5; source: 'gemini'; criteria: { key: string; score: number; max: number }[]; concepts: string[] };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const localShape = (questionId: string, answer: string): Review => {
  const question = (rubric.questions as Record<string, { criteria: { key: string; max: number; keywords?: string[] }[]; concepts: string[] }>)[questionId];
  if (!question) return { score: 0, max: 5, source: 'gemini', criteria: [], concepts: [] };
  const text = answer.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const criteria = question.criteria.map((criterion) => {
    const hits = criterion.keywords?.filter((word) => text.includes(word.toLowerCase())).length ?? 0;
    return { key: criterion.key, score: criterion.key === 'own_words' ? (text.trim().split(/\s+/).length >= 4 ? criterion.max : 0) : hits > 1 ? criterion.max : hits ? Math.ceil(criterion.max / 2) : 0, max: criterion.max };
  });
  return { score: criteria.reduce((sum, item) => sum + item.score, 0), max: 5, source: 'gemini', criteria, concepts: question.concepts.filter((concept) => text.includes(concept.toLowerCase())) };
};

export default async function assess(request: Request) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  let body: { questionId?: unknown; answer?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (typeof body.questionId !== 'string' || typeof body.answer !== 'string' || body.answer.trim().length === 0 || body.answer.length > 1200) return json({ error: 'invalid_input' }, 400);
  const question = (rubric.questions as Record<string, { prompt: string; reference: string[]; criteria: unknown[] }>)[body.questionId];
  if (!question) return json({ error: 'unknown_question' }, 400);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ ...localShape(body.questionId, body.answer), source: 'gemini_unavailable' }, 503);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `Score this child answer against the rubric. Return JSON only with score (0-5 integer), criteria (array of key/score/max), and concepts (string array). Do not invent criteria. Question: ${question.prompt}\nRubric: ${JSON.stringify(question.criteria)}\nAnswer: ${body.answer}` }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }) });
    if (!response.ok) return json({ error: 'provider_unavailable' }, 503);
    const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const parsed = JSON.parse(payload.candidates?.[0]?.content?.parts?.[0]?.text || '{}') as Partial<Review>;
    if (!Number.isInteger(parsed.score) || parsed.score < 0 || parsed.score > 5 || !Array.isArray(parsed.criteria) || !Array.isArray(parsed.concepts)) return json({ error: 'invalid_provider_output' }, 502);
    return json({ score: parsed.score, max: 5, source: 'gemini', criteria: parsed.criteria, concepts: parsed.concepts.filter((value): value is string => typeof value === 'string').slice(0, 8) });
  } catch { return json({ error: 'provider_error' }, 503); }
}
