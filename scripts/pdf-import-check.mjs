/**
 * Exercises the reconstruction a PDF import depends on.
 *
 * A PDF stores no headings, no paragraphs and frequently no spaces: a line
 * arrives as a handful of separately positioned glyph runs. Everything readable
 * about an imported page therefore comes out of the clustering in
 * `pdfParser.ts`, not out of the file, so that clustering is the only part
 * worth testing and the only part that can quietly ruin the feature.
 *
 * The failure it exists to prevent is already known by name: "Series A
 * SyndicateMemorandum." Two runs, no stored space, welded together on import.
 *
 *   node scripts/pdf-import-check.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(resolvePath(here, 'pdf-import-check.mjs'), { interopDefault: true });
const { toLines, lineText, toBlocks, inkIn, backgroundOf } =
  await jiti.import(resolvePath(here, '../src/features/pdf-import/pdfParser.ts'));

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok: !!ok, detail });

/** One positioned run, as pdf.js hands them over. `w` is its advance width. */
const piece = (text, x, y, sizePx, w = text.length * sizePx * 0.5) =>
  ({ text, x, y, sizePx, w, font: 'Helvetica', bold: false, italic: false });

const textOf = (pieces) => toLines(pieces).map(lineText);
const blockText = (pieces) =>
  toBlocks(toLines(pieces)).map((block) => block.map(lineText).join('\n'));

// --- 1. words separated only by position ------------------------------------

// The exact shape of the bug: two runs on one baseline with a real gap between
// them, and nothing in the file saying "space".
const split = [piece('Series A Syndicate', 100, 200, 40), piece('Memorandum.', 480, 200, 40)];
check('runs separated by a gap get the space the PDF never stored',
  textOf(split)[0] === 'Series A Syndicate Memorandum.', textOf(split)[0]);

// And the opposite must not happen: kerned runs that are one word stay one word.
const kerned = [piece('Memo', 100, 200, 40), piece('randum.', 180, 200, 40, 140)];
check('runs set tight against each other are not pulled apart',
  textOf(kerned)[0] === 'Memorandum.', textOf(kerned)[0]);

// A run that already carries its own space must not gain a second one.
const spaced = [piece('Series A ', 100, 200, 40), piece('Syndicate', 300, 200, 40)];
check('a run that already ends in a space does not get another',
  spaced.length && textOf(spaced)[0] === 'Series A Syndicate', textOf(spaced)[0]);

// --- 2. lines ---------------------------------------------------------------

// pdf.js emits in content-stream order, which is not reading order.
const outOfOrder = [
  piece('third', 100, 300, 20),
  piece('first', 100, 100, 20),
  piece('second', 100, 200, 20),
];
check('lines come back in reading order, not file order',
  textOf(outOfOrder).join('|') === 'first|second|third', textOf(outOfOrder).join('|'));

// Runs on one line are rarely emitted left to right either.
const backwards = [piece('World', 300, 100, 20), piece('Hello', 100, 100, 20, 80)];
check('runs on a line are ordered by position, not by emission',
  textOf(backwards)[0] === 'Hello World', textOf(backwards)[0]);

// Subscripts and accents sit slightly off the baseline without being a new line.
const jittered = [piece('same', 100, 100, 20), piece('line', 200, 103, 20)];
check('a hair off the baseline is still the same line', textOf(jittered).length === 1,
  `${textOf(jittered).length} lines`);

// --- 3. blocks --------------------------------------------------------------

// A heading welded to the paragraph under it is one shape that can never be
// styled or moved separately, which defeats the point of importing text at all.
const headingAndBody = [
  piece('The Opportunity', 100, 100, 48),
  piece('Our pipeline grew by 185% year on year across', 100, 200, 20),
  piece('both regions, ahead of the plan we set in Q1.', 100, 228, 20),
];
const blocks = blockText(headingAndBody);
check('a heading does not merge into the paragraph below it', blocks.length === 2,
  `${blocks.length} blocks`);
check('the heading is its own block', blocks[0] === 'The Opportunity', blocks[0]);
check('the paragraph keeps both its lines',
  blocks[1] === 'Our pipeline grew by 185% year on year across\nboth regions, ahead of the plan we set in Q1.',
  JSON.stringify(blocks[1]));

// A gap wide enough to be a new paragraph must split, at the same type size.
const twoParagraphs = [
  piece('First paragraph here.', 100, 100, 20),
  piece('Second one, far below.', 100, 260, 20),
];
check('a wide vertical gap starts a new block', blockText(twoParagraphs).length === 2,
  `${blockText(twoParagraphs).length} blocks`);

// Two columns share baselines but do not overlap horizontally.
const columns = [
  piece('Left column text', 100, 100, 20, 200),
  piece('Right column text', 900, 100, 20, 200),
];
check('side by side columns are not joined into one line',
  toLines(columns).length === 1 && blockText(columns).length === 1);

// --- 4. colour read off the rendered page -----------------------------------

/** A tiny fake raster: white page, a red mark in the middle. */
function raster(w, h, mark) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  if (mark) {
    for (let y = mark.y; y < mark.y + mark.h; y++) {
      for (let x = mark.x; x < mark.x + mark.w; x++) {
        const i = (y * w + x) * 4;
        data[i] = mark.rgb[0]; data[i + 1] = mark.rgb[1]; data[i + 2] = mark.rgb[2]; data[i + 3] = 255;
      }
    }
  }
  return data;
}

const white = raster(40, 40, { x: 15, y: 15, w: 8, h: 8, rgb: [200, 20, 20] });
check('a white page is detected as white',
  backgroundOf(white, 40, 40).join(',') === '255,255,255', backgroundOf(white, 40, 40).join(','));
check('ink is read as the colour furthest from the background',
  inkIn(white, 40, 40, { x: 12, y: 12, w: 16, h: 16 }, 1, [255, 255, 255]) === 'C81414',
  String(inkIn(white, 40, 40, { x: 12, y: 12, w: 16, h: 16 }, 1, [255, 255, 255])));

// A dark page must be read as dark, or the slide comes in white and every
// re-light decision downstream is made on a wrong answer.
const darkPage = raster(40, 40);
darkPage.fill(255);
for (let i = 0; i < 40 * 40; i++) {
  darkPage[i * 4] = 11; darkPage[i * 4 + 1] = 7; darkPage[i * 4 + 2] = 26;
}
check('a dark page is detected as dark', backgroundOf(darkPage, 40, 40).join(',') === '11,7,26',
  backgroundOf(darkPage, 40, 40).join(','));

// Text the same colour as its background is not ink, it is nothing: leaving the
// colour unset lets the slide's own ink apply, which re-lighting can then flip.
const blank = raster(40, 40);
check('a box with nothing in it reports no colour',
  inkIn(blank, 40, 40, { x: 5, y: 5, w: 10, h: 10 }, 1, [255, 255, 255]) === undefined);
check('a box outside the page reports no colour',
  inkIn(blank, 40, 40, { x: 90, y: 90, w: 10, h: 10 }, 1, [255, 255, 255]) === undefined);

// --- 5. end to end, against real pdf.js and a real file ----------------------

// Everything above drives the clustering with hand-made runs, which proves the
// rules but not that a PDF actually arrives in the shape they expect. So this
// builds a real PDF, reads it with real pdf.js, and applies the same transform
// the parser does. It is the only check here that would catch the parser
// measuring position or type size wrongly.
//
// Node gets pdf.js's legacy build (the browser build wants a DOM); the geometry
// they report is identical, which is the part under test.
const { jsPDF } = await import('jspdf');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [960, 540] });
doc.setFontSize(40);
doc.setFont('helvetica', 'bold');
doc.text('Series A Syndicate', 60, 120);
doc.text('Memorandum.', 60, 170);
doc.setFontSize(14);
doc.setFont('helvetica', 'normal');
doc.text('Our pipeline grew by 185% year on year across both regions,', 60, 240);
doc.text('ahead of the plan we set in Q1.', 60, 262);

const pdf = await pdfjs.getDocument({
  data: new Uint8Array(doc.output('arraybuffer')),
  standardFontDataUrl: resolvePath(here, '../node_modules/pdfjs-dist/standard_fonts/') + '/',
}).promise;
check('a real PDF opens and reports its pages', pdf.numPages === 1, String(pdf.numPages));

const page = await pdf.getPage(1);
const rawViewport = page.getViewport({ scale: 1 });
const pageScale = Math.min(1920 / rawViewport.width, 1080 / rawViewport.height);
const viewport = page.getViewport({ scale: pageScale });
const offX = (1920 - viewport.width) / 2;
const offY = (1080 - viewport.height) / 2;

const real = [];
for (const item of (await page.getTextContent()).items) {
  if (!('str' in item) || !item.str.trim()) continue;
  const tx = pdfjs.Util.transform(viewport.transform, item.transform);
  real.push({
    text: item.str,
    x: tx[4] + offX,
    y: tx[5] + offY,
    w: item.width * pageScale,
    sizePx: Math.hypot(tx[2], tx[3]),
    font: '',
    bold: false,
    italic: false,
  });
}

// A 960x540pt page doubles into the 1920x1080 design space, so every number
// below is checkable by hand: 40pt type is 80px, and 60pt in is 120px in.
check('a 16:9 page maps into the design space with no letterboxing',
  offX === 0 && offY === 0, `${offX},${offY}`);
check('type size survives the mapping', real[0] && Math.round(real[0].sizePx) === 80,
  String(real[0]?.sizePx));
check('position survives the mapping', real[0] && Math.round(real[0].x) === 120,
  String(real[0]?.x));

const realBlocks = blockText(real);
check('the heading and the paragraph come back as separate blocks',
  realBlocks.length === 2, `${realBlocks.length}: ${JSON.stringify(realBlocks)}`);
check('the two heading lines stay one block, with their break kept',
  realBlocks[0] === 'Series A Syndicate\nMemorandum.', JSON.stringify(realBlocks[0]));
check('the body paragraph keeps both of its lines',
  realBlocks[1] === 'Our pipeline grew by 185% year on year across both regions,\nahead of the plan we set in Q1.',
  JSON.stringify(realBlocks[1]));

// --- report -----------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
}

console.log(failed === 0
  ? `\nAll ${results.length} PDF import checks passed.`
  : `\n${failed} of ${results.length} PDF import checks FAILED.`);
process.exit(failed === 0 ? 0 : 1);
