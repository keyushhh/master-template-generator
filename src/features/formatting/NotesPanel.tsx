/**
 * Speaker notes for the slide on the stage.
 *
 * A panel rather than a dropdown inside the formatting bar, because notes are a
 * property of the whole slide and the old placement said otherwise: sitting
 * between Bold and Colour, it read as a note attached to whichever text box was
 * selected. Here it is titled with the slide's own name and stays open while
 * you move around the slide, which is how notes actually get written.
 */

import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from '../ui/icons';

interface NotesPanelProps {
  slideTitle: string;
  notes: string;
  onChange: (notes: string) => void;
  onClose: () => void;
}

export function NotesPanel({ slideTitle, notes, onChange, onClose }: NotesPanelProps) {
  const [draft, setDraft] = useState(notes);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Follow the slide unless the user is mid-sentence, which would otherwise
  // yank their text out from under them when the deck re-renders.
  useEffect(() => {
    if (!editing) setDraft(notes);
  }, [notes, editing]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const commit = () => {
    setEditing(false);
    if (draft !== notes) onChange(draft);
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: 66,
        bottom: 18,
        width: 340,
        zIndex: 101,
        background: '#fff',
        border: '1px solid var(--neutral-200)',
        boxShadow: '0 2px 6px rgba(15,23,20,0.06), 0 18px 44px -14px rgba(15,23,20,0.28)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '9px 10px 9px 12px',
          borderBottom: '1px solid var(--neutral-150, var(--neutral-200))',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--neutral-600)',
            }}
          >
            Speaker notes
          </div>
          <div
            style={{
              fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-800)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            title={slideTitle}
          >
            {slideTitle}
          </div>
        </div>
        <button
          onClick={() => { commit(); onClose(); }}
          aria-label="Close speaker notes"
          style={{
            flexShrink: 0, width: 26, height: 26, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--neutral-600)',
          }}
        >
          <CloseIcon size={14} />
        </button>
      </div>

      <textarea
        ref={ref}
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Esc closes; the panel is not a dialog and Enter must stay a newline.
          if (e.key === 'Escape') { e.preventDefault(); commit(); onClose(); }
        }}
        placeholder="What you'll say on this slide. Goes to PowerPoint's notes pane and Present mode, never onto the slide itself."
        rows={7}
        style={{
          width: '100%', resize: 'vertical', padding: 12,
          fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.55,
          color: 'var(--neutral-900)', background: '#fff',
          border: 'none', outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
