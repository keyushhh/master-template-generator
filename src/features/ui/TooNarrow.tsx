import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * The studio's floor.
 *
 * A 1920x1080 canvas, a slide rail, a contextual format bar and an insert rail
 * do not fit on a phone, and the honest answer is to say so. Before this, the
 * page simply drew itself anyway: the canvas was clipped by the insert rail,
 * the format bar ran off the screen, and the header stacked on top of itself.
 * That reads as a broken app rather than as the wrong device.
 *
 * 768px is iPad portrait, which is the smallest screen the editor is designed
 * for. Presenting is not gated: a deck presents full-bleed at any size, and
 * running a deck from a phone is a real thing people do.
 */

export const STUDIO_MIN_WIDTH = 768;

/** True while the viewport is narrower than the editor supports. */
export function useBelowStudioFloor(): boolean {
  const [below, setBelow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < STUDIO_MIN_WIDTH
  );

  useEffect(() => {
    // Both a media query and a resize listener. The query alone is the tidier
    // signal, but it does not always fire when the viewport is resized by the
    // browser rather than by the user (rotating a tablet, a devtools override),
    // and being stuck on this screen after rotating back is worse than one
    // extra listener.
    const update = () => setBelow(window.innerWidth < STUDIO_MIN_WIDTH);
    const query = window.matchMedia(`(max-width: ${STUDIO_MIN_WIDTH - 1}px)`);
    update();
    query.addEventListener('change', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return below;
}

export function TooNarrow({
  deckName,
  slideCount,
  onPresent,
  canPresent,
}: {
  deckName: string;
  slideCount: number;
  onPresent: () => void;
  canPresent: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'var(--bg-white)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 22,
        padding: '32px 24px',
        overflowY: 'auto',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--neutral-600)',
        }}
      >
        {deckName} &middot; {slideCount} {slideCount === 1 ? 'slide' : 'slides'}
      </span>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          fontWeight: 700,
          margin: 0,
          color: 'var(--neutral-900)',
        }}
      >
        Editing needs a bigger screen.
      </h1>

      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--neutral-600)', maxWidth: 380 }}>
        The canvas is a full 1920 by 1080 slide with a rail either side, so the
        editor starts at tablet width. Open this deck on an iPad or a laptop and
        everything is here.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380 }}>
        {canPresent && (
          <button
            type="button"
            onClick={onPresent}
            style={{
              height: 46,
              padding: '0 18px',
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              background: 'var(--neutral-900)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Present this deck
          </button>
        )}
        <Link
          to="/"
          style={{
            height: 46,
            padding: '0 18px',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--neutral-900)',
            background: '#fff',
            border: '1px solid var(--neutral-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          Back to all decks
        </Link>
      </div>

      <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--neutral-600)' }}>
        Presenting works at any size.
      </p>
    </div>
  );
}
