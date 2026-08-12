/**
 * Asserts the exported .pptx names the same typefaces the canvas draws with.
 *
 * There was a divergence here for the whole life of the project: the slide root
 * sets `font-family: var(--font-sans)` and every body paragraph inherits it, but
 * the exporter had no sans role at all - it wrote the *display* face onto body
 * copy. So a deck's paragraphs were one typeface in the studio and another in the
 * file the client opened.
 *
 * That is the worst class of bug this codebase has, because the two renderers
 * share no code and nothing crashes: it is invisible until someone puts the
 * studio and PowerPoint side by side. A position or a colour would have been
 * spotted; a typeface just looks like a slightly different deck.
 *
 * So: render the real exporter and count typefaces per role. The counts are
 * deliberately not asserted exactly - they would change every time a template
 * gains a line of text - but the *presence* of all three roles is, and so is the
 * absence of any face the app does not ship.
 */

import { installBrowserStubs, loadExporter, renderSlideXml } from './_pptx-harness.mjs';

installBrowserStubs();

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok, detail });

const rig = await loadExporter();
const { deckTheme } = rig;
const theme = deckTheme.WOZKU_THEME;

const parts = await renderSlideXml(rig);
const xml = parts.map((p) => p.xml).join('');

const counts = {};
for (const m of xml.matchAll(/typeface="([^"]*)"/g)) {
  counts[m[1]] = (counts[m[1]] ?? 0) + 1;
}

check('14 slides rendered', parts.length === 14, `${parts.length} parts`);

// Every role the theme declares has to actually reach the file. A role declared
// and never used is a role the canvas is drawing with and the export is not.
for (const role of ['display', 'sans', 'mono']) {
  const face = theme.fonts[role].family;
  check(
    `${role} face reaches the export (${face})`,
    (counts[face] ?? 0) > 0,
    `${counts[face] ?? 0} runs`
  );
}

// And nothing else may appear. A face in the XML that is not one of the three is
// a face with no file behind it in `pptxFontEmbed`, which PowerPoint substitutes.
const declared = new Set(['display', 'sans', 'mono'].map((r) => theme.fonts[r].family));
const strays = Object.keys(counts).filter((f) => !declared.has(f));
check(
  'no typeface outside the theme',
  strays.length === 0,
  strays.length ? `stray: ${strays.join(', ')}` : `${declared.size} faces`
);

// Body copy is set at 1.5x leading in every template, and headings at 0.85-1.05.
// If a run has body leading it must be in the body face: this is the specific
// mistake that was there before, expressed as a rule rather than a count.
const bodyRuns = [...xml.matchAll(/<a:lnSpc><a:spcPct val="150000"\/><\/a:lnSpc>[\s\S]{0,600}?typeface="([^"]*)"/g)]
  .map((m) => m[1]);
const wrongFace = [...new Set(bodyRuns.filter((f) => f !== theme.fonts.sans.family))];
check(
  'every 1.5x-leading run is in the body face',
  wrongFace.length === 0,
  wrongFace.length ? `also found: ${wrongFace.join(', ')}` : `${bodyRuns.length} body runs`
);

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
}
console.log(
  failed === 0
    ? '\nAll font role checks passed.'
    : `\n${failed} font role check${failed === 1 ? '' : 's'} failed.`
);
process.exit(failed === 0 ? 0 : 1);
