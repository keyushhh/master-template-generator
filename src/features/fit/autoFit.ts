import { scanForClipping } from './fitScan';

/**
 * Shrinks type until it stops being cut off.
 *
 * The cover has done a version of this since the beginning: `SlideCover`
 * computes its hero size from the length of the headline, so a long title comes
 * down from 180px rather than running off the slide. That is one hand-rolled
 * formula for one slot on one layout, and every other slot on the other
 * thirteen just clips.
 *
 * The fit check measures any slot on any layout, so the same idea generalises.
 * What it cannot do is guess: this is offered as an action, never applied
 * silently. You chose 180px on that headline, and an app that quietly overrules
 * a type decision is worse than one that lets you ship a clipped line.
 *
 * ── Why this is imperative ─────────────────────────────────────────────────
 * Finding the largest size that fits means: set a size, let the browser lay it
 * out, measure, repeat. Through React state each step is a render and a frame,
 * so a dozen steps across a dozen slots is a visible stutter and a dozen entries
 * in the undo stack.
 *
 * So the search runs on the DOM directly - writing `style.fontSize`, reading
 * back the geometry, which forces synchronous layout - and only the answer is
 * committed to the model. One state change, one undo. The scratch styles are
 * discarded either way, and the re-render that follows the commit rewrites the
 * element from props regardless.
 */

/** Smallest fraction of the original size we will go down to.
 *
 *  A floor, not a target. Past roughly two thirds the slot no longer reads as
 *  the same piece of typography, and the honest answer stops being "smaller
 *  type" and becomes "shorter copy". Reporting that we could not fit it is more
 *  use than a heading at 40% that technically fits. */
const MIN_FRACTION = 0.62;

/** How much smaller each attempt is. Coarse enough to converge in a few steps,
 *  fine enough that the result does not look arbitrarily reduced. Stepping down
 *  rather than bisecting because fit is not perfectly monotonic in size - a line
 *  break can rearrange at any threshold - and stepping guarantees the largest
 *  size on the grid that actually measures clean. */
const STEP = 0.04;

export interface AutoFitPlan {
  /** Slot name, as `patchStyles` keys them. */
  slot: string;
  /** The size to commit, in design px. */
  sizePx: number;
  /** What it was before, for the message. */
  fromPx: number;
}

export interface AutoFitResult {
  plan: AutoFitPlan[];
  /**
   * What resizing cannot save: slots still cut off at the floor, named by slot,
   * and clipped text with no slot behind it at all, quoted. Both need the copy
   * edited rather than the type reduced, which is why they are reported instead
   * of quietly left out of a "fixed it" message.
   */
  stubborn: string[];
}

/**
 * Works out what to resize on one slide, without changing anything.
 *
 * `root` must be a slide rendered **in edit mode**: slot identity comes from the
 * `data-slot` attribute, and the renderers only emit it on an editable. In view
 * mode most slots are bare text with no element of their own, so there is
 * nothing to attribute a size to. Hence the warning works everywhere and the fix
 * is an editing action.
 *
 * Returns an empty plan if nothing is clipped, so the caller can treat "already
 * fits" and "nothing to do" as the same case.
 */
export function planAutoFit(root: HTMLElement): AutoFitResult {
  const plan: AutoFitPlan[] = [];
  const stubborn: string[] = [];

  // Group by slot before touching anything. One slot can own several text boxes
  // (a two-line heading, a label and its rule), and they have to come down
  // together or the pair stops matching.
  const targets = new Map<string, HTMLElement[]>();
  const orphans: string[] = [];

  for (const issue of scanForClipping(root)) {
    const el = issue.el;
    if (!el) continue;
    const holder = el.closest<HTMLElement>('[data-slot]');
    const slot = holder?.dataset.slot;
    if (!slot || !holder) {
      // Clipped text with no slot behind it: a table cell, a chart label, an
      // imported shape. Nothing to resize, so say so rather than silently
      // dropping it and reporting a clean fix.
      orphans.push(issue.text);
      continue;
    }
    const group = targets.get(slot);
    if (group) group.push(holder);
    else targets.set(slot, [holder]);
  }

  for (const [slot, els] of targets) {
    const cs = window.getComputedStyle(els[0]);
    const fromPx = parseFloat(cs.fontSize);
    if (!Number.isFinite(fromPx) || fromPx <= 0) continue;

    // Restore whatever inline size was there, whether or not a fit is found.
    const saved = els.map((el) => el.style.fontSize);
    const revert = () => els.forEach((el, i) => { el.style.fontSize = saved[i]; });

    const floor = fromPx * MIN_FRACTION;
    let found = 0;

    for (let size = fromPx * (1 - STEP); size >= floor; size -= fromPx * STEP) {
      const px = Math.round(size);
      if (px <= 0) break;
      for (const el of els) el.style.fontSize = `${px}px`;
      // Re-run the real scan rather than measuring the element directly. What
      // clips a slot is often an ancestor's box, not its own, and duplicating
      // that decision here is how the fix and the warning would come to
      // disagree about whether the slide is clean.
      const stillClipped = scanForClipping(root).some(
        (i) => i.el?.closest<HTMLElement>('[data-slot]')?.dataset.slot === slot
      );
      if (!stillClipped) {
        found = px;
        break;
      }
    }

    revert();

    if (found) plan.push({ slot, sizePx: found, fromPx: Math.round(fromPx) });
    else stubborn.push(slot);
  }

  return { plan, stubborn: [...stubborn, ...orphans] };
}

/**
 * Plan the same fix across several slides.
 *
 * Every slide in the deck stays mounted in the canvas - only the current one is
 * visible - which is what makes this possible without navigating to each in turn.
 * The catch is the same as for one slide: slot identity comes from `data-slot`,
 * which only exists in edit mode, so the caller has to be in it first.
 *
 * Returns one entry per slide that has something to change, so the caller can
 * commit the whole sweep as a single deck mutation. Twelve slides fixed should be
 * one undo, not twelve.
 */
export function planAutoFitForSlides(instanceIds: readonly string[]): {
  plans: { instanceId: string; plan: AutoFitPlan[] }[];
  /** Slides where something needs shorter copy rather than smaller type. */
  stubborn: string[];
} {
  const plans: { instanceId: string; plan: AutoFitPlan[] }[] = [];
  const stubborn: string[] = [];

  for (const instanceId of instanceIds) {
    const root = document.getElementById(instanceId);
    if (!root) continue;
    const result = planAutoFit(root);
    if (result.plan.length) plans.push({ instanceId, plan: result.plan });
    if (result.stubborn.length) stubborn.push(instanceId);
  }

  return { plans, stubborn };
}
