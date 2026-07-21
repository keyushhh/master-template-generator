import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../a11y/useFocusTrap';

interface Shortcut {
  keys: string[];
  description: string;
}

const GLOBAL_SHORTCUTS: Shortcut[] = [
  { keys: ['Cmd/Ctrl', 'Z'], description: 'Undo last committed change' },
  { keys: ['Cmd/Ctrl', 'Shift', 'Z'], description: 'Redo' },
  { keys: ['Esc'], description: 'Close the open dialog' },
  { keys: ['?'], description: 'Show this shortcuts overlay' },
];

const PRESENT_SHORTCUTS: Shortcut[] = [
  { keys: ['→', 'Space'], description: 'Next slide' },
  { keys: ['←'], description: 'Previous slide' },
  { keys: ['Esc'], description: 'Exit presentation' },
];

function KeyCap({ label }: { label: string }) {
  return (
    <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-bold text-neutral-700 bg-neutral-100 border border-neutral-300 rounded-[4px]">
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm p-6" onClick={onClose}>
      <div
        ref={panelRef}
        className="w-full max-w-sm bg-white rounded-[var(--radius-sharp)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-neutral-150">
          <h2 className="text-[15px] font-bold text-neutral-900">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="px-5 py-3 divide-y divide-neutral-100">
          {GLOBAL_SHORTCUTS.map((s, i) => (
            <ShortcutRow key={i} shortcut={s} />
          ))}
        </div>
        <div className="px-5 pt-1 pb-2 text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-neutral-400">
          While presenting
        </div>
        <div className="px-5 pb-4 divide-y divide-neutral-100">
          {PRESENT_SHORTCUTS.map((s, i) => (
            <ShortcutRow key={i} shortcut={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
