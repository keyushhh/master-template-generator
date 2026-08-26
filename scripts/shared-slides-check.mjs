/**
 * Proves every shared template layout still exports as a real slide.
 *
 * The shared layouts (agenda, statement, stat, pillars, gauge, versus, phases,
 * voice) have no exporter of their own: `addNativeSlide` routes them onto the
 * classic slide they were built to match. Miss that routing and the layout
 * still looks right on canvas while the .pptx comes out blank, which is exactly
 * the failure a client finds first.
 *
 *   node scripts/shared-slides-check.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createJiti } from 'jiti';
import { installBrowserStubs, loadExporter } from './_pptx-harness.mjs';

installBrowserStubs();
const { pptxNative, pptxgen, JSZip } = await loadExporter();
const jiti = createJiti(resolve(dirname(fileURLToPath(import.meta.url)), 'shared-slides-check.mjs'), { interopDefault: true });
const shared = await jiti.import('../src/features/templates/sharedLayouts.ts');
const templates = await jiti.import('../src/features/templates/presentationTemplates.ts');

/** Content carrying the marker text each layout is expected to draw. */
const CONTENT = {
  agenda: { heading: 'AGENDA MARK', parts: [{ title: 'Part one', description: 'A part.' }] },
  statement: { heading: 'STATEMENT MARK', subtitle: 'A line of context.' },
  stat: { heading: 'STAT MARK', value: '42', unit: 'M', body: 'How it was measured.' },
  pillars: { heading: 'PILLARS MARK', steps: [{ num: '01', title: 'One', description: 'First.' }] },
  gauge: { heading: 'GAUGE MARK', bars: [{ label: 'Adoption', pct: 80 }], kpis: [{ label: 'Accounts', value: '1K' }] },
  versus: { heading: 'VERSUS MARK', rows: [{ dim: 'Speed', cur: '1s', tgt: '2s', delta: '+1s' }] },
  phases: { heading: 'PHASES MARK', phases: [{ num: '01', title: 'First', description: 'Now.' }] },
  voice: { quote: 'VOICE MARK', author: 'Someone', role: 'Somewhere' },
};

async function xmlFor(templateId, content) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  const slide = { instanceId: 'x', templateId, group: 'G', title: 'T', hidden: false, content };
  await pptxNative.addNativeSlide(pptx.addSlide(), slide, '01', undefined, '1 / 1', 1);
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }));
  return zip.file('ppt/slides/slide1.xml').async('string');
}

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok: !!ok, detail });

for (const name of shared.SHARED_LAYOUT_NAMES) {
  const templateId = `product_showcase_${name}`;
  check(`${name} routes to a classic exporter`, shared.sharedExportId(templateId) === shared.SHARED_EXPORT_AS[name]);
  const xml = await xmlFor(templateId, CONTENT[name]);
  const marker = Object.values(CONTENT[name]).find((v) => typeof v === 'string' && v.endsWith('MARK'));
  check(`${name} exports its own text`, xml.includes(marker), marker);
}

check('a slide id that is not shared is left alone', shared.sharedExportId('s7') === undefined);
check('a template slide id is not mistaken for a shared one', shared.sharedExportId('ai_native_metrics') === undefined);

// Every shared id a template deck uses must have a renderer palette behind it.
const prefixes = Object.keys(shared.SHARED_PALETTES);
for (const template of templates.PRESENTATION_TEMPLATES) {
  const deck = template.build();
  const count = deck.slides.length;
  check(`${template.id} says how many slides it has`, template.slideCountText === `${count} slide${count === 1 ? '' : 's'}`,
    `${template.slideCountText} against ${count}`);
  for (const slide of deck.slides) {
    const prefix = prefixes.find((p) => slide.templateId.startsWith(`${p}_`));
    if (!prefix) continue;
    const name = slide.templateId.slice(prefix.length + 1);
    if (!shared.SHARED_LAYOUT_NAMES.includes(name)) continue;
    check(`${slide.templateId} exports natively`, !!shared.sharedExportId(slide.templateId));
  }
}

for (const r of results) if (!r.ok) console.log(`FAIL  ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed ? `${failed} of ${results.length}` : `All ${results.length}`} shared slide checks ${failed ? 'failed' : 'passed'}.`);
process.exit(failed ? 1 : 0);
