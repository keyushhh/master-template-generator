/**
 * Checks that the spacing/case/list overrides and video shapes reach the .pptx.
 *
 * `resolve-check.mjs` proves an override survives the resolver; this proves it
 * survives pptxgenjs and lands as real OOXML - which is the only place the
 * client sees it.
 *
 *   node scripts/pptx-format-check.mjs
 */

import { installBrowserStubs, loadExporter } from './_pptx-harness.mjs';

installBrowserStubs();
const rig = await loadExporter();
const { pptxNative, pptxgen, JSZip } = rig;

const SLOT_STYLES = {
  heading: {
    lineHeight: 1.8,
    letterSpacing: 0.2,
    spaceBefore: 24,
    spaceAfter: 48,
    textCase: 'upper',
    indentLevel: 2,
    bullet: true,
  },
};

/** One blank slide carrying a formatted heading and two video shapes. */
const slide = {
  instanceId: 'fmt-1',
  templateId: 'blank',
  group: 'Test',
  title: 'Format check',
  hidden: false,
  content: {
    blankLayout: 'standard',
    heading: 'spacing check heading',
    body: 'Body copy.',
    styles: SLOT_STYLES,
    overlay: [
      {
        id: 'ov_video_1',
        kind: 'video',
        x: 240, y: 300, w: 960, h: 540,
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        muted: true,
      },
      {
        id: 'ov_video_2',
        kind: 'video',
        x: 240, y: 300, w: 480, h: 270,
        // No source at all: must degrade to a labelled placeholder, not throw.
        videoName: 'missing.mp4',
      },
    ],
  },
};

async function render() {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  await pptxNative.addNativeSlide(pptx.addSlide(), slide, '01', undefined, '1 / 1', 1);
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }));
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  const relsFile = zip.file('ppt/slides/_rels/slide1.xml.rels');
  return { xml, rels: relsFile ? await relsFile.async('string') : '', names: Object.keys(zip.files) };
}

const { xml, rels } = await render();

const checks = [
  // lnSpc with spcPct is how a line-height multiple is spelled in OOXML.
  ['line height reaches the file', /<a:lnSpc><a:spcPct val="180000"\/><\/a:lnSpc>/.test(xml)],
  // Tracking is derived from the effective size: 0.2em of the blank heading's
  // 88px = 17.6px = 8.8pt, and OOXML spc is hundredths of a point.
  ['letter spacing reaches the file as charSpacing', /spc="880"/.test(xml)],
  ['space before reaches the file', /<a:spcBef><a:spcPts val="1200"\/><\/a:spcBef>/.test(xml)],
  ['space after reaches the file', /<a:spcAft><a:spcPts val="2400"\/><\/a:spcAft>/.test(xml)],
  ['indent level reaches the file', /lvl="2"/.test(xml)],
  ['bullet reaches the file', /buChar|buAutoNum|buFont/.test(xml)],
  // Case is destructive on export, since OOXML has no run-level equivalent.
  ['text case is applied to the exported string', xml.includes('SPACING CHECK HEADING')],
  ['the un-cased original is gone', !xml.includes('spacing check heading')],

  ['a YouTube shape exports as media', /<p:pic>|videoFile|media/.test(xml)],
  ['the online video link is in the slide rels', rels.includes('youtube.com/embed/dQw4w9WgXcQ')],
  ['a sourceless video degrades to its label', xml.includes('missing.mp4')],
];

let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}
console.log(failed === 0 ? '\nAll pptx formatting checks passed.' : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
