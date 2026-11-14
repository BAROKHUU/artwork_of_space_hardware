import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { extractContent, isAllowed, parseRobots } from '../scripts/crawl-knowledge-lib.mjs';
import crawled from '../knowledge/crawled.json';
import manifest from '../knowledge/sources.json';

describe('NASA crawl extraction', () => {
  it('keeps article text and excludes navigation and scripts', () => {
    const html = '<html><head><title>Mission</title></head><body><nav>Navigation</nav><main><h1>Mission</h1><p>The spacecraft &amp; rover landed.</p><script>ignore me</script><p>Another paragraph.</p></main></body></html>';
    const result = extractContent(html, 'science.nasa.gov');
    expect(result).toContain('The spacecraft & rover landed.');
    expect(result).toContain('Another paragraph.');
    expect(result).not.toContain('Navigation');
    expect(result).not.toContain('ignore me');
  });
  it('uses NSSDCA content rather than page navigation', () => {
    const html = '<body><div id="nav">Navigation</div><div id="rightcontent"><h1>Record</h1><p>Spacecraft mission record.</p></div></body>';
    const result = extractContent(html, 'nssdc.gsfc.nasa.gov');
    expect(result).toContain('Spacecraft mission record.');
    expect(result).not.toContain('Navigation');
  });
  it('respects robots allow and disallow rules', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/public\n', 'RISE-Knowledge-Crawler');
    expect(isAllowed('/private/secret', rules)).toBe(false);
    expect(isAllowed('/private/public/page', rules)).toBe(true);
    expect(isAllowed('/mission/example', rules)).toBe(true);
  });
  it('preserves a verifiable raw snapshot and extracted content for every listed source', () => {
    expect(crawled).toHaveLength(manifest.length);
    for (const document of crawled) {
      const source = manifest.find((item) => `crawl_${item.id}` === document.id);
      expect(source).toBeDefined();
      expect(document.sources).toEqual([source!.url]);
      const raw = gunzipSync(readFileSync(document.provenance.rawPath));
      expect(createHash('sha256').update(raw).digest('hex')).toBe(document.provenance.sha256);
      expect(extractContent(raw.toString('utf8'), new URL(document.provenance.finalUrl).hostname)).toBe(document.text);
    }
  });
  it('includes every mission page and NSSDCA record requested', () => {
    const requested = ['apollo11_ascent_record', 'apollo15_ascent_record', 'apollo12_ascent_record', 'surveyor3_page', 'pathfinder_page', 'mer_page', 'viking1_page', 'insight_page', 'dawn_page', 'near_page', 'pioneer10_page', 'ingenuity_page', 'kepler_page'];
    expect(manifest.map((source) => source.id)).toEqual(expect.arrayContaining(requested));
  });
});
