/**
 * Asserts every field of a SlotStyle survives the formatting seam.
 *
 * `resolve.ts` is the one place an override becomes something a renderer can use,
 * and it has three consumers that must agree: `patchStyles` (which decides
 * whether an override is worth storing), `applyToCss` (the canvas) and
 * `applyToPptx` (the exporter). A field added to `SlotStyle` and missed in any one
 * of them fails silently in a different way each time.
 *
 * `fontFamily` was missed in `isEmptyStyle`, which `patchStyles` uses to drop
 * overrides that would change nothing. So `{ fontFamily: 'Roboto' }` was judged
 * empty and deleted: picking a typeface for a slot with no other override did
 * nothing at all, with no error anywhere. Nothing crashed, the menu closed
 * normally, and the text simply stayed as it was.
 *
 * So this reads the field list off the TypeScript declaration rather than
 * repeating it. A field added to the interface and nowhere else fails here.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const jiti = createJiti(resolvePath(here, 'resolve-check.mjs'), { interopDefault: true });

const { isEmptyStyle, patchStyles, applyToCss, applyToPptx } = await jiti.import(
  resolvePath(root, 'src/features/formatting/resolve.ts')
);

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok, detail });

// --- the field list, read from the type ---------------------------------------

const types = readFileSync(join(root, 'src/features/deck/types.ts'), 'utf8');
const block = types.match(/export interface SlotStyle \{([\s\S]*?)\n\}/);
if (!block) throw new Error('SlotStyle not found in types.ts - has it been renamed?');
const fields = [...block[1].matchAll(/^\s{2}([a-zA-Z]+)\?:/gm)].map((m) => m[1]);

check('SlotStyle fields parsed', fields.length >= 7, fields.join(', '));

/** A value that is legal for each field, so each can be patched on its own. */
const SAMPLE = {
  sizePx: 42,
  bold: true,
  italic: true,
  underline: true,
  color: 'FF0000',
  align: 'center',
  fontFamily: 'Roboto',
  lineHeight: 1.5,
  letterSpacing: 0.12,
  spaceBefore: 12,
  spaceAfter: 24,
  textCase: 'upper',
  indentLevel: 2,
  bullet: true,
};

const unsampled = fields.filter((f) => SAMPLE[f] === undefined);
check(
  'every field has a sample value in this script',
  unsampled.length === 0,
  unsampled.length ? `add one for: ${unsampled.join(', ')}` : ''
);

// --- one field at a time ------------------------------------------------------

for (const field of fields) {
  if (SAMPLE[field] === undefined) continue;
  const patch = { [field]: SAMPLE[field] };

  // 1. On its own, it is not "empty". This is the specific check that was wrong.
  check(`${field}: alone, is not treated as an empty override`, !isEmptyStyle(patch));

  // 2. So patchStyles keeps it rather than deleting the slot's entry.
  const stored = patchStyles(undefined, 'heading', patch);
  check(
    `${field}: survives patchStyles onto a clean slot`,
    stored?.heading?.[field] === SAMPLE[field],
    stored?.heading === undefined ? 'the whole entry was dropped' : JSON.stringify(stored?.heading)
  );

  // 3. And reaches both renderers. Neither is allowed to ignore it, or the canvas
  //    and the exported file disagree about the same slot.
  const css = applyToCss(patch);
  check(`${field}: reaches the canvas as CSS`, Object.keys(css).length > 0, JSON.stringify(css));

  const pptx = applyToPptx({}, patch);
  check(`${field}: reaches the exporter`, Object.keys(pptx).length > 0, JSON.stringify(pptx));
}

// --- and the inverse: unsetting really unsets ---------------------------------

const full = patchStyles(undefined, 'heading', SAMPLE);
check('a full override stores every field', Object.keys(full?.heading ?? {}).length === fields.length,
  `${Object.keys(full?.heading ?? {}).length} of ${fields.length}`);

let stripped = full;
for (const field of fields) stripped = patchStyles(stripped, 'heading', { [field]: undefined });
check(
  'unsetting every field removes the slot entirely',
  stripped === undefined,
  stripped ? JSON.stringify(stripped) : 'so the template value takes over again'
);

check('an empty object is empty', isEmptyStyle({}));
check('undefined is empty', isEmptyStyle(undefined));

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
}
console.log(
  failed === 0
    ? '\nAll formatting seam checks passed.'
    : `\n${failed} formatting seam check${failed === 1 ? '' : 's'} failed.`
);
process.exit(failed === 0 ? 0 : 1);
