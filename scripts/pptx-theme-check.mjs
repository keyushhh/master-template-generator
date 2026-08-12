/**
 * Checks that a deck's theme genuinely reaches the PPTX exporter, and does not
 * leak from one export into the next.
 *
 * The point of the theme extraction was that the canvas and the .pptx cannot
 * disagree about a client's palette. That guarantee is worth an actual test:
 * "the colours are in a shared file now" is easy to believe and easy to be wrong
 * about, because the exporter reads its palette from module state and a missed
 * `clearExportTheme()` would put one client's brand on the next client's deck.
 *
 *   node scripts/pptx-theme-check.mjs
 */

import { installBrowserStubs, loadExporter, renderSlideXml } from './_pptx-harness.mjs';

installBrowserStubs();
const rig = await loadExporter();
const { WOZKU_THEME } = rig.deckTheme;

/** A deliberately un-Wozku theme, so any leak is unmistakable in the output. */
const TEST_THEME = {
  ...WOZKU_THEME,
  id: 'theme-check',
  name: 'Theme check',
  accent: { base: 'FF00AA', bright: 'FF66CC', deep: 'CC0088', tint: 'FFE6F5' },
  fonts: {
    ...WOZKU_THEME.fonts,
    display: { family: 'Georgia', stack: 'Georgia, serif' },
  },
};

const join = (slides) => slides.map((s) => s.xml).join('');

const house = join(await renderSlideXml(rig, WOZKU_THEME));
const themed = join(await renderSlideXml(rig, TEST_THEME));
// Run the house theme again *after* a themed export: this is the leak check.
const houseAgain = join(await renderSlideXml(rig, WOZKU_THEME));

const checks = [
  ['house export uses the Wozku emerald', house.includes('10B981')],
  ['house export has no test accent', !house.includes('FF00AA')],
  ['house export uses Space Grotesk', house.includes('Space Grotesk')],

  ['themed export uses the test accent', themed.includes('FF00AA')],
  ['themed export dropped the Wozku emerald', !themed.includes('10B981')],
  ['themed export uses the test display font', themed.includes('Georgia')],
  ['themed export dropped Space Grotesk', !themed.includes('Space Grotesk')],

  ['themed output differs from house output', house !== themed],
  ['no leak: house export after a themed one is identical', house === houseAgain],
];

let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}
console.log(failed === 0 ? '\nAll theme checks passed.' : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
