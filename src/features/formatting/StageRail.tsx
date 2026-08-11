/**
 * The stage's right-hand rail: tools that act on the slide, not on the
 * selection.
 *
 * Insert and speaker notes used to live in the bottom toolbar beside bold,
 * italic and colour. That was wrong on two counts. The bar grew long enough to
 * crowd the stage - six insert buttons plus a contextual middle that expands
 * again for a table or a chart - and, worse, it implied both were scoped to
 * whatever was selected. Notes have always belonged to the whole slide, but
 * sitting inside a selection-contextual bar made them read as a property of the
 * highlighted text box.
 *
 * Splitting by scope fixes both: the bottom bar formats what you have selected,
 * this rail acts on the slide you are looking at.
 */

import { useState } from 'react';
import type { OverlayShape } from '../deck/types';

interface StageRailProps {
  onInsert: (kind: OverlayShape['kind']) => void;
  /** Slide-level speaker notes. */
  hasNotes: boolean;
  notesOpen: boolean;
  onToggleNotes: () => void;
}

/**
 * Duotone icons: a neutral outline plus exactly one emerald element.
 *
 * The single-accent rule is the house idiom - it is what the slide templates do
 * with their eyebrow rules and metric highlights - and it is what stops these
 * reading as stock outline glyphs. Each accent also says something: the shapes
 * carry the same corner handles the canvas draws on a selection, the chart's
 * tallest bar is the one being called out, the table's header row is filled.
 *
 * `accent` is passed in rather than hardcoded because the active button inverts
 * to a solid emerald background, where an emerald detail would vanish.
 */
type IconFn = (accent: string) => React.ReactNode;

const TOOLS: { kind: OverlayShape['kind']; label: string; icon: IconFn }[] = [
  {
    kind: 'text',
    label: 'Text box',
    icon: (a) => (
      <>
        <path d="M5 5.5h14M12 5.5V17" />
        <path d="M8.5 19.5h7" stroke={a} strokeWidth="2.4" />
      </>
    ),
  },
  {
    kind: 'rect',
    label: 'Rectangle',
    icon: (a) => (
      <>
        <rect x="4.5" y="6" width="15" height="12" />
        <rect x="2.9" y="4.4" width="3.2" height="3.2" fill={a} stroke="none" />
        <rect x="17.9" y="16.4" width="3.2" height="3.2" fill={a} stroke="none" />
      </>
    ),
  },
  {
    kind: 'ellipse',
    label: 'Oval',
    icon: (a) => (
      <>
        <ellipse cx="12" cy="12" rx="7.5" ry="6" />
        <rect x="2.9" y="4.4" width="3.2" height="3.2" fill={a} stroke="none" />
        <rect x="17.9" y="16.4" width="3.2" height="3.2" fill={a} stroke="none" />
      </>
    ),
  },
  {
    kind: 'image',
    label: 'Image',
    icon: (a) => (
      <>
        <rect x="3.5" y="5" width="17" height="14" />
        <path d="M3.5 15.5l4.5-4 3.5 3.2" />
        <circle cx="15.8" cy="9.8" r="1.9" fill={a} stroke="none" />
      </>
    ),
  },
  {
    kind: 'table',
    label: 'Table',
    icon: (a) => (
      <>
        {/* Fill first: painted after the outline it would cover the top border
            and the header divider. */}
        <rect x="3.5" y="5" width="17" height="4.6" fill={a} stroke="none" />
        <rect x="3.5" y="5" width="17" height="14" />
        <path d="M3.5 9.6h17M3.5 14.3h17M9.7 9.6V19M15.2 9.6V19" />
      </>
    ),
  },
  {
    kind: 'chart',
    label: 'Chart',
    icon: (a) => (
      <>
        <path d="M4.6 19.5v-5.8M19.4 19.5v-7.4" />
        <path d="M12 19.5V5.6" stroke={a} strokeWidth="2.6" />
      </>
    ),
  },
];

const NOTES_ICON: IconFn = (a) => (
  <>
    <path d="M4.5 6.5h15M4.5 11.5h15" />
    <path d="M4.5 16.5h8" stroke={a} strokeWidth="2.4" />
  </>
);

function RailButton({
  label,
  active,
  badge,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  badge?: boolean;
  onClick: () => void;
  children: (accent: string) => React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  // On the active button the background is solid emerald, so the accent has to
  // step out of the way; on hover it brightens instead.
  const accent = active ? 'rgba(255,255,255,0.72)' : hover ? 'var(--emerald-400)' : 'var(--emerald-500)';
  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <button
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, padding: 0,
          border: 'none', cursor: 'pointer',
          borderRadius: 'var(--radius-sharp)',
          background: active ? 'var(--emerald-500)' : hover ? 'var(--neutral-100)' : 'transparent',
          color: active ? '#fff' : 'var(--neutral-600)',
          transition: 'background .12s, color .12s',
          position: 'relative',
        }}
      >
        {children(accent)}
        {badge && !active && (
          <span
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--emerald-500)',
            }}
          />
        )}
      </button>

      {/* Opens to the left - the rail sits against the right edge. */}
      {hover && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', right: 'calc(100% + 8px)', top: '50%',
            transform: 'translateY(-50%)',
            padding: '3px 7px',
            background: 'var(--neutral-900)', color: '#fff',
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.06em', whiteSpace: 'nowrap',
            pointerEvents: 'none', zIndex: 1,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export function StageRail({ onInsert, hasNotes, notesOpen, onToggleNotes }: StageRailProps) {
  return (
    <div
      // Same mousedown guard as the bottom bar: clicking a tool must not blur
      // the field being edited, since blur is what commits its text.
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        right: 20,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 101,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: 4,
        background: '#fff',
        border: '1px solid var(--neutral-200)',
        boxShadow: '0 1px 2px rgba(15,23,20,0.05), 0 8px 24px -10px rgba(15,23,20,0.18)',
      }}
    >
      {TOOLS.map((t) => (
        <RailButton key={t.kind} label={t.label} onClick={() => onInsert(t.kind)}>
          {(accent) => (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {t.icon(accent)}
            </svg>
          )}
        </RailButton>
      ))}

      <span style={{ width: 20, height: 1, background: 'var(--neutral-200)', margin: '4px 0' }} />

      <RailButton label="Speaker notes" active={notesOpen} badge={hasNotes} onClick={onToggleNotes}>
        {(accent) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {NOTES_ICON(accent)}
          </svg>
        )}
      </RailButton>
    </div>
  );
}
