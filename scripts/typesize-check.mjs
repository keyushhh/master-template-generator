/**
 * Proves the generator knows the size each renderer actually draws a slot at.
 *
 * `fitSlideText` leaves a slot alone when its text fits at `RENDERED_PX`. So a
 * number smaller than the renderer draws is not a safe guess, it is a silent
 * failure: the pass measures the text at 72px, decides it fits, writes no
 * override, and the renderer then sets the same words at 180px and runs them
 * straight through the copy below. Nothing on screen says the two disagreed.
 *
 * Hand-maintaining that table is exactly how it broke, so this reads the sizes
 * back off the renderers and fails on any disagreement. Adding a slot to a
 * template, or restyling one, now fails here until the table is updated.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolvePath(root, p), 'utf8');

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok: !!ok, detail });

const CANVAS = 'src/features/generator/PresentationCanvas.tsx';
const canvas = read(CANVAS);

// templateId -> renderer function name, straight off the registry.
const registry = canvas.match(/const SLIDE_RENDERERS[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
const byFunction = new Map();
for (const m of registry[1].matchAll(/^\s*(\w+):\s*(\w+),/gm)) byFunction.set(m[2], m[1]);
check('the slide renderer registry is readable', byFunction.size > 20, `${byFunction.size} renderers`);

// The long-form slots the generator sizes. Matches TEXT_SLOTS plus the array
// and display slots, so a size change anywhere in that family is caught.
const SLOTS = /^(heading|headingLines|body|subtitle|quote|tagline|leftHeading|rightHeading|leftBody|rightBody|stat|value)$/;

const files = [
  CANVAS,
  ...readdirSync(resolvePath(root, 'src/features/templates/slides'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `src/features/templates/slides/${f}`),
];

/** The size the renderer sets on the element wrapping each slot: the last
 *  `fontSize` literal opened before it, which is the style block it sits in. */
const rendered = new Map();
for (const file of files) {
  const src = read(file);
  const fns = [...src.matchAll(/^(?:export\s+)?function\s+(\w+)\s*\(/gm)]
    .map((m) => ({ name: m[1], start: m.index }));
  fns.forEach((fn, i) => { fn.end = i + 1 < fns.length ? fns[i + 1].start : src.length; });

  for (const fn of fns) {
    const templateId = byFunction.get(fn.name);
    if (!templateId) continue;
    const body = src.slice(fn.start, fn.end);
    for (const m of body.matchAll(/slot=["']([A-Za-z]+)["']/g)) {
      if (!SLOTS.test(m[1])) continue;
      const sizes = [...body.slice(0, m.index).matchAll(/fontSize:\s*(\d+)/g)];
      if (!sizes.length) continue;
      const key = `${templateId}.${m[1]}`;
      if (!rendered.has(key)) rendered.set(key, Number(sizes[sizes.length - 1][1]));
    }
  }
}
check('slot sizes were read off the renderers', rendered.size > 60, `${rendered.size} slots`);

// The table the generator actually uses.
const builders = read('src/features/deck/templateDocumentBuilders.ts');
const tableSrc = builders.match(/const RENDERED_PX: Record<string, number> = \{([\s\S]*?)\n\};/);
check('RENDERED_PX is declared', !!tableSrc);

const table = new Map();
for (const m of (tableSrc?.[1] ?? '').matchAll(/'([^']+)':\s*(\d+),/g)) table.set(m[1], Number(m[2]));

for (const [key, px] of rendered) {
  const listed = table.get(key);
  check(`${key} is listed at the size it is drawn`, listed === px,
    listed === undefined ? `missing, drawn at ${px}px` : `listed ${listed}px, drawn ${px}px`);
}

for (const key of table.keys()) {
  check(`${key} is a slot that still exists`, rendered.has(key), 'listed but no renderer draws it');
}

// The failure this whole file exists to prevent, stated as itself.
check('the closing heading is not modelled three times smaller than it is drawn',
  table.get('s14.heading') === 180, String(table.get('s14.heading')));

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  if (!r.ok) console.log(`FAIL  ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
}

console.log(failed === 0
  ? `\nAll ${results.length} type size checks passed.`
  : `\n${failed} of ${results.length} type size checks FAILED.`);
process.exit(failed === 0 ? 0 : 1);
