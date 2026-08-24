import JSZip from 'jszip';
import type {
  ImportedSlide,
  ImportedShape,
  ImportedParagraph,
  ImportedRun,
  ImportedTableRow,
} from '../deck/types';
import { mapFont, snapToBrand, relightForBrand, WOZKU_BRAND, type BrandMap } from './brandMap';

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
      out.push({ ...base, kind: 'image', imageUrl: data });
      continue;
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
    walk(spTree, IDENTITY, scale, media, rels, theme, brand, tableStyles, shapes, warnings, { n: 0 });
    slides.push({
      shapes,
      base: bgSrgb ?? 'FFFFFF',
      title: slideTitle(shapes, i),
    });
  }

  if (!slides.length) throw new Error('No slides could be read from this file.');

  // A deck built dark and dropped onto a light template comes out white-on-cream
  // unless the whole thing is re-lit.
  const lit = relightForBrand(slides, brand);
  if (lit.relit && slides.some((s) => s.shapes.some((sh) => sh.kind === 'image'))) {
    warnings.push('Colours were re-lit to match this template. Images keep their '
      + 'original background, so a screenshot may need replacing.');
  }

  return { slides: lit.slides, warnings: Array.from(new Set(warnings)), relit: lit.relit };
}
