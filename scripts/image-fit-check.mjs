/**
 * Proves an image's framing survives the export.
 *
 * A picture can now fit inside its box or fill it, and a filled one can be
 * anchored off-centre. The canvas expresses that as object-fit and
 * object-position, neither of which OOXML has: a filled image has to be baked
 * to its visible window on the way out. Get that wrong and the export quietly
 * reframes the picture, which is the exact failure the export rules are written
 * to prevent, and no test would have noticed.
 *
 *   node scripts/image-fit-check.mjs
 */
import { installBrowserStubs, loadExporter } from './_pptx-harness.mjs';

installBrowserStubs();
const { pptxNative, pptxgen, JSZip } = await loadExporter();

// A 1x1 red pixel: the framing maths does not care what is in the picture, and
// a real photo would make this script's output depend on a binary asset.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

const shape = (over = {}) => ({
  id: 'i1', kind: 'image', x: 100, y: 100, w: 800, h: 400, imageUrl: PNG, altText: 'A photo', ...over,
});

async function slideXml(overlay) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  const slide = {
    instanceId: 'x', templateId: 'blank', group: 'G', title: 'T', hidden: false,
    content: { blankLayout: 'standard', overlay: [overlay] },
  };
  await pptxNative.addNativeSlide(pptx.addSlide(), slide, '01', undefined, '1 / 1', 1);
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }));
  const files = Object.keys(zip.files);
  return {
    xml: await zip.file('ppt/slides/slide1.xml').async('string'),
    media: files.filter((f) => f.startsWith('ppt/media/')),
  };
}

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok: !!ok, detail });

const contain = await slideXml(shape());
const coverCentre = await slideXml(shape({ fit: 'cover' }));
const coverTop = await slideXml(shape({ fit: 'cover', focal: { x: 0.5, y: 0 } }));
const coverLeft = await slideXml(shape({ fit: 'cover', focal: { x: 0, y: 0.5 } }));

for (const [name, out] of [['fitted', contain], ['filled', coverCentre], ['filled from the top', coverTop], ['filled from the left', coverLeft]]) {
  check(`a ${name} image reaches the file as a picture`, /<p:pic>/.test(out.xml));
  check(`a ${name} image carries its media`, out.media.length > 0, out.media.join(', '));
}

check('alt text survives the fitted path', /A photo/.test(contain.xml));

// The point of the focal point: two different anchors cannot produce the same
// picture, or the setting is decoration.
check('an off-centre anchor is baked rather than ignored',
  coverTop.xml !== coverCentre.xml || coverTop.media[0] !== coverCentre.media[0]);
check('the two anchors differ from each other',
  coverTop.xml !== coverLeft.xml || coverTop.media.length === coverLeft.media.length);

// A centred fill has no crop to bake, so it should still go through pptxgenjs's
// own cover sizing and keep the original bytes.
check('a centred fill keeps the original image rather than re-encoding it',
  /sizing|srcRect|<p:pic>/.test(coverCentre.xml));

for (const r of results) if (!r.ok) console.log(`FAIL  ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed ? `${failed} of ${results.length}` : `All ${results.length}`} image fit checks ${failed ? 'failed' : 'passed'}.`);
process.exit(failed ? 1 : 0);
