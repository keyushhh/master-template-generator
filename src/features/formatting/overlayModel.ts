/**
 * Creating and reordering overlay shapes.
 *
 * Defaults matter here: an inserted shape should already look like it belongs
 * to the deck. New shapes land on the brand grid, at brand sizes, using the
 * house treatment (outlined = context, emerald-tinted = the payoff), so the
 * common case needs no styling at all.
 */

import type { OverlayShape, SlideContent } from '../deck/types';
import { GRID, SLIDE_H, SLIDE_W, clampToSlide, type Rect } from './snap';

let seq = 0;

/** Ids only need to be unique within a slide's overlay array. A counter plus a
 *  random suffix avoids collisions when a slide is duplicated. */
function mintId(kind: string): string {
  seq += 1;
  return `ov_${kind}_${seq}_${Math.random().toString(36).slice(2, 7)}`;
}

const NEUTRAL_200 = 'E5E5E5';
const NEUTRAL_900 = '171717';

/** Default geometry per kind, in design px and grid-aligned. */
const DEFAULTS: Record<OverlayShape['kind'], Rect> = {
  // A text box arrives sized to its one line of placeholder rather than to some
  // notional paragraph. An oversized empty box reads as a mistake, and it is
  // easier to drag a small box bigger than to work out why a huge one is empty.
  text: { x: 240, y: 480, w: 480, h: 60 },
  rect: { x: 240, y: 480, w: 480, h: 240 },
  ellipse: { x: 240, y: 480, w: 240, h: 240 },
  image: { x: 240, y: 360, w: 600, h: 360 },
  table: { x: 240, y: 360, w: 900, h: 300 },
  chart: { x: 240, y: 300, w: 800, h: 480 },
};

const TABLE_ROWS = 3;
const TABLE_COLS = 3;

/**
 * Builds a new shape.
 *
 * `existingCount` cascades each insertion down-right by one grid cell, so
 * inserting three rectangles in a row gives three visible shapes rather than
 * one shape with two hidden underneath it.
 */
export function createOverlayShape(
  kind: OverlayShape['kind'],
  existingCount = 0
): OverlayShape {
  const base = DEFAULTS[kind];
  const step = (existingCount % 6) * (GRID / 2);
  const rect = clampToSlide({
    ...base,
    x: Math.min(base.x + step, SLIDE_W - base.w - GRID),
    y: Math.min(base.y + step, SLIDE_H - base.h - GRID),
  });

  const shape: OverlayShape = { id: mintId(kind), kind, ...rect };

  if (kind === 'text') {
    shape.text = 'Text';
    // Body scale, ink colour - matches what the templates use for copy, so an
    // inserted note reads as part of the deck rather than as a sticky note.
    shape.style = { sizePx: 32, color: NEUTRAL_900 };
    shape.vAlign = 'top';
  } else if (kind === 'rect' || kind === 'ellipse') {
    // Outlined by default: in the house system an outline means context, and a
    // fill means "this is the point". Context is the safer default - a filled
    // shape dropped onto a slide would claim emphasis the user didn't ask for.
    shape.line = { color: NEUTRAL_200, widthPx: 1 };
  } else if (kind === 'table') {
    // A plain 3x3 starter grid, PowerPoint's own default table insert -
    // equal columns, empty cells the user fills in by double-clicking.
    const colW = rect.w / TABLE_COLS;
    const rowH = rect.h / TABLE_ROWS;
    shape.colWidthsPx = Array.from({ length: TABLE_COLS }, () => colW);
    shape.rows = Array.from({ length: TABLE_ROWS }, () => ({
      heightPx: rowH,
      cells: Array.from({ length: TABLE_COLS }, () => ({})),
    }));
  } else if (kind === 'chart') {
    // Sample data so the chart is legible the instant it lands, rather than an
    // empty axis the user has to populate before it means anything.
    shape.chartType = 'bar';
    shape.chartCategories = ['Q1', 'Q2', 'Q3', 'Q4'];
    shape.chartSeries = [{ name: 'Series 1', values: [30, 45, 60, 80] }];
  }
  return shape;
}

/** Reads a slide's overlay array, always as an array. */
export function overlayOf(content: SlideContent): OverlayShape[] {
  return content.overlay ?? [];
}

/** Writes an overlay array back, dropping the key entirely when empty so an
 *  untouched slide carries no trace of the feature. */
export function withOverlay(content: SlideContent, next: OverlayShape[]): SlideContent {
  const out = { ...content };
  if (next.length) out.overlay = next;
  else delete out.overlay;
  return out;
}

export type LayerMove = 'front' | 'forward' | 'backward' | 'back';

/**
 * Reorders one shape within the array. Array order *is* z-order (later paints
 * later), so "bring to front" means moving to the end.
 */
export function moveLayer(shapes: OverlayShape[], id: string, move: LayerMove): OverlayShape[] {
  const i = shapes.findIndex((s) => s.id === id);
  if (i < 0) return shapes;
  const next = [...shapes];
  const [item] = next.splice(i, 1);
  const target =
    move === 'front' ? next.length
      : move === 'back' ? 0
        : move === 'forward' ? Math.min(next.length, i + 1)
          : Math.max(0, i - 1);
  next.splice(target, 0, item);
  return next;
}

/** True when the shape is already as far forward/back as it can go - lets the
 *  layer buttons disable rather than silently doing nothing. */
export function layerBounds(shapes: OverlayShape[], id: string) {
  const i = shapes.findIndex((s) => s.id === id);
  return { isFirst: i <= 0, isLast: i === shapes.length - 1, index: i, total: shapes.length };
}

/** Short human label for the layer list. */
export function shapeLabel(s: OverlayShape): string {
  if (s.kind === 'text') {
    const t = (s.text ?? '').replace(/\s+/g, ' ').trim();
    return t ? (t.length > 24 ? `${t.slice(0, 24)}…` : t) : 'Text box';
  }
  if (s.kind === 'image') return 'Image';
  if (s.kind === 'table') return 'Table';
  if (s.kind === 'chart') return 'Chart';
  return s.kind === 'ellipse' ? 'Ellipse' : 'Rectangle';
}
