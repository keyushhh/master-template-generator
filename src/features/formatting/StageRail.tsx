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
import { DocumentTextIcon, EllipseIcon, ImageIcon, ListIcon, PieChartIcon, RectIcon, TextIcon } from '../ui/icons';

interface StageRailProps {
  onInsert: (kind: OverlayShape['kind']) => void;
  /** Slide-level speaker notes. */
  hasNotes: boolean;
  notesOpen: boolean;
  onToggleNotes: () => void;
}

const TOOLS: { kind: OverlayShape['kind']; label: string; icon: React.ReactNode }[] = [
  { kind: 'text', label: 'Text box', icon: <TextIcon size={19} /> },
  { kind: 'rect', label: 'Rectangle', icon: <RectIcon size={19} /> },
  { kind: 'ellipse', label: 'Ellipse', icon: <EllipseIcon size={19} /> },
  { kind: 'image', label: 'Image', icon: <ImageIcon size={19} /> },
  { kind: 'table', label: 'Table', icon: <ListIcon size={19} /> },
  { kind: 'chart', label: 'Chart', icon: <PieChartIcon size={19} /> },
];

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
          {t.icon}
        </RailButton>
      ))}

      <span style={{ width: 20, height: 1, background: 'var(--neutral-200)', margin: '4px 0' }} />

      <RailButton label="Speaker notes" active={notesOpen} badge={hasNotes} onClick={onToggleNotes}>
        <DocumentTextIcon size={19} />
      </RailButton>
    </div>
  );
}
