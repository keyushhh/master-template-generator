/**
 * Checks the brand-kit accent ramp.
 *
 * A kit is one hex, and the four steps the templates need are derived from it.
 * That derivation is the part nobody can eyeball: it has to hold up for a
 * near-black brand colour, a near-white one, and a pure grey, and in each case
 * still produce four *distinguishable* steps in the right order. Get it wrong and
 * a client's deck ships with an accent that is invisible against its own ground.
 *
 *   node scripts/brand-kit-check.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(resolve(here, 'brand-kit-check.mjs'), { interopDefault: true });
const { accentRamp, hexToHsl, isHex6 } = await jiti.import('../src/features/theme/deckTheme.ts');

/** Relative luminance, for ordering steps by how light they actually read. */
function luminance(hex) {
  const v = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const CASES = [
  ['Wozku emerald', '10B981'],
  ['near-black', '111111'],
  ['pure black', '000000'],
  ['near-white', 'FAFAFA'],
  ['pure white', 'FFFFFF'],
  ['mid grey', '808080'],
  ['saturated red', 'FF0000'],
  ['deep navy', '0B2545'],
  ['bright yellow', 'FFE600'],
];

let failed = 0;
const fail = (label, detail) => {
  failed++;
  console.log(`FAIL  ${label}${detail ? ` (${detail})` : ''}`);
};
const pass = (label) => console.log(`PASS  ${label}`);

for (const [label, input] of CASES) {
  const r = accentRamp(input);

  const allHex = [r.base, r.bright, r.deep, r.tint].every((h) => isHex6(h));
  if (!allHex) { fail(`${label}: all four steps are valid hex`, JSON.stringify(r)); continue; }

  if (r.base !== input.toUpperCase()) fail(`${label}: base is the colour as given`, r.base);
  else pass(`${label}: base preserved`);

  // Monotonic: deep is never lighter than base, bright never darker. Equality is
  // allowed and correct - a brand colour that is already near-white needs no
  // lightening to be readable on black, and pure black needs no darkening to be
  // readable on white. Strict ordering was the first version of this assertion and
  // it was wrong: it demanded movement from colours that were already at the end
  // of the range they were being pushed toward.
  // Tint is deliberately excluded: it is a fixed near-white wash, not a step on
  // this ramp, and its own contract (dark ink reads on it) is asserted below. A
  // near-white brand colour legitimately produces a `bright` lighter than the
  // wash, and no template cares.
  const lum = { tint: luminance(r.tint), bright: luminance(r.bright), base: luminance(r.base), deep: luminance(r.deep) };
  if (!(lum.deep <= lum.base + 1e-9 && lum.bright >= lum.base - 1e-9)) {
    fail(`${label}: ramp monotonic (deep <= base <= bright)`, JSON.stringify(lum));
  } else {
    pass(`${label}: ramp monotonic`);
  }

  // The tint is a ground for dark copy, so ink must stay readable on it.
  const inkOnTint = contrast(r.tint, '171717');
  if (inkOnTint < 7) fail(`${label}: ink readable on tint`, `contrast ${inkOnTint.toFixed(1)}`);
  else pass(`${label}: ink on tint (${inkOnTint.toFixed(1)}:1)`);

  // `deep` exists so accent text can hold up on a white slide.
  const deepOnWhite = contrast(r.deep, 'FFFFFF');
  if (deepOnWhite < 3) fail(`${label}: deep usable on white`, `contrast ${deepOnWhite.toFixed(1)}`);
  else pass(`${label}: deep on white (${deepOnWhite.toFixed(1)}:1)`);

  // `bright` exists so accent text can hold up on a black slide.
  const brightOnBlack = contrast(r.bright, '000000');
  if (brightOnBlack < 3) fail(`${label}: bright usable on black`, `contrast ${brightOnBlack.toFixed(1)}`);
  else pass(`${label}: bright on black (${brightOnBlack.toFixed(1)}:1)`);

  // Hue must survive, or a client's blue comes back purple.
  const inHue = hexToHsl(input);
  const outHue = hexToHsl(r.deep);
  if (inHue.s > 0.15 && outHue.s > 0.15) {
    const drift = Math.min(Math.abs(inHue.h - outHue.h), 360 - Math.abs(inHue.h - outHue.h));
    if (drift > 6) fail(`${label}: hue preserved through the ramp`, `drift ${drift.toFixed(1)}deg`);
    else pass(`${label}: hue preserved (${drift.toFixed(1)}deg drift)`);
  }
  console.log('');
}

console.log(failed === 0 ? 'All brand kit checks passed.' : `${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
