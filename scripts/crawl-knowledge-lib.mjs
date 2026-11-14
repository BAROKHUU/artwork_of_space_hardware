import { parse } from 'node-html-parser';

export function parseRobots(text, agent) {
  const groups = [];
  let group = null;
  let hasRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line || !line.includes(':')) continue;
    const colon = line.indexOf(':');
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!group || hasRules) { group = { agents: [], rules: [] }; groups.push(group); hasRules = false; }
      group.agents.push(value.toLowerCase());
    } else if (group && (key === 'allow' || key === 'disallow')) {
      hasRules = true;
      if (value) group.rules.push({ allow: key === 'allow', path: value });
    }
  }
  const name = agent.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((value) => value !== '*' && name.includes(value)));
  const selected = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  return selected.flatMap((group) => group.rules);
}

export function isAllowed(path, rules) {
  const matches = rules.filter((rule) => {
    const pattern = rule.path.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${pattern}`).test(path);
  }).sort((a, b) => b.path.replaceAll('*', '').length - a.path.replaceAll('*', '').length || Number(b.allow) - Number(a.allow));
  return matches.length === 0 || matches[0].allow;
}

export function extractContent(html, hostname) {
  const root = parse(html, { comment: false });
  const main = hostname === 'nssdc.gsfc.nasa.gov'
    ? root.querySelector('#rightcontent') ?? root.querySelector('main') ?? root.querySelector('body') ?? root
    : root.querySelector('main');
  if (!main) throw new Error('Main content element not found');
  for (const element of main.querySelectorAll('script, style, noscript, nav, footer, form, iframe, [hidden], [aria-hidden="true"]')) element.remove();
  const text = main.structuredText.replace(/\r/g, '').split('\n').map((line) => line.replace(/[\t\u00a0 ]+/g, ' ').trim()).filter(Boolean).join('\n');
  if (!text) throw new Error('Main content is empty');
  return text;
}
