/**
 * Measures whether any text on a slide is being cut off by the box it sits in.
 *
 * The slide is a fixed 1920x1080 canvas with fixed slots. Type too long for its
 * slot does not reflow the layout, it disappears under an `overflow: hidden`,
 * and because the PPTX exporter is told the same box, it disappears in
 * PowerPoint too. Nothing in the studio said so. You found out in the room.
 *
 * There is no way to answer this from the model: the deck stores strings, and
 * whether a string fits is a question about font metrics, so it can only be
 * answered by the browser after layout. Hence a DOM measurement rather than a
 * length heuristic.
 */

/** Design width of a slide. Rects come back post-transform, so this recovers
 *  the render scale and reports every measurement in design px. */
const DESIGN_W = 1920;

/**
 * How far past its edge text has to reach before it counts.
 *
 * Not zero. Sub-pixel layout, font hinting and fractional scales all leave
 * text a hair over its box with nothing visibly wrong, and a warning that
 * fires on every slide is a warning nobody reads. Four design px is under half
 * a line of the smallest type we set and still well below anything a person
 * would notice.
 */
const TOLERANCE = 4;

/** Past this, the text is not "close" - a line or more is gone. */
export const SEVERE_BY = 14;

/** Opt a subtree out of the scan with `data-no-fit`. For decoration that is
 *  meant to run off the edge of the slide. */
const OPT_OUT = '[data-no-fit]';

export type ClipSide = 'bottom' | 'right' | 'top' | 'left';

export interface ClipIssue {
  /** The text that is being cut, shortened, so the warning can name it. */
  text: string;
  side: ClipSide;
  /** How far past the edge it reaches, in design px. */
  by: number;
  /** The measured element, for the dev outline. Not persisted. */
  el?: HTMLElement;
}

/** Longest snippet we quote back. Enough to recognise the sentence. */
const SNIPPET = 48;

function snippet(el: HTMLElement): string {
  const raw = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return raw.length > SNIPPET ? `${raw.slice(0, SNIPPET - 1)}…` : raw;
}

/** Whether this element establishes a box of its own, rather than flowing as
 *  text inside its parent. `inline` and `contents` do not; `inline-block`,
 *  `inline-flex` and everything else do. */
function isBox(cs: CSSStyleDeclaration): boolean {
  const d = cs.display;
  return d !== 'inline' && d !== 'contents' && d !== 'none';
}

function hasText(el: Element): boolean {
  return !!el.textContent && el.textContent.trim().length > 0;
}

/**
 * The innermost boxes that carry text.
 *
 * Measuring inline spans instead would read a font metric, not a layout box: an
 * inline rect is the union of its line boxes sized from the font's em box, so a
 * heading set at line-height 0.9 reports a span reaching ~25% past the h1 that
 * contains it while looking perfectly fine. Blocks report the box the browser
 * actually laid out, which is the thing that gets clipped.
 */
function textBoxes(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  const walk = (el: HTMLElement) => {
    if (el.closest(OPT_OUT)) return;
    let nestedText = false;
    for (const child of Array.from(el.children)) {
      const ce = child as HTMLElement;
      if (!hasText(ce)) continue;
      const cs = window.getComputedStyle(ce);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (isBox(cs)) {
        nestedText = true;
        walk(ce);
      }
    }
    // A box whose text lives only in inline children is itself the text box.
    if (!nestedText && hasText(el)) out.push(el);
  };
  walk(root);
  return out;
}

function clips(cs: CSSStyleDeclaration, axis: 'x' | 'y'): boolean {
  const v = axis === 'x' ? cs.overflowX : cs.overflowY;
  return v !== 'visible';
}

/** The box that actually clips: content is cut at the padding edge, so the
 *  border widths come off the border-box rect. */
function paddingBox(el: HTMLElement, cs: CSSStyleDeclaration): DOMRect {
  const r = el.getBoundingClientRect();
  const t = parseFloat(cs.borderTopWidth) || 0;
  const rt = parseFloat(cs.borderRightWidth) || 0;
  const b = parseFloat(cs.borderBottomWidth) || 0;
  const l = parseFloat(cs.borderLeftWidth) || 0;
  return new DOMRect(r.x + l, r.y + t, r.width - l - rt, r.height - t - b);
}

/**
 * Every piece of text on this slide that is being cut off, worst first.
 *
 * `root` is the 1920x1080 slide element. Safe to call on a scaled slide: the
 * scale is recovered from the root's own width and divided out.
 */
export function scanForClipping(root: HTMLElement): ClipIssue[] {
  const rootRect = root.getBoundingClientRect();
  // A slide mid-mount can measure zero; there is nothing to say about it yet.
  if (rootRect.width <= 0) return [];
  const scale = rootRect.width / DESIGN_W;

  const issues: ClipIssue[] = [];

  for (const el of textBoxes(root)) {
    const cs = window.getComputedStyle(el);
    // Nothing to say about a box that is not being drawn. Reachable: a slot whose
    // only text sits in a `display: none` child still counts as text-bearing, and
    // measuring it would report a finding about copy nobody can see.
    if (cs.visibility === 'hidden' || el.getBoundingClientRect().height <= 0) continue;
    let worst: { side: ClipSide; by: number } | null = null;
    const note = (side: ClipSide, by: number) => {
      if (by > TOLERANCE && (!worst || by > worst.by)) worst = { side, by };
    };

    // Its own box, clipping its own text. scrollHeight/clientHeight are layout
    // values, already in design px whatever the render scale.
    if (clips(cs, 'y')) note('bottom', el.scrollHeight - el.clientHeight);
    if (clips(cs, 'x')) note('right', el.scrollWidth - el.clientWidth);

    // Or an ancestor's box, clipping this one. Walks past every transparent
    // wrapper to the first thing that actually cuts, which for most slots is
    // the slide root itself.
    for (let p = el.parentElement; p; p = p.parentElement) {
      const pcs = window.getComputedStyle(p);
      const cx = clips(pcs, 'x');
      const cy = clips(pcs, 'y');
      if (cx || cy) {
        const box = paddingBox(p, pcs);
        const r = el.getBoundingClientRect();
        if (cy) {
          note('bottom', (r.bottom - box.bottom) / scale);
          note('top', (box.top - r.top) / scale);
        }
        if (cx) {
          note('right', (r.right - box.right) / scale);
          note('left', (box.left - r.left) / scale);
        }
        break;
      }
      if (p === root) break;
    }

    if (worst) {
      const w: { side: ClipSide; by: number } = worst;
      issues.push({ text: snippet(el), side: w.side, by: Math.round(w.by), el });
    }
  }

  return issues.sort((a, b) => b.by - a.by);
}

/** How to say it. Deliberately about the consequence, not the geometry: "runs
 *  4px past its box" is a fact about CSS, "is cut off" is a fact about the
 *  slide the client sees. */
export function describeIssue(issue: ClipIssue): string {
  const where = issue.side === 'bottom' || issue.side === 'top' ? 'vertically' : 'horizontally';
  return issue.by >= SEVERE_BY
    ? `Cut off ${where}, by about ${issue.by}px`
    : `Just overruns its space ${where}`;
}
