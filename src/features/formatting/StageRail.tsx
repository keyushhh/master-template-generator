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
 * Ionicons (outline set), inlined rather than pulled in as a web component.
 *
 * The `<ion-icon>` element fetches each glyph at runtime from a CDN, which
 * would put a network dependency in front of the editor's chrome. These are the
 * exact path data from the `ionicons` package, so they match the named icons
 * without shipping a loader.
 *
 * Their native canvas is 512x512 with a 32px stroke, so they are drawn at that
 * viewBox and scaled by the <svg> box - rescaling the paths into a 24 grid
 * would throw the stroke weight off against the rest of the set.
 */
const TOOLS: { kind: OverlayShape['kind']; label: string; icon: React.ReactNode }[] = [
  {
    kind: 'text',
    label: 'Text box',
    icon: (
      <>
        <path d="m32 415.5 120-320 120 320M230 303.5H74M326 239.5c12.19-28.69 41-48 74-48h0c46 0 80 32 80 80v144" />
        <path d="M320 358.5c0 36 26.86 58 60 58 54 0 100-27 100-106v-15c-20 0-58 1-92 5-32.77 3.86-68 19-68 58" />
      </>
    ),
  },
  {
    kind: 'rect',
    label: 'Rectangle',
    icon: <rect width="352" height="480" x="80" y="16" rx="48" ry="48" transform="rotate(-90 256 256)" />,
  },
  {
    kind: 'ellipse',
    label: 'Ellipse',
    icon: <circle cx="256" cy="256" r="192" />,
  },
  {
    kind: 'image',
    label: 'Image',
    icon: (
      <>
        <rect width="416" height="352" x="48" y="80" rx="48" ry="48" />
        <circle cx="336" cy="176" r="32" />
        <path d="m304 335.79-90.66-90.49a32 32 0 0 0-43.87-1.3L48 352M224 432l123.34-123.34a32 32 0 0 1 43.11-2L464 368" />
      </>
    ),
  },
  {
    kind: 'table',
    label: 'Table',
    icon: (
      <>
        <path d="M160 144h288M160 256h288M160 368h288" />
        <circle cx="80" cy="144" r="16" />
        <circle cx="80" cy="256" r="16" />
        <circle cx="80" cy="368" r="16" />
      </>
    ),
  },
  {
    kind: 'chart',
    label: 'Chart',
    icon: (
      <>
        <path d="M256.05 80.65Q263.94 80 272 80c106 0 192 86 192 192s-86 192-192 192A192.09 192.09 0 0 1 89.12 330.65" />
        <path d="M256 48C141.12 48 48 141.12 48 256a207.3 207.3 0 0 0 18.09 85L256 256Z" />
      </>
    ),
  },
];

const NOTES_ICON = (
  <>
    <path d="M416 221.25V416a48 48 0 0 1-48 48H144a48 48 0 0 1-48-48V96a48 48 0 0 1 48-48h98.75a32 32 0 0 1 22.62 9.37l141.26 141.26a32 32 0 0 1 9.37 22.62Z" />
    <path d="M256 56v120a32 32 0 0 0 32 32h120M176 288h160M176 368h160" />
  </>
);

/** Shared frame so every glyph keeps Ionicons' own proportions and weight. */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 512 512"
      fill="none"
      stroke="currentColor"
      strokeWidth="32"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

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
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
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
        {children}
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
          <Icon>{t.icon}</Icon>
        </RailButton>
      ))}

      <span style={{ width: 20, height: 1, background: 'var(--neutral-200)', margin: '4px 0' }} />

      <RailButton label="Speaker notes" active={notesOpen} badge={hasNotes} onClick={onToggleNotes}>
        <Icon>{NOTES_ICON}</Icon>
      </RailButton>
    </div>
  );
}
