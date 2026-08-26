import type { SlideInstance } from '../deck/types';

/**
 * Where the time went.
 *
 * The presenter had one number: a stopwatch for the whole deck. That tells you
 * afterwards that you ran eight minutes long and nothing about which slide ate
 * them, which is the only part you can act on. A run is now recorded per slide,
 * against a target length for the deck, and the summary at the end names the
 * slides to cut.
 *
 * Pure functions on a seconds-per-slide map, so the arithmetic is testable and
 * present mode only has to count.
 */

/** Targets offered for a deck, in minutes. The lengths meetings actually are. */
export const TARGET_MINUTES = [5, 10, 15, 20, 30, 45, 60] as const;

export interface SlideTime {
  instanceId: string;
  /** 1-based position among the visible slides. */
  n: number;
  title: string;
  seconds: number;
  /** Fraction of the run spent here, 0-1. */
  share: number;
  /** True when this slide took more than twice its fair share of the run. */
  overlong: boolean;
}

/** mm:ss, hours only once there are any. */
export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/**
 * One row per slide that got any time, longest first.
 *
 * Slides that were never reached are left out rather than listed at zero: a run
 * that stopped halfway is a real thing to look at, and eleven rows of 00:00
 * would bury the six that matter.
 */
export function rehearsalRows(visible: SlideInstance[], timings: Record<string, number>): SlideTime[] {
  const total = Object.values(timings).reduce((sum, n) => sum + n, 0);
  const fair = visible.length > 0 ? total / visible.length : 0;
  return visible
    .map((slide, i) => ({
      instanceId: slide.instanceId,
      n: i + 1,
      title: slide.title || 'Untitled slide',
      seconds: timings[slide.instanceId] ?? 0,
      share: total > 0 ? (timings[slide.instanceId] ?? 0) / total : 0,
      overlong: fair > 0 && (timings[slide.instanceId] ?? 0) > fair * 2,
    }))
    .filter((row) => row.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
}

export type Pace = 'ahead' | 'on' | 'behind' | 'over' | 'none';

export interface PaceReading {
  state: Pace;
  /** Short enough for the presenter bar. */
  label: string;
}

/**
 * Whether the run is on pace, judged against where the deck has got to.
 *
 * The target is spread evenly across the slides, which is not how any deck is
 * actually paced, so the tolerance is deliberately loose: this is meant to
 * catch "you are four minutes behind on slide three", not to police a script.
 */
export function paceReading(elapsed: number, targetMinutes: number | null, slidesDone: number, total: number): PaceReading {
  if (!targetMinutes || total <= 0) return { state: 'none', label: '' };
  const target = targetMinutes * 60;
  if (elapsed > target) {
    return { state: 'over', label: `${formatSeconds(elapsed - target)} over` };
  }
  const expected = target * (Math.max(0, Math.min(slidesDone, total)) / total);
  const drift = elapsed - expected;
  if (Math.abs(drift) <= Math.max(30, target * 0.05)) return { state: 'on', label: 'On pace' };
  return drift > 0
    ? { state: 'behind', label: `${formatSeconds(drift)} behind` }
    : { state: 'ahead', label: `${formatSeconds(-drift)} ahead` };
}

export interface RehearsalSummary {
  totalSeconds: number;
  targetMinutes: number | null;
  /** Signed seconds against the target: positive is over. Null with no target. */
  againstTarget: number | null;
  slidesCovered: number;
  rows: SlideTime[];
  /** One sentence on how the run went. */
  verdict: string;
}

export function rehearsalSummary(
  visible: SlideInstance[],
  timings: Record<string, number>,
  targetMinutes: number | null
): RehearsalSummary {
  const rows = rehearsalRows(visible, timings);
  const totalSeconds = rows.reduce((sum, row) => sum + row.seconds, 0);
  const target = targetMinutes || null;
  const againstTarget = target === null ? null : totalSeconds - target * 60;
  const longest = rows[0];

  let verdict: string;
  if (rows.length === 0) {
    verdict = 'The timer never ran, so there is nothing to report.';
  } else if (againstTarget === null) {
    verdict = `${formatSeconds(totalSeconds)} across ${rows.length} ${rows.length === 1 ? 'slide' : 'slides'}. Set a target to see how that compares.`;
  } else if (againstTarget > 60) {
    verdict = `${formatSeconds(againstTarget)} over the ${target} minute target${longest ? `, and slide ${longest.n} took ${formatSeconds(longest.seconds)} of it` : ''}.`;
  } else if (againstTarget < -60) {
    verdict = `${formatSeconds(-againstTarget)} inside the ${target} minute target, with room to say more.`;
  } else {
    verdict = `On target at ${formatSeconds(totalSeconds)}.`;
  }

  return {
    totalSeconds,
    targetMinutes: target,
    againstTarget,
    slidesCovered: rows.length,
    rows,
    verdict,
  };
}
