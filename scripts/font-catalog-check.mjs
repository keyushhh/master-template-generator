/**
 * Checks the committed font catalogue is usable.
 *
 * The catalogue is generated data, and generated data that nobody validates is a
 * silent failure waiting to happen: a schema change at fonts.google.com, a
 * reorganised google/fonts repository, or a half-written file from an interrupted
 * run would all leave a JSON that parses and a picker that offers fonts nobody
 * can embed.
 *
 * The one network assertion is deliberate and small: it fetches the two files for
 * a single well-known family and checks they are real TrueType. That is the whole
 * chain the export depends on - path shape, CDN, CORS-free reachability - and if
 * it breaks, every non-house font silently stops embedding.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok, detail });

const raw = readFileSync(join(root, 'public/google-fonts.json'), 'utf8');
const cat = JSON.parse(raw);

check('catalogue parses', !!cat.fonts, `${(raw.length / 1024).toFixed(0)}KB`);
check('count matches the array', cat.count === cat.fonts.length, `${cat.count} vs ${cat.fonts.length}`);
check('has a usable number of families', cat.fonts.length > 1500, `${cat.fonts.length}`);
check('cdn is set', typeof cat.cdn === 'string' && cat.cdn.startsWith('https://'), cat.cdn);

// Every row has to carry everything both consumers need, or the picker shows a
// font the exporter cannot resolve.
const REQUIRED = ['family', 'category', 'popularity', 'weights', 'dir', 'slug', 'regular', 'bold'];
const broken = cat.fonts.filter((f) => REQUIRED.some((k) => f[k] === undefined || f[k] === null));
check('every row is complete', broken.length === 0, broken.length ? `${broken.length} incomplete` : '');

const badWeights = cat.fonts.filter((f) => !Array.isArray(f.weights) || f.weights.length === 0);
check('every family has at least one weight', badWeights.length === 0,
  badWeights.length ? badWeights.slice(0, 3).map((f) => f.family).join(', ') : '');

const LICENCES = new Set(['ofl', 'apache', 'ufl']);
const badDir = cat.fonts.filter((f) => !LICENCES.has(f.dir));
check('every family sits in a redistributable licence directory', badDir.length === 0,
  badDir.length ? [...new Set(badDir.map((f) => f.dir))].join(', ') : '');

// The whole reason the generator filters on the repository rather than the API:
// Google serves its own brand faces but they carry no licence we can put inside a
// file we send to a client.
const names = new Set(cat.fonts.map((f) => f.family));
const mustNotBeThere = ['Google Sans', 'Google Sans Flex'];
const leaked = mustNotBeThere.filter((n) => names.has(n));
check('unlicensed brand faces are excluded', leaked.length === 0,
  leaked.length ? `leaked: ${leaked.join(', ')}` : mustNotBeThere.join(', '));

// The three the app ships have to be present too: the picker pins them at the
// top, and an imported deck naming one must resolve like any other.
const house = ['Space Grotesk', 'DM Sans', 'JetBrains Mono'];
const missingHouse = house.filter((n) => !names.has(n));
check('house faces are in the catalogue', missingHouse.length === 0,
  missingHouse.length ? `missing: ${missingHouse.join(', ')}` : house.join(', '));

const dupes = cat.fonts.length - names.size;
check('no duplicate families', dupes === 0, dupes ? `${dupes} duplicates` : '');

// One real fetch, end to end.
const probe = cat.fonts.find((f) => f.family === 'Poppins');
if (!probe) {
  check('probe family present (Poppins)', false);
} else {
  const url = `${cat.cdn}/${probe.dir}/${probe.slug}/${encodeURIComponent(probe.regular)}`;
  try {
    const res = await fetch(url);
    const buf = new Uint8Array(await res.arrayBuffer());
    // TrueType outlines start with the version tag 0x00010000; OpenType with 'OTTO'.
    const sfnt =
      (buf[0] === 0x00 && buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00) ||
      String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) === 'OTTO';
    check(`font files are fetchable and are real fonts (${probe.family})`, res.ok && sfnt,
      `${res.status}, ${(buf.length / 1024).toFixed(0)}KB`);
  } catch (err) {
    check('font files are fetchable', false, String(err));
  }
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
}
console.log(
  failed === 0
    ? '\nAll font catalogue checks passed.'
    : `\n${failed} font catalogue check${failed === 1 ? '' : 's'} failed.`
);
process.exit(failed === 0 ? 0 : 1);
