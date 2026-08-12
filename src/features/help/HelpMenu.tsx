import { useEffect, useRef, useState } from 'react';
import { ChangelogModal } from './ChangelogModal';
import { CHANGELOG, hasUnreadChangelog, LATEST_VERSION } from './changelog';
import { MOD_KEY } from './platform';
import { DocumentTextIcon, HelpIcon, KeyboardIcon, SparklesIcon } from '../ui/icons';

interface HelpMenuProps {
  /** Opens the app's keyboard shortcuts overlay. Required rather than optional:
   *  an earlier version fell back to opening the changelog where no overlay was
   *  wired up, which means a row labelled "Keyboard shortcuts" showed something
   *  else entirely. */
  onOpenShortcuts: () => void;
}

/**
 * The help affordance: a single quiet (?) that opens the handful of things a
 * question mark should reach.
 *
 * Carries an unread dot while the newest release has not been read, so a
 * changelog nobody would think to look for still gets seen once. Opening it
 * clears the dot for that version, and the next release brings it back.
 */
export function HelpMenu({ onOpenShortcuts }: HelpMenuProps) {
  const [open, setOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [unread, setUnread] = useState(() => hasUnreadChangelog());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const row =
    'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer hover:bg-neutral-100';

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Help"
        aria-expanded={open}
        title="Help"
        className={`relative w-[34px] h-[34px] flex items-center justify-center border transition-colors cursor-pointer ${
          open
            ? 'bg-neutral-900 text-white border-neutral-900'
            : 'bg-white text-neutral-500 border-neutral-200 hover:text-neutral-900 hover:border-neutral-400'
        }`}
      >
        <HelpIcon size={17} />
        {unread && !open && (
          <span
            aria-hidden
            className="absolute top-[5px] right-[5px] w-[6px] h-[6px] rounded-full"
            style={{ background: 'var(--emerald-500)' }}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-[292px] py-1 bg-white border border-neutral-200"
          style={{ boxShadow: '0 14px 40px -10px rgba(15,23,20,0.30)' }}
        >
          <button
            onClick={() => { setOpen(false); setChangelogOpen(true); setUnread(false); }}
            className={row}
          >
            <span className="shrink-0 mt-[2px] text-emerald-600">
              <SparklesIcon size={15} />
            </span>
            <span className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[12.5px] font-bold text-neutral-900">What&rsquo;s new</span>
                {unread && (
                  <span className="font-mono text-[8.5px] font-bold tracking-[0.1em] uppercase px-1 py-[1px] bg-emerald-500 text-white">
                    New
                  </span>
                )}
              </span>
              <span className="text-[11px] text-neutral-500 leading-snug">
                Changelog, newest first. Now on {LATEST_VERSION}.
              </span>
            </span>
          </button>

          <button
            onClick={() => { setOpen(false); onOpenShortcuts(); }}
            className={row}
          >
            <span className="shrink-0 mt-[2px] text-neutral-400">
              <KeyboardIcon size={15} />
            </span>
            <span className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[12.5px] font-bold text-neutral-900">Keyboard shortcuts</span>
                <kbd className="font-mono text-[10px] font-bold text-neutral-500 bg-neutral-100 border border-neutral-200 px-1">
                  ?
                </kbd>
              </span>
              <span className="text-[11px] text-neutral-500 leading-snug">
                Search is {MOD_KEY} K. The rest live in the studio.
              </span>
            </span>
          </button>

          <div className="my-1 h-px bg-neutral-200" />

          <div className="px-3 py-2 flex items-start gap-3">
            <span className="shrink-0 mt-[2px] text-neutral-400">
              <DocumentTextIcon size={15} />
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[12.5px] font-bold text-neutral-900">Wozku Master Template</span>
              <span className="text-[11px] text-neutral-500 leading-snug">
                Version {LATEST_VERSION} · {CHANGELOG.length} release
                {CHANGELOG.length === 1 ? '' : 's'}. Everything is stored in this browser.
              </span>
            </span>
          </div>
        </div>
      )}

      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </div>
  );
}
