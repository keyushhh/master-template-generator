import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { CloseIcon } from '../ui/icons';
import { MOD_KEY } from '../help/platform';

interface Shortcut {
  keys: string[];
  description: string;
}

const GLOBAL_SHORTCUTS: Shortcut[] = [
  { keys: [MOD_KEY, 'Z'], description: 'Undo last committed change' },
  { keys: [MOD_KEY, 'Shift', 'Z'], description: 'Redo' },
  // Same key in both places, because it means the same thing in both: type what
  // you want rather than go and find it.
  { keys: [MOD_KEY, 'K'], description: 'Command palette here, deck search in the library' },
  { keys: ['Esc'], description: 'Close the open dialog' },
  { keys: ['?'], description: 'Show this shortcuts overlay' },
  { keys: ['G'], description: 'Organize the whole deck at once' },
  { keys: ['←', '→'], description: 'Previous / next slide on the stage' },
];

/** Edit-mode gestures. Documented here because several of them (shift-click to
 *  build a group, Alt to escape snapping) are otherwise invisible - discoverable
 *  only from a tooltip you have to already be hovering to see. */
const EDIT_SHORTCUTS: Shortcut[] = [
  { keys: ['Shift', 'Click'], description: 'Add another text field to the selection' },
  { keys: ['↑', '↓', '←', '→'], description: 'Nudge the selection' },
  { keys: ['Shift', 'Arrows'], description: 'Nudge by a full grid cell' },
  { keys: ['Alt'], description: 'Hold while dragging to ignore snapping' },
  { keys: ['Alt', '↑ / ↓'], description: 'Bring a shape forward / send it backward' },
  { keys: ['Delete'], description: 'Remove the selected shape' },
  { keys: ['Esc'], description: 'Clear the selection' },
];

const PRESENT_SHORTCUTS: Shortcut[] = [
  { keys: ['→', 'Space'], description: 'Next slide (or click the slide)' },
  { keys: ['←'], description: 'Previous slide' },
  { keys: ['Home', 'End'], description: 'First / last slide' },
  { keys: ['P'], description: 'Presenter view: next slide, notes, timer' },
  { keys: ['G'], description: 'Jump to any slide' },
  { keys: ['B'], description: 'Blank the screen' },
  { keys: ['T'], description: 'Start / pause the timer' },
  { keys: ['Esc'], description: 'Exit presentation' },
];

function KeyCap({ label }: { label: string }) {
  return (
    <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-bold text-neutral-700 bg-neutral-100 border border-neutral-300 rounded-[var(--radius-sharp)]">
      {label}
    </kbd>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-[13px] text-neutral-700">{shortcut.description}</span>
      <span className="flex items-center gap-1 shrink-0">
        {shortcut.keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            <KeyCap label={k} />
            {i < shortcut.keys.length - 1 && <span className="text-neutral-400 text-[11px]">+</span>}
          </span>
        ))}
      </span>
    </div>
  );
}

export function KeyboardShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="wg-overlay fixed inset-0 z-[310] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="wg-modal w-full max-w-[420px] max-h-[82vh] flex flex-col overflow-hidden my-auto bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-neutral-150 shrink-0">
          <h2 className="text-[15px] font-bold text-neutral-900">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
          >
            <CloseIcon size={14} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-5 py-3 divide-y divide-neutral-100">
          {GLOBAL_SHORTCUTS.map((s, i) => (
            <ShortcutRow key={i} shortcut={s} />
          ))}
        </div>
        <div className="sticky top-0 px-5 pt-2 pb-2 bg-white text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-neutral-400">
          While editing
        </div>
        <div className="px-5 divide-y divide-neutral-100">
          {EDIT_SHORTCUTS.map((s, i) => (
            <ShortcutRow key={i} shortcut={s} />
          ))}
        </div>
        <div className="sticky top-0 px-5 pt-3 pb-2 bg-white text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-neutral-400">
          While presenting
        </div>
        <div className="px-5 pb-4 divide-y divide-neutral-100">
          {PRESENT_SHORTCUTS.map((s, i) => (
            <ShortcutRow key={i} shortcut={s} />
          ))}
        </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
