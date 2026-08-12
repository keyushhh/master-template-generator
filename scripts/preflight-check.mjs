/**
 * Asserts the placeholder table matches the renderers.
 *
 * `preflight/placeholders.ts` lists, per layout, the content fields whose
 * absence means template copy is on screen. That list is a duplicate of
 * knowledge that really lives in PresentationCanvas.tsx, and a duplicate with no
 * check on it drifts: someone adds a `content.newField ?? 'Some Placeholder'` to
 * a layout, the pre-flight silently stops covering it, and a deck ships with
 * placeholder text the studio said was clean. A false all-clear is worse than no
 * check at all.
 *
 * So this reads every `content.x ??` out of every render function and requires
 * each one to be accounted for: either flagged as a placeholder for that layout,
 * or listed as a house default. Adding a fallback without deciding which it is
 * fails the build.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const canvasSrc = readFileSync(join(root, 'src/features/generator/PresentationCanvas.tsx'), 'utf8');
const tableSrc = readFileSync(join(root, 'src/features/preflight/placeholders.ts'), 'utf8');

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok, detail });

// --- what the renderers actually fall back on --------------------------------

/** Render function bodies, sliced between top-level `function SlideX(` lines. */
function rendererBodies(src) {
  const marks = [...src.matchAll(/^function (Slide[A-Za-z0-9]+)\(/gm)].map((m) => ({
    name: m[1],
    at: m.index,
  }));
  return marks.map((m, i) => ({
    name: m.name,
    body: src.slice(m.at, i + 1 < marks.length ? marks[i + 1].at : src.length),
  }));
}

/** templateId -> renderer name, read from the SLIDE_RENDERERS map. */
function rendererIds(src) {
  const block = src.match(/const SLIDE_RENDERERS[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('SLIDE_RENDERERS map not found - has it been renamed?');
  const out = new Map();
  for (const m of block[1].matchAll(/^\s*([A-Za-z0-9_]+):\s*(Slide[A-Za-z0-9]+),/gm)) {
    out.set(m[1], m[2]);
  }
  return out;
}

const bodies = new Map(rendererBodies(canvasSrc).map((b) => [b.name, b.body]));
const ids = rendererIds(canvasSrc);

check('SLIDE_RENDERERS parsed', ids.size >= 16, `${ids.size} layouts`);

/** Fields with a `??` fallback inside one renderer. */
function fallbackFields(body) {
  const out = new Set();
  for (const m of body.matchAll(/content\.([a-zA-Z]+)\s*\?\?/g)) out.add(m[1]);
  return out;
}

// --- what the table claims ---------------------------------------------------

/**
 * Read the two tables out of the source as text rather than importing it: the
 * module is TypeScript and imports React types, and standing up jiti for two
 * string arrays is more machinery than reading them.
 */
function stringSet(name) {
  const m = tableSrc.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) throw new Error(`${name} not found in placeholders.ts`);
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
}

function fieldTable() {
  const m = tableSrc.match(
    /const PLACEHOLDER_FIELDS: Record<string, readonly string\[\]> = \{([\s\S]*?)\n\};/
  );
  if (!m) throw new Error('PLACEHOLDER_FIELDS not found in placeholders.ts');
  const out = new Map();
  for (const entry of m[1].matchAll(/^\s{2}([A-Za-z0-9_]+): \[([\s\S]*?)\],$/gm)) {
    out.set(entry[1], new Set([...entry[2].matchAll(/'([^']+)'/g)].map((x) => x[1])));
  }
  return out;
}

const houseDefaults = stringSet('HOUSE_DEFAULTS');
const table = fieldTable();

check('HOUSE_DEFAULTS parsed', houseDefaults.size > 0, `${houseDefaults.size} fields`);
check('PLACEHOLDER_FIELDS parsed', table.size === ids.size, `${table.size} of ${ids.size} layouts`);

// --- the actual assertions ---------------------------------------------------

for (const [templateId, rendererName] of ids) {
  const body = bodies.get(rendererName);
  if (!body) {
    check(`${templateId}: renderer ${rendererName} found`, false);
    continue;
  }
  const actual = fallbackFields(body);
  const claimed = table.get(templateId);
  if (!claimed) {
    check(`${templateId}: listed in PLACEHOLDER_FIELDS`, false, 'add an entry, [] if it has none');
    continue;
  }

  // Every fallback the renderer has must be either flagged or waved through.
  const unclassified = [...actual].filter((f) => !claimed.has(f) && !houseDefaults.has(f));
  check(
    `${templateId} (${rendererName}): every fallback classified`,
    unclassified.length === 0,
    unclassified.length ? `unclassified: ${unclassified.join(', ')}` : `${actual.size} fallbacks`
  );

  // And nothing may be flagged that the renderer does not actually draw, or the
  // pre-flight would warn about copy that is not on the slide.
  const phantom = [...claimed].filter((f) => !actual.has(f));
  check(
    `${templateId}: nothing flagged that the layout doesn't render`,
    phantom.length === 0,
    phantom.length ? `not in renderer: ${phantom.join(', ')}` : ''
  );
}

// Every flagged field needs a label, or a warning reads "quote, role, tagline"
// in field-name casing straight out of the model.
const labels = new Set(
  [...tableSrc.matchAll(/^\s{2}([a-zA-Z]+): '[^']*',$/gm)].map((m) => m[1])
);
const flagged = new Set([...table.values()].flatMap((s) => [...s]));
const unlabelled = [...flagged].filter((f) => !labels.has(f));
check(
  'every flagged field has a label',
  unlabelled.length === 0,
  unlabelled.length ? `missing: ${unlabelled.join(', ')}` : `${flagged.size} fields`
);

// --- report ------------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
}
console.log(
  failed === 0
    ? '\nAll pre-flight checks passed.'
    : `\n${failed} pre-flight check${failed === 1 ? '' : 's'} failed.`
);
process.exit(failed === 0 ? 0 : 1);
