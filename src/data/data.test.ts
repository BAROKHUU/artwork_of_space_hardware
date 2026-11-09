import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import chapters from './chapters.json';
import hardware from './hardware.json';
import sources from './sources.json';
import backdrops from './backdrops.json';

const LOCALES = path.resolve(__dirname, '../locales');
const read = (lang: string, ns: string) => JSON.parse(fs.readFileSync(path.join(LOCALES, lang, `${ns}.json`), 'utf8'));
const flatten = (o: unknown, p = ''): string[] =>
  o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => flatten(v, p ? `${p}.${k}` : k)) : [p];

const hardwareSchema = z.object({
  id: z.string(), world: z.enum(['moon', 'mars', 'deep']), model: z.string(),
  fate: z.enum(['operating', 'silent', 'retired', 'drifting']),
  lat: z.number().min(-90).max(90).optional(), lon: z.number().min(-180).max(180).optional(),
  photo: z.string(), nasaId: z.string(), credit: z.string(), dates: z.record(z.string(), z.string()), sources: z.array(z.string()).min(1),
});

describe('content', () => {
  const hwIds = new Set(hardware.map((h) => h.id));
  const en = { hardware: read('en', 'hardware'), story: read('en', 'story'), missions: read('en', 'missions'), quiz: read('en', 'quiz') };

  it('hardware records are valid and fully sourced', () => {
    for (const h of hardware) {
      hardwareSchema.parse(h);
      expect(fs.existsSync(path.resolve(__dirname, `../../public/assets/photos/${h.photo}.webp`)), h.photo).toBe(true);
      for (const s of h.sources) expect(sources, `${h.id} -> ${s}`).toHaveProperty(s);
      if (h.world !== 'deep') expect(h.lat, h.id).toBeTypeOf('number');
      for (const key of ['name', 'where', 'young', 'older', 'learned', 'now']) expect(en.hardware[h.id]?.[key], `${h.id}.${key}`).toBeTruthy();
    }
  });

  it('every page background has a file, a title, and a safe scrim', () => {
    const titles = read('en', 'ui').sources.backdrop;
    for (const [key, b] of Object.entries(backdrops)) {
      expect(fs.existsSync(path.resolve(__dirname, `../../public/assets/backdrops/${key}.webp`)), key).toBe(true);
      expect(titles[key], key).toBeTruthy();
      expect(b.scrim).toBeGreaterThanOrEqual(0.3); // Each value was computed from its image for at least 4.5:1 text contrast.
    }
  });

  it('every hardware item is unlocked exactly once in the story', () => {
    const memories = chapters.flatMap((c) => c.beats.flatMap((b) => (b.kind === 'memory' ? [b.hardware as string] : [])));
    expect([...memories].sort()).toEqual([...hwIds].sort());
  });

  it('every beat points at existing content', () => {
    for (const c of chapters) {
      expect(en.story[c.id]?.title, c.id).toBeTruthy();
      for (const b of c.beats) {
        if (b.kind === 'dialogue') {
          expect(en.story[c.id][b.key as string], `${c.id}.${b.key}`).toBeInstanceOf(Array);
          if (b.focus !== 'echo') expect(hwIds.has(b.focus as string), b.focus as string).toBe(true);
        }
        if (b.kind === 'mission') for (const key of ['title', 'goal', 'hint', 'success']) expect(en.missions[b.id as string]?.[key], `${b.id}.${key}`).toBeTruthy();
        if (b.kind === 'quiz') {
          const qs = en.quiz[b.key as string];
          expect(qs.length).toBe((b.answers as number[]).length);
          qs.forEach((q: { options: string[] }, i: number) => expect((b.answers as number[])[i]).toBeLessThan(q.options.length));
        }
      }
    }
  });

  it('other languages match the English keys exactly', () => {
    for (const lang of fs.readdirSync(LOCALES).filter((l) => l !== 'en')) {
      for (const ns of ['ui', 'story', 'missions', 'hardware', 'quiz']) {
        expect(flatten(read(lang, ns)).sort(), `${lang}/${ns}`).toEqual(flatten(read('en', ns)).sort());
      }
    }
  });
});
