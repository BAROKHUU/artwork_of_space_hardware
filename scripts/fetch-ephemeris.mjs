// Pulls Earth-to-probe range tables from JPL Horizons and writes them to src/data/generated/ephemeris.json.
import fs from 'node:fs';
const PROBES = { voyager1: '-31', voyager2: '-32', new_horizons: '-98', pioneer10: '-23' };
const START = '2026-01-01', STOP = '2036-01-01', STEP_DAYS = 10;
const out = { source: 'JPL Horizons, https://ssd.jpl.nasa.gov/horizons/', generated: new Date().toISOString().slice(0, 10), startISO: START, stepDays: STEP_DAYS, au: {} };
for (const [key, id] of Object.entries(PROBES)) {
  const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  const params = { format: 'text', COMMAND: `'${id}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'OBSERVER', CENTER: "'500@399'", START_TIME: `'${START}'`, STOP_TIME: `'${STOP}'`, STEP_SIZE: `'${STEP_DAYS} d'`, QUANTITIES: "'20'" };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const text = await (await fetch(url)).text();
  const m = text.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!m) throw new Error(`Horizons returned no table for ${key}:\n${text.slice(0, 500)}`);
  out.au[key] = m[1].trim().split('\n').map((l) => Number(Number(l.trim().split(/\s+/)[2]).toFixed(4)));
  console.log(key, out.au[key].length, 'rows, first', out.au[key][0]);
}
fs.writeFileSync('src/data/generated/ephemeris.json', JSON.stringify(out));
