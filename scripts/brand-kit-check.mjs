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
const { accentRamp, brandKitTheme, hexToHsl, isHex6, themeCssVars, WOZKU_THEME } =
  await jiti.import('../src/features/theme/deckTheme.ts');

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

// ---------------------------------------------------------------------------
// Typefaces
//
// A kit carries type as well as colour. The rule that matters is that an unset
// role means the house face - not an empty string, not a broken stack - because
// every kit saved before type existed has no `fonts` at all and must keep
// rendering as house type on the client's colour.
// ---------------------------------------------------------------------------

console.log('Typefaces\n');

const houseKit = brandKitTheme({ id: 'k1', name: 'No type', accent: '2563EB' });
for (const role of ['display', 'sans', 'mono']) {
  if (houseKit.fonts[role].family !== WOZKU_THEME.fonts[role].family) {
    fail(`kit with no fonts: ${role} is the house face`, houseKit.fonts[role].family);
  } else pass(`kit with no fonts: ${role} is the house face (${houseKit.fonts[role].family})`);
}

const fullKit = brandKitTheme({
  id: 'k2', name: 'Full', accent: '2563EB',
  fonts: { display: 'Playfair Display', sans: 'Inter', mono: 'IBM Plex Mono' },
});
for (const [role, want] of [['display', 'Playfair Display'], ['sans', 'Inter'], ['mono', 'IBM Plex Mono']]) {
  if (fullKit.fonts[role].family !== want) fail(`kit fonts: ${role} is the chosen face`, fullKit.fonts[role].family);
  else pass(`kit fonts: ${role} is the chosen face (${want})`);
}

// The chosen family goes in front of the house stack, so the fallback chain stays
// role-correct: a client's mono falls back to a mono, never to a sans.
for (const [role, want] of [['display', 'Playfair Display'], ['sans', 'Inter'], ['mono', 'IBM Plex Mono']]) {
  const stack = fullKit.fonts[role].stack;
  const startsRight = stack.startsWith(`"${want}"`);
  const keepsHouse = stack.includes(WOZKU_THEME.fonts[role].family);
  if (!startsRight || !keepsHouse) fail(`kit fonts: ${role} stack falls back within its role`, stack);
  else pass(`kit fonts: ${role} stack falls back within its role`);
}

const partial = brandKitTheme({ id: 'k3', name: 'Partial', accent: '2563EB', fonts: { display: 'Lora' } });
if (partial.fonts.display.family !== 'Lora') fail('partial kit: display overridden', partial.fonts.display.family);
else pass('partial kit: display overridden (Lora)');
for (const role of ['sans', 'mono']) {
  if (partial.fonts[role].family !== WOZKU_THEME.fonts[role].family) {
    fail(`partial kit: ${role} left on the house face`, partial.fonts[role].family);
  } else pass(`partial kit: ${role} left on the house face`);
}

// An empty string is not a choice. It would otherwise produce `"" , stack` and a
// family name of nothing in the exported XML.
const blank = brandKitTheme({ id: 'k4', name: 'Blank', accent: '2563EB', fonts: { display: '' } });
if (blank.fonts.display.family !== WOZKU_THEME.fonts.display.family) {
  fail('empty family falls back to the house face', blank.fonts.display.family);
} else pass('empty family falls back to the house face');

// And the CSS vars the canvas reads have to carry the kit's stacks, since that is
// the only route from a kit to a rendered slide.
const vars = themeCssVars(fullKit);
for (const [v, want] of [['--font-display', 'Playfair Display'], ['--font-sans', 'Inter'], ['--font-mono', 'IBM Plex Mono']]) {
  if (!vars[v]?.includes(want)) fail(`${v} carries the kit face`, vars[v]);
  else pass(`${v} carries the kit face (${want})`);
}

// Colour must be untouched by any of this.
const ramp = accentRamp('2563EB');
if (fullKit.accent.base !== ramp.base) fail('kit type does not disturb the colour ramp', fullKit.accent.base);
else pass('kit type does not disturb the colour ramp');

console.log('');
console.log(failed === 0 ? 'All brand kit checks passed.' : `${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
