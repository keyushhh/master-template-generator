import { useSyncExternalStore } from 'react';
import type { ClipIssue } from './fitScan';

/**
 * Where the fit findings live.
 *
 * A registry rather than React state because of who does the measuring. Only a
 * mounted, laid-out slide can be measured, and the one place every slide in the
 * deck is mounted at once is the thumbnail rail - so the rail's miniatures are
 * what produce the report, while the consumers (a badge on the thumbnail, the
 * pre-flight line in the export sheet) sit elsewhere in the tree. Passing this
 * up through the rail and back down would make the rail's job look like it was
 * about export.
 *
 * Nothing here is persisted. A finding is only true of the fonts and text in
 * front of you right now, so it is re-measured every session rather than
 * restored from a previous one and possibly lying.
 */

const issuesBySlide = new Map<string, ClipIssue[]>();
const listeners = new Set<() => void>();

/** Bumped on every real change, so `useSyncExternalStore` has a stable value to
 *  compare when nothing has moved. */
let version = 0;

const EMPTY: ClipIssue[] = [];

function notify() {
  version++;
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Cheap identity for a finding set, so re-measuring an unchanged slide (which
 *  happens on every rail resize) doesn't re-render everything watching it. */
function signature(issues: ClipIssue[]): string {
  return issues.map((i) => `${i.side}:${i.by}:${i.text}`).join('|');
}

export function reportSlideFit(slideId: string, issues: ClipIssue[]): void {
  const prev = issuesBySlide.get(slideId);
  if (prev && signature(prev) === signature(issues)) return;
  if (issues.length === 0) {
    if (!prev) return;
    issuesBySlide.delete(slideId);
  } else {
    issuesBySlide.set(slideId, issues);
  }
  notify();
}

/** Drop findings for slides that no longer exist. Without this, deleting the one
 *  offending slide would leave the export sheet still warning about it. */
export function pruneFit(liveIds: readonly string[]): void {
  const live = new Set(liveIds);
  let changed = false;
  for (const id of Array.from(issuesBySlide.keys())) {
    if (!live.has(id)) {
      issuesBySlide.delete(id);
      changed = true;
    }
  }
  if (changed) notify();
}

/** Findings for one slide. */
export function useSlideFit(slideId: string): ClipIssue[] {
  return useSyncExternalStore(
    subscribe,
    () => issuesBySlide.get(slideId) ?? EMPTY
  );
}

export interface FitReport {
  /** Slide ids with at least one finding, in no particular order. */
  slideIds: string[];
  /** Findings across the whole deck. */
  count: number;
}

/**
 * Deck-wide summary, for anything that has to speak about the deck as a whole.
 *
 * Recomputed from `version` rather than memoised on the map, because the map is
 * mutated in place.
 */
export function useFitReport(): FitReport {
  const v = useSyncExternalStore(subscribe, () => version);
  return reportFor(v);
}

let cached: { v: number; report: FitReport } | null = null;

function reportFor(v: number): FitReport {
  if (cached && cached.v === v) return cached.report;
  let count = 0;
  const slideIds: string[] = [];
  for (const [id, issues] of issuesBySlide) {
    slideIds.push(id);
    count += issues.length;
  }
  const report = { slideIds, count };
  cached = { v, report };
  return report;
}

// ---------------------------------------------------------------------------
// Dev outline
// ---------------------------------------------------------------------------

/**
 * Draws a box around everything the scan flagged, on the slide itself.
 *
 * A measurement you cannot see is a measurement you have to trust, and the
 * tolerance in `fitScan` is a judgement call that wants checking against real
 * slides rather than argued about. This makes the finding visible on the canvas
 * so a false positive is obvious at a glance. Dev builds only.
 */
let outline = false;
const outlineListeners = new Set<() => void>();

export function getFitOutline(): boolean {
  return outline;
}

export function setFitOutline(next: boolean): void {
  if (outline === next) return;
  outline = next;
  for (const fn of outlineListeners) fn();
}

export function useFitOutline(): boolean {
  return useSyncExternalStore(
    (fn) => {
      outlineListeners.add(fn);
      return () => outlineListeners.delete(fn);
    },
    () => outline
  );
}
