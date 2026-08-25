import JSZip from 'jszip';
import type {
  ImportedSlide,
  ImportedShape,
  ImportedParagraph,
  ImportedRun,
  ImportedTableRow,
} from '../deck/types';
import { mapFont, snapToBrand, snapGround, relightForBrand, WOZKU_BRAND, type BrandMap } from './brandMap';

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
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const CANVAS_W = 1920;
const CANVAS_H = 1080;

export type { ImportedSlide };

export interface PptxImportResult {
  slides: ImportedSlide[];
  /** Non-fatal notes worth showing the user (skipped charts, unsupported art). */
  warnings: string[];
  /** Whether the deck's colours were mirrored to match the template's lightness. */
  relit: boolean;
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

/** dk1/lt1/dk2/lt2/accentN/hlink/folHlink -> hex, read from the deck's theme. */
type ThemeMap = Record<string, string>;

/**
 * A table's banded columns/rows are very often colored by scheme reference
 * (`accent2`, `accent3`...) rather than a literal RGB - a fill only some
 * shapes in a "fake table" (a grid of individually drawn rectangles, the
 * overwhelmingly common way tables show up in decks) carry. Resolving only
 * bg1/tx1 and leaving every other scheme name as "no fill" is exactly what
 * makes some columns keep their background and others lose it.
 */
async function loadThemeMap(zip: JSZip): Promise<ThemeMap> {
  const map: ThemeMap = {};
  const names = Object.keys(zip.files).filter((n) => /^ppt\/theme\/theme\d+\.xml$/.test(n));
  const name = names.sort()[0];
  if (!name) return map;
  const xml = await zip.file(name)?.async('string');
  if (!xml) return map;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const scheme = doc.getElementsByTagNameNS(A, 'clrScheme')[0];
  if (!scheme) return map;
  for (let i = 0; i < scheme.childNodes.length; i++) {
    const node = scheme.childNodes[i];
    if (node.nodeType !== 1) continue;
    const child = node as Element;
    const srgb = firstChild(child, 'srgbClr')?.getAttribute('val');
    const sys = firstChild(child, 'sysClr')?.getAttribute('lastClr');
    const hex = srgb ?? sys;
    if (hex) map[child.localName] = hex;
  }
  // Default clrMap PowerPoint ships when a slide master doesn't remap it -
  // resolving a full <p:clrMap> per master is more machinery than the payoff
  // here justifies.
  if (map.lt1) map.bg1 = map.bg1 ?? map.lt1;
  if (map.dk1) map.tx1 = map.tx1 ?? map.dk1;
  if (map.lt2) map.bg2 = map.bg2 ?? map.lt2;
  if (map.dk2) map.tx2 = map.tx2 ?? map.dk2;
  return map;
}

/** Resolves a DrawingML fill element to a hex string, or undefined for none. */
function readFill(spPr: Element | null, theme: ThemeMap): string | undefined {
  if (!spPr) return undefined;
  if (firstChild(spPr, 'noFill')) return undefined;
  const solid = firstChild(spPr, 'solidFill');
  if (!solid) return undefined;
  const srgb = firstChild(solid, 'srgbClr');
  if (srgb) return srgb.getAttribute('val') ?? undefined;
  const scheme = firstChild(solid, 'schemeClr');
  const val = scheme?.getAttribute('val');
  if (val && theme[val]) return theme[val];
  if (val === 'bg1' || val === 'lt1') return 'FFFFFF';
  if (val === 'tx1' || val === 'dk1') return '171717';
  return undefined;
}

function readLine(spPr: Element | null, theme: ThemeMap): { color: string; widthPx: number } | undefined {
  if (!spPr) return undefined;
  const ln = firstChild(spPr, 'ln');
  if (!ln || firstChild(ln, 'noFill')) return undefined;
  const solid = firstChild(ln, 'solidFill');
  if (!solid) return undefined;
  const srgb = firstChild(solid, 'srgbClr');
  const scheme = firstChild(solid, 'schemeClr');
  const color = srgb?.getAttribute('val') ?? (scheme ? theme[scheme.getAttribute('val') ?? ''] : undefined);
  if (!color) return undefined;
  const w = ln.getAttribute('w');
  return { color, widthPx: w ? Math.max(1, Number(w) / EMU_PER_PX) : 1 };
}

/** A table style's per-region fill, resolved from `ppt/tableStyles.xml` -
 *  what a cell without its own inline fill inherits (banded rows, a
 *  highlighted header/first column, etc). */
interface TableStyleDef {
  wholeTbl?: string;
  band1H?: string;
  band2H?: string;
  firstRow?: string;
  lastRow?: string;
  firstCol?: string;
  lastCol?: string;
}

type TableStyleMap = Record<string, TableStyleDef>;

function readTcStyleFill(region: Element | null, theme: ThemeMap): string | undefined {
  const tcStyle = region ? firstChild(region, 'tcStyle') : null;
  const fill = tcStyle ? firstChild(tcStyle, 'fill') : null;
  return fill ? readFill(fill, theme) : undefined;
}

/**
 * A table's own style (`<a:tblStyleId>`, resolved against this part) is where
 * banded rows and a highlighted header/first column actually come from in
 * most real decks - authors override one or two cells' fill inline (a
 * "favorite" column) and leave everything else to the style, which this app
 * previously never read at all. Skipping it is exactly why some columns of
 * an imported table kept their color and others came through blank.
 */
async function loadTableStyleMap(zip: JSZip, theme: ThemeMap): Promise<TableStyleMap> {
  const map: TableStyleMap = {};
  const xml = await zip.file('ppt/tableStyles.xml')?.async('string');
  if (!xml) return map;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  for (const styleEl of Array.from(doc.getElementsByTagNameNS(A, 'tblStyle'))) {
    const id = styleEl.getAttribute('styleId');
    if (!id) continue;
    const read = (name: string) => readTcStyleFill(firstChild(styleEl, name), theme);
    map[id] = {
      wholeTbl: read('wholeTbl'),
      band1H: read('band1H'),
      band2H: read('band2H'),
      firstRow: read('firstRow'),
      lastRow: read('lastRow'),
      firstCol: read('firstCol'),
      lastCol: read('lastCol'),
    };
  }
  return map;
}

/** '../slideLayouts/x.xml' declared by a slide resolves to 'ppt/slideLayouts/x.xml'. */
function resolveTarget(part: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const segs = part.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') segs.pop();
    else if (seg !== '.') segs.push(seg);
  }
  return segs.join('/');
}

/** Relationship id to full part path, for whichever part declared them. */
async function loadRels(zip: JSZip, parser: DOMParser, part: string): Promise<Map<string, string>> {
  const rels = new Map<string, string>();
  const i = part.lastIndexOf('/');
  const xml = await zip.file(`${part.slice(0, i)}/_rels/${part.slice(i + 1)}.rels`)?.async('string');
  if (!xml) return rels;
  const doc = parser.parseFromString(xml, 'application/xml');
  Array.from(doc.getElementsByTagName('Relationship')).forEach((rel) => {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) rels.set(id, resolveTarget(part, target));
  });
  return rels;
}

/** An image's average colour, which is all a picture background is asked for. */
async function averageHex(dataUrl: string): Promise<string | undefined> {
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, 8, 8);
    const { data } = ctx.getImageData(0, 0, 8, 8);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const n = data.length / 4;
    return [r / n, g / n, b / n]
      .map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch {
    return undefined;
  }
}

/** A <p:bg> resolved to one hex, whether it is painted flat, graded or with a picture. */
async function bgHex(
  bg: Element,
  theme: ThemeMap,
  rels: Map<string, string>,
  media: Map<string, string>
): Promise<string | undefined> {
  const pr = firstChild(bg, 'bgPr');
  if (pr) {
    const solid = readFill(pr, theme);
    if (solid) return solid;
    const grad = firstChild(pr, 'gradFill');
    const stop = grad ? el(grad, A, 'gs') : null;
    if (stop) {
      const srgb = firstChild(stop, 'srgbClr')?.getAttribute('val');
      const scheme = firstChild(stop, 'schemeClr')?.getAttribute('val');
      const hex = srgb ?? (scheme ? theme[scheme] : undefined);
      if (hex) return hex;
    }
    const fill = firstChild(pr, 'blipFill');
    const embed = fill ? el(fill, A, 'blip')?.getAttributeNS(R, 'embed') : null;
    const data = embed ? media.get(rels.get(embed) ?? '') : undefined;
    if (data) return averageHex(data);
  }
  const ref = firstChild(bg, 'bgRef');
  if (ref) {
    const srgb = firstChild(ref, 'srgbClr')?.getAttribute('val');
    const scheme = firstChild(ref, 'schemeClr')?.getAttribute('val');
    return srgb ?? (scheme ? theme[scheme] : undefined);
  }
  return undefined;
}

// Most decks paint the background once on the master and never repeat it per
// slide, so reading only the slide leaves every base white - and white text on
// a white base is exactly how an imported deck arrives unreadable.
async function readBackground(
  zip: JSZip,
  parser: DOMParser,
  slidePart: string,
  theme: ThemeMap,
  media: Map<string, string>
): Promise<string | undefined> {
  let part: string | undefined = slidePart;
  for (let hop = 0; part && hop < 3; hop++) {
    const xml: string | undefined = await zip.file(part)?.async('string');
    if (!xml) return undefined;
    const doc = parser.parseFromString(xml, 'application/xml');
    const rels = await loadRels(zip, parser, part);
    const bg = doc.getElementsByTagNameNS(P, 'bg')[0];
    const hex = bg ? await bgHex(bg, theme, rels, media) : undefined;
    if (hex) return hex;
    part = Array.from(rels.values()).find((t) => /slideLayouts\/|slideMasters\//.test(t));
  }
  return undefined;
}

function isOpaque(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return false;
  return true;
}

// How much of a picture has to be see-through, and how light its ink has to be,
// before it counts as a logo cut out for a dark slide rather than a picture.
const CUTOUT_CLEAR = 0.3;
const CUTOUT_INK = 0.75;

// A logo drawn in white for a dark deck vanishes on a light one, and no amount
// of re-colouring the slide behind it helps. Cut-out art is the one kind of
// picture that can be re-lit like everything else: its ink flips and its
// transparency keeps the shape. A photo is opaque and never qualifies.
async function invertCutout(dataUrl: string): Promise<string | undefined> {
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, img.width);
    canvas.height = Math.max(1, img.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    const pixels = d.length / 4;
    let clear = 0;
    let lum = 0;
    let ink = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) {
        clear += 1;
        continue;
      }
      lum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      ink += 1;
    }
    if (!ink || clear / pixels < CUTOUT_CLEAR || lum / ink < CUTOUT_INK) return undefined;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const max = Math.max(d[i], d[i + 1], d[i + 2]);
      const min = Math.min(d[i], d[i + 1], d[i + 2]);
      // A coloured mark keeps its hue; only the black-and-white part flips.
      if (max === 0 || (max - min) / max >= 0.15) continue;
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return undefined;
  }
}

/** Re-lights every cut-out logo in the deck, once per distinct picture. */
async function relightArt(slides: ImportedSlide[]): Promise<number> {
  const done = new Map<string, string>();
  let flipped = 0;
  for (const slide of slides) {
    for (const shape of slide.shapes) {
      if (shape.kind !== 'image' || !shape.imageUrl) continue;
      const from = shape.imageUrl;
      let to = done.get(from);
      if (to === undefined) {
        to = (await invertCutout(from)) ?? from;
        done.set(from, to);
        if (to !== from) flipped += 1;
      }
      shape.imageUrl = to;
    }
  }
  return flipped;
}

// Art is re-encoded at screen size: a deck's media folder routinely runs to
// tens of MB at print resolution, and the whole library shares ~5MB of storage.
async function shrink(dataUrl: string, mime: string, maxDim = 1200): Promise<string> {
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    if (scale === 1 && dataUrl.length < 200_000) return dataUrl;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // PNG only earns its size when the art really is cut out; a screenshot in a
    // lossless wrapper is an order of magnitude bigger than it needs to be.
    const keepPng = mime === 'image/png' && !isOpaque(ctx, canvas.width, canvas.height);
    const out = keepPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}

// PowerPoint stores leading as either exact points or a percentage of the type
// size, and both change where the next line lands.
function readLeading(pPr: Element | null, fontPx: number): number | undefined {
  const lnSpc = pPr ? firstChild(pPr, 'lnSpc') : null;
  if (!lnSpc) return undefined;
  const pts = firstChild(lnSpc, 'spcPts')?.getAttribute('val');
  if (pts) return (Number(pts) / 100) * (96 / 72);
  const pct = firstChild(lnSpc, 'spcPct')?.getAttribute('val');
  if (pct && fontPx) return (Number(pct) / 100000) * fontPx;
  return undefined;
}

function readParagraphs(sp: Element, theme: ThemeMap, brand: BrandMap): ImportedParagraph[] | undefined {
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
        const color = readFill(rPr, theme);
        if (color) run.color = snapToBrand(color, brand);
        const latin = firstChild(rPr, 'latin');
        const face = latin?.getAttribute('typeface');
        if (face) run.font = mapFont(face, brand);
      }
      runs.push(run);
    }
    const pPr = firstChild(p, 'pPr');
    const endSz = firstChild(p, 'endParaRPr')?.getAttribute('sz');
    const leadingPx = readLeading(pPr, runs[0]?.sizePx ?? (endSz ? (Number(endSz) / 100) * (96 / 72) : 0));
    if (!runs.length) {
      // A blank line is a spacer, and collapsing it to a default height is what
      // pushed the copy under it up into the label above.
      paragraphs.push({ runs: [], leadingPx });
      continue;
    }
    const algn = pPr?.getAttribute('algn');
    paragraphs.push({
      runs,
      align: algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : 'left',
      leadingPx,
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

// A picture placed with a zoom or a crop stores that as fillRect insets, in
// thousandths of a percent, where a negative value runs past the box's edge.
function readCrop(blipFill: Element | null): ImportedShape['crop'] {
  const stretch = blipFill ? firstChild(blipFill, 'stretch') : null;
  const rect = stretch ? firstChild(stretch, 'fillRect') : null;
  if (!rect) return undefined;
  const side = (name: string) => Number(rect.getAttribute(name) ?? 0) / 100000;
  const crop = { l: side('l'), t: side('t'), r: side('r'), b: side('b') };
  return crop.l || crop.t || crop.r || crop.b ? crop : undefined;
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
/** Reads a native OOXML table (`<a:tbl>`, sitting under a `graphicFrame`'s
 *  `<a:graphic><a:graphicData>`) into rows of cells with their own fill and
 *  text. Column widths and row heights come straight from `tblGrid`/`tr`, so
 *  the table's internal proportions survive even though its overall box is
 *  scaled like every other shape. */
function readTable(
  node: Element,
  frame: Frame,
  scale: number,
  theme: ThemeMap,
  brand: BrandMap,
  tableStyles: TableStyleMap,
  counter: { n: number }
): ImportedShape | null {
  const tbl = el(node, A, 'tbl');
  if (!tbl) return null;
  const box = readXfrm(node, frame, scale);
  if (!box || box.w <= 0 || box.h <= 0) return null;

  const grid = firstChild(tbl, 'tblGrid');
  const colsEmu = grid ? childrenOf(grid, ['gridCol']).map((c) => Number(c.getAttribute('w') ?? 0)) : [];
  const totalColEmu = colsEmu.reduce((a, b) => a + b, 0) || 1;
  const colWidthsPx = colsEmu.map((w) => (w / totalColEmu) * box.w);

  const trs = childrenOf(tbl, ['tr']);
  const rowsEmu = trs.map((tr) => Number(tr.getAttribute('h') ?? 0));
  const totalRowEmu = rowsEmu.reduce((a, b) => a + b, 0) || 1;
  const rowCount = trs.length;
  const colCount = colsEmu.length || Math.max(...trs.map((tr) => childrenOf(tr, ['tc']).length), 1);

  // The style a cell without its own inline fill falls back to - precedence
  // (later wins) mirrors ECMA-376: base fill, then banding, then a
  // highlighted first/last column, then a highlighted first/last row (the
  // header/total row an author calls out is the most specific override).
  const tblPr = firstChild(tbl, 'tblPr');
  const styleId = tblPr ? firstChild(tblPr, 'tableStyleId')?.textContent?.trim() : undefined;
  const style = styleId ? tableStyles[styleId] : undefined;
  const on = (name: string) => tblPr?.getAttribute(name) === '1' || tblPr?.getAttribute(name) === 'true';
  const firstRowOn = on('firstRow');
  const lastRowOn = on('lastRow');
  const firstColOn = on('firstCol');
  const lastColOn = on('lastCol');
  const bandRowOn = on('bandRow');

  const styleFillFor = (ri: number, ci: number): string | undefined => {
    if (!style) return undefined;
    let fill = style.wholeTbl;
    if (bandRowOn && (style.band1H || style.band2H)) {
      const bodyIndex = ri - (firstRowOn ? 1 : 0);
      const inFooter = lastRowOn && ri === rowCount - 1;
      if (bodyIndex >= 0 && !inFooter) fill = (bodyIndex % 2 === 0 ? style.band1H : style.band2H) ?? fill;
    }
    if (firstColOn && ci === 0) fill = style.firstCol ?? fill;
    if (lastColOn && ci === colCount - 1) fill = style.lastCol ?? fill;
    if (firstRowOn && ri === 0) fill = style.firstRow ?? fill;
    if (lastRowOn && ri === rowCount - 1) fill = style.lastRow ?? fill;
    return fill;
  };

  const rows: ImportedTableRow[] = trs.map((tr, ri) => ({
    heightPx: (rowsEmu[ri] / totalRowEmu) * box.h,
    cells: childrenOf(tr, ['tc']).map((tc, ci) => {
      const tcPr = firstChild(tc, 'tcPr');
      const fill = readFill(tcPr, theme) ?? styleFillFor(ri, ci);
      return {
        fill: fill ? snapToBrand(fill, brand) : undefined,
        paragraphs: readParagraphs(tc, theme, brand),
      };
    }),
  }));

  counter.n += 1;
  return {
    id: `imp-${counter.n}`,
    kind: 'table',
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    colWidthsPx,
    rows,
  };
}

function walk(
  tree: Element,
  frame: Frame,
  scale: number,
  media: Map<string, string>,
  rels: Map<string, string>,
  theme: ThemeMap,
  brand: BrandMap,
  tableStyles: TableStyleMap,
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
      walk(node, next, scale, media, rels, theme, brand, tableStyles, out, warnings, counter);
      continue;
    }

    if (name === 'graphicFrame') {
      const table = readTable(node, frame, scale, theme, brand, tableStyles, counter);
      if (table) {
        out.push(table);
      } else {
        // Charts and SmartArt live behind a graphicFrame too and have no cell
        // grid to lift. Flagged rather than silently skipped.
        warnings.push('A chart or SmartArt object was skipped - it has no '
          + 'shape geometry to import. Re-create it on the slide if you need it.');
      }
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
      out.push({ ...base, kind: 'image', imageUrl: data, crop: readCrop(firstChild(node, 'blipFill')) });
      continue;
    }

    // A picture used as a shape's fill is how most cropped or rounded art is
    // placed, and reading only solidFill dropped every one of them.
    const picFill = spPr ? firstChild(spPr, 'blipFill') : null;
    const picEmbed = picFill ? el(picFill, A, 'blip')?.getAttributeNS(R, 'embed') : null;
    const picData = picEmbed ? media.get(rels.get(picEmbed) ?? '') : undefined;
    if (picData) {
      out.push({ ...base, kind: 'image', imageUrl: picData, crop: readCrop(picFill) });
      counter.n += 1;
      base.id = `imp-${counter.n}`;
    }

    const fill = readFill(spPr, theme);
    const line = readLine(spPr, theme);
    const paragraphs = readParagraphs(node, theme, brand);
    if (!fill && !line && !paragraphs) continue; // invisible spacer

    out.push({
      ...base,
      kind: geomOf(spPr),
      fill: fill ? snapToBrand(fill, brand) : undefined,
      line: line ? { color: snapToBrand(line.color, brand), widthPx: line.widthPx } : undefined,
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

export async function parsePptx(file: File | ArrayBuffer, brand: BrandMap = WOZKU_BRAND): Promise<PptxImportResult> {
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

  const theme = await loadThemeMap(zip);
  const tableStyles = await loadTableStyleMap(zip, theme);

  // Decode every media part once; slides reference them by relationship id.
  const media = new Map<string, string>();
  await Promise.all(Object.keys(zip.files)
    .filter((n) => n.startsWith('ppt/media/'))
    .map(async (n) => {
      const ext = n.split('.').pop()?.toLowerCase() ?? '';
      const mime = MIME[ext];
      if (!mime) return; // EMF/WMF vector art can't be shown in a browser
      const b64 = await zip.file(n)!.async('base64');
      media.set(n, await shrink(`data:${mime};base64,${b64}`, mime));
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

    const rels = await loadRels(zip, parser, name);

    const spTree = doc.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/presentationml/2006/main', 'spTree')[0];
    if (!spTree) continue;

    const slideBase = await readBackground(zip, parser, name, theme, media);

    const shapes: ImportedShape[] = [];
    walk(spTree, IDENTITY, scale, media, rels, theme, brand, tableStyles, shapes, warnings, { n: 0 });
    slides.push({
      shapes,
      base: slideBase ? snapGround(slideBase, brand) : 'FFFFFF',
      title: slideTitle(shapes, i),
    });
  }

  if (!slides.length) throw new Error('No slides could be read from this file.');

  // A deck built dark and dropped onto a light template comes out white-on-cream
  // unless the whole thing is re-lit.
  const lit = relightForBrand(slides, brand);
  if (lit.relit) {
    const flipped = await relightArt(lit.slides);
    if (flipped) {
      warnings.push(`Colours were re-lit to match this template, and ${flipped} cut-out `
        + 'logos were re-lit with them. Photos and screenshots keep their original '
        + 'background, so one of those may need replacing.');
    } else if (lit.slides.some((s) => s.shapes.some((sh) => sh.kind === 'image'))) {
      warnings.push('Colours were re-lit to match this template. Images keep their '
        + 'original background, so a screenshot may need replacing.');
    }
  }

  return { slides: lit.slides, warnings: Array.from(new Set(warnings)), relit: lit.relit };
}
