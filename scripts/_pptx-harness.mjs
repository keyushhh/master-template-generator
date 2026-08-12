/**
 * Shared rig for running the real PPTX exporter under Node.
 *
 * `pptxNative.ts` is the component whose failure the *client* sees, it is ~1400
 * lines, and it had no tests. These scripts give it two: that a refactor changes
 * nothing (pptx-snapshot.mjs), and that the deck theme genuinely reaches it
 * without leaking between exports (pptx-theme-check.mjs).
 *
 * Sources load through jiti so there is no build step and no second copy of the
 * exporter to drift out of sync with the app's.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(resolve(here, '_pptx-harness.mjs'), { interopDefault: true });

// ---------------------------------------------------------------------------
// Browser stubs. The exporter touches the DOM in exactly two places: an
// offscreen canvas that bakes each template's grid/glow into a background PNG,
// and an Image used to read an uploaded photo's aspect ratio. Neither is what
// these scripts check, and a real canvas would make the output
// machine-dependent, so both are deterministic fakes.
// ---------------------------------------------------------------------------

const noop = () => {};

function stubContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    save: noop,
    restore: noop,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    fill: noop,
    arc: noop,
    closePath: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
  };
}

export function installBrowserStubs() {
  globalThis.document = {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error(`pptx harness: unexpected createElement(${tag})`);
      return {
        width: 0,
        height: 0,
        getContext: () => stubContext(),
        // Fixed, so a background's presence still shows up in a diff (the slide
        // XML references it) without the pixels making the output unstable.
        toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=',
      };
    },
  };
  globalThis.Image = class {
    set src(_v) {
      // The exporter's loadImage() already falls back to the box aspect ratio
      // when this rejects, and the pristine template carries no images anyway.
      if (this.onerror) this.onerror(new Error('stub'));
    }
  };
}

export async function loadExporter() {
  const [deckBuilder, pptxNative, deckTheme, pptxgen, JSZip] = await Promise.all([
    jiti.import('../src/features/deck/deckBuilder.ts'),
    jiti.import('../src/features/generator/pptxNative.ts'),
    jiti.import('../src/features/theme/deckTheme.ts'),
    jiti.import('pptxgenjs', { default: true }),
    jiti.import('jszip', { default: true }),
  ]);
  return { deckBuilder, pptxNative, deckTheme, pptxgen, JSZip };
}

/**
 * Renders the pristine 14-slide master template through the exporter and returns
 * each slide's XML, in slide order. `theme` undefined means the house default.
 */
export async function renderSlideXml({ deckBuilder, pptxNative, pptxgen, JSZip }, theme) {
  pptxNative.setExportTheme(theme);
  try {
    const deck = deckBuilder.createTemplateDeck();
    const slides = deck.slides.filter((s) => !s.hidden);

    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_WIDE';

    for (let i = 0; i < slides.length; i++) {
      await pptxNative.addNativeSlide(
        pptx.addSlide(),
        slides[i],
        String(i + 1).padStart(2, '0'),
        undefined,
        `${i + 1} / ${slides.length}`,
        1
      );
    }

    const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }));
    // Only the slide parts. The package also carries a creation timestamp in
    // docProps, which would make every run differ for no reason.
    const names = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));

    const out = [];
    for (const name of names) out.push({ name, xml: await zip.file(name).async('string') });
    return out;
  } finally {
    pptxNative.clearExportTheme();
  }
}
