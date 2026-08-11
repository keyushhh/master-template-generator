/**
 * The single place a SlotStyle override is turned into something a renderer
 * can use.
 *
 * There are two independent renderers - the React canvas in
 * PresentationCanvas.tsx and the native PowerPoint exporter in pptxNative.ts -
 * and they share no styling code otherwise. Anything that applies an override
 * must go through here, or a format will look right on screen and silently
 * disappear on export. That failure is invisible until someone opens the
 * exported file, which is exactly the wrong time to find out.
 */

import type { SlotOffset, SlotStyle } from '../deck/types';
import { fontStack } from './rails';

/** Reads a slot's drag offset, or undefined if it hasn't been moved. */
export function offsetFor(
  offsets: Record<string, SlotOffset> | undefined,
  slot: string | undefined
): SlotOffset | undefined {
  if (!offsets || !slot) return undefined;
  const o = offsets[slot];
  if (!o || (o.dx === 0 && o.dy === 0)) return undefined;
  return o;
}

/** Writes a slot's offset, dropping the entry when it returns to zero so an
 *  un-nudged slot leaves no trace in the saved deck. */
export function patchOffset(
  offsets: Record<string, SlotOffset> | undefined,
  slot: string,
  next: SlotOffset | undefined
): Record<string, SlotOffset> | undefined {
  const out = { ...(offsets ?? {}) };
  if (!next || (next.dx === 0 && next.dy === 0)) delete out[slot];
  else out[slot] = { dx: Math.round(next.dx), dy: Math.round(next.dy) };
  return Object.keys(out).length ? out : undefined;
}

/**
 * Adds one delta to several slots' offsets at once.
 *
 * The single primitive behind every way a group can be moved - dragging its
 * grip, nudging with the arrow keys, and aligning it to the slide. Because all
 * three go through here, they cannot disagree about what "move these together"
 * means, and the members' relative positions are preserved by construction: the
 * same delta reaches every one of them.
 */
export function shiftOffsets(
  offsets: Record<string, SlotOffset> | undefined,
  slots: string[],
  delta: SlotOffset
): Record<string, SlotOffset> | undefined {
  if (!delta.dx && !delta.dy) return offsets;
  let out = offsets;
  for (const slot of slots) {
    const cur = out?.[slot];
    out = patchOffset(out, slot, {
      dx: (cur?.dx ?? 0) + delta.dx,
      dy: (cur?.dy ?? 0) + delta.dy,
    });
  }
  return out;
}

/** Reads the override for one slot, or undefined if the slot is untouched. */
export function styleFor(
  styles: Record<string, SlotStyle> | undefined,
  slot: string | undefined
): SlotStyle | undefined {
  if (!styles || !slot) return undefined;
  const s = styles[slot];
  // An override emptied by "reset to template" is stored as {} rather than
  // deleted in some code paths; treat it as absent so the template wins.
  return s && Object.keys(s).length ? s : undefined;
}

/** True if the override would change nothing - used to drop empty entries
 *  instead of accumulating dead keys in the saved deck. */
export function isEmptyStyle(s: SlotStyle | undefined): boolean {
  if (!s) return true;
  return (
    s.sizePx === undefined &&
    s.bold === undefined &&
    s.italic === undefined &&
    s.underline === undefined &&
    s.color === undefined &&
    s.align === undefined
  );
}

/**
 * Override as CSS for the React canvas.
 *
 * Only properties the user actually set are emitted, so everything else keeps
 * inheriting from the template's own element styles. Note `align` also sets
 * `display: block`: `text-align` has no effect on an inline span, and every
 * editable slot renders as a span inside the template's own heading/paragraph
 * element. The switch to block is applied *only* when an alignment override
 * exists, so untouched slides keep their original inline layout exactly.
 */
export function applyToCss(s: SlotStyle | undefined): React.CSSProperties {
  if (!s) return {};
  const css: React.CSSProperties = {};
  if (s.sizePx !== undefined) css.fontSize = s.sizePx;
  if (s.bold !== undefined) css.fontWeight = s.bold ? 700 : 400;
  if (s.italic !== undefined) css.fontStyle = s.italic ? 'italic' : 'normal';
  if (s.underline !== undefined) css.textDecoration = s.underline ? 'underline' : 'none';
  if (s.color !== undefined) css.color = `#${s.color}`;
  if (s.fontFamily !== undefined) css.fontFamily = fontStack(s.fontFamily) ?? s.fontFamily;
  if (s.align !== undefined) {
    css.textAlign = s.align;
    css.display = 'block';
  }
  return css;
}

/** The subset of pptxNative's TextOpts this module can override. Declared
 *  structurally rather than imported so resolve.ts stays free of the
 *  exporter's pptxgenjs dependency (it is also imported by the canvas, which
 *  must not pull that in). */
export interface PptxTextOverride {
  size?: number; // design px
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string; // hex, no '#'
  align?: 'left' | 'center' | 'right';
  fontFace?: string;
}

/**
 * Override merged onto the text options a template build function already
 * computed. Unset override fields leave the template's value untouched.
 */
export function applyToPptx<T extends PptxTextOverride>(base: T, s: SlotStyle | undefined): T {
  if (!s) return base;
  const out = { ...base };
  if (s.sizePx !== undefined) out.size = s.sizePx;
  if (s.bold !== undefined) out.bold = s.bold;
  if (s.italic !== undefined) out.italic = s.italic;
  if (s.underline !== undefined) out.underline = s.underline;
  if (s.color !== undefined) out.color = s.color;
  if (s.align !== undefined) out.align = s.align;
  if (s.fontFamily !== undefined) out.fontFace = s.fontFamily;
  return out;
}

/**
 * Writes one override into a styles map, returning a new map. Passing a patch
 * whose fields are all undefined removes the slot's entry entirely, which is
 * how "reset to template" works - the absence of a key is the default, so a
 * reset genuinely restores the template rather than freezing today's template
 * values into the saved deck.
 */
export function patchStyles(
  styles: Record<string, SlotStyle> | undefined,
  slot: string,
  patch: Partial<SlotStyle>
): Record<string, SlotStyle> | undefined {
  const next = { ...(styles ?? {}) };
  const merged: SlotStyle = { ...(next[slot] ?? {}), ...patch };
  // Explicit undefined in the patch means "unset this property".
  for (const k of Object.keys(patch) as (keyof SlotStyle)[]) {
    if (patch[k] === undefined) delete merged[k];
  }
  if (isEmptyStyle(merged)) delete next[slot];
  else next[slot] = merged;
  return Object.keys(next).length ? next : undefined;
}

/** Drops every override for a slot. */
export function clearSlot(
  styles: Record<string, SlotStyle> | undefined,
  slot: string
): Record<string, SlotStyle> | undefined {
  if (!styles || !(slot in styles)) return styles;
  const next = { ...styles };
  delete next[slot];
  return Object.keys(next).length ? next : undefined;
}
