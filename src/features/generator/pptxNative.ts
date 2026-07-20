import type pptxgen from 'pptxgenjs';
import type { SlideInstance, ComparisonRow } from '../deck/types';

/**
 * Native (editable) pptxgenjs equivalent of PresentationCanvas.tsx's DOM
 * renderers, one per template. The 1920x1080px slide space maps onto
 * pptxgenjs' 10x5.625in layout at a fixed 192px/inch.
 */

const PX_PER_IN = 192;
const PX_TO_PT = 0.375; // 1 design-px == 0.375pt at 192px/in, 72pt/in

const inch = (px: number) => px / PX_PER_IN;
const pt = (px: number) => Math.round(px * PX_TO_PT * 100) / 100;
const tracking = (fontPx: number, em: number) => Math.round(fontPx * em * PX_TO_PT * 100) / 100;

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
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(245,245,245,0.8)';
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
  if (cfg.grid) drawGrid(ctx, canvas.width, canvas.height);
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
  color?: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  lineSpacingMultiple?: number;
  letterSpacingEm?: number;
  charSpacing?: number; // pt, takes precedence over letterSpacingEm
  transparency?: number;
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
  o: TextOpts
) {
  const runs = typeof text === 'string' && text.includes('\n') ? splitLines(text) : text;
  slide.addText(runs, {
    ...b,
    fontFace: o.fontFace ?? FONT_DISPLAY,
    fontSize: pt(o.size),
    bold: o.bold,
    italic: o.italic,
    color: o.color ?? NEUTRAL_900,
    align: o.align ?? 'left',
    valign: o.valign ?? 'top',
    lineSpacingMultiple: o.lineSpacingMultiple,
    charSpacing: o.charSpacing ?? (o.letterSpacingEm ? tracking(o.size, o.letterSpacingEm) : undefined),
    transparency: o.transparency,
    wrap: true,
    fit: 'none',
    margin: 0,
    autoFit: false,
  });
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

/** Top HUD bar shared by most light templates: label left, slide number right, hairline rule below. */
function addHudTop(slide: pptxgen.Slide, label: string, num: string) {
  addText(slide, label.toUpperCase(), box(80, 55, 800, 30), {
    fontFace: FONT_MONO,
    size: 12,
    color: NEUTRAL_500,
    letterSpacingEm: 0.12,
    valign: 'bottom',
  });
  addText(slide, num.toUpperCase(), box(1040, 55, 800, 30), {
    fontFace: FONT_MONO,
    size: 12,
    color: NEUTRAL_500,
    align: 'right',
    letterSpacingEm: 0.12,
    valign: 'bottom',
  });
  addLine(slide, 80, 92, 1840, 92, NEUTRAL_200, 1);
}

/** Editorial eyebrow label: short emerald rule + tracked mono uppercase text. */
function addEditorialLabel(slide: pptxgen.Slide, text: string, xPx: number, yPx: number, opts?: { size?: number; center?: boolean; color?: string }) {
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
    });
  } else {
    addLine(slide, xPx, yPx + size / 2 + 3, xPx + 40, yPx + size / 2 + 3, EMERALD_500, 1);
    addText(slide, text.toUpperCase(), box(xPx + 55, yPx, 900, size + 14), {
      fontFace: FONT_MONO,
      size,
      color,
      letterSpacingEm: 0.25,
      bold: true,
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
async function addLogo(slide: pptxgen.Slide, logoUrl: string | undefined, xPx: number, yPx: number, dark = false) {
  if (logoUrl) {
    await addImageContain(slide, logoUrl, box(xPx, yPx, 260, 42));
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

async function buildCover(slide: pptxgen.Slide, content: SlideInstance['content'], logoUrl?: string) {
  const lines = content.headingLines?.length ? content.headingLines : ['Master Primary', 'Heading', 'Variable.'];
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const heroFont = Math.round(Math.max(72, Math.min(180, 1640 / (longest * 0.6), 620 / (lines.length * 0.95))));
  const heroTopPad = lines.length >= 4 ? 160 : lines.length === 3 ? 210 : 280;

  addHudTop(slide, content.projectLabel ?? 'Project Name Placeholder', content.versionLabel ?? 'YYYY // Version 0.0');
  addEditorialLabel(slide, content.eyebrow ?? 'Presentation Subtitle', 140, heroTopPad);

  const headingH = lines.length * heroFont * 0.85 * PX_TO_PT * (PX_PER_IN / 72);
  const runs: pptxgen.TextProps[] = lines.map((line, i) => ({
    text: line,
    options: {
      ...(i > 0 ? { softBreakBefore: true } : {}),
      ...(i === lines.length - 1 && lines.length > 1 ? { color: NEUTRAL_300 } : {}),
    },
  }));
  addText(slide, runs, box(140, heroTopPad + 55, 1680, headingH + 40), {
    size: heroFont,
    bold: true,
    lineSpacingMultiple: 0.9,
  });

  const taglineY = heroTopPad + 55 + headingH + 100;
  addLine(slide, 140, taglineY + 7, 260, taglineY + 7, EMERALD_500, 1);
  addText(slide, content.tagline ?? PLACEHOLDER, box(280, taglineY - 8, 1500, 40), {
    fontFace: FONT_MONO,
    size: 14,
    color: NEUTRAL_500,
    letterSpacingEm: 0.25,
  });

  addText(slide, 'PROPRIETARY AND CONFIDENTIAL', box(80, 1000, 500, 26), {
    fontFace: FONT_MONO,
    size: 11,
    color: NEUTRAL_400,
  });
  await addLogo(slide, logoUrl, 1580, 995);
}

const DEFAULT_INDEX_PARTS = [
  { title: 'Introduction', description: PLACEHOLDER },
  { title: 'Context', description: PLACEHOLDER },
  { title: 'Performance', description: PLACEHOLDER },
  { title: 'Strategy', description: PLACEHOLDER },
];

function buildIndex(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  const parts = content.parts?.length ? content.parts : DEFAULT_INDEX_PARTS;
  addHudTop(slide, content.hudLabel ?? 'Agenda', num);
  addEditorialLabel(slide, 'Navigation', 140, 160);
  addText(slide, content.heading ?? 'Presentation\nStructure.', box(140, 215, 620, 260), {
    size: 100,
    bold: true,
    lineSpacingMultiple: 0.9,
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
    addText(slide, part.title, box(cx + 30, cy + 30, colW - 30, 50), { size: 32, bold: true, lineSpacingMultiple: 1.05 });
    addText(slide, part.description, box(cx + 30, cy + 85, colW - 30, 120), {
      size: 18,
      color: NEUTRAL_500,
      lineSpacingMultiple: 1.5,
    });
  });
}

function buildExecutiveSummary(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  addHudTop(slide, content.hudLabel ?? 'Executive Summary', num);
  addText(slide, content.heading ?? 'Core Strategic\nObjective.', box(140, 160, 1640, 220), {
    size: 100,
    bold: true,
    lineSpacingMultiple: 0.9,
  });
  const bodyY = 460;
  addText(slide, content.body ?? PLACEHOLDER, box(140, bodyY, 760, 400), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: NEUTRAL_500,
    lineSpacingMultiple: 1.5,
  });
  addRect(slide, box(1020, bodyY, 760, 400), NEUTRAL_50, { color: NEUTRAL_200, widthPx: 1 });
  addEditorialLabel(slide, content.metricLabel ?? 'Variable Metric', 1080, bodyY + 60);
  addText(slide, content.metricText ?? PLACEHOLDER, box(1080, bodyY + 110, 640, 260), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: NEUTRAL_900,
    lineSpacingMultiple: 1.5,
  });
}

async function buildSectionDivider(slide: pptxgen.Slide, content: SlideInstance['content'], num: string, logoUrl?: string) {
  await addLogo(slide, logoUrl, 80, 60, true);
  addEditorialLabel(slide, content.eyebrow ?? 'Section Marker', 960, 380, { center: true, color: EMERALD_400 });
  addText(slide, content.heading ?? 'Section Title.', box(160, 440, 1600, 260), {
    size: 240,
    bold: true,
    color: WHITE,
    align: 'center',
  });
  addText(slide, content.subtitle ?? PLACEHOLDER, box(460, 720, 1000, 80), {
    fontFace: FONT_MONO,
    size: 20,
    color: 'CCCCCC',
    transparency: 60,
    align: 'center',
    letterSpacingEm: 0.38,
    lineSpacingMultiple: 1.4,
  });
  void num;
}

const DEFAULT_ATTRIBUTES = ['Placeholder Attribute', 'Placeholder Attribute', 'Placeholder Attribute'];

function buildTwoColumnContext(slide: pptxgen.Slide, content: SlideInstance['content'], num: string) {
  const attributes = content.leftAttributes?.length ? content.leftAttributes : DEFAULT_ATTRIBUTES;
  addHudTop(slide, content.hudLabel ?? 'Strategic Context', num);
  addLine(slide, 960, 0, 960, 1080, NEUTRAL_200, 1);

  addEditorialLabel(slide, content.leftLabel ?? 'Condition A', 140, 250);
  addText(slide, content.leftHeading ?? 'Current State\nEnvironment.', box(140, 305, 700, 200), {
    size: 72,
    bold: true,
    lineSpacingMultiple: 0.9,
  });
  addText(slide, content.leftBody ?? PLACEHOLDER, box(140, 515, 700, 160), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: NEUTRAL_500,
    lineSpacingMultiple: 1.5,
  });
  const attrRuns: pptxgen.TextProps[] = attributes.flatMap((a, i) => [
    { text: `[${String(i + 1).padStart(2, '0')}] ${a}`, options: { breakLine: true } },
  ]);
  addText(slide, attrRuns, box(140, 690, 700, 180), {
    fontFace: FONT_MONO,
    size: 20,
    color: NEUTRAL_400,
    lineSpacingMultiple: 1.6,
  });

  addRect(slide, box(960, 0, 960, 1080), NEUTRAL_50);
  addEditorialLabel(slide, content.rightLabel ?? 'Condition B', 1000, 250);
  addText(slide, content.rightHeading ?? 'Strategic Pivot\nTarget State.', box(1000, 305, 780, 200), {
    size: 72,
    bold: true,
    lineSpacingMultiple: 0.9,
  });
  addText(slide, content.rightBody ?? PLACEHOLDER, box(1000, 515, 780, 300), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: NEUTRAL_900,
    lineSpacingMultiple: 1.5,
  });
}

function buildDataMonument(slide: pptxgen.Slide, content: SlideInstance['content']) {
  addEditorialLabel(slide, content.eyebrow ?? 'Performance Metric', 140, 260);
  const runs: pptxgen.TextProps[] = [
    { text: content.value ?? '000.0', options: {} },
    { text: ` ${content.unit ?? 'M'}`, options: { color: EMERALD_500, fontSize: pt(420 * 0.3) } },
  ];
  addText(slide, runs, box(140, 305, 1600, 330), { size: 420, bold: true, lineSpacingMultiple: 0.8 });
  addText(slide, content.heading ?? 'Primary Performance Variable Title.', box(140, 630, 1600, 100), {
    size: 64,
    bold: true,
    lineSpacingMultiple: 0.95,
  });
  addText(slide, content.body ?? PLACEHOLDER, box(140, 745, 800, 220), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: NEUTRAL_500,
    lineSpacingMultiple: 1.5,
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
  addHudTop(slide, content.hudLabel ?? 'Metrics Dashboard', num);
  addEditorialLabel(slide, content.eyebrow ?? 'Temporal Performance', 140, 260);

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
    });
  });

  const kpiY = 750;
  const kpiColW = (1640 - 40 * 2) / 3;
  kpis.slice(0, 3).forEach((k, i) => {
    const x = 140 + i * (kpiColW + 40);
    addEditorialLabel(slide, k.label, x, kpiY, { size: 10 });
    addText(slide, k.value, box(x, kpiY + 40, kpiColW, 90), { size: 64, bold: true, lineSpacingMultiple: 0.95 });
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
  addHudTop(slide, content.hudLabel ?? 'Comparative Framework', num);
  addEditorialLabel(slide, content.eyebrow ?? 'Benchmark Comparison', 140, 260);

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

  const bodyRows: pptxgen.TableRow[] = rows.map((r) => [
    { text: r.dim, options: {} },
    { text: r.cur, options: {} },
    { text: r.tgt, options: {} },
    { text: r.delta, options: { color: EMERALD_600 } },
  ].map((c) => ({
    text: c.text,
    options: {
      fontFace: FONT_DISPLAY,
      fontSize: pt(cellFont),
      color: c.options.color ?? NEUTRAL_900,
      border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', color: NEUTRAL_200, pt: 0.75 }, { type: 'none' }],
      valign: 'top',
    },
  })));

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
  addHudTop(slide, content.hudLabel ?? 'Execution Timeline', num);
  addEditorialLabel(slide, content.eyebrow ?? 'Milestone Projection', 140, 260);
  addText(slide, content.heading ?? 'Pathway to Execution.', box(140, 315, 1640, 100), { size: 100, bold: true });

  const railY = 512;
  addLine(slide, 140, railY, 1780, railY, NEUTRAL_200, 2);

  const itemW = 320;
  const n = phases.length;
  const totalW = 1640;
  const spacing = n > 1 ? (totalW - itemW) / (n - 1) : 0;
  phases.forEach((p, i) => {
    const x = 140 + i * spacing;
    addCircle(slide, box(x, railY - 12, 24, 24), p.completed ? EMERALD_500 : NEUTRAL_300);
    addEditorialLabel(slide, `Phase ${String(i + 1).padStart(2, '0')}`, x, railY + 42, { size: 12 });
    addText(slide, p.title, box(x, railY + 85, itemW, 60), { size: 32, bold: true, lineSpacingMultiple: 1.05 });
    addText(slide, p.description || PLACEHOLDER, box(x, railY + 140, itemW, 140), {
      fontFace: FONT_DISPLAY,
      size: 18,
      color: NEUTRAL_500,
      lineSpacingMultiple: 1.5,
    });
  });
}

async function buildImageEditorial(slide: pptxgen.Slide, content: SlideInstance['content']) {
  const showImage = !content.hideImage;
  const leftW = showImage ? 873 : 1920;
  const textPad = showImage ? 140 : 360;
  addEditorialLabel(slide, content.eyebrow ?? 'Visual Narrative', 140, 400);
  addText(slide, content.heading ?? 'Primary Insight Statement.', box(140, 455, leftW - textPad, 260), {
    size: 100,
    bold: true,
    lineSpacingMultiple: 0.95,
  });
  addText(slide, content.body ?? PLACEHOLDER, box(140, 700, leftW - textPad - 60, 260), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: NEUTRAL_500,
    lineSpacingMultiple: 1.5,
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
  addHudTop(slide, content.hudLabel ?? 'System Logic', num);
  addEditorialLabel(slide, content.eyebrow ?? 'Architectural Protocol', 140, 260);
  addText(slide, content.heading ?? 'Operational Flow.', box(140, 315, 1640, 100), { size: 100, bold: true });

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
    addText(slide, s.title, box(x + 40, top + 110, colW - 80, 60), { size: 32, bold: true, lineSpacingMultiple: 1.05 });
    addText(slide, s.description || PLACEHOLDER, box(x + 40, top + 170, colW - 80, h - 200), {
      fontFace: FONT_DISPLAY,
      size: 18,
      color: NEUTRAL_500,
      lineSpacingMultiple: 1.5,
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
  addHudTop(slide, content.hudLabel ?? 'Reach Distribution', num);
  addText(slide, content.heading ?? 'Regional Impact.', box(140, 160, 1640, 100), { size: 100, bold: true });

  const showMap = !content.hideImage;
  if (showMap) {
    const mapBox = box(140, 320, 1640, 480);
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
      addCircle(slide, box(140 + 1640 * 0.22 - 10, 320 + 480 * 0.35 - 10, 20, 20), EMERALD_500);
      addCircle(slide, box(140 + 1640 * 0.62 - 10, 320 + 480 * 0.45 - 10, 20, 20), EMERALD_500);
    }
  }

  const sectorY = showMap ? 840 : 340;
  const gap = 100;
  const colW = (1640 - gap * (sectors.length - 1)) / Math.max(sectors.length, 1);
  sectors.forEach((s, i) => {
    const x = 140 + i * (colW + gap);
    addEditorialLabel(slide, s.label, x, sectorY, { size: 10 });
    addText(slide, s.value, box(x, sectorY + 40, colW, 50), { size: 24, bold: true });
  });
  void num;
}

async function buildFeaturedQuote(slide: pptxgen.Slide, content: SlideInstance['content']) {
  addEditorialLabel(slide, content.eyebrow ?? 'Key Insight', 140, 300);
  addText(slide, `“${content.quote ?? PLACEHOLDER}”`, box(140, 355, 1640, 380), {
    size: 110,
    bold: true,
    lineSpacingMultiple: 0.95,
  });

  const avatarY = 800;
  if (content.avatarUrl) {
    slide.addImage({ data: content.avatarUrl, x: inch(140), y: inch(avatarY), w: inch(80), h: inch(80), rounding: true });
  } else {
    addCircle(slide, box(140, avatarY, 80, 80), NEUTRAL_200);
  }
  addText(slide, content.author ?? 'Author Name', box(245, avatarY + 4, 700, 50), { size: 28, bold: true });
  addText(slide, content.role ?? 'Author Title Placeholder', box(245, avatarY + 46, 700, 40), {
    fontFace: FONT_MONO,
    size: 18,
    color: NEUTRAL_500,
  });
}

const DEFAULT_CONTACTS = ['email@placeholder.com', '@social_handle', 'www.domain.com'];

async function buildExit(slide: pptxgen.Slide, content: SlideInstance['content'], logoUrl?: string) {
  await addLogo(slide, logoUrl, 80, 60, true);
  addEditorialLabel(slide, content.eyebrow ?? 'Conclusion', 140, 360, { color: EMERALD_400 });
  addText(slide, content.heading ?? 'Thank You.', box(140, 415, 1600, 280), { size: 180, bold: true, color: WHITE });
  addText(slide, content.body ?? PLACEHOLDER, box(140, 700, 800, 200), {
    fontFace: FONT_DISPLAY,
    size: 32,
    color: 'CCCCCC',
    transparency: 50,
    lineSpacingMultiple: 1.5,
  });

  const contacts = content.contacts?.length ? content.contacts : DEFAULT_CONTACTS;
  const runs: pptxgen.TextProps[] = contacts.flatMap((c, i) => [
    { text: c + (i < contacts.length - 1 ? '   ' : ''), options: {} },
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
    });
    addText(slide, num, box(1040, 55, 800, 30), { fontFace: FONT_MONO, size: 12, color: WHITE, align: 'right' });
    addEditorialLabel(slide, content.eyebrow ?? 'Section', 140, 780, { color: EMERALD_400 });
    addText(slide, content.heading ?? 'Blank Slide.', box(140, 835, 1600, 110), { size: 72, bold: true, color: WHITE });
    addText(slide, content.body ?? 'Click to add your content…', box(140, 955, 1200, 100), {
      fontFace: FONT_DISPLAY,
      size: 28,
      color: 'DDDDDD',
      lineSpacingMultiple: 1.5,
    });
    return;
  }

  if (layout === 'two-column') {
    addHudTop(slide, content.hudLabel ?? 'Custom Slide', num);
    addEditorialLabel(slide, content.eyebrow ?? 'Section', 140, 200);
    addText(slide, content.heading ?? 'Blank Slide.', box(140, 255, 780, 180), { size: 64, bold: true, lineSpacingMultiple: 0.95 });
    addText(slide, content.body ?? 'Click to add your content…', box(140, 460, 780, 400), {
      fontFace: FONT_DISPLAY,
      size: 28,
      color: NEUTRAL_500,
      lineSpacingMultiple: 1.5,
    });
    const imgBox = box(1000, 160, 780, 760);
    if (content.imageUrl) {
      addImageCover(slide, content.imageUrl, imgBox);
    } else {
      addRect(slide, imgBox, NEUTRAL_100);
      addText(slide, 'CLICK TO ADD AN IMAGE', imgBox, {
        fontFace: FONT_MONO,
        size: 18,
        color: NEUTRAL_400,
        align: 'center',
        valign: 'middle',
        letterSpacingEm: 0.12,
      });
    }
    return;
  }

  // standard
  addHudTop(slide, content.hudLabel ?? 'Custom Slide', num);
  addEditorialLabel(slide, content.eyebrow ?? 'Section', 140, 200);
  addText(slide, content.heading ?? 'Blank Slide.', box(140, 255, 1640, 130), { size: 88, bold: true });
  addText(slide, content.body ?? 'Click to add your content…', box(140, 400, 1200, 200), {
    fontFace: FONT_DISPLAY,
    size: 28,
    color: NEUTRAL_500,
    lineSpacingMultiple: 1.5,
  });
  if (content.imageUrl && !content.hideImage) {
    addImageCover(slide, content.imageUrl, box(140, 620, 1640, 380));
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
  pageLabel?: string
): Promise<void> {
  const c = instance.content;

  if (instance.templateId === 'blank') {
    const layout = c.blankLayout ?? 'standard';
    applyBackground(slide, layout === 'full-bleed' ? { base: WHITE } : { base: WHITE, grid: true });
  } else {
    applyBackground(slide, DECOR[instance.templateId] ?? { base: WHITE });
  }

  switch (instance.templateId) {
    case 's1':
      await buildCover(slide, c, logoUrl);
      break;
    case 's2':
      buildIndex(slide, c, num);
      break;
    case 's3':
      buildExecutiveSummary(slide, c, num);
      break;
    case 's4':
      await buildSectionDivider(slide, c, num, logoUrl);
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
      await buildFeaturedQuote(slide, c);
      break;
    case 's14':
      await buildExit(slide, c, logoUrl);
      break;
    case 'blank':
      await buildBlank(slide, c, num);
      break;
    default:
      break;
  }

  if (pageLabel) {
    addText(slide, instance.title, box(64, 1032, 700, 24), {
      fontFace: FONT_MONO,
      size: 10.5,
      color: NEUTRAL_400,
      letterSpacingEm: 0.04,
    });
    addText(slide, pageLabel, box(1156, 1032, 700, 24), {
      fontFace: FONT_MONO,
      size: 10.5,
      color: NEUTRAL_400,
      align: 'right',
      letterSpacingEm: 0.04,
    });
  }
}
