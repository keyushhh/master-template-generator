/**
 * Guards the two rules an imported deck's readability rests on.
 *
 * An uploaded .pptx keeps its own colours, so nothing about the template it
 * lands on stops a run of text ending up the same lightness as the thing it
 * sits on. Both failures this covers shipped: a deck whose background lives on
 * its master imported as white-on-white, and text on a dark card took its ink
 * from the slide behind the card rather than the card.
 *
 *   node scripts/pptx-import-check.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(resolvePath(here, 'pptx-import-check.mjs'), { interopDefault: true });
const { hexIsDark, importedInk } = await jiti.import(resolvePath(here, '../src/features/deck/slideBackground.ts'));
const { snapGround, relightForBrand, WOZKU_BRAND } =
  await jiti.import(resolvePath(here, '../src/features/pptx-import/brandMap.ts'));

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok: !!ok, detail });

// --- 1. ink never matches what it sits on -----------------------------------

const GROUNDS = ['FFFFFF', 'F5F5F5', '0A0A0A', '171717', '525252', 'A3A3A3', '3F5985', '064E3B'];
const inkHex = (kind) => (kind === 'light' ? 'FFFFFF' : '171717');

for (const base of GROUNDS) {
  for (const fill of [undefined, ...GROUNDS]) {
    const ground = fill ?? base;
    const ink = inkHex(importedInk(fill, base));
    check(
      `ink on card #${fill ?? '(none)'} over slide #${base}`,
      hexIsDark(ground) !== hexIsDark(ink),
      `ink #${ink} on #${ground}`
    );
  }
}

// The specific shape of the bug: a dark card sitting on a light slide.
check(
  'dark card on a light slide takes light ink',
  importedInk('171717', 'FFFFFF') === 'light'
);
check(
  'light card on a dark slide takes dark ink',
  importedInk('F5F5F5', '0A0A0A') === 'dark'
);

// --- 2. a slide's ground is never the accent --------------------------------

const ACCENTS = new Set(WOZKU_BRAND.accents);
const SOURCE_GROUNDS = ['3F5985', '10B981', 'B91C1C', '000000', 'FFFFFF', '7C3AED'];

for (const hex of SOURCE_GROUNDS) {
  for (const flip of [false, true]) {
    const ground = snapGround(hex, WOZKU_BRAND, flip);
    check(
      `ground from #${hex}${flip ? ' (re-lit)' : ''} stays neutral`,
      WOZKU_BRAND.neutrals.includes(ground) && !ACCENTS.has(ground),
      `got #${ground}`
    );
  }
}

check(
  're-lighting mirrors a ground rather than keeping its lightness',
  hexIsDark(snapGround('3F5985', WOZKU_BRAND)) && !hexIsDark(snapGround('3F5985', WOZKU_BRAND, true))
);

// --- 3. a dark deck lands readable on a light template ----------------------

const darkDeck = [1, 2, 3].map(() => ({
  base: '3F5985',
  title: 'x',
  shapes: [{
    id: 'a', kind: 'rect', x: 0, y: 0, w: 10, h: 10,
    paragraphs: [{ runs: [{ text: 'hello', color: 'FFFFFF' }] }],
  }],
}));

for (const isDark of [false, true]) {
  const brand = { ...WOZKU_BRAND, isDark };
  const { slides, relit } = relightForBrand(darkDeck, brand);
  const s = slides[0];
  const ink = s.shapes[0].paragraphs[0].runs[0].color;
  check(
    `dark deck on a ${isDark ? 'dark' : 'light'} template stays readable`,
    hexIsDark(s.base) !== hexIsDark(ink),
    `base #${s.base}, ink #${ink}, relit=${relit}`
  );
  check(
    `dark deck ${isDark ? 'keeps' : 'flips'} its lightness on a ${isDark ? 'dark' : 'light'} template`,
    hexIsDark(s.base) === isDark
  );
}

// --- 4. every template answers with a ground, id or no id -------------------

const { templateBaseFor, TEMPLATE_BASE } =
  await jiti.import(resolvePath(here, '../src/features/templates/templateLook.ts'));
const { WOZKU_THEME, EDITORIAL_THEME, AI_NATIVE_THEME } =
  await jiti.import(resolvePath(here, '../src/features/theme/deckTheme.ts'));

// The classic template is the one deck that carries no id at all, so "no id"
// has to answer with the house ground rather than with nothing.
check(
  'a deck with no template id lands on the house ground',
  templateBaseFor(undefined, WOZKU_THEME) === 'FFFFFF',
  `got #${templateBaseFor(undefined, WOZKU_THEME)}`
);
check(
  'a deck with no template id but a dark theme lands dark',
  hexIsDark(templateBaseFor(undefined, AI_NATIVE_THEME)),
  `got #${templateBaseFor(undefined, AI_NATIVE_THEME)}`
);
check(
  'a template with its own look outranks the theme it carries',
  templateBaseFor('product-showcase', WOZKU_THEME) === TEMPLATE_BASE['product-showcase']
);
check(
  'the editorial template lands on its own cream',
  templateBaseFor('editorial', EDITORIAL_THEME) === TEMPLATE_BASE.editorial
);

for (const id of Object.keys(TEMPLATE_BASE)) {
  check(`#${id} answers with its own ground`, templateBaseFor(id, WOZKU_THEME) === TEMPLATE_BASE[id]);
}

// --- report -----------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
for (const r of failed) console.error(`FAIL  ${r.label}${r.detail ? ` - ${r.detail}` : ''}`);
console.log(`pptx-import-check: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
