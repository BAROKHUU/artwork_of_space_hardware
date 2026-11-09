// Writes src/data/generated/planets.json (JPL Keplerian elements) and trajectories.json (Horizons probe paths).
import fs from 'node:fs';

const ELEMENTS_URL = 'https://ssd.jpl.nasa.gov/planets/approx_pos.html';
const elementsText = await (await fetch(ELEMENTS_URL)).text();
const NAMES = { Mercury: 'mercury', Venus: 'venus', 'EM Bary': 'earth', Mars: 'mars', Jupiter: 'jupiter', Saturn: 'saturn', Uranus: 'uranus', Neptune: 'neptune' };
// Table 1 covers 1800-2050 AD.
const table = elementsText.slice(elementsText.indexOf('<h4>Table 1</h4>'), elementsText.indexOf('<h4>Table 2a</h4>'));
const lines = table.split('\n');
const planets = {};
for (const [label, id] of Object.entries(NAMES)) {
  const i = lines.findIndex((l) => l.startsWith(label));
  if (i < 0) throw new Error(`Missing ${label} in ${ELEMENTS_URL}`);
  const base = lines[i].slice(label.length).trim().split(/\s+/).map(Number);
  const rate = lines[i + 1].trim().split(/\s+/).map(Number);
  if (base.length !== 6 || rate.length !== 6 || [...base, ...rate].some(Number.isNaN)) throw new Error(`Bad row for ${label}`);
  planets[id] = { base, rate };
}
fs.writeFileSync('src/data/generated/planets.json', JSON.stringify({ source: ELEMENTS_URL, validFrom: '1800-01-01', validTo: '2050-12-31', planets }));
console.log('planets', Object.keys(planets).length);

const STEP_DAYS = 30;
const STOP = '2049-12-31'; // Pioneer 10's ephemeris ends on 2050-01-01.
const PROBES = { pioneer10: ['-23', '1972-03-05'], voyager2: ['-32', '1977-08-22'], voyager1: ['-31', '1977-09-07'], new_horizons: ['-98', '2006-01-21'] };
const out = { source: 'JPL Horizons, https://ssd.jpl.nasa.gov/horizons/', stepDays: STEP_DAYS, probes: {} };
for (const [id, [command, start]] of Object.entries(PROBES)) {
  const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  const params = { format: 'text', COMMAND: `'${command}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', CENTER: "'500@10'", REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'ICRF', OUT_UNITS: 'AU-D', VEC_TABLE: '1', CSV_FORMAT: 'YES', START_TIME: `'${start}'`, STOP_TIME: `'${STOP}'`, STEP_SIZE: `'${STEP_DAYS} d'` };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const text = await (await fetch(url)).text();
  const m = text.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!m) throw new Error(`Horizons returned no table for ${id}:\n${text.slice(0, 600)}`);
  const xyz = m[1].trim().split('\n').flatMap((row) => row.split(',').slice(2, 5).map((v) => Number(Number(v).toFixed(3))));
  out.probes[id] = { startISO: start, xyz };
  console.log(id, xyz.length / 3, 'rows, last', xyz.slice(-3));
}
fs.writeFileSync('src/data/generated/trajectories.json', JSON.stringify(out));
