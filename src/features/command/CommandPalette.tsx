import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MOD_KEY } from '../help/platform';
import { SearchIcon } from '../ui/icons';

export interface Command {
  id: string;
  label: string;
  /** Section heading. Commands are shown grouped, in the order the groups first
   *  appear in the array. */
  group: string;
  /** Right-hand note: a shortcut, a slide number, a state. */
  hint?: string;
  /** Extra words that should match this command but do not belong in its label.
   *  A layout's group name, a slide's template, the word "delete" on Remove. */
  keywords?: string;
  /** Hidden until something is typed. For the long tails - every layout, every
   *  slide - that would otherwise bury the handful of things people actually
   *  come here for. */
  secondary?: boolean;
  disabled?: boolean;
  run: () => void;
}

/**
 * How well `text` answers `query`. 0 means it does not.
 *
 * Three tiers rather than a real fuzzy score: a prefix beats a word start beats
 * letters in order. That is enough to put "Present" first when you type "pre"
 * and to let "dm" find Data Monument, and it is honest about being a lookup
 * rather than pretending to rank relevance.
 */
function score(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 4;
  const at = t.indexOf(q);
  if (at === 0) return 4;
  if (at > 0) return t[at - 1] === ' ' ? 3 : 2;
  // Subsequence: every letter of the query appears in order.
  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i++;
    if (i === q.length) return 1;
  }
  return 0;
}

/**
 * One place to reach everything in the studio.
 *
 * The studio's problem was not that it lacked controls but that it had them in
 * fourteen places: the layout picker was a grid you had to open and scan, the
 * organiser was behind a letter key, and jumping to slide nine of forty meant
 * scrolling a rail. All of it is faster to *name* than to find, and naming is
 * what a palette is for.
 *
 * It is also the clearest place the app beats the tools it is competing with.
 * Google Slides makes you hunt menus. Fourteen named layouts and a deck of named
 * slides is exactly the kind of vocabulary a palette handles better than any
 * amount of picker design.
 */
export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // A palette that remembers last time's query is a palette you have to clear
  // before you can use it.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim();
    const scored = commands
      .filter((c) => !c.disabled && (q !== '' || !c.secondary))
      .map((c) => ({ c, s: Math.max(score(q, c.label), score(q, c.keywords ?? '') * 0.9) }))
      .filter((x) => x.s > 0);

    const out: { name: string; items: Command[] }[] = [];
    for (const { c } of scored) {
      const g = out.find((x) => x.name === c.group);
      if (g) g.items.push(c);
      else out.push({ name: c.group, items: [c] });
    }
    // Sort inside each group only. Keeping the group order fixed means the
    // palette does not rearrange itself under the cursor as you type, which is
    // what makes muscle memory possible at all.
    if (q) {
      const rank = new Map(scored.map(({ c, s }) => [c.id, s]));
      for (const g of out) g.items.sort((a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0));
    }
    return out;
  }, [commands, query]);

  /** Every visible command in display order, which is what the arrow keys walk. */
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Clamp rather than reset: filtering down to fewer results should leave the
  // selection on the last row, not silently jump it back to the top.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  useEffect(() => {
    if (!open) return;
    // Focus after paint. Focusing during the same commit races the portal's
    // insertion and silently does nothing.
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Keep the highlighted row on screen when it is reached by keyboard.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, flat.length]);

  if (!open) return null;

  const runAt = (i: number) => {
    const cmd = flat[i];
    if (!cmd) return;
    // Close first. Several commands open a modal of their own, and a palette
    // still on screen behind it is a stack of two dialogs.
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setActive((a) => (flat.length ? (a + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(Math.max(0, flat.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let index = -1;

  return createPortal(
    <div
      className="wg-overlay fixed inset-0 z-[400] flex items-start justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        // Sits high rather than centred: the list grows downward as you type, and
        // a centred panel would drift up the screen while you were reading it.
        className="wg-modal flex flex-col w-full max-w-[520px] mt-[9vh] max-h-[64vh] overflow-hidden bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 h-[46px] border-b border-neutral-150 shrink-0">
          <span className="shrink-0 text-neutral-600 flex items-center">
            <SearchIcon size={15} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Go to a slide, change a layout, export…"
            aria-label="Search commands"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent text-[14px] text-neutral-900 placeholder:text-neutral-600 outline-none"
          />
          <span className="shrink-0 font-mono text-[10px] text-neutral-600">esc</span>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-1.5">
          {flat.length === 0 && (
            <div className="px-4 py-6 text-center text-[12.5px] text-neutral-600">
              Nothing matches &ldquo;{query}&rdquo;
            </div>
          )}

          {groups.map((g) => (
            <div key={g.name} className="mb-1">
              <div className="px-4 pt-2 pb-1 font-mono text-[8.5px] font-bold tracking-[0.14em] uppercase text-neutral-600">
                {g.name}
              </div>
              {g.items.map((c) => {
                index++;
                const i = index;
                const isActive = i === active;
                return (
                  <button
                    key={c.id}
                    data-active={isActive}
                    // Pointer, not click: the row under the cursor should be the
                    // one Enter runs, so hovering and typing cannot disagree.
                    onMouseMove={() => setActive(i)}
                    onClick={() => runAt(i)}
                    className={`w-full flex items-center gap-3 px-4 py-[7px] text-left transition-colors cursor-pointer ${
                      isActive ? 'bg-emerald-50' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <span
                      className={`flex-1 min-w-0 truncate text-[13px] ${
                        isActive ? 'font-bold text-emerald-900' : 'text-neutral-700'
                      }`}
                    >
                      {c.label}
                    </span>
                    {c.hint && (
                      <span
                        className={`shrink-0 font-mono text-[10px] ${
                          isActive ? 'text-emerald-700/80' : 'text-neutral-600'
                        }`}
                      >
                        {c.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="shrink-0 flex items-center gap-3 px-4 h-[32px] border-t border-neutral-150 bg-neutral-50 font-mono text-[9.5px] text-neutral-600">
          <span>↑↓ move</span>
          <span>↵ run</span>
          <span className="ml-auto">{MOD_KEY}K</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
