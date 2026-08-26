import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { MOD_KEY } from './platform';

/**
 * Four things a new user would otherwise never find.
 *
 * The studio has a command palette, a shortcuts sheet, brand rails, borrowing,
 * folders, preflight and a slide sorter, and on first open it shows none of
 * that: a deck and a toolbar. This is not a walkthrough of the app, it is the
 * four doors that lead to the rest of it.
 *
 * Deliberately not anchored to elements. A spotlight tour that points at real
 * DOM has to be maintained against every layout change and breaks quietly when
 * something moves; four cards that name where to look do not, and they still
 * work at tablet width.
 */

const SEEN_KEY = 'wozku-tour-seen-v1';

interface Step {
  eyebrow: string;
  title: string;
  body: string;
  /** Shown as a key cap next to the body when the step has a shortcut. */
  keys?: string[];
}

const STEPS: Step[] = [
  {
    eyebrow: 'Step 1 of 4',
    title: 'Edit anything by clicking it',
    body:
      'Switch to Edit at the top, then click any line on the slide and type. The bar along the bottom formats whatever you have selected, and it only ever offers what the brand allows.',
  },
  {
    eyebrow: 'Step 2 of 4',
    title: 'Add a slide, not a blank',
    body:
      'Add slide opens this deck’s own layouts: agenda, headline number, timeline, quote and the rest, each written in the deck’s voice. Pick one and edit it rather than starting from nothing.',
    keys: ['N'],
  },
  {
    eyebrow: 'Step 3 of 4',
    title: 'Everything has a keyboard route',
    body:
      'The command palette finds any action by name. Press the shortcut key for the full list, and use Alt with the arrows to move the selected slide up or down the deck.',
    keys: [MOD_KEY, 'K'],
  },
  {
    eyebrow: 'Step 4 of 4',
    title: 'Export is real PowerPoint',
    body:
      'Export writes editable slides, not screenshots, with the brand fonts embedded. It checks for cut-off text and leftover placeholder copy first, so a client never opens the surprise.',
    keys: [MOD_KEY, 'Shift', 'E'],
  },
];

export function shouldShowTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === null;
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
  } catch {
    // Storage unavailable; the tour simply shows again next time.
  }
}

function KeyCap({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 22, height: 22, padding: '0 6px',
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
        color: 'var(--neutral-800)', background: '#fff',
        border: '1px solid var(--neutral-300)',
        boxShadow: '0 1px 0 var(--neutral-300)',
      }}
    >
      {label}
    </span>
  );
}

export function FirstRunTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  const finish = useCallback(() => {
    markTourSeen();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(STEPS.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish]);

  if (!open) return null;

  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  return (
    <div
      className="wg-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Getting started"
        className="wg-modal"
        style={{ width: 'min(520px, 100%)', padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--emerald-700)',
          }}
        >
          {step.eyebrow}
        </span>

        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {step.title}
        </h2>

        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: 'var(--neutral-700)' }}>
          {step.body}
        </p>

        {step.keys && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {step.keys.map((k) => <KeyCap key={k} label={k} />)}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {/* Progress as dots: four steps is few enough to show rather than count. */}
          <div style={{ display: 'flex', gap: 5, marginRight: 'auto' }}>
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                aria-hidden
                style={{
                  width: i === index ? 16 : 6, height: 6,
                  background: i === index ? 'var(--emerald-500)' : 'var(--neutral-300)',
                  transition: 'width .18s, background .18s',
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={finish}
            style={{
              height: 36, padding: '0 14px', fontSize: 13, fontWeight: 600,
              color: 'var(--neutral-700)', background: '#fff',
              border: '1px solid var(--neutral-200)', cursor: 'pointer',
            }}
          >
            Skip
          </button>
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              style={{
                height: 36, padding: '0 14px', fontSize: 13, fontWeight: 600,
                color: 'var(--neutral-800)', background: '#fff',
                border: '1px solid var(--neutral-200)', cursor: 'pointer',
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? finish() : setIndex((i) => i + 1))}
            style={{
              height: 36, padding: '0 18px', fontSize: 13, fontWeight: 700,
              color: '#fff', background: 'var(--neutral-900)',
              border: 'none', cursor: 'pointer',
            }}
          >
            {last ? 'Start editing' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
