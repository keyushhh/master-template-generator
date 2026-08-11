/**
 * Positioning rails for inserted shapes.
 *
 * A free-drag canvas is what makes generic editors produce misaligned decks:
 * nothing lines up unless the user aligns it by eye. The brand already has a
 * geometry - a 120px grid and 80/140px margins - so dragging snaps to that by
 * default. The result is that the fastest way to place a shape is also the
 * correctly-aligned way, and a deck full of user-inserted boxes still looks
 * like it was laid out on purpose.
 *
 * Holding Alt suspends snapping entirely, which is the escape hatch.
 */

export const SLIDE_W = 1920;
export const SLIDE_H = 1080;

/** The brand's hairline grid pitch - the same 120px used by SlideGrid and the
 *  exporter's drawGrid. */
export const GRID = 120;

/** Fine step used when a drag isn't near any brand line. Keeps values round
 *  without forcing everything onto a coarse 120px lattice. */
export const FINE = 20;

/** How close (in design px) a dragged edge must come to a brand line before it
 *  snaps to it. Generous enough to feel magnetic, tight enough that you can
 *  still place something deliberately between two gridlines. */
export const MAGNET = 14;

/** The layout margins the 14 templates actually use: 80px for HUD/footer
 *  furniture, 140px for body content. Snapping to these is what makes an
 *  inserted box line up with the heading above it. */
const GUIDES_X = [80, 140, 960, 1780, 1840];
const GUIDES_Y = [80, 92, 160, 260, 540, 920, 1000];

function lines(axis: 'x' | 'y'): number[] {
  const guides = axis === 'x' ? GUIDES_X : GUIDES_Y;
  const extent = axis === 'x' ? SLIDE_W : SLIDE_H;
  const grid: number[] = [];
  for (let v = 0; v <= extent; v += GRID) grid.push(v);
  return [...grid, ...guides];
}

/** Snaps one coordinate: to a brand line if within MAGNET, else to FINE. */
export function snapValue(v: number, axis: 'x' | 'y', free: boolean): number {
  if (free) return Math.round(v);
  let best: number | undefined;
  let bestDist = MAGNET + 1;
  for (const l of lines(axis)) {
    const d = Math.abs(l - v);
    if (d < bestDist) { bestDist = d; best = l; }
  }
  if (best !== undefined && bestDist <= MAGNET) return best;
  return Math.round(v / FINE) * FINE;
}

export interface Rect { x: number; y: number; w: number; h: number }

/** Minimum size, so a shape can never be resized into something unclickable. */
export const MIN_SIZE = 24;

/**
 * Snaps a moved rect. Both edges are considered on each axis and the better
 * match wins, so dragging a box to sit flush against a gridline works whether
 * you're thinking about its left edge or its right.
 */
export function snapMove(r: Rect, free: boolean): Rect {
  const snapAxis = (pos: number, size: number, axis: 'x' | 'y') => {
    const lead = snapValue(pos, axis, free);
    const trail = snapValue(pos + size, axis, free) - size;
    return Math.abs(lead - pos) <= Math.abs(trail - pos) ? lead : trail;
  };
  return {
    x: snapAxis(r.x, r.w, 'x'),
    y: snapAxis(r.y, r.h, 'y'),
    w: Math.round(r.w),
    h: Math.round(r.h),
  };
}

/** The eight resize handles, named by the edges they move. */
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * Applies a resize drag. Only the edges the handle owns move, and each moved
 * edge snaps independently - so resizing the right edge of a box leaves its
 * left edge exactly where the user put it.
 */
export function snapResize(start: Rect, handle: Handle, dx: number, dy: number, free: boolean): Rect {
  let { x, y, w, h } = start;
  const right = start.x + start.w;
  const bottom = start.y + start.h;

  if (handle.includes('w')) {
    const nx = snapValue(start.x + dx, 'x', free);
    x = Math.min(nx, right - MIN_SIZE);
    w = right - x;
  }
  if (handle.includes('e')) {
    const nr = snapValue(right + dx, 'x', free);
    w = Math.max(MIN_SIZE, nr - start.x);
  }
  if (handle.includes('n')) {
    const ny = snapValue(start.y + dy, 'y', free);
    y = Math.min(ny, bottom - MIN_SIZE);
    h = bottom - y;
  }
  if (handle.includes('s')) {
    const nb = snapValue(bottom + dy, 'y', free);
    h = Math.max(MIN_SIZE, nb - start.y);
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/** Keeps a rect at least partially on the slide, so a shape can't be dragged
 *  into the void and become unreachable. */
export function clampToSlide(r: Rect): Rect {
  const margin = MIN_SIZE;
  return {
    ...r,
    x: Math.min(SLIDE_W - margin, Math.max(margin - r.w, r.x)),
    y: Math.min(SLIDE_H - margin, Math.max(margin - r.h, r.y)),
  };
}
