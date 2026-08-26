import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { CloseIcon, SearchIcon } from '../ui/icons';
import { detectIsApple, formatShortcutKey } from '../help/platform';

interface Shortcut {
  keys: string[];
  description: string;
  category: 'general' | 'editing' | 'presenting';
  keywords?: string[];
}

const ALL_SHORTCUTS: Shortcut[] = [
  // ── General & Navigation ───────────────────────────────────────────────────
  {
    keys: ['Mod', 'Z'],
    description: 'Undo last committed change',
    category: 'general',
    keywords: ['revert', 'back', 'history', 'ctrl', 'cmd'],
  },
  {
    keys: ['Mod', 'Shift', 'Z'],
    description: 'Redo previously undone change',
    category: 'general',
    keywords: ['forward', 'repeat', 'ctrl', 'cmd'],
  },
  {
    keys: ['Mod', 'F'],
    description: 'Find and replace across all slides in the deck',
    category: 'general',
    keywords: ['search', 'locate', 'text', 'ctrl', 'cmd'],
  },
  {
    keys: ['Mod', 'Enter'],
    description: 'Start full presentation mode',
    category: 'general',
    keywords: ['play', 'slideshow', 'fullscreen', 'ctrl', 'cmd', 'return'],
  },
  {
    keys: ['/'],
    description: 'Cursor Chat: broadcast a temporary live message',
    category: 'general',
    keywords: ['chat', 'talk', 'collab', 'cursor', 'slash'],
  },
  {
    keys: ['C'],
    description: 'Comment Mode: click anywhere to drop a comment pin',
    category: 'general',
    keywords: ['feedback', 'pin', 'notes', 'review'],
  },
  {
    keys: ['Shift', 'C'],
    description: 'Toggle comments visibility on canvas',
    category: 'general',
    keywords: ['hide', 'show', 'pins'],
  },
  {
    keys: ['N'],
    description: 'Add a new slide to the deck',
    category: 'general',
    keywords: ['create', 'insert', 'page'],
  },
  {
    keys: ['G'],
    description: 'Slide Sorter: organize and overview the entire deck',
    category: 'general',
    keywords: ['grid', 'overview', 'reorder', 'sorter'],
  },
  {
    keys: ['Alt', '↑ / ↓'],
    description: 'Move focused slide position up or down in the deck',
    category: 'general',
    keywords: ['reorder', 'shift', 'swap', 'option', 'arrows'],
  },
  {
    keys: ['←', '→'],
    description: 'Navigate to previous or next slide on stage',
    category: 'general',
    keywords: ['prev', 'next', 'step', 'arrows'],
  },
  {
    keys: ['?'],
    description: 'Show / hide this keyboard shortcuts sheet',
    category: 'general',
    keywords: ['help', 'overlay', 'hotkeys', 'question'],
  },
  {
    keys: ['Esc'],
    description: 'Close the active modal dialog or sheet',
    category: 'general',
    keywords: ['dismiss', 'exit', 'cancel', 'escape'],
  },

  // ── While Editing ──────────────────────────────────────────────────────────
  {
    keys: ['Mod', 'C'],
    description: 'Copy selected shape, field, or slide',
    category: 'editing',
    keywords: ['clipboard', 'duplicate', 'ctrl', 'cmd'],
  },
  {
    keys: ['Mod', 'V'],
    description: 'Paste copied element or slide',
    category: 'editing',
    keywords: ['clipboard', 'insert', 'ctrl', 'cmd'],
  },
  {
    keys: ['Mod', 'D'],
    description: 'Duplicate selected shape or slide in-place',
    category: 'editing',
    keywords: ['clone', 'copy', 'ctrl', 'cmd'],
  },
  {
    keys: ['Shift', 'Click'],
    description: 'Add or remove another text field from multi-selection',
    category: 'editing',
    keywords: ['multi-select', 'group', 'combine'],
  },
  {
    keys: ['↑', '↓', '←', '→'],
    description: 'Nudge the active selection by 1 pixel',
    category: 'editing',
    keywords: ['move', 'arrows', 'position', 'align'],
  },
  {
    keys: ['Shift', 'Arrows'],
    description: 'Nudge the selection by a full grid cell (10px)',
    category: 'editing',
    keywords: ['jump', 'grid', 'step', 'arrows'],
  },
  {
    keys: ['Alt'],
    description: 'Hold while dragging an element to ignore smart snapping',
    category: 'editing',
    keywords: ['freeform', 'drag', 'guidelines', 'option'],
  },
  {
    keys: ['Alt', '↑ / ↓'],
    description: 'Bring selected shape forward or send it backward in layer stack',
    category: 'editing',
    keywords: ['layer', 'order', 'z-index', 'arrange', 'option', 'arrows'],
  },
  {
    keys: ['Delete'],
    description: 'Remove the selected shape or content block',
    category: 'editing',
    keywords: ['backspace', 'trash', 'clear', 'del'],
  },
  {
    keys: ['Esc'],
    description: 'Clear current element selection or exit inline edit',
    category: 'editing',
    keywords: ['deselect', 'unfocus', 'escape'],
  },

  // ── While Presenting ───────────────────────────────────────────────────────
  {
    keys: ['→', 'Space'],
    description: 'Advance to the next slide (or click anywhere on slide)',
    category: 'presenting',
    keywords: ['forward', 'play', 'spacebar'],
  },
  {
    keys: ['←'],
    description: 'Go back to the previous slide',
    category: 'presenting',
    keywords: ['back', 'reverse'],
  },
  {
    keys: ['Home', 'End'],
    description: 'Jump directly to the first or last slide of presentation',
    category: 'presenting',
    keywords: ['start', 'finish'],
  },
  {
    keys: ['P'],
    description: 'Open Presenter View: see notes, timer, and upcoming slide',
    category: 'presenting',
    keywords: ['speaker', 'timer', 'notes', 'stage'],
  },
  {
    keys: ['G'],
    description: 'Jump to any slide number immediately',
    category: 'presenting',
    keywords: ['picker', 'goto', 'search'],
  },
  {
    keys: ['B'],
    description: 'Blank / blackout screen to focus audience attention',
    category: 'presenting',
    keywords: ['black', 'dark', 'hide'],
  },
  {
    keys: ['T'],
    description: 'Start, pause, or resume the presentation timer',
    category: 'presenting',
    keywords: ['stopwatch', 'clock'],
  },
  {
    keys: ['Esc'],
    description: 'Exit presentation mode and return to studio',
    category: 'presenting',
    keywords: ['leave', 'close', 'quit', 'escape'],
  },
];

type CategoryId = 'all' | 'general' | 'editing' | 'presenting';

const CATEGORIES: { id: CategoryId; label: string; count: number }[] = [
  { id: 'all', label: 'All', count: ALL_SHORTCUTS.length },
  { id: 'general', label: 'General', count: ALL_SHORTCUTS.filter((s) => s.category === 'general').length },
  { id: 'editing', label: 'Editing', count: ALL_SHORTCUTS.filter((s) => s.category === 'editing').length },
  { id: 'presenting', label: 'Presenting', count: ALL_SHORTCUTS.filter((s) => s.category === 'presenting').length },
];

const CATEGORY_TITLES: Record<Exclude<CategoryId, 'all'>, string> = {
  general: 'General & Navigation',
  editing: 'Canvas & Editing gestures',
  presenting: 'Presentation mode',
};

function KeyCap({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-[22px] px-2 text-[11.5px] font-mono font-semibold text-neutral-800 bg-neutral-100/90 border border-neutral-300 rounded-none shadow-[0_1px_0_0_rgba(0,0,0,0.06)] select-none">
      {label}
    </kbd>
  );
}

function ShortcutRow({ shortcut, isApple }: { shortcut: Shortcut; isApple: boolean }) {
  const resolvedKeys = useMemo(
    () => shortcut.keys.map((k) => formatShortcutKey(k, isApple)),
    [shortcut.keys, isApple]
  );

  return (
    <div className="flex items-center justify-between gap-6 px-6 py-2.5 hover:bg-neutral-50/80 transition-colors group">
      <span className="text-[13px] text-neutral-800 font-normal leading-tight select-text">
        {shortcut.description}
      </span>
      <div className="flex items-center gap-1.5 shrink-0 select-none">
        {resolvedKeys.map((k, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <KeyCap label={k} />
            {i < resolvedKeys.length - 1 && (
              <span className="text-neutral-400 font-mono text-[11px] font-medium">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Dynamically detected from client user agent; user can also toggle preview
  const [isApple, setIsApple] = useState<boolean>(() => detectIsApple());

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    setSearchQuery('');
    setSelectedCategory('all');
    setIsApple(detectIsApple());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ALL_SHORTCUTS.filter((shortcut) => {
      if (selectedCategory !== 'all' && shortcut.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;

      const descMatch = shortcut.description.toLowerCase().includes(q);
      const rawKeyMatch = shortcut.keys.some((k) => k.toLowerCase().includes(q));
      const formattedKeyMatch = shortcut.keys.some((k) =>
        formatShortcutKey(k, isApple).toLowerCase().includes(q)
      );
      const keywordMatch = shortcut.keywords?.some((kw) => kw.toLowerCase().includes(q));
      return descMatch || rawKeyMatch || formattedKeyMatch || keywordMatch;
    });
  }, [selectedCategory, searchQuery, isApple]);

  const grouped = useMemo(() => {
    const map = new Map<Exclude<CategoryId, 'all'>, Shortcut[]>();
    for (const item of filteredShortcuts) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [filteredShortcuts]);

  if (!open) return null;

  return createPortal(
    <div
      className="wg-overlay fixed inset-0 z-[310] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Keyboard shortcuts"
        className="wg-modal w-full max-w-[760px] max-h-[85vh] flex flex-col overflow-hidden my-auto bg-white rounded-none border border-neutral-300 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col bg-white border-b border-neutral-200 shrink-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-150">
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-bold text-neutral-900 tracking-tight">Keyboard shortcuts</h2>
              <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-600 font-mono text-[10.5px] font-medium rounded-none">
                {ALL_SHORTCUTS.length} shortcuts
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close keyboard shortcuts"
              className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-none border border-transparent hover:border-neutral-200 transition-colors cursor-pointer"
            >
              <CloseIcon size={14} />
            </button>
          </div>

          {/* Controls: Category Tabs & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-3 bg-neutral-50/50">
            {/* Category tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {CATEGORIES.map(({ id, label, count }) => {
                const isActive = selectedCategory === id;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedCategory(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-none border transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm font-semibold'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`text-[10px] font-mono px-1 py-0.2 rounded-none ${
                        isActive ? 'bg-neutral-800 text-neutral-200' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick search input */}
            <div className="relative min-w-[200px] sm:w-[240px]">
              <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-neutral-400">
                <SearchIcon size={13} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search shortcuts..."
                className="w-full pl-8 pr-7 py-1.5 text-[12.5px] bg-white border border-neutral-200 rounded-none text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute inset-y-0 right-2 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  aria-label="Clear search"
                >
                  <CloseIcon size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Shortcuts list container */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-neutral-100">
          {filteredShortcuts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <p className="text-[14px] font-medium text-neutral-700">No shortcuts found</p>
              <p className="text-[12px] text-neutral-500 mt-1">
                No matching shortcut for &ldquo;{searchQuery}&rdquo;. Try another search term.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="mt-3 px-3 py-1.5 text-[11.5px] font-medium bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-none text-neutral-800 transition-colors cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            (Array.from(grouped.entries()) as [Exclude<CategoryId, 'all'>, Shortcut[]][]).map(([category, items]) => (
              <div key={category} className="flex flex-col">
                <div className="sticky top-0 z-10 px-6 py-2 bg-neutral-100/90 backdrop-blur-sm border-y border-neutral-200/80 flex items-center justify-between select-none">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-neutral-600">
                    {CATEGORY_TITLES[category]}
                  </span>
                  <span className="text-[10.5px] font-mono text-neutral-500">
                    {items.length} {items.length === 1 ? 'action' : 'actions'}
                  </span>
                </div>
                <div className="divide-y divide-neutral-100/80">
                  {items.map((shortcut, idx) => (
                    <ShortcutRow key={idx} shortcut={shortcut} isApple={isApple} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 select-none">
          <div className="flex items-center gap-2 text-[11.5px] text-neutral-500">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 text-[10.5px] font-mono bg-white border border-neutral-300 text-neutral-700 rounded-none shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
              Esc
            </kbd>
            <span>or</span>
            <kbd className="px-1.5 py-0.5 text-[10.5px] font-mono bg-white border border-neutral-300 text-neutral-700 rounded-none shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
              ?
            </kbd>
            <span>anywhere to toggle</span>
          </div>

          {/* Dynamic Platform Selector / Switcher */}
          <div className="flex items-center gap-1.5 text-[11.5px] text-neutral-600">
            <span className="text-neutral-400 font-mono text-[11px]">Platform:</span>
            <div className="inline-flex items-center border border-neutral-200 bg-white p-0.5 rounded-none shadow-xs">
              <button
                type="button"
                onClick={() => setIsApple(true)}
                className={`px-2 py-0.5 text-[10.5px] font-mono rounded-none transition-colors cursor-pointer ${
                  isApple
                    ? 'bg-neutral-900 text-white font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
                title="View macOS shortcuts (⌘)"
              >
                macOS (⌘)
              </button>
              <button
                type="button"
                onClick={() => setIsApple(false)}
                className={`px-2 py-0.5 text-[10.5px] font-mono rounded-none transition-colors cursor-pointer ${
                  !isApple
                    ? 'bg-neutral-900 text-white font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
                title="View Windows / Linux shortcuts (Ctrl)"
              >
                Windows / Linux (Ctrl)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
