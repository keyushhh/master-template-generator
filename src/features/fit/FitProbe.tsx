import { useEffect, type RefObject } from 'react';
import { scanForClipping, SEVERE_BY } from './fitScan';
import { reportSlideFit, useFitOutline } from './fitStore';

/**
 * Measures one mounted slide and files the result.
 *
 * Renders nothing. It is a component rather than a hook inside `SlideStage`
 * because only some of the places that render a slide should be measuring one:
 * the rail mounts all fourteen and is the natural place to do it, while Present
 * mode has no business paying for a scan mid-talk.
 */
export function FitProbe({
  rootRef,
  slideId,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  slideId: string;
}) {
  const outline = useFitOutline();

  // No dependency list on purpose: a scan is only valid for the layout that was
  // just painted, and any edit to the slide produces a new one. The store
  // discards findings identical to the ones it already holds, so re-measuring
  // an unchanged slide costs a frame of reads and re-renders nothing.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let raf = 0;
    const cleanups: (() => void)[] = [];

    const measure = () => {
      const issues = scanForClipping(root);
      reportSlideFit(slideId, issues);

      if (!outline) return;
      for (const issue of issues) {
        const el = issue.el;
        if (!el) continue;
        const prev = el.style.outline;
        const prevOffset = el.style.outlineOffset;
        el.style.outline = `2px solid ${issue.by >= SEVERE_BY ? '#dc2626' : '#f59e0b'}`;
        el.style.outlineOffset = '-1px';
        cleanups.push(() => {
          el.style.outline = prev;
          el.style.outlineOffset = prevOffset;
        });
      }
    };

    // After paint, so the layout being measured is the one on screen.
    raf = requestAnimationFrame(measure);

    // Web fonts land after first paint and change every metric with them, so a
    // scan taken before they arrive describes a slide nobody saw. `fonts.ready`
    // resolves immediately once they are in, which is the usual case.
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });

    return () => {
      live = false;
      cancelAnimationFrame(raf);
      for (const fn of cleanups) fn();
    };
  });

  return null;
}
