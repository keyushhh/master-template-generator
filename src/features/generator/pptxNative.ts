import type pptxgen from 'pptxgenjs';
import type { SlideInstance, ComparisonRow, SlotOffset, SlotStyle } from '../deck/types';
import { applyToPptx, offsetFor, styleFor } from '../formatting/resolve';

/**
 * Native (editable) pptxgenjs equivalent of PresentationCanvas.tsx's DOM
 * renderers, one per template. The 1920x1080px slide space maps onto
 * pptxgenjs' LAYOUT_WIDE (13.333x7.5in) layout at a fixed 144px/inch.
 */

// 144px/in maps the 1920x1080 design canvas onto pptxgenjs's LAYOUT_WIDE
// (13.333in x 7.5in) - the modern PowerPoint/Google Slides/Canva "Widescreen"
// standard - rather than the legacy 10in x 5.625in LAYOUT_16x9 preset.
const PX_PER_IN = 144;
const PX_TO_PT = 72 / PX_PER_IN; // pt-per-design-px, derived so box()/pt() stay canvas-size-agnostic

const inch = (px: number) => px / PX_PER_IN;
const pt = (px: number) => Math.round(px * PX_TO_PT * 100) / 100;
const tracking = (fontPx: number, em: number) => Math.round(fontPx * em * PX_TO_PT * 100) / 100;

/**
 * Estimates how many lines bold display-weight text will wrap to at a given
 * box width, using Space Grotesk Bold's real average advance width
 * (~0.55em/char) as the char-width heuristic. Unlike the web renderer's flex
 * layout, pptxgenjs text boxes have a fixed height and don't auto-grow, so
 * headings sized off a hardcoded box height silently overflow into whatever
 * sits below once the actual wrap count exceeds what was assumed.
 */
function estimateWrappedLines(text: string, fontPx: number, widthPx: number): number {
  const charsPerLine = Math.max(1, Math.floor(widthPx / (fontPx * 0.55)));
  // Places a word (possibly itself longer than one line) at the current cursor position,
  // returning the extra lines it consumed and the line length it leaves behind.
  const placeWord = (lineLen: number, wordLen: number): [extraLines: number, newLineLen: number] => {
    const startLen = lineLen === 0 ? wordLen : lineLen + 1 + wordLen;
    if (lineLen !== 0 && startLen <= charsPerLine) return [0, startLen];
    const effectiveLen = lineLen === 0 ? wordLen : wordLen;
    const brokeToNewLine = lineLen === 0 ? 0 : 1;
    if (effectiveLen <= charsPerLine) return [brokeToNewLine, effectiveLen];
    const extraWraps = Math.ceil(effectiveLen / charsPerLine) - 1;
    const remainder = effectiveLen % charsPerLine || charsPerLine;
    return [brokeToNewLine + extraWraps, remainder];
  };

  return text.split('\n').reduce((total, segment) => {
    const words = segment.split(/\s+/).filter(Boolean);
    if (!words.length) return total + 1;
    let lines = 1;
    let lineLen = 0;
    for (const word of words) {
      const [extraLines, newLineLen] = placeWord(lineLen, word.length);
      lines += extraLines;
      lineLen = newLineLen;
    }
    return total + lines;
  }, 0);
}

const FONT_DISPLAY = 'Space Grotesk';
const FONT_MONO = 'JetBrains Mono';

const NEUTRAL_50 = 'FBFBFB';
const NEUTRAL_100 = 'F5F5F5';
const NEUTRAL_200 = 'E5E5E5';
const NEUTRAL_300 = 'D4D4D4';
const NEUTRAL_400 = 'A3A3A3';
const NEUTRAL_500 = '737373';
const NEUTRAL_900 = '171717';
const EMERALD_400 = '34D399';
const EMERALD_500 = '10B981';
const EMERALD_600 = '059669';
const WHITE = 'FFFFFF';
const BLACK = '000000';

const PLACEHOLDER =
  'Placeholder content for the Wozku Master Template. This section will automatically populate once a Document is provided.';

// ---------------------------------------------------------------------------
// Decorative background (hairline grid + accent glow) - baked into the
// slide's actual PowerPoint background (a flat, non-editable fill) via an
// offscreen canvas, exactly mirroring <SlideGrid/> and <Glow/> in
// PresentationCanvas.tsx. Kept out of the shape tree so it can never be
// accidentally selected/edited, while every real content field stays a
// separate, editable text/shape object on top of it.
// ---------------------------------------------------------------------------

interface GlowSpec {
  cx: number;
  cy: number;
  r: number;
}

interface DecorConfig {
  base: string; // hex, no '#'
  grid?: boolean;
  glow?: GlowSpec;
  /** Overrides the hairline colour. A dark slide needs light-on-dark rules -
   *  the default near-white grid is invisible on black. */
  gridColor?: string;
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, color?: string) {
  ctx.save();
  ctx.strokeStyle = color ?? 'rgba(245,245,245,0.8)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 120) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlow(ctx: CanvasRenderingContext2D, g: GlowSpec) {
  const grad = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.r);
  grad.addColorStop(0, 'rgba(16,185,129,0.08)');
  grad.addColorStop(0.7, 'rgba(16,185,129,0)');
  grad.addColorStop(1, 'rgba(16,185,129,0)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(g.cx - g.r, g.cy - g.r, g.r * 2, g.r * 2);
  ctx.restore();
}

/** Renders the given template's decorative background to a flattened PNG data
 *  URL, or returns undefined for a plain flat fill (nothing to bake in). */
function buildDecorBackground(cfg: DecorConfig): string | undefined {
  if (!cfg.grid && !cfg.glow) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.fillStyle = `#${cfg.base}`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (cfg.grid) drawGrid(ctx, canvas.width, canvas.height, cfg.gridColor);
  if (cfg.glow) drawGlow(ctx, cfg.glow);
  return canvas.toDataURL('image/png');
}

/** Sets the slide's real (non-editable) PowerPoint background - a flat color,
 *  or a baked-in grid/glow image where the template calls for one. */
function applyBackground(slide: pptxgen.Slide, cfg: DecorConfig) {
  const data = buildDecorBackground(cfg);
  slide.background = data ? { data } : { color: cfg.base };
}

const DECOR: Record<string, DecorConfig> = {
  s1: { base: WHITE, grid: true, glow: { cx: 1520, cy: 400, r: 700 } },
  s2: { base: WHITE, grid: true },
  s3: { base: WHITE, grid: true },
  s4: { base: BLACK },
  s5: { base: WHITE, grid: true },
  s6: { base: WHITE, grid: true, glow: { cx: 960, cy: 540, r: 700 } },
  s7: { base: WHITE, grid: true },
  s8: { base: WHITE, grid: true },
  s9: { base: WHITE, grid: true },
  s10: { base: WHITE, grid: true },
  s11: { base: WHITE, grid: true },
  s12: { base: WHITE, grid: true },
  s13: { base: WHITE, grid: true, glow: { cx: 200, cy: 880, r: 700 } },
  s14: { base: BLACK },
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function box(xPx: number, yPx: number, wPx: number, hPx: number): Box {
  return { x: inch(xPx), y: inch(yPx), w: inch(wPx), h: inch(hPx) };
}

interface TextOpts {
  fontFace?: string;
  size: number; // px
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  lineSpacingMultiple?: number;
  letterSpacingEm?: number;
  charSpacing?: number; // pt, takes precedence over letterSpacingEm
  transparency?: number;
  /** Slot name this text belongs to, matching the `slot` on the corresponding
   *  <E> in PresentationCanvas.tsx. Supplying it is what makes the user's
   *  formatting overrides survive the export - a call site without one exports
   *  at template styling regardless of what the editor shows. */
  slot?: string;
}

// ---------------------------------------------------------------------------
// Per-slide formatting overrides
//
// The override for a slot has to reach addText(), which sits many call frames
// below the slide being exported. Rather than thread a styles map through every
// build function and all ~60 call sites, the active slide's map is bound here
// for the duration of that slide.
//
// This is only safe because slides are exported strictly sequentially (see the
// awaited for-loop in exportHelper.ts). The re-entrancy guard below turns a
// future attempt to parallelise the export into a loud failure instead of
// silently cross-applying one slide's formatting onto another.
// ---------------------------------------------------------------------------

let activeStyles: Record<string, SlotStyle> | undefined;
let activeOffsets: Record<string, SlotOffset> | undefined;
let activeSlideOpen = false;

function beginSlideStyles(
  styles: Record<string, SlotStyle> | undefined,
  offsets: Record<string, SlotOffset> | undefined
) {
  if (activeSlideOpen) {
    throw new Error(
      'pptxNative: addNativeSlide re-entered before the previous slide finished. '
      + 'Slide export must stay sequential, or formatting overrides will be applied to the wrong slide.'
    );
  }
  activeSlideOpen = true;
  activeStyles = styles;
  activeOffsets = offsets;
}

function endSlideStyles() {
  activeSlideOpen = false;
  activeStyles = undefined;
  activeOffsets = undefined;
}

/** Splits on "\n" into runs joined by `<a:br/>` (via `softBreakBefore`) inside
 *  one paragraph. NOT pptxgenjs' `breakLine`: that starts a new paragraph
 *  (breaking our lineSpacingMultiple), and a run ending in "\n" skips
 *  pptxgenjs' own splitting, leaving a raw newline character renderers
 *  handle inconsistently. */
function splitLines(text: string): pptxgen.TextProps[] {
  return text.split('\n').map((line, i) => ({
    text: line,
    options: i > 0 ? { softBreakBefore: true } : {},
  }));
}

function addText(
  slide: pptxgen.Slide,
  text: string | pptxgen.TextProps[],
  b: Box,
  opts: TextOpts
) {
  // The user's per-slot override wins over whatever the template specified.
  // Merged through the shared resolver so the canvas and this exporter can
  // never disagree about what an override means.
  const o = applyToPptx(opts, styleFor(activeStyles, opts.slot));

  // A slot the user dragged in the editor has to land in the same place here.
  // The canvas moves it with a CSS translate; this is the same delta converted
  // from design px to inches and added to the box origin.
  const off = offsetFor(activeOffsets, opts.slot);
  const placed = off ? { ...b, x: b.x + inch(off.dx), y: b.y + inch(off.dy) } : b;

  const runs = typeof text === 'string' && text.includes('\n') ? splitLines(text) : text;
  slide.addText(runs, {
    ...placed,
    fontFace: o.fontFace ?? FONT_DISPLAY,
    fontSize: pt(o.size),
    bold: o.bold,
    italic: o.italic,
    underline: o.underline ? { style: 'sng' } : undefined,
    color: o.color ?? NEUTRAL_900,
    align: o.align ?? 'left',
    valign: o.valign ?? 'top',
    lineSpacingMultiple: o.lineSpacingMultiple,
    // Tracking is derived from the font size, so it has to follow the override
    // rather than the template's original size - otherwise resizing a tracked
    // label (an eyebrow, a HUD line) keeps the old letter-spacing and the text
    // either crowds or falls apart.
    charSpacing: o.charSpacing ?? (o.letterSpacingEm ? tracking(o.size, o.letterSpacingEm) : undefined),
    transparency: o.transparency,
    wrap: true,
    fit: 'none',
    margin: 0,
    autoFit: false,
  });
}

/**
 * A slot's override expressed as per-run text options.
 *
 * Some templates pack several editable slots into a single PowerPoint text box
 * (the two-column slide's attribute list, the data monument's value + unit, the
 * exit slide's contact line). Those slots each have their own <E> in the canvas,
 * so each needs its own formatting - which means the override has to be applied
 * run by run rather than to the box.
 *
 * Alignment is deliberately absent: in OOXML alignment is a paragraph property,
 * not a run property, so it cannot vary between runs sharing a paragraph. The
 * canvas has the same constraint for the same reason.
 */
function runOpts(slot: string): pptxgen.TextPropsOptions {
  const s = styleFor(activeStyles, slot);
  if (!s) return {};
  const o: pptxgen.TextPropsOptions = {};
  if (s.sizePx !== undefined) o.fontSize = pt(s.sizePx);
  if (s.bold !== undefined) o.bold = s.bold;
  if (s.italic !== undefined) o.italic = s.italic;
  if (s.underline !== undefined) o.underline = s.underline ? { style: 'sng' } : undefined;
  if (s.color !== undefined) o.color = s.color;
  return o;
}

function addLine(slide: pptxgen.Slide, x1: number, y1: number, x2: number, y2: number, color: string, widthPx = 1) {
  slide.addShape('line', {
    x: inch(x1),
    y: inch(y1),
    w: inch(x2 - x1),
    h: inch(y2 - y1),
    line: { color, width: Math.max(0.25, pt(widthPx)) },
  });
}

function addRect(
  slide: pptxgen.Slide,
  b: Box,
  fill: string | undefined,
  line?: { color: string; widthPx: number },
  transparency?: number
) {
  slide.addShape('rect', {
    ...b,
    fill: fill ? { color: fill, transparency } : { type: 'none' },
    line: line ? { color: line.color, width: Math.max(0.25, pt(line.widthPx)) } : { type: 'none' },
  });
}

function addCircle(slide: pptxgen.Slide, b: Box, fill: string, line?: { color: string; widthPx: number }) {
  slide.addShape('ellipse', {
    ...b,
    fill: { color: fill },
    line: line ? { color: line.color, width: pt(line.widthPx) } : { type: 'none' },
  });
}

/** Top HUD bar shared by most light templates: label left, slide number right, hairline rule below.
 *  `slots` names the content fields the two texts came from, so their formatting
 *  overrides apply. The slide number is generated, not content, so most callers
 *  only pass a label slot. */
function addHudTop(
  slide: pptxgen.Slide,
  label: string,
  num: string,
  slots?: { label?: string; num?: string }
) {
  addText(slide, label.toUpperCase(), box(80, 55, 800, 30), {
    fontFace: FONT_MONO,
    size: 16,
    color: NEUTRAL_500,
    letterSpacingEm: 0.12,
    valign: 'bottom',
    slot: slots?.label,
  });
  addText(slide, num.toUpperCase(), box(1040, 55, 800, 30), {
    fontFace: FONT_MONO,
    size: 16,
    color: NEUTRAL_500,
    align: 'right',
    letterSpacingEm: 0.12,
    valign: 'bottom',
    slot: slots?.num,
  });
  addLine(slide, 80, 92, 1840, 92, NEUTRAL_200, 1);
}

/** Editorial eyebrow label: short emerald rule + tracked mono uppercase text. */
function addEditorialLabel(slide: pptxgen.Slide, text: string, xPx: number, yPx: number, opts?: { size?: number; center?: boolean; color?: string; slot?: string }) {
  const size = opts?.size ?? 14;
  const color = opts?.color ?? EMERALD_600;
  if (opts?.center) {
    addText(slide, text.toUpperCase(), box(xPx - 700, yPx, 1400, size + 14), {
      fontFace: FONT_MONO,
      size,
      color,
      align: 'center',
      letterSpacingEm: 0.25,
      bold: true,
      slot: opts?.slot,
    });
  } else {
    // The rule is decoration belonging to the text, not an independent object,
    // so it has to carry the slot's drag offset too - addText applies that
    // offset itself, and without this the rule would stay behind on export even
    // though the canvas moved both together.
    const off = offsetFor(activeOffsets, opts?.slot);
    const rx = xPx + (off?.dx ?? 0);
    const ry = yPx + (off?.dy ?? 0) + size / 2 + 3;
    addLine(slide, rx, ry, rx + 40, ry, EMERALD_500, 1);
    addText(slide, text.toUpperCase(), box(xPx + 55, yPx, 900, size + 14), {
      fontFace: FONT_MONO,
      size,
      color,
      letterSpacingEm: 0.25,
      bold: true,
      slot: opts?.slot,
    });
  }
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Places an image contained (aspect-preserved, letterboxed) inside a px box, centered. */
async function addImageContain(slide: pptxgen.Slide, dataUrl: string, b: Box) {
  let ratio = 1;
  try {
    const img = await loadImage(dataUrl);
    ratio = img.naturalWidth / img.naturalHeight || 1;
  } catch {
    /* fall back to box aspect ratio */
  }
  const boxRatio = b.w / b.h;
  let w = b.w;
  let h = b.h;
  if (ratio > boxRatio) {
    h = b.w / ratio;
  } else {
    w = b.h * ratio;
  }
  slide.addImage({ data: dataUrl, x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h });
}

function addImageCover(slide: pptxgen.Slide, dataUrl: string, b: Box) {
  slide.addImage({ data: dataUrl, x: b.x, y: b.y, w: b.w, h: b.h, sizing: { type: 'cover', w: b.w, h: b.h } });
}

/** Client logo (or a placeholder pill) top-left/bottom-right depending on caller. */
async function addLogo(
  slide: pptxgen.Slide,
  logoUrl: string | undefined,
  xPx: number,
  yPx: number,
  dark = false,
  scale = 1
) {
  if (logoUrl) {
    // Grown around the box's centre, not its top-left: the cover anchors its
    // logo near the bottom-right, so expanding from the origin would push a
    // scaled-up mark off the slide.
    const w = 260 * scale;
    const h = 42 * scale;
    await addImageContain(slide, logoUrl, box(xPx + (260 - w) / 2, yPx + (42 - h) / 2, w, h));
    return;
  }
  addText(slide, 'CLIENT LOGO', box(xPx, yPx, 200, 30), {
    fontFace: FONT_MONO,
    size: 11,
    color: dark ? 'CCCCCC' : '5A5A69',
    letterSpacingEm: 0.14,
    bold: true,
  });
}

// ---------------------------------------------------------------------------
// Per-template builders
// ---------------------------------------------------------------------------

async function buildCover(slide: pptxgen.Slide, content: SlideInstance['content'], logoUrl?: string, logoScale = 1) {
  const lines = content.headingLines?.length ? content.headingLines : ['Master Primary', 'Heading.'];
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const heroFont = Math.round(Math.max(72, Math.min(180, 1640 / (longest * 0.6), 620 / (lines.length * 0.95))));
  const heroTopPad = lines.length >= 4 ? 160 : lines.length === 3 ? 210 : 280;

  addHudTop(slide, content.projectLabel ?? 'Project Name Placeholder', content.versionLabel ?? 'YYYY // Version 0.0',
    { label: 'projectLabel', num: 'versionLabel' });
  addEditorialLabel(slide, content.eyebrow ?? 'Presentation Subtitle', 140, heroTopPad, { slot: 'eyebrow' });

  // Multiplier is intentionally generous (vs. the ~0.85 Space Grotesk itself renders at): if the
  // embedded font ever fails to load, PowerPoint's fallback font may have taller line metrics, and
  // this estimate drives the tagline's Y position below - undershooting crowds the tagline into the heading.
  const headingH = lines.length * heroFont * 1.05 * PX_TO_PT * (PX_PER_IN / 72);
  const runs: pptxgen.TextProps[] = lines.map((line, i) => ({
    text: line,
    options: {
      ...(i > 0 ? { softBreakBefore: true } : {}),
      // Matches the canvas's cover renderer. Both must change together or the
      // exported deck stops matching what the editor showed.
      ...(i === lines.length - 1 && lines.length > 1 ? { color: EMERALD_500 } : {}),
    },
  }));
  addText(slide, runs, box(140, heroTopPad + 55, 1680, headingH + 40), {
    size: heroFont,
    bold: true,
    lineSpacingMultiple: 0.9,
    slot: 'headingLines',
  });

  const taglineY = heroTopPad + 55 + headingH + 96;
  addLine(slide, 140, taglineY + 9, 275, taglineY + 9, EMERALD_500, 1);
  addText(slide, content.tagline ?? PLACEHOLDER, box(323, taglineY - 10, 1460, 40), {
    fontFace: FONT_MONO,
    size: 18,
    color: NEUTRAL_500,
    letterSpacingEm: 0.25,
    slot: 'tagline',
  });

  const confidential = content.confidentialLabel ?? 'PROPRIETARY AND CONFIDENTIAL';
  if (confidential !== '') {
    addText(slide, confidential, box(80, 1000, 500, 26), {
      fontFace: FONT_MONO,
      size: 16,
      color: NEUTRAL_400,
      slot: 'confidentialLabel',
    });
  }
  await addLogo(slide, logoUrl, 1580, 995, false, logoScale);
}

const DEFAULT_INDEX_PARTS = [
  { title: 'Introduction', description: PLACEHOLDER },
  { title: 'Context', description: PLACEHOLDER },
  { title: 'Performance', description: PLACEHOLDER },
  { title: 'Strategy', description: PLACEHOLDER },
];

function buildIndex(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  const parts = content.parts?.length ? content.parts : DEFAULT_INDEX_PARTS;
  addHudTop(slide, content.hudLabel ?? 'Agenda', num, { label: 'hudLabel' });
  addEditorialLabel(slide, 'Navigation', 140, 160);
  const heading = content.heading ?? 'Presentation\nStructure.';
  const headingFont = 100;
  const headingW = 700;
  const headingLines = estimateWrappedLines(heading, headingFont, headingW);
  const headingH = Math.max(260, headingLines * headingFont * 1.05);
  addText(slide, heading, box(140, 215, headingW, headingH), {
    size: headingFont,
    bold: true,
    lineSpacingMultiple: 0.9,
    slot: 'heading',
  });

  const cols = 2;
  const colW = 395;
  const gapX = 60;
  const rowH = 220;
  const gapY = 40;
  const startX = 930;
  const startY = 200;
  parts.slice(0, 4).forEach((part, i) => {
    const cx = startX + (i % cols) * (colW + gapX);
    const cy = startY + Math.floor(i / cols) * (rowH + gapY);
    addLine(slide, cx, cy, cx, cy + rowH, i === 0 ? EMERALD_500 : NEUTRAL_200, 2);
    addEditorialLabel(slide, `Part 0${i + 1}`, cx + 30, cy, { size: 10 });
    addText(slide, part.title, box(cx + 30, cy + 30, colW - 30, 50), { size: 32, bold: true, lineSpacingMultiple: 1.05, slot: `parts.${i}.title` });
    addText(slide, part.description, box(cx + 30, cy + 85, colW - 30, 120), {
      size: 18,
      color: NEUTRAL_500,
      lineSpacingMultiple: 1.5,
      slot: `parts.${i}.description`,
    });
  });
}

function buildExecutiveSummary(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  addHudTop(slide, content.hudLabel ?? 'Executive Summary', num, { label: 'hudLabel' });
  addEditorialLabel(slide, content.eyebrow ?? 'Executive Summary', 140, 160, { slot: 'eyebrow' });
  addText(slide, content.heading ?? 'Core Strategic\nObjective.', box(140, 215, 1640, 220), {
    size: 100,
    bold: true,
    lineSpacingMultiple: 0.9,
    slot: 'heading',
  });

  // 1.4fr:1fr split (vs. an even 1fr:1fr) so the recommendation reads as the
  // primary content and the metric as a supporting aside, matching the source layout.
  const bodyY = 500;
  const gap = 120;
  const contentW = 1640 - gap;
  const leftW = Math.round((contentW * 1.4) / 2.4);
  const rightX = 140 + leftW + gap;
  const rightW = 1640 - leftW - gap;

  addText(slide, content.body ?? PLACEHOLDER, box(140, bodyY, leftW, 400), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: NEUTRAL_500,
    lineSpacingMultiple: 1.5,
    slot: 'body',
  });

  const rightPadLeft = 66;
  addLine(slide, rightX, bodyY, rightX, bodyY + 340, NEUTRAL_200, 1);
  addEditorialLabel(slide, content.metricLabel ?? 'Variable Metric', rightX + rightPadLeft, bodyY + 100, { slot: 'metricLabel' });
  addText(slide, content.metricText ?? '00.0%', box(rightX + rightPadLeft, bodyY + 150, rightW - rightPadLeft, 140), {
    size: 56,
    bold: true,
    color: NEUTRAL_900,
    lineSpacingMultiple: 1.1,
    slot: 'metricText',
  });
}

async function buildSectionDivider(slide: pptxgen.Slide, content: SlideInstance['content'], num: string, logoUrl?: string, logoScale = 1) {
  await addLogo(slide, logoUrl, 80, 60, true, logoScale);
  addText(slide, content.hudLabel ?? 'Section Marker', box(1400, 60, 420, 30), {
    fontFace: FONT_MONO,
    size: 16,
    color: WHITE,
    transparency: 60,
    align: 'right',
    letterSpacingEm: 0.2,
    slot: 'hudLabel',
  });

  addEditorialLabel(slide, content.eyebrow ?? 'Part 02', 150, 400, { color: EMERALD_400, slot: 'eyebrow' });
  addText(slide, content.heading ?? 'Section Title.', box(150, 463, 1620, 260), {
    size: 180,
    bold: true,
    color: WHITE,
    slot: 'heading',
  });
  addText(slide, content.subtitle ?? PLACEHOLDER, box(150, 730, 960, 100), {
    fontFace: FONT_DISPLAY,
    size: 30,
    color: WHITE,
    transparency: 45,
    lineSpacingMultiple: 1.5,
    slot: 'subtitle',
  });
  void num;
}

const DEFAULT_ATTRIBUTES = ['Placeholder Attribute', 'Placeholder Attribute', 'Placeholder Attribute'];

function buildTwoColumnContext(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  const attributes = content.leftAttributes?.length ? content.leftAttributes : DEFAULT_ATTRIBUTES;
  addHudTop(slide, content.hudLabel ?? 'Strategic Context', num, { label: 'hudLabel' });
  addLine(slide, 960, 0, 960, 1080, NEUTRAL_200, 1);

  addEditorialLabel(slide, content.leftLabel ?? 'Condition A', 140, 250, { slot: 'leftLabel' });
  addText(slide, content.leftHeading ?? 'Current State\nEnvironment.', box(140, 305, 700, 200), {
    size: 72,
    bold: true,
    lineSpacingMultiple: 0.9,
    slot: 'leftHeading',
  });
  addText(slide, content.leftBody ?? PLACEHOLDER, box(140, 515, 700, 160), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: NEUTRAL_500,
    lineSpacingMultiple: 1.5,
    slot: 'leftBody',
  });
  const attrRuns: pptxgen.TextProps[] = attributes.flatMap((a, i) => [
    { text: `[${String(i + 1).padStart(2, '0')}] ${a}`, options: { breakLine: true, ...runOpts(`leftAttributes.${i}`) } },
  ]);
  addText(slide, attrRuns, box(140, 690, 700, 180), {
    fontFace: FONT_MONO,
    size: 20,
    color: NEUTRAL_400,
    lineSpacingMultiple: 1.6,
  });

  addRect(slide, box(960, 0, 960, 1080), NEUTRAL_50);
  addEditorialLabel(slide, content.rightLabel ?? 'Condition B', 1000, 250, { slot: 'rightLabel' });
  addText(slide, content.rightHeading ?? 'Strategic Pivot\nTarget State.', box(1000, 305, 780, 200), {
    size: 72,
    bold: true,
    lineSpacingMultiple: 0.9,
    slot: 'rightHeading',
  });
  addText(slide, content.rightBody ?? PLACEHOLDER, box(1000, 515, 780, 300), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: NEUTRAL_900,
    lineSpacingMultiple: 1.5,
    slot: 'rightBody',
  });
}

function buildDataMonument(slide: pptxgen.Slide, content: SlideInstance['content']) {
  addEditorialLabel(slide, content.eyebrow ?? 'Performance Metric', 140, 260, { slot: 'eyebrow' });
  const runs: pptxgen.TextProps[] = [
    { text: content.value ?? '000.0', options: { ...runOpts('value') } },
    { text: ` ${content.unit ?? 'M'}`, options: { color: EMERALD_500, fontSize: pt(420 * 0.3), ...runOpts('unit') } },
  ];
  addText(slide, runs, box(140, 305, 1600, 330), { size: 420, bold: true, lineSpacingMultiple: 0.8 });
  addText(slide, content.heading ?? 'Primary Performance Variable Title.', box(140, 630, 1600, 100), {
    size: 64,
    bold: true,
    lineSpacingMultiple: 0.95,
    slot: 'heading',
  });
  addText(slide, content.body ?? PLACEHOLDER, box(140, 745, 800, 220), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: NEUTRAL_500,
    lineSpacingMultiple: 1.5,
    slot: 'body',
  });
}

const DEFAULT_BARS = [
  { label: 'P1', pct: 30 },
  { label: 'P2', pct: 45 },
  { label: 'P3', pct: 70 },
  { label: 'P4', pct: 95, active: true },
];
const DEFAULT_KPIS = [
  { label: 'Metric Alpha', value: '00.0%' },
  { label: 'Metric Beta', value: '00.0x' },
  { label: 'Metric Gamma', value: '-00%' },
];

function buildMetricsDashboard(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  const bars = content.bars?.length ? content.bars : DEFAULT_BARS;
  const kpis = content.kpis?.length ? content.kpis : DEFAULT_KPIS;
  addHudTop(slide, content.hudLabel ?? 'Metrics Dashboard', num, { label: 'hudLabel' });
  addEditorialLabel(slide, content.eyebrow ?? 'Temporal Performance', 140, 260, { slot: 'eyebrow' });

  const chartTop = 320;
  const chartBottom = 670;
  const chartH = chartBottom - chartTop;
  const chartX = 140;
  const chartW = 1640;
  const gap = 20;
  const barW = (chartW - gap * (bars.length - 1)) / bars.length;
  addLine(slide, chartX, chartBottom, chartX + chartW, chartBottom, NEUTRAL_900, 2);
  bars.forEach((b, i) => {
    const h = Math.max(4, (b.pct / 100) * chartH);
    const x = chartX + i * (barW + gap);
    addRect(slide, box(x, chartBottom - h, barW, h), b.active ? EMERALD_500 : NEUTRAL_200);
    addText(slide, b.label, box(x - 10, chartTop - 40, barW + 20, 30), {
      fontFace: FONT_MONO,
      size: 14,
      color: NEUTRAL_500,
      align: 'center',
      slot: `bars.${i}.label`,
    });
  });

  const kpiY = 750;
  const kpiColW = (1640 - 40 * 2) / 3;
  kpis.slice(0, 3).forEach((k, i) => {
    const x = 140 + i * (kpiColW + 40);
    addEditorialLabel(slide, k.label, x, kpiY, { size: 10, slot: `kpis.${i}.label` });
    addText(slide, k.value, box(x, kpiY + 40, kpiColW, 90), { size: 64, bold: true, lineSpacingMultiple: 0.95, slot: `kpis.${i}.value` });
  });
}

const DEFAULT_ROWS: ComparisonRow[] = [
  { dim: 'Dimension 01', cur: '00.0', tgt: '00.0', delta: '+00.0%' },
  { dim: 'Dimension 02', cur: '0.00%', tgt: '0.00%', delta: '+00.0%' },
  { dim: 'Dimension 03', cur: '0,000', tgt: '0,000', delta: '+00.0%' },
  { dim: 'Dimension 04', cur: 'XXX.X', tgt: 'XXX.X', delta: '+00.0%' },
];

function buildComparativeTable(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  const rows = content.rows?.length ? content.rows : DEFAULT_ROWS;
  addHudTop(slide, content.hudLabel ?? 'Comparative Framework', num, { label: 'hudLabel' });
  addEditorialLabel(slide, content.eyebrow ?? 'Benchmark Comparison', 140, 260, { slot: 'eyebrow' });

  const cellFont = rows.length > 6 ? 18 : rows.length > 4 ? 22 : 26;
  const headers = ['Analysis Category', 'Current Variable', 'Target Variable', 'Performance Delta'];
  const colW = [0.19, 0.27, 0.27, 0.27].map((f) => inch(1640 * f));

  const headerRow: pptxgen.TableRow = headers.map((h) => ({
    text: h,
    options: {
      fontFace: FONT_MONO,
      fontSize: pt(13),
      color: NEUTRAL_500,
      bold: false,
      charSpacing: tracking(13, 0.12),
      border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', color: NEUTRAL_900, pt: 1.5 }, { type: 'none' }],
      valign: 'bottom',
    },
  }));

  // Table cells bypass addText(), so their overrides are merged in here. Cell
  // options do accept `align`, so unlike the shared-box run cases above, table
  // cells support the full set of controls the toolbar offers.
  const bodyRows: pptxgen.TableRow[] = rows.map((r, i) => [
    { text: r.dim, options: {}, slot: `rows.${i}.dim` },
    { text: r.cur, options: {}, slot: `rows.${i}.cur` },
    { text: r.tgt, options: {}, slot: `rows.${i}.tgt` },
    { text: r.delta, options: { color: EMERALD_600 }, slot: `rows.${i}.delta` },
  ].map((c) => {
    const ov = styleFor(activeStyles, c.slot);
    return {
      text: c.text,
      options: {
        fontFace: FONT_DISPLAY,
        fontSize: pt(ov?.sizePx ?? cellFont),
        color: ov?.color ?? c.options.color ?? NEUTRAL_900,
        bold: ov?.bold,
        italic: ov?.italic,
        underline: ov?.underline ? { style: 'sng' as const } : undefined,
        align: ov?.align,
        border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', color: NEUTRAL_200, pt: 0.75 }, { type: 'none' }],
        valign: 'top',
      },
    };
  }));

  slide.addTable([headerRow, ...bodyRows], {
    x: inch(140),
    y: inch(330),
    w: inch(1640),
    colW,
    autoPage: false,
    margin: [4, 18, 4, 0],
  });
}

const DEFAULT_PHASES = [
  { title: 'Initiation', description: PLACEHOLDER, completed: true },
  { title: 'Integration', description: PLACEHOLDER, completed: true },
  { title: 'Optimization', description: PLACEHOLDER, completed: false },
];

function buildStrategicRoadmap(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  const phases = content.phases?.length ? content.phases : DEFAULT_PHASES;
  addHudTop(slide, content.hudLabel ?? 'Execution Timeline', num, { label: 'hudLabel' });
  addEditorialLabel(slide, content.eyebrow ?? 'Milestone Projection', 140, 260, { slot: 'eyebrow' });
  addText(slide, content.heading ?? 'Pathway to Execution.', box(140, 315, 1640, 100), { size: 100, bold: true, slot: 'heading' });

  const railY = 490;
  addLine(slide, 140, railY, 1780, railY, NEUTRAL_200, 2);

  const itemW = 320;
  const n = phases.length;
  const totalW = 1640;
  const spacing = n > 1 ? (totalW - itemW) / (n - 1) : 0;
  phases.forEach((p, i) => {
    const x = 140 + i * spacing;
    addCircle(slide, box(x, railY - 10, 20, 20), p.completed ? EMERALD_500 : NEUTRAL_300);
    addEditorialLabel(slide, `Phase ${String(i + 1).padStart(2, '0')}`, x, railY + 42, { size: 12 });
    addText(slide, p.title, box(x, railY + 85, itemW, 60), { size: 32, bold: true, lineSpacingMultiple: 1.05, slot: `phases.${i}.title` });
    addText(slide, p.description || PLACEHOLDER, box(x, railY + 140, itemW, 140), {
      fontFace: FONT_DISPLAY,
      size: 18,
      color: NEUTRAL_500,
      lineSpacingMultiple: 1.5,
      slot: `phases.${i}.description`,
    });
  });
}

async function buildImageEditorial(slide: pptxgen.Slide, content: SlideInstance['content']) {
  const showImage = !content.hideImage;
  const leftW = showImage ? 873 : 1920;
  const textPad = showImage ? 140 : 360;
  const heading = content.heading ?? 'Primary Insight Statement.';
  const headingFont = 100;
  const headingW = leftW - textPad;
  const headingLines = estimateWrappedLines(heading, headingFont, headingW);
  const headingH = Math.max(260, headingLines * headingFont * 1.05);
  addEditorialLabel(slide, content.eyebrow ?? 'Visual Narrative', 140, 400, { slot: 'eyebrow' });
  addText(slide, heading, box(140, 455, headingW, headingH), {
    size: headingFont,
    bold: true,
    lineSpacingMultiple: 0.95,
    slot: 'heading',
  });
  const bodyY = 455 + headingH + 40;
  addText(slide, content.body ?? PLACEHOLDER, box(140, bodyY, headingW - 60, 260), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: NEUTRAL_500,
    lineSpacingMultiple: 1.5,
    slot: 'body',
  });
  if (!showImage) return;
  const imgBox = box(leftW, 0, 1920 - leftW, 1080);
  if (content.imageUrl) {
    addImageCover(slide, content.imageUrl, imgBox);
  } else {
    addRect(slide, imgBox, NEUTRAL_100);
    addText(slide, 'IMAGE ASSET PLACEHOLDER', imgBox, {
      fontFace: FONT_MONO,
      size: 20,
      color: NEUTRAL_400,
      align: 'center',
      valign: 'middle',
      letterSpacingEm: 0.12,
    });
  }
}

const DEFAULT_STEPS = [
  { title: 'Input', description: PLACEHOLDER },
  { title: 'Process', description: PLACEHOLDER },
  { title: 'Output', description: PLACEHOLDER },
];

function buildProcessArchitecture(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  const steps = content.steps?.length ? content.steps : DEFAULT_STEPS;
  addHudTop(slide, content.hudLabel ?? 'System Logic', num, { label: 'hudLabel' });
  addEditorialLabel(slide, content.eyebrow ?? 'Architectural Protocol', 140, 260, { slot: 'eyebrow' });
  addText(slide, content.heading ?? 'Operational Flow.', box(140, 315, 1640, 100), { size: 100, bold: true, slot: 'heading' });

  const n = steps.length;
  const gap = 40;
  const colW = (1640 - gap * (n - 1)) / n;
  steps.forEach((s, i) => {
    const x = 140 + i * (colW + gap);
    const yOffset = i * 40;
    const top = 495 + yOffset;
    const h = 420 - yOffset;
    addRect(slide, box(x, top, colW, h), undefined, { color: i === 1 ? EMERALD_500 : NEUTRAL_200, widthPx: 1 });
    addText(slide, String(i + 1).padStart(2, '0'), box(x + 40, top + 30, colW - 80, 70), {
      fontFace: FONT_MONO,
      size: 48,
      color: EMERALD_500,
    });
    addText(slide, s.title, box(x + 40, top + 110, colW - 80, 60), { size: 32, bold: true, lineSpacingMultiple: 1.05, slot: `steps.${i}.title` });
    addText(slide, s.description || PLACEHOLDER, box(x + 40, top + 170, colW - 80, h - 200), {
      fontFace: FONT_DISPLAY,
      size: 18,
      color: NEUTRAL_500,
      lineSpacingMultiple: 1.5,
      slot: `steps.${i}.description`,
    });
  });
}

const DEFAULT_SECTORS = [
  { label: 'Sector A', value: '0.0M Metric' },
  { label: 'Sector B', value: '0.0M Metric' },
  { label: 'Sector C', value: '0.0M Metric' },
];

async function buildGlobalMap(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  const sectors = content.sectors?.length ? content.sectors : DEFAULT_SECTORS;
  addHudTop(slide, content.hudLabel ?? 'Reach Distribution', num, { label: 'hudLabel' });

  // 1.2fr:1fr split - image column left, stats column right (vertically centered), matching the source layout.
  const gap = 105;
  const contentW = 1640 - gap;
  const leftW = Math.round((contentW * 1.2) / 2.2);
  const rightX = 140 + leftW + gap;
  const rightW = 1640 - leftW - gap;

  addText(slide, content.heading ?? 'Regional Impact.', box(140, 160, leftW, 100), { size: 100, bold: true, slot: 'heading' });

  const showMap = !content.hideImage;
  if (showMap) {
    const mapBox = box(140, 305, leftW, 645);
    if (content.imageUrl) {
      addImageCover(slide, content.imageUrl, mapBox);
      addRect(slide, mapBox, undefined, { color: NEUTRAL_200, widthPx: 1 });
    } else {
      addRect(slide, mapBox, NEUTRAL_50, { color: NEUTRAL_200, widthPx: 1 });
      addText(slide, 'GEOGRAPHIC VISUALISATION PLACEHOLDER', mapBox, {
        fontFace: FONT_MONO,
        size: 20,
        color: NEUTRAL_400,
        align: 'center',
        valign: 'middle',
        letterSpacingEm: 0.12,
      });
    }
  }

  const blockH = 190;
  const totalH = blockH * sectors.length;
  const startY = 160 + Math.max(0, (860 - totalH) / 2);
  sectors.forEach((s, i) => {
    const y = startY + i * blockH;
    addLine(slide, rightX, y, rightX + rightW, y, NEUTRAL_200, 1);
    addEditorialLabel(slide, s.label, rightX, y + 30, { size: 10, slot: `sectors.${i}.label` });
    addText(slide, s.value, box(rightX, y + 68, rightW, 90), { size: 72, bold: true, slot: `sectors.${i}.value` });
  });
  void num;
}

async function buildFeaturedQuote(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  addHudTop(slide, content.eyebrow ?? 'Key Insight', num, { label: 'eyebrow' });

  // Giant decorative quotation mark (vs. the previous inline quote-mark-in-heading treatment) -
  // this is what let the source design run the actual quote text at a much saner size.
  addText(slide, '“', box(195, 160, 300, 160), {
    size: 300,
    bold: true,
    color: EMERALD_500,
    lineSpacingMultiple: 0.5,
  });

  const quote = content.quote ?? PLACEHOLDER;
  const quoteFont = 84;
  const quoteW = 1440;
  const quoteLines = estimateWrappedLines(quote, quoteFont, quoteW);
  const quoteH = Math.max(200, quoteLines * quoteFont * 1.2);
  addText(slide, quote, box(195, 330, quoteW, quoteH), {
    size: quoteFont,
    lineSpacingMultiple: 1.12,
    slot: 'quote',
  });

  const avatarY = 330 + quoteH + 72;
  const avatarD = 84 * (content.avatarScale ?? 1);
  const avatarPad = (84 - avatarD) / 2;
  if (content.avatarUrl) {
    slide.addImage({
      data: content.avatarUrl,
      x: inch(195 + avatarPad),
      y: inch(avatarY + avatarPad),
      w: inch(avatarD),
      h: inch(avatarD),
      rounding: true,
    });
  } else {
    addCircle(slide, box(195, avatarY, 84, 84), NEUTRAL_200);
  }
  addText(slide, content.author ?? 'Author Name', box(304, avatarY + 6, 700, 50), { size: 27, bold: true, slot: 'author' });
  addText(slide, content.role ?? 'Author Title Placeholder', box(304, avatarY + 50, 700, 40), {
    fontFace: FONT_MONO,
    size: 18,
    color: NEUTRAL_500,
    slot: 'role',
  });
}

const DEFAULT_CONTACTS = ['email@placeholder.com', '@social_handle', 'www.domain.com'];

async function buildExit(slide: pptxgen.Slide, content: SlideInstance['content'], logoUrl?: string, logoScale = 1) {
  await addLogo(slide, logoUrl, 80, 60, true, logoScale);
  addEditorialLabel(slide, content.eyebrow ?? 'Conclusion', 140, 360, { color: EMERALD_400, slot: 'eyebrow' });
  addText(slide, content.heading ?? 'Thank You.', box(140, 415, 1600, 280), { size: 180, bold: true, color: WHITE, slot: 'heading' });
  addText(slide, content.body ?? PLACEHOLDER, box(140, 700, 800, 200), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: 'CCCCCC',
    transparency: 50,
    lineSpacingMultiple: 1.5,
    slot: 'body',
  });

  const contacts = content.contacts?.length ? content.contacts : DEFAULT_CONTACTS;
  const runs: pptxgen.TextProps[] = contacts.flatMap((c, i) => [
    { text: c + (i < contacts.length - 1 ? '   ' : ''), options: { ...runOpts(`contacts.${i}`) } },
  ]);
  addText(slide, runs, box(140, 920, 1600, 40), { fontFace: FONT_MONO, size: 16, color: EMERALD_400 });
}

async function buildBlank(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  const layout = content.blankLayout ?? 'standard';

  if (layout === 'full-bleed') {
    if (content.imageUrl) {
      addImageCover(slide, content.imageUrl, box(0, 0, 1920, 1080));
    } else {
      addRect(slide, box(0, 0, 1920, 1080), NEUTRAL_100);
    }
    addRect(slide, box(0, 540, 1920, 540), BLACK, undefined, 30);
    addText(slide, (content.hudLabel ?? 'Custom Slide').toUpperCase(), box(80, 55, 800, 30), {
      fontFace: FONT_MONO,
      size: 12,
      color: WHITE,
      letterSpacingEm: 0.12,
      slot: 'hudLabel',
    });
    addText(slide, num, box(1040, 55, 800, 30), { fontFace: FONT_MONO, size: 12, color: WHITE, align: 'right' });
    addEditorialLabel(slide, content.eyebrow ?? 'Section', 140, 780, { color: EMERALD_400, slot: 'eyebrow' });
    addText(slide, content.heading ?? 'Blank Slide.', box(140, 835, 1600, 110), { size: 72, bold: true, color: WHITE, slot: 'heading' });
    addText(slide, content.body ?? 'Click to add your content…', box(140, 955, 1200, 100), {
      fontFace: FONT_DISPLAY,
      size: 28,
      color: 'DDDDDD',
      lineSpacingMultiple: 1.5,
      slot: 'body',
    });
    return;
  }

  if (layout === 'two-column') {
    addHudTop(slide, content.hudLabel ?? 'Custom Slide', num, { label: 'hudLabel' });
    addEditorialLabel(slide, content.eyebrow ?? 'Section', 140, 200, { slot: 'eyebrow' });
    addText(slide, content.heading ?? 'Blank Slide.', box(140, 255, 780, 180), { size: 64, bold: true, lineSpacingMultiple: 0.95, slot: 'heading' });
    addText(slide, content.body ?? 'Click to add your content…', box(140, 460, 780, 400), {
      fontFace: FONT_DISPLAY,
      size: 28,
      color: NEUTRAL_500,
      lineSpacingMultiple: 1.5,
      slot: 'body',
    });
    // No image slot and no fixed table here - the right column's table is a
    // draggable OverlayShape (auto-inserted when this layout is picked), so
    // it exports through the generic addOverlayShapes() pass instead.
    return;
  }

  // standard
  addHudTop(slide, content.hudLabel ?? 'Custom Slide', num, { label: 'hudLabel' });
  addEditorialLabel(slide, content.eyebrow ?? 'Section', 140, 200, { slot: 'eyebrow' });
  addText(slide, content.heading ?? 'Blank Slide.', box(140, 255, 1640, 130), { size: 88, bold: true, slot: 'heading' });
  addText(slide, content.body ?? 'Click to add your content…', box(140, 400, 1200, 200), {
    fontFace: FONT_DISPLAY,
    size: 28,
    color: NEUTRAL_500,
    lineSpacingMultiple: 1.5,
    slot: 'body',
  });
  addText(slide, content.secondHeading ?? 'Second Section.', box(140, 620, 1640, 80), { size: 40, bold: true, slot: 'secondHeading' });
  addText(slide, content.secondBody ?? 'Click to add more content…', box(140, 710, 1200, 200), {
    fontFace: FONT_DISPLAY,
    size: 28,
    color: NEUTRAL_500,
    lineSpacingMultiple: 1.5,
    slot: 'secondBody',
  });
}

/**
 * Rebuilds an imported .pptx slide as native pptxgenjs objects - one editable
 * text box or shape per imported shape, at its original coordinates.
 *
 * Text is emitted run by run so mixed formatting inside a line survives the
 * round trip, and every box lands as a real PowerPoint text box the client can
 * edit after download.
 */
async function buildImported(slide: pptxgen.Slide, content: SlideInstance['content']) {
  for (const sh of content.shapes ?? []) {
    const b = box(sh.x, sh.y, sh.w, sh.h);

    if (sh.kind === 'image' && sh.imageUrl) {
      await addImageContain(slide, sh.imageUrl, b);
      continue;
    }

    if (sh.kind === 'table' && sh.rows) {
      const colW = (sh.colWidthsPx ?? []).map((w) => inch(w));
      const rows: pptxgen.TableRow[] = sh.rows.map((row) => row.cells.map((cell) => ({
        text: (cell.paragraphs ?? []).flatMap((p) => p.runs.map((r) => r.text)).join(' '),
        options: {
          fill: cell.fill ? { color: cell.fill } : undefined,
          fontFace: cell.paragraphs?.[0]?.runs[0]?.font ?? FONT_DISPLAY,
          fontSize: pt(cell.paragraphs?.[0]?.runs[0]?.sizePx ?? 16),
          bold: cell.paragraphs?.[0]?.runs[0]?.bold,
          color: cell.paragraphs?.[0]?.runs[0]?.color ?? NEUTRAL_900,
          align: cell.paragraphs?.[0]?.align ?? 'left',
          border: { type: 'solid', color: 'D9D9D9', pt: 0.75 },
        },
      })));
      slide.addTable(rows, { ...b, colW: colW.length ? colW : undefined, autoPage: false });
      continue;
    }

    if (sh.fill || sh.line) {
      const line = sh.line ? { color: sh.line.color, widthPx: sh.line.widthPx } : undefined;
      if (sh.kind === 'ellipse') {
        addCircle(slide, b, sh.fill ?? WHITE, line);
      } else {
        addRect(slide, b, sh.fill, line);
      }
    }

    const paragraphs = sh.paragraphs ?? [];
    if (!paragraphs.length) continue;

    const runs: pptxgen.TextProps[] = [];
    paragraphs.forEach((para, pi) => {
      if (!para.runs.length) {
        runs.push({ text: ' ', options: pi > 0 ? { breakLine: true } : {} });
        return;
      }
      para.runs.forEach((run, ri) => {
        runs.push({
          text: run.text,
          options: {
            ...(pi > 0 && ri === 0 ? { breakLine: true } : {}),
            fontFace: run.font ?? FONT_DISPLAY,
            fontSize: pt(run.sizePx ?? 18),
            bold: run.bold,
            italic: run.italic,
            underline: run.underline ? { style: 'sng' } : undefined,
            color: run.color ?? NEUTRAL_900,
            align: para.align ?? 'left',
          },
        });
      });
    });

    slide.addText(runs, {
      ...b,
      valign: sh.vAlign ?? 'top',
      align: paragraphs[0]?.align ?? 'left',
      wrap: true,
      fit: 'none',
      margin: 0,
      autoFit: false,
    });
  }
}

/**
 * Emits the user-inserted overlay shapes for a slide.
 *
 * Called for every template, after its own content, so array order becomes
 * paint order. PowerPoint has no "behind the layout" concept to map `behind`
 * onto - z-order there is simply shape order within the slide - so behind-shapes
 * are emitted first (painting under everything the template added) and the rest
 * last. That reproduces what the canvas shows in the only way the format allows.
 */
async function addOverlayShapes(slide: pptxgen.Slide, content: SlideInstance['content'], phase: 'behind' | 'front') {
  const blankLayout = content.blankLayout ?? 'standard';
  const shapes = (content.overlay ?? [])
    .filter((s) => (phase === 'behind' ? s.behind : !s.behind))
    // A shape pinned to one 'blank' layout (two-column's table) must not
    // export while the slide is showing a different layout - see
    // OverlayShape.blankLayoutOnly.
    .filter((s) => !s.blankLayoutOnly || s.blankLayoutOnly === blankLayout);

  for (const s of shapes) {
    const b = box(s.x, s.y, s.w, s.h);

    if (s.kind === 'image') {
      if (s.imageUrl) await addImageContain(slide, s.imageUrl, b);
      continue;
    }

    if (s.kind === 'text') {
      // A text box with no text would export as an invisible empty shape that
      // the client can still click - skip it rather than ship the confusion.
      const text = s.text ?? '';
      if (!text.trim()) continue;
      addText(slide, text, b, {
        fontFace: s.style?.fontFamily,
        size: s.style?.sizePx ?? 32,
        bold: s.style?.bold,
        italic: s.style?.italic,
        underline: s.style?.underline,
        color: s.style?.color ?? NEUTRAL_900,
        align: s.style?.align ?? 'left',
        valign: s.vAlign ?? 'top',
        lineSpacingMultiple: 1.3,
      });
      continue;
    }

    if (s.kind === 'table' && s.rows) {
      const colW = (s.colWidthsPx ?? []).map((w) => inch(w));
      const rows: pptxgen.TableRow[] = s.rows.map((row) => row.cells.map((cell) => ({
        text: cell.text ?? '',
        options: {
          fill: cell.fill ? { color: cell.fill } : undefined,
          fontFace: cell.style?.fontFamily ?? FONT_DISPLAY,
          fontSize: pt(cell.style?.sizePx ?? 16),
          bold: cell.style?.bold,
          italic: cell.style?.italic,
          underline: cell.style?.underline ? { style: 'sng' } : undefined,
          color: cell.style?.color ?? NEUTRAL_900,
          align: cell.style?.align ?? 'left',
          border: { type: 'solid', color: 'D9D9D9', pt: 0.75 },
        },
      })));
      slide.addTable(rows, { ...b, colW: colW.length ? colW : undefined, autoPage: false });
      continue;
    }

    if (s.kind === 'chart' && s.chartSeries?.length) {
      const data = s.chartSeries.map((series) => ({
        name: series.name,
        labels: s.chartCategories ?? [],
        values: series.values,
      }));
      // Plain string literals rather than the pptxgen.ChartType enum - this
      // file only imports pptxgenjs's types, not its runtime, and the string
      // literals are the same values the enum resolves to.
      slide.addChart(s.chartType ?? 'bar', data, {
        ...b,
        showLegend: data.length > 1,
        showTitle: false,
      });
      continue;
    }

    const line = s.line ? { color: s.line.color, widthPx: s.line.widthPx } : undefined;
    if (s.kind === 'ellipse') {
      // addCircle demands a fill; an outlined ellipse has none, so it goes
      // through the generic shape call with an explicit no-fill instead.
      slide.addShape('ellipse', {
        ...b,
        fill: s.fill ? { color: s.fill } : { type: 'none' },
        line: line ? { color: line.color, width: Math.max(0.25, pt(line.widthPx)) } : { type: 'none' },
      });
    } else {
      addRect(slide, b, s.fill, line);
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Populates one freshly-added pptxgenjs slide with the native (editable)
 *  equivalent of the given deck slide's template. */
export async function addNativeSlide(
  slide: pptxgen.Slide,
  instance: SlideInstance,
  num: string,
  logoUrl?: string,
  pageLabel?: string,
  logoScale = 1
): Promise<void> {
  const c = instance.content;
  beginSlideStyles(c.styles, c.offsets);
  try {
    await buildSlideBody(slide, instance, num, logoUrl, pageLabel, logoScale);
  } finally {
    // Released even if a build function throws, so one bad slide cannot leak
    // its overrides onto every slide after it.
    endSlideStyles();
  }
}

async function buildSlideBody(
  slide: pptxgen.Slide,
  instance: SlideInstance,
  num: string,
  logoUrl?: string,
  pageLabel?: string,
  logoScale = 1
): Promise<void> {
  const c = instance.content;

  // Speaker notes land in PowerPoint's own notes pane, never on the slide.
  if (instance.notes?.trim()) slide.addNotes(instance.notes);

  if (instance.templateId === 'imported') {
    const base = (c.importedBase ?? 'FFFFFF').replace('#', '').toUpperCase();
    const lum = (0.2126 * parseInt(base.slice(0, 2), 16)
      + 0.7152 * parseInt(base.slice(2, 4), 16)
      + 0.0722 * parseInt(base.slice(4, 6), 16)) / 255;
    applyBackground(slide, {
      base,
      grid: true,
      gridColor: lum < 0.5 ? 'rgba(255,255,255,0.11)' : undefined,
      glow: { cx: 1520, cy: 320, r: 700 },
    });
  } else if (instance.templateId === 'blank') {
    const layout = c.blankLayout ?? 'standard';
    applyBackground(slide, layout === 'full-bleed' ? { base: WHITE } : { base: WHITE, grid: true });
  } else {
    applyBackground(slide, DECOR[instance.templateId] ?? { base: WHITE });
  }

  // Behind-shapes first, so the template's own content paints over them.
  await addOverlayShapes(slide, c, 'behind');

  switch (instance.templateId) {
    case 's1':
      await buildCover(slide, c, logoUrl, logoScale);
      break;
    case 's2':
      buildIndex(slide, c, num);
      break;
    case 's3':
      buildExecutiveSummary(slide, c, num);
      break;
    case 's4':
      await buildSectionDivider(slide, c, num, logoUrl, logoScale);
      break;
    case 's5':
      buildTwoColumnContext(slide, c, num);
      break;
    case 's6':
      buildDataMonument(slide, c);
      break;
    case 's7':
      buildMetricsDashboard(slide, c, num);
      break;
    case 's8':
      buildComparativeTable(slide, c, num);
      break;
    case 's9':
      buildStrategicRoadmap(slide, c, num);
      break;
    case 's10':
      await buildImageEditorial(slide, c);
      break;
    case 's11':
      buildProcessArchitecture(slide, c, num);
      break;
    case 's12':
      await buildGlobalMap(slide, c, num);
      break;
    case 's13':
      await buildFeaturedQuote(slide, c, num);
      break;
    case 's14':
      await buildExit(slide, c, logoUrl, logoScale);
      break;
    case 'blank':
      await buildBlank(slide, c, num);
      break;
    case 'imported':
      await buildImported(slide, c);
      break;
    default:
      break;
  }

  // Front-shapes last, so they sit over everything the template drew.
  await addOverlayShapes(slide, c, 'front');

  if (pageLabel && !c.hideFooter) {
    addText(slide, instance.title, box(64, 1032, 700, 24), {
      fontFace: FONT_MONO,
      size: 16,
      color: NEUTRAL_400,
      letterSpacingEm: 0.04,
    });
    addText(slide, pageLabel, box(1156, 1032, 700, 24), {
      fontFace: FONT_MONO,
      size: 16,
      color: NEUTRAL_400,
      align: 'right',
      letterSpacingEm: 0.04,
    });
  }
}
