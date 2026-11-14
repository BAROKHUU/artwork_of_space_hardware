import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { extractContent, isAllowed, parseRobots } from './crawl-knowledge-lib.mjs';

const AGENT = 'RISE-Knowledge-Crawler/1.0';
const start = performance.now();
const manifest = JSON.parse(await readFile('knowledge/sources.json', 'utf8'));
if (!Array.isArray(manifest) || !manifest.length || manifest.some((s) => !/^[a-z0-9_]+$/.test(s.id) || !s.title || !Array.isArray(s.aliases) || !s.url)) throw new Error('Invalid source manifest');
if (new Set(manifest.map((s) => s.id)).size !== manifest.length) throw new Error('Duplicate source IDs');
await mkdir('knowledge/raw', { recursive: true });
const robots = new Map();
const results = [];
const failures = [];

for (const [index, source] of manifest.entries()) {
  try {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || !['science.nasa.gov', 'nssdc.gsfc.nasa.gov'].includes(url.hostname)) throw new Error('Source host is not in the allowlist');
    if (!robots.has(url.origin)) {
      const policy = await fetch(`${url.origin}/robots.txt`, { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(20000) });
      if (!policy.ok) throw new Error(`robots.txt HTTP ${policy.status}`);
      robots.set(url.origin, parseRobots(await policy.text(), AGENT));
    }
    if (!isAllowed(`${url.pathname}${url.search}`, robots.get(url.origin))) throw new Error('Blocked by robots.txt');
    const response = await fetch(url, { headers: { 'User-Agent': AGENT, Accept: 'text/html,application/xhtml+xml,text/xml' }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const final = new URL(response.url);
    if (final.protocol !== 'https:' || !['science.nasa.gov', 'nssdc.gsfc.nasa.gov'].includes(final.hostname)) throw new Error('Redirected outside the allowlist');
    if (final.origin !== url.origin || final.pathname !== url.pathname) {
      if (!robots.has(final.origin)) {
        const policy = await fetch(`${final.origin}/robots.txt`, { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(20000) });
        if (!policy.ok) throw new Error(`Redirect robots.txt HTTP ${policy.status}`);
        robots.set(final.origin, parseRobots(await policy.text(), AGENT));
      }
      if (!isAllowed(`${final.pathname}${final.search}`, robots.get(final.origin))) throw new Error('Redirect target blocked by robots.txt');
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!/html|xml/i.test(contentType)) throw new Error(`Unexpected content type: ${contentType}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8_000_000) throw new Error('Page exceeds 8 MB limit');
    const text = extractContent(bytes.toString('utf8'), final.hostname);
    if (text.length < 200) throw new Error('Extracted content is unexpectedly short');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const rawPath = `knowledge/raw/${source.id}-${sha256.slice(0, 12)}.html.gz`;
    try { await writeFile(rawPath, gzipSync(bytes, { level: 9 }), { flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    results.push({ id: `crawl_${source.id}`, title: source.title, aliases: source.aliases, text, sources: [source.url], provenance: { finalUrl: response.url, retrievedAt: new Date().toISOString(), sha256, rawPath, bytes: bytes.length } });
    console.log(`[${index + 1}/${manifest.length}] ${source.id}: ${text.split(/\s+/u).length} words`);
  } catch (error) {
    failures.push({ id: source.id, error: error instanceof Error ? error.message : 'Unknown error' });
    console.error(`[${index + 1}/${manifest.length}] ${source.id}: FAILED`);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (failures.length) {
  console.error(`Crawl incomplete: ${results.length} succeeded, ${failures.length} failed; previous corpus unchanged.`);
  for (const failure of failures) console.error(`${failure.id}: ${failure.error}`);
  process.exitCode = 1;
} else {
  const temp = `knowledge/crawled.${process.pid}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(results, null, 2)}\n`);
    await rename(temp, 'knowledge/crawled.json');
  } catch (error) {
    const { unlink } = await import('node:fs/promises');
    await unlink(temp).catch(() => {});
    throw error;
  }
  console.log(`Saved ${results.length} pages in ${((performance.now() - start) / 1000).toFixed(1)}s; raw snapshots in knowledge/raw/.`);
}
