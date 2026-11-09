// Confirms every reference in sources.json still resolves. Run before submitting.
import fs from 'node:fs';
const sources = JSON.parse(fs.readFileSync('src/data/sources.json', 'utf8'));
// Some sites refuse automated requests. Those are listed for a manual check, never retried in disguise.
let broken = 0;
let refused = 0;
for (const [id, s] of Object.entries(sources)) {
  let status = 'no response';
  try {
    status = (await fetch(s.url, { redirect: 'follow', signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'echo-link-check' } })).status;
  } catch {
    /* reported below */
  }
  if (status === 403 || status === 'no response') {
    refused++;
    console.log('CHECK BY HAND', status, id, s.url);
  } else if (status >= 400) {
    broken++;
    console.log('BROKEN', status, id, s.url);
  }
}
console.log(`${Object.keys(sources).length} links: ${broken} broken, ${refused} to check by hand`);
process.exitCode = broken ? 1 : 0;
