/**
 * Moving several template slots as one block.
 *
 * Two deliberate limits, both there to keep this a template tool rather than a
 * blank canvas:
 *
 *  - **A group moves, it does not rearrange.** Every action produces a single
 *    delta applied to every member, so the relative positions the template
 *    chose are preserved exactly. There is no "distribute" or "align these to
 *    each other", because those are the operations that turn a designed layout
 *    into an arbitrary one.
 *  - **Alignment is to the slide, not freeform.** The targets are the margins
 *    and centre lines the 14 templates already use, so a re-aligned block lands
 *    on the same geometry as everything the generator produced. You cannot
 *    align a block to 137px.
 *
 * Positions have to be measured from the DOM rather than read from the model:
 * template slots are laid out by their renderer (flex, padding, hero sizes
 * computed from the title's length), so their coordinates exist only once the
 * browser has laid them out.
 */

import { SLIDE_H, SLIDE_W } from './snap';

/** The E primitive's edit-mode hit-area padding, in design px. Slots get this
 *  so a 10px eyebrow is still clickable; measurement has to subtract it again
 *  or a group's box would read 16px wider than the text actually is, and every
 *  alignment would sit visibly short of the margin. Kept here next to the code
 *  that removes it, and imported by the canvas that adds it, so the two can
 *  never drift apart. */
export const HIT_PAD_X = 8;
export const HIT_PAD_Y = 6;

export interface GroupBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a group can be aligned to. The x values are the body margin (140),
 *  the slide centre (960) and the right margin (1780); the y values are the
 *  top margin, the vertical centre and the footer line - the same guides
 *  inserted shapes snap to. */
export type GroupAlign =
  | 'left' | 'hcenter' | 'right'
  | 'top' | 'vcenter' | 'bottom';

export const LEFT_MARGIN = 140;
export const RIGHT_MARGIN = SLIDE_W - LEFT_MARGIN;
export const TOP_MARGIN = 160;
export const BOTTOM_MARGIN = SLIDE_H - 160;

export const GROUP_ALIGNMENTS: { key: GroupAlign; label: string; hint: string }[] = [
  { key: 'left', label: 'Left margin', hint: '140' },
  { key: 'hcenter', label: 'Centre across', hint: '960' },
  { key: 'right', label: 'Right margin', hint: '1780' },
  { key: 'top', label: 'Top margin', hint: '160' },
  { key: 'vcenter', label: 'Centre down', hint: '540' },
  { key: 'bottom', label: 'Bottom margin', hint: '920' },
];

/** The rendered extent of one slot, in the slide's 1920x1080 design space.
 *
 *  A slot inside a frame (an eyebrow and its emerald rule) measures the whole
 *  unit, because that is what the user sees as the object and what a move will
 *  actually shift. Returns null for a slot that isn't currently rendered - a
 *  template switch can leave a selection pointing at a slot the new layout
 *  doesn't have. */
export function measureSlot(slideEl: HTMLElement, slot: string): GroupBox | null {
  const el = slideEl.querySelector<HTMLElement>(`[data-slot="${CSS.escape(slot)}"]`);
  if (!el) return null;

  const slide = slideEl.getBoundingClientRect();
  // The slide is CSS-scaled to fit the viewport, so screen px must be divided
  // back out to design px before anything can be compared to a 140px margin.
  const scale = slide.width ? slide.width / SLIDE_W : 1;
  if (!scale) return null;

  const frame = el.closest<HTMLElement>('[data-slot-frame]');
  const owned = frame?.dataset.slotFrame === slot;

  let left: number;
  let top: number;
  let right: number;
  let bottom: number;

  if (owned && frame) {
    // Union of the frame's children, not the frame's own box: the frame is a
    // block-level flex row that spans the full content width, so its rect says
    // nothing about where the label's ink actually is.
    left = Infinity; top = Infinity; right = -Infinity; bottom = -Infinity;
    for (const child of Array.from(frame.children)) {
      const r = child.getBoundingClientRect();
      const isSlot = child === el || child.contains(el);
      // Only the editable span carries the hit padding.
      const px = isSlot ? HIT_PAD_X * scale : 0;
      const py = isSlot ? HIT_PAD_Y * scale : 0;
      left = Math.min(left, r.left + px);
      top = Math.min(top, r.top + py);
      right = Math.max(right, r.right - px);
      bottom = Math.max(bottom, r.bottom - py);
    }
    if (!Number.isFinite(left)) return null;
  } else {
    const r = el.getBoundingClientRect();
    left = r.left + HIT_PAD_X * scale;
    top = r.top + HIT_PAD_Y * scale;
    right = r.right - HIT_PAD_X * scale;
    bottom = r.bottom - HIT_PAD_Y * scale;
  }

  return {
    x: (left - slide.left) / scale,
    y: (top - slide.top) / scale,
    w: (right - left) / scale,
    h: (bottom - top) / scale,
  };
}

/** The union box of a whole selection, or null if none of it is on screen. */
export function measureGroup(slideEl: HTMLElement, slots: string[]): GroupBox | null {
  const boxes = slots.map((s) => measureSlot(slideEl, s)).filter((b): b is GroupBox => !!b);
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * The one delta that lands `box` on an alignment target.
 *
 * Only one axis ever moves. Aligning left must not also re-centre vertically -
 * that would move text the user never asked to move, and they would have to
 * undo the whole thing to get one of the two effects.
 */
export function alignDelta(box: GroupBox, to: GroupAlign): { dx: number; dy: number } {
  switch (to) {
    case 'left':    return { dx: Math.round(LEFT_MARGIN - box.x), dy: 0 };
    case 'right':   return { dx: Math.round(RIGHT_MARGIN - (box.x + box.w)), dy: 0 };
    case 'hcenter': return { dx: Math.round(SLIDE_W / 2 - (box.x + box.w / 2)), dy: 0 };
    case 'top':     return { dx: 0, dy: Math.round(TOP_MARGIN - box.y) };
    case 'bottom':  return { dx: 0, dy: Math.round(BOTTOM_MARGIN - (box.y + box.h)) };
    case 'vcenter': return { dx: 0, dy: Math.round(SLIDE_H / 2 - (box.y + box.h / 2)) };
  }
}
