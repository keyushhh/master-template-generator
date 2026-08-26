import type { Deck, SlideInstance, SlotStyle } from '../deck/types';
import {
  ALL_SWATCHES,
  FONT_CHOICES,
  LETTER_SPACINGS,
  LINE_HEIGHTS,
  TYPE_SCALE,
} from '../formatting/rails';
import { GRID } from '../formatting/snap';
import type { DeckTheme } from '../theme/deckTheme';
import { themePalette } from './brandCheck';

/**
 * Everywhere the deck has drifted off its own rails, and how to put it back.
 *
 * The formatting controls are built so the fast path is the on-brand path:
 * sizes step through a scale, colour comes from swatches, shapes snap to the
 * 120px grid. Every one of those has an escape hatch a keystroke deeper, which
 * is right - a client's own hex is a real thing to need - and nothing has ever
 * reported on how often it got used. After a week of edits by three people,
 * "is this deck still on brand?" had no answer short of clicking every slot.
 *
 * This asks the rails themselves. A finding is a value that is not one of the
 * offered ones, paired with the nearest offered one, so the fix is a value the
 * templates already use rather than a guess.
 *
 * Deliberately not a lint with a score. Off-brand on purpose is a legitimate
 * outcome, so every row is a suggestion the user can leave alone.
 */

export type DriftKind = 'size' | 'leading' | 'tracking' | 'font' | 'colour' | 'position';

export interface Drift {
  instanceId: string;
  slideTitle: string;
  /** 1-based position in the deck, hidden slides counted. */
  slideNumber: number;
  /** The slot key in `content.styles`, or `overlay:<shapeId>` for a shape. */
  slot: string;
  /** Human-readable name of what drifted, for the row. */
  slotLabel: string;
  kind: DriftKind;
  /** What is off, in the user's terms. */
  detail: string;
  /** What snapping back would do. */
  fix: string;
}

/** Nearest value on a rail. */
function nearest(value: number, rail: readonly number[]): number {
  return rail.reduce((best, step) => (Math.abs(step - value) < Math.abs(best - value) ? step : best), rail[0]);
}

function onRail(value: number, rail: readonly number[]): boolean {
  return rail.some((step) => Math.abs(step - value) < 0.001);
}

/** A slot key as a person would read it: 'bars.0.label' is a label on a bar. */
function labelForSlot(slot: string): string {
  if (slot.startsWith('overlay:')) return 'A text box you added';
  const parts = slot.split('.');
  const readable = parts[parts.length - 1].replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

function checkStyle(
  style: SlotStyle | undefined,
  slot: string,
  slide: SlideInstance,
  slideNumber: number,
  palette: Set<string>,
  out: Drift[]
): void {
  if (!style) return;
  const base = {
    instanceId: slide.instanceId,
    slideTitle: slide.title || 'Untitled slide',
    slideNumber,
    slot,
    slotLabel: labelForSlot(slot),
  };

  if (style.sizePx !== undefined && !onRail(style.sizePx, TYPE_SCALE)) {
    out.push({
      ...base,
      kind: 'size',
      detail: `${Math.round(style.sizePx)}px is not on the type scale`,
      fix: `Use ${nearest(style.sizePx, TYPE_SCALE)}px`,
    });
  }
  if (style.lineHeight !== undefined && !onRail(style.lineHeight, LINE_HEIGHTS)) {
    out.push({
      ...base,
      kind: 'leading',
      detail: `Leading of ${style.lineHeight} is not one of the deck's`,
      fix: `Use ${nearest(style.lineHeight, LINE_HEIGHTS)}`,
    });
  }
  if (style.letterSpacing !== undefined && !onRail(style.letterSpacing, LETTER_SPACINGS)) {
    out.push({
      ...base,
      kind: 'tracking',
      detail: `Tracking of ${style.letterSpacing}em is not one of the deck's`,
      fix: `Use ${nearest(style.letterSpacing, LETTER_SPACINGS)}em`,
    });
  }
  if (style.fontFamily && !FONT_CHOICES.some((f) => f.face === style.fontFamily)) {
    out.push({
      ...base,
      kind: 'font',
      detail: `${style.fontFamily} is not one of the three brand faces`,
      fix: 'Return to the template’s own face',
    });
  }
  if (style.color && !palette.has(style.color.replace('#', '').toUpperCase())) {
    out.push({
      ...base,
      kind: 'colour',
      detail: `#${style.color.replace('#', '').toUpperCase()} is not in the palette`,
      fix: 'Return to the template’s own colour',
    });
  }
}

/** Off the 120px grid by enough to see, in either axis. */
function offGrid(value: number): boolean {
  const remainder = Math.abs(value) % GRID;
  return remainder > 1 && remainder < GRID - 1;
}

/**
 * Every drift in a deck, in deck order.
 *
 * Only user overrides are examined. Template-drawn type and colour come from
 * the theme by construction, so it cannot drift; what an editor typed on top of
 * it can.
 */
export function auditDeck(deck: Deck, theme: DeckTheme): Drift[] {
  // The theme's own colours plus the swatches the picker offers: a value from
  // either is a value the app handed the user, so it is not drift.
  const palette = new Set([...themePalette(theme), ...ALL_SWATCHES.map((sw) => sw.hex.toUpperCase())]);
  const out: Drift[] = [];

  deck.slides.forEach((slide, i) => {
    const n = i + 1;
    for (const [slot, style] of Object.entries(slide.content.styles ?? {})) {
      checkStyle(style, slot, slide, n, palette, out);
    }

    for (const [slot, offset] of Object.entries(slide.content.offsets ?? {})) {
      if (!offset || (offset.dx === 0 && offset.dy === 0)) continue;
      if (offGrid(offset.dx) || offGrid(offset.dy)) {
        out.push({
          instanceId: slide.instanceId,
          slideTitle: slide.title || 'Untitled slide',
          slideNumber: n,
          slot,
          slotLabel: labelForSlot(slot),
          kind: 'position',
          detail: `Nudged ${Math.round(offset.dx)}, ${Math.round(offset.dy)} off the grid`,
          fix: 'Put it back where the template had it',
        });
      }
    }

    for (const shape of slide.content.overlay ?? []) {
      checkStyle(shape.style, `overlay:${shape.id}`, slide, n, palette, out);
      if (offGrid(shape.x) || offGrid(shape.y)) {
        out.push({
          instanceId: slide.instanceId,
          slideTitle: slide.title || 'Untitled slide',
          slideNumber: n,
          slot: `overlay:${shape.id}`,
          slotLabel: labelForSlot(`overlay:${shape.id}`),
          kind: 'position',
          detail: `Sits at ${Math.round(shape.x)}, ${Math.round(shape.y)}, off the 120px grid`,
          fix: 'Snap to the nearest grid line',
        });
      }
      if (shape.fill && !palette.has(shape.fill.replace('#', '').toUpperCase())) {
        out.push({
          instanceId: slide.instanceId,
          slideTitle: slide.title || 'Untitled slide',
          slideNumber: n,
          slot: `overlay:${shape.id}`,
          slotLabel: 'A shape you added',
          kind: 'colour',
          detail: `Fill #${shape.fill.replace('#', '').toUpperCase()} is not in the palette`,
          fix: 'Use the nearest palette colour',
        });
      }
    }
  });

  return out;
}

/** Snap one grid coordinate to the nearest brand line. */
function toGrid(value: number): number {
  return Math.round(value / GRID) * GRID;
}

/**
 * The deck with one drift put back on brand.
 *
 * Size, leading and tracking snap to the nearest rail value, because the user
 * clearly wanted a value near there. Font and colour drop the override
 * entirely: there is no "nearest face", and the template's own colour is a
 * better answer than the closest swatch to a hex somebody pasted.
 */
export function snapDrift(deck: Deck, drift: Drift): Deck {
  const slides = deck.slides.map((slide) => {
    if (slide.instanceId !== drift.instanceId) return slide;
    const content = { ...slide.content };

    if (drift.slot.startsWith('overlay:')) {
      const id = drift.slot.slice('overlay:'.length);
      content.overlay = (content.overlay ?? []).map((shape) => {
        if (shape.id !== id) return shape;
        if (drift.kind === 'position') return { ...shape, x: toGrid(shape.x), y: toGrid(shape.y) };
        if (drift.kind === 'colour' && shape.kind !== 'text') {
          const { fill: _drop, ...rest } = shape;
          return rest;
        }
        return { ...shape, style: snapStyle(shape.style, drift.kind) };
      });
      return { ...slide, content };
    }

    if (drift.kind === 'position') {
      const offsets = { ...(content.offsets ?? {}) };
      delete offsets[drift.slot];
      content.offsets = offsets;
      return { ...slide, content };
    }

    const styles = { ...(content.styles ?? {}) };
    const snapped = snapStyle(styles[drift.slot], drift.kind);
    if (snapped && Object.keys(snapped).length > 0) styles[drift.slot] = snapped;
    else delete styles[drift.slot];
    content.styles = styles;
    return { ...slide, content };
  });

  return { ...deck, slides };
}

function snapStyle(style: SlotStyle | undefined, kind: DriftKind): SlotStyle | undefined {
  if (!style) return style;
  const next: SlotStyle = { ...style };
  if (kind === 'size' && next.sizePx !== undefined) next.sizePx = nearest(next.sizePx, TYPE_SCALE);
  if (kind === 'leading' && next.lineHeight !== undefined) next.lineHeight = nearest(next.lineHeight, LINE_HEIGHTS);
  if (kind === 'tracking' && next.letterSpacing !== undefined) {
    next.letterSpacing = nearest(next.letterSpacing, LETTER_SPACINGS);
  }
  if (kind === 'font') delete next.fontFamily;
  if (kind === 'colour') delete next.color;
  return next;
}

/** Every drift in a deck, snapped in one pass. */
export function snapAll(deck: Deck, drifts: Drift[]): Deck {
  return drifts.reduce((acc, drift) => snapDrift(acc, drift), deck);
}
