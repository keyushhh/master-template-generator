/**
 * Proves a chart leaves the app in the colours it was drawn in.
 *
 * Chart colours used to be five hardcoded hexes in the canvas renderer and
 * nothing at all in the exporter, so pptxgenjs picked its own defaults: the
 * chart on screen and the chart in the file were different pictures, and a deck
 * on a client's brand kit exported charts in Wozku's green. Both sides now read
 * `chartPalette.ts`, and this checks the file rather than trusting that.
 *
 * The colours live in the embedded chart part (ppt/charts/chart*.xml), not in
 * the slide, which is why this looks there.
 *
 *   node scripts/chart-color-check.mjs
 */
import { installBrowserStubs, loadExporter } from './_pptx-harness.mjs';

installBrowserStubs();
const { pptxNative, deckTheme, pptxgen, JSZip } = await loadExporter();

const CLIENT = deckTheme.brandKitTheme({ id: 'k1', name: 'Northwind', accent: '2563EB' });

const chartShape = (over = {}) => ({
  id: 'c1',
  kind: 'chart',
  x: 200,
  y: 200,
  w: 900,
  h: 500,
  chartType: 'bar',
  chartCategories: ['Q1', 'Q2', 'Q3'],
  chartSeries: [
    { name: 'Series 1', values: [30, 45, 60] },
    { name: 'Series 2', values: [12, 22, 31] },
  ],
  ...over,
});

/** Every hex named inside the workbook's chart parts, uppercased. */
async function chartHexes(overlay, theme) {
  pptxNative.setExportTheme(theme);
  try {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_WIDE';
    const slide = {
      instanceId: 'x', templateId: 'blank', group: 'G', title: 'T', hidden: false,
      content: { blankLayout: 'standard', overlay: [overlay] },
    };
    await pptxNative.addNativeSlide(pptx.addSlide(), slide, '01', undefined, '1 / 1', 1);
    const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }));
    const parts = Object.keys(zip.files).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n));
    let xml = '';
    for (const part of parts) xml += await zip.file(part).async('string');
    return {
      parts: parts.length,
      hexes: [...xml.matchAll(/val="([0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase()),
    };
  } finally {
    pptxNative.clearExportTheme();
  }
}

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok: !!ok, detail });

const house = await chartHexes(chartShape(), undefined);
check('a chart reaches the file as a real chart part', house.parts > 0, `${house.parts} part(s)`);
check('the deck accent is one of the chart colours', house.hexes.includes('10B981'), house.hexes.slice(0, 6).join(', '));

const client = await chartHexes(chartShape(), CLIENT);
check("a client kit's chart carries the client's accent", client.hexes.includes('2563EB'));
check("a client kit's chart does not carry Wozku's green", !client.hexes.includes('10B981'));

// The point of the override: a colour typed by hand has to survive the export,
// or it is a canvas-only decoration.
const overridden = await chartHexes(chartShape({ chartColors: ['', 'FF0000'] }), undefined);
check('a colour chosen by hand survives the export', overridden.hexes.includes('FF0000'));
check('the series that was not overridden keeps the deck colour', overridden.hexes.includes('10B981'));

// A pie cycles colour by category, so it needs one colour per slice rather than
// one per series - getting that wrong silently repeats a single colour.
const pie = await chartHexes(
  chartShape({ chartType: 'pie', chartSeries: [{ name: 'Series 1', values: [30, 45, 60] }] }),
  undefined
);
check('a pie gets a colour per slice, not one for its single series',
  new Set(pie.hexes.filter((h) => h !== 'FFFFFF' && h !== '000000')).size >= 3,
  pie.hexes.join(', '));

for (const r of results) if (!r.ok) console.log(`FAIL  ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed ? `${failed} of ${results.length}` : `All ${results.length}`} chart colour checks ${failed ? 'failed' : 'passed'}.`);
process.exit(failed ? 1 : 0);
