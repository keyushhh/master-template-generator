import type { ImportedSlide, ImportedShape, ImportedParagraph, ImportedRun } from '../deck/types';
import { mapFont, snapToBrand, relightForBrand, WOZKU_BRAND, type BrandMap } from '../pptx-import/brandMap';

/**
 * Reads an uploaded .pdf and lifts each page into positioned shapes in the
 * app's 1920x1080 design space, the same model the .pptx importer produces, so
 * everything downstream (rendering, editing, re-lighting, export) is shared.
 *
 * A PDF has no structure to read. It is positioned glyph runs, frequently split
 * mid-word, with no notion of a heading, a paragraph or a slot. So the work here
 * is reconstruction: runs are clustered into lines by baseline, lines into
 * blocks by spacing and size, and a block becomes one text shape. That is a
 * heuristic and it is the part that decides whether this feature is any good.
 *
 * Colour is not in the text stream either, so ink is read back off the rendered
 * page: the pixel inside a block that sits furthest from the page's background
 * is that block's colour. Sampling is cheap because the page has to be rendered
 * anyway, both to find the background and to populate the image store.
 */

/** Loaded on demand. pdf.js is ~350KB and no deck needs it until a PDF arrives. */
type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

async function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import('pdfjs-dist');
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      return lib;
    })();
  }
  return pdfjsPromise;
}

const CANVAS_W = 1920;
const CANVAS_H = 1080;

/** Width the page is rasterised at for colour sampling. Big enough that a text
 *  block covers real pixels, small enough that a 60-page deck stays quick. */
const SAMPLE_W = 900;

/** Width a page with no text is rasterised at, since that render is not being
 *  sampled, it is the slide. Worth the extra pixels; nothing else will carry it. */
const IMAGE_W = 1600;

/**
 * How many bytes of page images one import may embed.
 *
 * A deck lives in localStorage, which is about 5MB for everything the app has
 * stored. A picture-only PDF would otherwise write one full-page JPEG per page
 * and blow that budget somewhere in the middle of a long file, which surfaces
 * as a deck that will not save rather than as anything to do with the PDF.
 */
const IMAGE_BUDGET_BYTES = 2_200_000;

/** Lets the browser paint between pages. Every part of this runs on the main
 *  thread, and a long PDF without this is an application that looks hung. */
const yieldToBrowser = () => new Promise<void>((resolve) => { setTimeout(resolve, 0); });

export interface PdfImportResult {
  slides: ImportedSlide[];
  warnings: string[];
  /** Whether the deck's colours were mirrored to match the template's lightness. */
  relit: boolean;
}

export interface Piece {
  text: string;
  x: number;
  y: number;
  w: number;
  sizePx: number;
  font: string;
  bold: boolean;
  italic: boolean;
}

export interface Line {
  pieces: Piece[];
  baseline: number;
  left: number;
  right: number;
  top: number;
  sizePx: number;
}

function hex(r: number, g: number, b: number): string {
  return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

/** A run's real family name, which pdf.js hides behind an internal id, plus the
 *  weight and slant that in a PDF live only in that name ("...-BoldOblique"). */
function faceOf(page: { commonObjs: { has(id: string): boolean; get(id: string): unknown } }, fontId: string) {
  let raw = '';
  try {
    if (page.commonObjs.has(fontId)) {
      const obj = page.commonObjs.get(fontId) as { name?: string; fallbackName?: string } | null;
      raw = obj?.name ?? obj?.fallbackName ?? '';
    }
  } catch {
    raw = '';
  }
  // Subset fonts arrive as "ABCDEF+Helvetica-Bold"; the tag is not part of the name.
  const name = raw.replace(/^[A-Z]{6}\+/, '');
  return {
    name,
    bold: /bold|black|heavy|semibold|[-_]?600|[-_]?700|[-_]?800|[-_]?900/i.test(name),
    italic: /italic|oblique/i.test(name),
  };
}

/** Groups runs sharing a baseline into a line, inserting the spaces a PDF does
 *  not store: a gap wider than a fraction of an em is a word break, which is
 *  why "Series A Syndicate" can otherwise arrive as one word. */
export function toLines(pieces: Piece[]): Line[] {
  const sorted = [...pieces].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];

  for (const piece of sorted) {
    const last = lines[lines.length - 1];
    const sameLine = last && Math.abs(last.baseline - piece.y) <= Math.max(2, piece.sizePx * 0.4);
    if (sameLine) {
      last.pieces.push(piece);
      last.left = Math.min(last.left, piece.x);
      last.right = Math.max(last.right, piece.x + piece.w);
      last.top = Math.min(last.top, piece.y - piece.sizePx);
      last.sizePx = Math.max(last.sizePx, piece.sizePx);
    } else {
      lines.push({
        pieces: [piece],
        baseline: piece.y,
        left: piece.x,
        right: piece.x + piece.w,
        top: piece.y - piece.sizePx,
        sizePx: piece.sizePx,
      });
    }
  }

  for (const line of lines) line.pieces.sort((a, b) => a.x - b.x);
  return lines;
}

export function lineText(line: Line): string {
  let out = '';
  let cursor = -Infinity;
  for (const piece of line.pieces) {
    const gap = piece.x - cursor;
    if (out && gap > piece.sizePx * 0.18 && !/\s$/.test(out) && !/^\s/.test(piece.text)) out += ' ';
    out += piece.text;
    cursor = piece.x + piece.w;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Consecutive lines that read as one block: similar size, close together, and
 *  horizontally overlapping. Anything else starts a new shape, which is what
 *  keeps a heading from being welded to the paragraph beneath it. */
export function toBlocks(lines: Line[]): Line[][] {
  const blocks: Line[][] = [];
  for (const line of lines) {
    const block = blocks[blocks.length - 1];
    const prev = block?.[block.length - 1];
    const joins =
      prev &&
      Math.abs(prev.sizePx - line.sizePx) <= Math.max(1, prev.sizePx * 0.25) &&
      line.baseline - prev.baseline > 0 &&
      line.baseline - prev.baseline < prev.sizePx * 2.2 &&
      Math.min(prev.right, line.right) - Math.max(prev.left, line.left) > 0;
    if (joins) block.push(line);
    else blocks.push([line]);
  }
  return blocks;
}

/** The colour of the ink in a box: the sampled pixel furthest from the page's
 *  own background. Text colour is not in the text stream, and this reads the
 *  answer off the page rather than walking the graphics state to infer it. */
export function inkIn(
  data: Uint8ClampedArray,
  cw: number,
  ch: number,
  box: { x: number; y: number; w: number; h: number },
  scale: number,
  bg: [number, number, number]
): string | undefined {
  const x0 = Math.max(0, Math.floor(box.x * scale));
  const y0 = Math.max(0, Math.floor(box.y * scale));
  const x1 = Math.min(cw, Math.ceil((box.x + box.w) * scale));
  const y1 = Math.min(ch, Math.ceil((box.y + box.h) * scale));
  if (x1 <= x0 || y1 <= y0) return undefined;

  let best: [number, number, number] | null = null;
  let bestDelta = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * cw + x) * 4;
      if (data[i + 3] < 128) continue;
      const px: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
      const delta = distance(px, bg);
      if (delta > bestDelta) {
        bestDelta = delta;
        best = px;
      }
    }
  }
  // Too close to the background to be ink: leave the colour unset so the slide's
  // own ink applies, which is also what keeps re-lighting able to flip it.
  if (!best || bestDelta < 90) return undefined;
  return hex(best[0], best[1], best[2]);
}

/** The page's background: the colour its border pixels agree on. */
export function backgroundOf(data: Uint8ClampedArray, cw: number, ch: number): [number, number, number] {
  const counts = new Map<string, { n: number; rgb: [number, number, number] }>();
  const sample = (x: number, y: number) => {
    const i = (Math.min(cw - 1, Math.max(0, x)) + Math.min(ch - 1, Math.max(0, y)) * cw) * 4;
    const rgb: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
    const key = `${rgb[0] >> 3}.${rgb[1] >> 3}.${rgb[2] >> 3}`;
    const hit = counts.get(key);
    if (hit) hit.n++;
    else counts.set(key, { n: 1, rgb });
  };
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const fx = Math.round((cw - 1) * (i / steps));
    const fy = Math.round((ch - 1) * (i / steps));
    sample(fx, 1); sample(fx, ch - 2); sample(1, fy); sample(cw - 2, fy);
  }
  let winner: [number, number, number] = [255, 255, 255];
  let most = 0;
  for (const { n, rgb } of counts.values()) if (n > most) { most = n; winner = rgb; }
  return winner;
}

export async function parsePdf(
  file: File | ArrayBuffer,
  brand: BrandMap = WOZKU_BRAND,
  onProgress?: (page: number, total: number) => void
): Promise<PdfImportResult> {
  const pdfjs = await loadPdfJs();
  const bytes = file instanceof ArrayBuffer ? file : await file.arrayBuffer();

  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  } catch {
    throw new Error('This file could not be read as a PDF. If it is password '
      + 'protected, remove the password and try again.');
  }

  const warnings: string[] = [];
  const slides: ImportedSlide[] = [];
  let textlessPages = 0;
  let imageBytes = 0;
  let droppedImages = 0;

  for (let n = 1; n <= doc.numPages; n++) {
    onProgress?.(n, doc.numPages);
    const page = await doc.getPage(n);
    const raw = page.getViewport({ scale: 1 });

    // Uniform scale so any page size lands inside 1920x1080 undistorted, centred
    // rather than pinned to a corner: a portrait page is a tall column on a wide
    // slide, and against the left edge it reads as a mistake.
    const scale = Math.min(CANVAS_W / raw.width, CANVAS_H / raw.height);
    const viewport = page.getViewport({ scale });
    const ox = (CANVAS_W - viewport.width) / 2;
    const oy = (CANVAS_H - viewport.height) / 2;

    const content = await page.getTextContent();
    const pieces: Piece[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const text = item.str;
      if (!text || !text.trim()) continue;
      const tx = pdfjs.Util.transform(viewport.transform, item.transform);
      const sizePx = Math.hypot(tx[2], tx[3]);
      if (sizePx < 1) continue;
      const face = faceOf(page, item.fontName);
      pieces.push({
        text,
        x: tx[4] + ox,
        y: tx[5] + oy,
        w: item.width * scale,
        sizePx,
        font: face.name,
        bold: face.bold,
        italic: face.italic,
      });
    }

    // A page with no text is a scan or pure artwork: nothing can be lifted off
    // it, so the render becomes the slide. Knowing that before rasterising is
    // what lets a picture page be drawn at a size worth keeping while a page of
    // text is only drawn large enough to sample its colours from.
    const isPicturePage = pieces.length === 0;
    const rasterScale = (isPicturePage ? IMAGE_W : SAMPLE_W) / raw.width;
    const rasterViewport = page.getViewport({ scale: rasterScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(rasterViewport.width));
    canvas.height = Math.max(1, Math.round(rasterViewport.height));
    const ctx = canvas.getContext('2d', { willReadFrequently: !isPicturePage });

    let pixels: Uint8ClampedArray | null = null;
    let bg: [number, number, number] = [255, 255, 255];
    let rendered = false;
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        await page.render({ canvasContext: ctx, viewport: rasterViewport, canvas }).promise;
        rendered = true;
        pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        bg = backgroundOf(pixels, canvas.width, canvas.height);
      } catch {
        warnings.push(`Page ${n} could not be drawn, so its colours were not read.`);
      }
    }

    /** Frees the page's raster before the next one is built. */
    const release = () => { canvas.width = 0; canvas.height = 0; };

    const shapes: ImportedShape[] = [];

    if (isPicturePage) {
      textlessPages++;
      if (rendered) {
        const imageUrl = canvas.toDataURL('image/jpeg', 0.72);
        if (imageBytes + imageUrl.length <= IMAGE_BUDGET_BYTES) {
          imageBytes += imageUrl.length;
          shapes.push({
            id: `pdf-${n}-page`,
            kind: 'image',
            x: ox,
            y: oy,
            w: viewport.width,
            h: viewport.height,
            imageUrl,
          });
        } else {
          droppedImages++;
        }
      }
      slides.push({ shapes, base: hex(bg[0], bg[1], bg[2]), title: `Page ${n}` });
      release();
      await yieldToBrowser();
      continue;
    }

    let counter = 0;
    for (const block of toBlocks(toLines(pieces))) {
      const paragraphs: ImportedParagraph[] = [];
      for (const line of block) {
        const text = lineText(line);
        if (!text) continue;
        const lead = line.pieces[0];
        const run: ImportedRun = { text, sizePx: line.sizePx };
        if (lead.bold) run.bold = true;
        if (lead.italic) run.italic = true;
        if (lead.font) run.font = mapFont(lead.font, brand);
        paragraphs.push({ runs: [run], align: 'left' });
      }
      if (!paragraphs.length) continue;

      const left = Math.min(...block.map((l) => l.left));
      const right = Math.max(...block.map((l) => l.right));
      const top = Math.min(...block.map((l) => l.top));
      const bottom = Math.max(...block.map((l) => l.baseline + l.sizePx * 0.28));
      const box = { x: left, y: top, w: Math.max(1, right - left), h: Math.max(1, bottom - top) };

      const ink = pixels
        ? inkIn(pixels, canvas.width, canvas.height,
            { x: box.x - ox, y: box.y - oy, w: box.w, h: box.h }, rasterScale, bg)
        : undefined;
      if (ink) for (const p of paragraphs) for (const r of p.runs) r.color = snapToBrand(ink, brand);

      counter++;
      shapes.push({
        id: `pdf-${n}-${counter}`,
        kind: 'rect',
        // A little slack: the measured box is the ink, and type set right at its
        // own edge clips the moment a font substitutes by a hair.
        x: box.x - 4,
        y: box.y - 4,
        w: box.w + 16,
        h: box.h + 10,
        paragraphs,
        vAlign: 'top',
      });
    }

    const heading = [...shapes]
      .filter((s) => s.paragraphs?.length)
      .sort((a, b) => (b.paragraphs![0].runs[0].sizePx ?? 0) - (a.paragraphs![0].runs[0].sizePx ?? 0))[0];
    const titleText = heading?.paragraphs?.[0].runs.map((r) => r.text).join('').trim() ?? '';
    const flat = titleText.replace(/\s+/g, ' ').slice(0, 42).replace(/[,.;:]$/, '');

    slides.push({
      shapes,
      base: hex(bg[0], bg[1], bg[2]),
      title: flat || `Page ${n}`,
    });
    release();
    await yieldToBrowser();
  }

  if (!slides.length) throw new Error('No pages could be read from this PDF.');

  if (droppedImages) {
    warnings.push(`${droppedImages} picture-only page${droppedImages > 1 ? 's' : ''} `
      + 'came in blank because the deck had no room left to store them. A deck is kept '
      + 'in this browser and there is a limit on how much artwork it can hold.');
  }

  if (textlessPages) {
    warnings.push(textlessPages === slides.length
      ? 'This PDF has no text in it, only pictures of text, so every page came in as an image. Scanned PDFs cannot be made editable here.'
      : `${textlessPages} page${textlessPages > 1 ? 's' : ''} had no text and came in as an image.`);
  }

  const lit = relightForBrand(slides, brand);
  return { slides: lit.slides, warnings: Array.from(new Set(warnings)), relit: lit.relit };
}
