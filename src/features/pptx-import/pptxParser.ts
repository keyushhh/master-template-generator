import JSZip from 'jszip';
import type {
  ImportedShape,
  ImportedParagraph,
  ImportedRun,
} from '../deck/types';
import { mapFont, snapToBrand } from './brandMap';

/**
 * Reads an uploaded .pptx and lifts each slide into positioned shapes in the
 * app's 1920x1080 design space.
 *
 * A .pptx is a ZIP of XML parts, so this needs no server: JSZip (already a
 * dependency, used by the PNG export) unpacks it and DOMParser reads the
 * OOXML. Geometry is preserved exactly - only fill, line and type are mapped
 * onto the brand palette. No text is ever altered.
 */

const EMU_PER_PX = 9525; // 914400 EMU/in at 96 px/in
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CANVAS_W = 1920;
const CANVAS_H = 1080;

export interface ImportedSlide {
  shapes: ImportedShape[];
  /** Hex, no '#'. */
  base: string;
  /** First substantial line of copy, used to title the slide in the sidebar. */
  title: string;
}

export interface PptxImportResult {
  slides: ImportedSlide[];
  /** Non-fatal notes worth showing the user (skipped charts, unsupported art). */
  warnings: string[];
}

/** A shape's placement plus the group transform stack it sits under. */
interface Frame {
  ox: number;
  oy: number;
  sx: number;
  sy: number;
}

const IDENTITY: Frame = { ox: 0, oy: 0, sx: 1, sy: 1 };

function el(parent: Element, ns: string, name: string): Element | null {
  const found = parent.getElementsByTagNameNS(ns, name);
  return found.length ? found[0] : null;
}

/** Direct children only - `getElementsByTagNameNS` reaches into descendants,
 *  which silently pulls a nested group's transform into its parent. */
function childrenOf(parent: Element, localNames: string[]): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1 && localNames.includes((node as Element).localName ?? '')) {
      out.push(node as Element);
    }
  }
  return out;
}

function firstChild(parent: Element, localName: string): Element | null {
  return childrenOf(parent, [localName])[0] ?? null;
}

/** Resolves a DrawingML fill element to a hex string, or undefined for none. */
function readFill(spPr: Element | null): string | undefined {
  if (!spPr) return undefined;
  if (firstChild(spPr, 'noFill')) return undefined;
  const solid = firstChild(spPr, 'solidFill');
  if (!solid) return undefined;
  const srgb = firstChild(solid, 'srgbClr');
  if (srgb) return srgb.getAttribute('val') ?? undefined;
  // Theme colours need the theme's clrMap to resolve properly. Rather than
  // half-resolve them, fall back to the two that carry an unambiguous meaning.
  const scheme = firstChild(solid, 'schemeClr');
  const val = scheme?.getAttribute('val');
  if (val === 'bg1' || val === 'lt1') return 'FFFFFF';
  if (val === 'tx1' || val === 'dk1') return '171717';
  return undefined;
}

function readLine(spPr: Element | null): { color: string; widthPx: number } | undefined {
  if (!spPr) return undefined;
  const ln = firstChild(spPr, 'ln');
  if (!ln || firstChild(ln, 'noFill')) return undefined;
  const solid = firstChild(ln, 'solidFill');
  if (!solid) return undefined;
  const srgb = firstChild(solid, 'srgbClr');
  const color = srgb?.getAttribute('val');
  if (!color) return undefined;
  const w = ln.getAttribute('w');
  return { color, widthPx: w ? Math.max(1, Number(w) / EMU_PER_PX) : 1 };
}

function readParagraphs(sp: Element): ImportedParagraph[] | undefined {
  const txBody = el(sp, 'http://schemas.openxmlformats.org/presentationml/2006/main', 'txBody')
    ?? el(sp, A, 'txBody');
  if (!txBody) return undefined;

  const paragraphs: ImportedParagraph[] = [];
  for (const p of childrenOf(txBody, ['p'])) {
    const runs: ImportedRun[] = [];
    // a:r is a normal run; a:fld is a field (slide number, date) that still
    // renders as text and would otherwise be dropped.
    for (const r of childrenOf(p, ['r', 'fld'])) {
      const t = firstChild(r, 't');
      const text = t?.textContent ?? '';
      if (!text) continue;
      const rPr = firstChild(r, 'rPr');
      const run: ImportedRun = { text };
      if (rPr) {
        const sz = rPr.getAttribute('sz');
        if (sz) run.sizePx = (Number(sz) / 100) * (96 / 72);
        if (rPr.getAttribute('b') === '1') run.bold = true;
        if (rPr.getAttribute('i') === '1') run.italic = true;
        const color = readFill(rPr);
        if (color) run.color = snapToBrand(color);
        const latin = firstChild(rPr, 'latin');
        const face = latin?.getAttribute('typeface');
        if (face) run.font = mapFont(face);
      }
      runs.push(run);
    }
    if (!runs.length) {
      // Preserve deliberate blank lines between paragraphs.
      paragraphs.push({ runs: [] });
      continue;
    }
    const pPr = firstChild(p, 'pPr');
    const algn = pPr?.getAttribute('algn');
    paragraphs.push({
      runs,
      align: algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : 'left',
    });
  }
  // Trailing empties are layout noise, not content.
  while (paragraphs.length && !paragraphs[paragraphs.length - 1].runs.length) {
    paragraphs.pop();
  }
  return paragraphs.length ? paragraphs : undefined;
}

function readAnchor(sp: Element): 'top' | 'middle' | 'bottom' | undefined {
  const bodyPr = el(sp, A, 'bodyPr');
  const anchor = bodyPr?.getAttribute('anchor');
  return anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top';
}

/** Applies the enclosing group transforms to a shape's own offset/extent. */
function readXfrm(spPr: Element | null, frame: Frame, scale: number) {
  const xfrm = spPr ? firstChild(spPr, 'xfrm') : null;
  if (!xfrm) return null;
  const off = firstChild(xfrm, 'off');
  const ext = firstChild(xfrm, 'ext');
  if (!off || !ext) return null;
  const x = Number(off.getAttribute('x') ?? 0) / EMU_PER_PX;
  const y = Number(off.getAttribute('y') ?? 0) / EMU_PER_PX;
  const w = Number(ext.getAttribute('cx') ?? 0) / EMU_PER_PX;
  const h = Number(ext.getAttribute('cy') ?? 0) / EMU_PER_PX;
  return {
    x: (frame.ox + x * frame.sx) * scale,
    y: (frame.oy + y * frame.sy) * scale,
    w: w * frame.sx * scale,
    h: h * frame.sy * scale,
  };
}

function geomOf(spPr: Element | null): 'rect' | 'ellipse' {
  const prst = spPr ? firstChild(spPr, 'prstGeom')?.getAttribute('prst') : null;
  return prst === 'ellipse' ? 'ellipse' : 'rect';
}

/**
 * Walks a spTree, flattening groups.
 *
 * A group's children are positioned in the group's own child coordinate space,
 * so each nested level multiplies a scale and offset onto everything beneath
 * it. Ignoring that puts every grouped shape in the wrong place - and groups
 * are common in Google Slides exports.
 */
function walk(
  tree: Element,
  frame: Frame,
  scale: number,
  media: Map<string, string>,
  rels: Map<string, string>,
  out: ImportedShape[],
  warnings: string[],
  counter: { n: number }
) {
  for (const node of childrenOf(tree, ['sp', 'pic', 'grpSp', 'graphicFrame'])) {
    const name = node.localName;

    if (name === 'grpSp') {
      const grpSpPr = firstChild(node, 'grpSpPr');
      const xfrm = grpSpPr ? firstChild(grpSpPr, 'xfrm') : null;
      let next = frame;
      if (xfrm) {
        const off = firstChild(xfrm, 'off');
        const ext = firstChild(xfrm, 'ext');
        const chOff = firstChild(xfrm, 'chOff');
        const chExt = firstChild(xfrm, 'chExt');
        if (off && ext && chOff && chExt) {
          const sx = Number(ext.getAttribute('cx')) / Math.max(1, Number(chExt.getAttribute('cx')));
          const sy = Number(ext.getAttribute('cy')) / Math.max(1, Number(chExt.getAttribute('cy')));
          next = {
            ox: frame.ox + (Number(off.getAttribute('x')) - Number(chOff.getAttribute('x')) * sx)
              / EMU_PER_PX * frame.sx,
            oy: frame.oy + (Number(off.getAttribute('y')) - Number(chOff.getAttribute('y')) * sy)
              / EMU_PER_PX * frame.sy,
            sx: frame.sx * sx,
            sy: frame.sy * sy,
          };
        }
      }
      walk(node, next, scale, media, rels, out, warnings, counter);
      continue;
    }

    if (name === 'graphicFrame') {
      // Charts, SmartArt and native tables live behind a graphicFrame and have
      // no shape tree to lift. Flagged rather than silently skipped.
      warnings.push('A chart, table or SmartArt object was skipped - it has no '
        + 'shape geometry to import. Re-create it on the slide if you need it.');
      continue;
    }

    const spPr = firstChild(node, 'spPr');
    const box = readXfrm(spPr, frame, scale);
    if (!box || box.w <= 0 || box.h <= 0) continue;

    counter.n += 1;
    const base: ImportedShape = {
      id: `imp-${counter.n}`,
      kind: 'rect',
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
    };

    if (name === 'pic') {
      const blip = el(node, A, 'blip');
      const embed = blip?.getAttributeNS(R, 'embed');
      const target = embed ? rels.get(embed) : undefined;
      const data = target ? media.get(target) : undefined;
      if (!data) {
        warnings.push('An image could not be read and was skipped.');
        continue;
      }
      out.push({ ...base, kind: 'image', imageUrl: data });
      continue;
    }

    const fill = readFill(spPr);
    const line = readLine(spPr);
    const paragraphs = readParagraphs(node);
    if (!fill && !line && !paragraphs) continue; // invisible spacer

    out.push({
      ...base,
      kind: geomOf(spPr),
      fill: fill ? snapToBrand(fill) : undefined,
      line: line ? { color: snapToBrand(line.color), widthPx: line.widthPx } : undefined,
      paragraphs,
      vAlign: paragraphs ? readAnchor(node) : undefined,
    });
  }
}

function slideTitle(shapes: ImportedShape[], index: number): string {
  let best = '';
  let bestSize = 0;
  for (const sh of shapes) {
    for (const p of sh.paragraphs ?? []) {
      const text = p.runs.map((r) => r.text).join('').trim();
      const size = p.runs[0]?.sizePx ?? 0;
      if (text.length > 3 && size > bestSize) {
        bestSize = size;
        best = text;
      }
    }
  }
  // Break on a word boundary: this title is also the slide's footer label, and
  // a mid-word cut ("...Partner Program alrea") reads as broken on export.
  const flat = best.replace(/\s+/g, ' ').trim();
  if (!flat) return `Slide ${index + 1}`;
  if (flat.length <= 42) return flat;
  const cut = flat.slice(0, 42);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[,.;:]$/, '')}…`;
}

/** Slide order comes from presentation.xml's sldIdLst, not filename order -
 *  slide12.xml can legitimately be the third slide. */
async function slideOrder(zip: JSZip): Promise<string[]> {
  const presXml = await zip.file('ppt/presentation.xml')?.async('string');
  const relsXml = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
  if (!presXml || !relsXml) return [];
  const parser = new DOMParser();
  const rels = new Map<string, string>();
  const relsDoc = parser.parseFromString(relsXml, 'application/xml');
  Array.from(relsDoc.getElementsByTagName('Relationship')).forEach((rel) => {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) rels.set(id, target.replace(/^\/?(ppt\/)?/, ''));
  });
  const pres = parser.parseFromString(presXml, 'application/xml');
  const ids = pres.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/presentationml/2006/main', 'sldId');
  const out: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const rid = ids[i].getAttributeNS(R, 'id');
    const target = rid ? rels.get(rid) : undefined;
    if (target) out.push(`ppt/${target.replace(/^ppt\//, '')}`);
  }
  return out;
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp',
};

export async function parsePptx(file: File | ArrayBuffer): Promise<PptxImportResult> {
  const zip = await JSZip.loadAsync(file);
  const warnings: string[] = [];
  const parser = new DOMParser();

  const presXml = await zip.file('ppt/presentation.xml')?.async('string');
  if (!presXml) {
    throw new Error('This file is not a readable PowerPoint package - '
      + 'ppt/presentation.xml is missing.');
  }
  const pres = parser.parseFromString(presXml, 'application/xml');
  const sz = pres.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/presentationml/2006/main', 'sldSz')[0];
  const srcW = Number(sz?.getAttribute('cx') ?? 12192000) / EMU_PER_PX;
  const srcH = Number(sz?.getAttribute('cy') ?? 6858000) / EMU_PER_PX;
  // Uniform scale so a deck authored at any size lands inside 1920x1080 without
  // distorting. A 16:9 source (the overwhelming majority) maps exactly.
  const scale = Math.min(CANVAS_W / srcW, CANVAS_H / srcH);

  // Decode every media part once; slides reference them by relationship id.
  const media = new Map<string, string>();
  await Promise.all(Object.keys(zip.files)
    .filter((n) => n.startsWith('ppt/media/'))
    .map(async (n) => {
      const ext = n.split('.').pop()?.toLowerCase() ?? '';
      const mime = MIME[ext];
      if (!mime) return; // EMF/WMF vector art can't be shown in a browser
      const b64 = await zip.file(n)!.async('base64');
      media.set(n.replace(/^ppt\//, ''), `data:${mime};base64,${b64}`);
    }));

  const order = await slideOrder(zip);
  const names = order.length
    ? order
    : Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

  const slides: ImportedSlide[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const xml = await zip.file(name)?.async('string');
    if (!xml) continue;
    const doc = parser.parseFromString(xml, 'application/xml');

    const relsXml = await zip.file(
      name.replace(/slides\/(slide\d+)\.xml$/, 'slides/_rels/$1.xml.rels'))?.async('string');
    const rels = new Map<string, string>();
    if (relsXml) {
      const relsDoc = parser.parseFromString(relsXml, 'application/xml');
      Array.from(relsDoc.getElementsByTagName('Relationship')).forEach((rel) => {
        const id = rel.getAttribute('Id');
        const target = rel.getAttribute('Target');
        if (id && target) rels.set(id, target.replace(/^\.\.\//, ''));
      });
    }

    const spTree = doc.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/presentationml/2006/main', 'spTree')[0];
    if (!spTree) continue;

    const bg = doc.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/presentationml/2006/main', 'bg')[0];
    const bgSrgb = bg?.getElementsByTagNameNS(A, 'srgbClr')[0]?.getAttribute('val');

    const shapes: ImportedShape[] = [];
    walk(spTree, IDENTITY, scale, media, rels, shapes, warnings, { n: 0 });
    slides.push({
      shapes,
      base: bgSrgb ?? 'FFFFFF',
      title: slideTitle(shapes, i),
    });
  }

  if (!slides.length) throw new Error('No slides could be read from this file.');

  return { slides, warnings: Array.from(new Set(warnings)) };
}
