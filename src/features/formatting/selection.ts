/**
 * What the formatting toolbar is pointed at.
 *
 * Before this existed, editing was one contentEditable per field committing on
 * blur, with no notion of "current target" - which is fine for typing but
 * meaningless for a toolbar, since every button needs something to act on.
 *
 * Two kinds of target, because the deck has two structurally different kinds
 * of slide:
 *
 *  - `slot` - a named field in one of the 14 templates. Formatting is stored
 *    as a SlotStyle override in `content.styles[slot]`, layered over whatever
 *    the template renderer specifies.
 *  - `run`  - a text run inside a shape on an imported .pptx slide. Those runs
 *    already carry their own formatting (it was read out of the source file),
 *    so the toolbar edits the run directly instead of layering an override.
 */

export interface SlotSelection {
  kind: 'slot';
  instanceId: string;
  /** Stable slot name, e.g. 'heading' or 'bars.0.label'. The anchor of the
   *  selection: with several slots selected this is the one the toolbar reads
   *  its font and size from, because a group of mixed sizes has no single
   *  number to show. */
  slot: string;
  /** Slots selected alongside `slot`, always on the same slide. Every action -
   *  formatting, nudging, dragging, resetting - applies to the whole set.
   *
   *  Kept as extras on the anchor rather than as a separate 'multi' kind so
   *  every existing consumer keeps working unchanged: a group is a slot
   *  selection that happens to include more than one slot. */
  extra?: string[];
  /** The size this slot is currently rendering at, in design px, read from
   *  the live DOM when it was selected. Needed because a template may compute
   *  its size at runtime (the cover fits its hero font to the title length),
   *  so there is no static number the toolbar could look up - and the size
   *  stepper has to start from what the user can actually see. */
  effectiveSizePx?: number;
  /** The font this text is actually rendering in, read from the live DOM at
   *  selection time. Shown in the toolbar in place of the internal slot name:
   *  "JetBrains Mono" tells you what you're looking at, "hudLabel" doesn't. */
  effectiveFont?: string;
}

export interface RunSelection {
  kind: 'run';
  instanceId: string;
  shapeId: string;
  paragraph: number;
  run: number;
  /** Other imported shapes on the same slide, selected alongside `shapeId` -
   *  the box-and-its-caption case, where the two are separate shapes that need
   *  to move, align or delete together. Same "anchor plus extras" shape as
   *  SlotSelection.extra, for the same reason: every existing consumer that
   *  only reads `shapeId` keeps working, a group is just a run selection that
   *  happens to include more shapes. */
  extra?: string[];
  effectiveSizePx?: number;
  /** The font this text is actually rendering in, read from the live DOM at
   *  selection time. Shown in the toolbar in place of the internal slot name:
   *  "JetBrains Mono" tells you what you're looking at, "hudLabel" doesn't. */
  effectiveFont?: string;
}

/** A user-inserted overlay shape. Its text formatting is stored as a SlotStyle
 *  on the shape itself, so the same toolbar drives it. */
export interface OverlaySelection {
  kind: 'overlay';
  instanceId: string;
  shapeId: string;
  /** Present when the shape is a table and a specific cell is targeted - its
   *  formatting lives on that cell, not on the shape, since a header row and
   *  its body need to look different from each other. Absent for every other
   *  overlay kind, and for a table selected as a whole (no cell picked). */
  cell?: { row: number; col: number };
  effectiveSizePx?: number;
  /** The font this text is actually rendering in, read from the live DOM at
   *  selection time. Shown in the toolbar in place of the internal slot name:
   *  "JetBrains Mono" tells you what you're looking at, "hudLabel" doesn't. */
  effectiveFont?: string;
}

export type Selection = SlotSelection | RunSelection | OverlaySelection;

/** Every slot a selection covers, anchor first. Duplicates are dropped so an
 *  additive click on an already-selected slot cannot double-apply a nudge. */
export function slotsOf(sel: Selection | null): string[] {
  if (!sel || sel.kind !== 'slot') return [];
  return [...new Set([sel.slot, ...(sel.extra ?? [])])];
}

/**
 * Adds or removes a slot from a selection, the way a shift-click should behave.
 *
 * Clicking an already-selected slot removes it, which is the only way to back
 * out of an over-wide selection without starting again. Removing the anchor
 * promotes the next member rather than dropping the whole group. A slot on a
 * different slide replaces the selection outright: a group spanning two slides
 * could not be dragged or aligned as one, so allowing it would only produce a
 * selection whose controls silently did the wrong thing.
 */
export function toggleSlot(
  prev: Selection | null,
  next: SlotSelection
): SlotSelection {
  if (!prev || prev.kind !== 'slot' || prev.instanceId !== next.instanceId) return next;

  const current = slotsOf(prev);
  if (!current.includes(next.slot)) {
    return { ...prev, extra: [...(prev.extra ?? []), next.slot] };
  }

  const remaining = current.filter((s) => s !== next.slot);
  // Never empty: un-clicking the last member leaves it selected rather than
  // clearing the toolbar out from under the user mid-gesture.
  if (!remaining.length) return prev;
  const [anchor, ...extra] = remaining;
  return {
    ...prev,
    slot: anchor,
    extra: extra.length ? extra : undefined,
    // The anchor changed, so the size and font it reported no longer describe
    // the slot the toolbar is now reading. Dropping them makes the stepper
    // re-read from the DOM instead of showing a stale number.
    ...(anchor === prev.slot ? {} : { effectiveSizePx: undefined, effectiveFont: undefined }),
  };
}

/** Every imported shape a selection covers, anchor first. Mirrors `slotsOf`. */
export function shapeIdsOf(sel: Selection | null): string[] {
  if (!sel || sel.kind !== 'run') return [];
  return [...new Set([sel.shapeId, ...(sel.extra ?? [])])];
}

/**
 * Adds or removes an imported shape from a selection, the way a shift-click
 * should behave. Mirrors `toggleSlot` - see there for the reasoning behind
 * "never empty" and "a different slide replaces outright".
 */
export function toggleShape(prev: Selection | null, next: RunSelection): RunSelection {
  if (!prev || prev.kind !== 'run' || prev.instanceId !== next.instanceId) return next;

  const current = shapeIdsOf(prev);
  if (!current.includes(next.shapeId)) {
    return { ...prev, extra: [...(prev.extra ?? []), next.shapeId] };
  }

  const remaining = current.filter((id) => id !== next.shapeId);
  if (!remaining.length) return prev;
  const [anchor, ...extra] = remaining;
  return {
    ...prev,
    shapeId: anchor,
    extra: extra.length ? extra : undefined,
    // A different anchor has its own paragraph/run/text metrics - the old
    // ones would point at text that may not even exist on the new anchor.
    ...(anchor === prev.shapeId ? {} : { paragraph: 0, run: 0, effectiveSizePx: undefined, effectiveFont: undefined }),
  };
}

/** True when both selections point at the same thing, so re-focusing the field
 *  a user is already in doesn't churn React state on every keystroke-blur. */
export function sameSelection(a: Selection | null, b: Selection | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'slot' && b.kind === 'slot') {
    if (a.instanceId !== b.instanceId || a.slot !== b.slot) return false;
    // Group membership is part of the identity: adding a slot to the selection
    // has to re-render, or the new member would show no outline.
    const ea = a.extra ?? [];
    const eb = b.extra ?? [];
    return ea.length === eb.length && ea.every((s, i) => s === eb[i]);
  }
  if (a.kind === 'run' && b.kind === 'run') {
    const ea = a.extra ?? [];
    const eb = b.extra ?? [];
    return (
      a.instanceId === b.instanceId &&
      a.shapeId === b.shapeId &&
      a.paragraph === b.paragraph &&
      a.run === b.run &&
      ea.length === eb.length &&
      ea.every((s, i) => s === eb[i])
    );
  }
  if (a.kind === 'overlay' && b.kind === 'overlay') {
    return (
      a.instanceId === b.instanceId &&
      a.shapeId === b.shapeId &&
      a.cell?.row === b.cell?.row &&
      a.cell?.col === b.cell?.col
    );
  }
  return false;
}
