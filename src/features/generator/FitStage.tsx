import { useEffect, useRef, useState } from 'react';
import { SlideStage } from './PresentationCanvas';
import type { DocumentNode } from '../business-record/parser/ast';
import type { SlideInstance } from '../deck/types';
import type { DeckTheme } from '../theme/deckTheme';

/**
 * A slide rendered at whatever size its container happens to be.
 *
 * `SlideStage` needs an explicit scale factor - it draws the deck at its true
 * 1920x1080 and shrinks it with a transform, which is what keeps a thumbnail
 * pixel-identical to the canvas and the export. That leaves every caller
 * needing the same ResizeObserver to turn "the box I have" into "the scale to
 * pass", which the review grid, the slide sorter and present mode's next-slide
 * preview were each about to reimplement.
 *
 * Renders a 16:9 box that fills its container's width, so a parent only has to
 * decide how wide the slide should be.
 */
export function FitStage({
  slide,
  ast,
  num,
  logoUrl,
  /** Painted under the slide, visible for the frame before the first measure. */
  background = '#fff',
  /** The deck's theme. Forwarded so a thumbnail is never drawn in a different
   *  palette from the stage it previews. */
  theme,
}: {
  slide: SlideInstance;
  ast: DocumentNode | null;
  num: string;
  logoUrl?: string;
  background?: string;
  theme?: DeckTheme;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Seeded near a plausible thumbnail scale so the first paint is roughly right
  // rather than visibly snapping into place on mount.
  const [scale, setScale] = useState(0.16);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // offsetWidth, not getBoundingClientRect: the rect is the *painted* width,
    // so a thumbnail measured while the modal was still playing its scale(0.975)
    // entrance kept that scale for good, leaving a sliver of the card showing
    // down the slide's right and bottom edges. A ResizeObserver never corrects
    // it, because the layout box never changed.
    const update = () => {
      const w = el.offsetWidth;
      if (w > 0) setScale(w / 1920);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full aspect-[16/9] relative overflow-hidden" style={{ background }}>
      <SlideStage slide={slide} ast={ast} num={num} scale={scale} logoUrl={logoUrl} theme={theme} />
    </div>
  );
}
