import { useEffect, useState } from 'react';
import { clearLibrary, seedLibrary } from './seedLibrary';
import { CloseIcon, FlashIcon } from '../ui/icons';
import { setFitOutline, useFitOutline } from '../fit/fitStore';

/**
 * Floating state simulator.
 *
 * Exists because the states that matter most were the hardest to reach. A library
 * with forty decks across five clients, or one still loading, or one that is
 * genuinely empty, each need a different layout - and none of them could be seen
 * without an hour of manual setup, so none of them were being designed against.
 *
 * Compiled out of production entirely: the whole component returns null unless
 * `import.meta.env.DEV`, so the bundler drops it and there is no way for it to
 * appear in front of a client.
 */

interface DevPanelProps {
  /** Forces the host page into its loading treatment. */
  loading: boolean;
  onSetLoading: (loading: boolean) => void;
  /** Called after the underlying store changes, so the page can re-read it. */
  onDataChanged: () => void;
  /** How many decks are in the library right now, for the readout. */
  deckCount: number;
}

const SEEDS = [1, 3, 8, 20, 40];

export function DevPanel({ loading, onSetLoading, onDataChanged, deckCount }: DevPanelProps) {
  const [open, setOpen] = useState(false);
  const outline = useFitOutline();

  // Cmd/Ctrl + Shift + D, so the panel can be summoned without a mouse trip to
  // the corner while comparing states.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!import.meta.env.DEV) return null;

  const apply = (fn: () => void) => {
    fn();
    onDataChanged();
    // Without this, clearing the library while scrolled halfway down a long list
    // leaves the viewport below the end of a now-short page: the new state is
    // on screen but nowhere near the eye.
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const btn =
    'h-[30px] px-2.5 text-[11.5px] font-bold border transition-colors cursor-pointer whitespace-nowrap';

  return (
    <div className="fixed bottom-4 left-4 z-[300] flex flex-col items-start gap-2 print:hidden">
      {open && (
        <div
          className="w-[268px] bg-neutral-900 text-white shadow-2xl"
          style={{ boxShadow: '0 20px 50px -12px rgba(0,0,0,0.55)' }}
        >
          <div className="flex items-center justify-between gap-2 px-3 h-[38px] border-b border-white/10">
            <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-white/45">
              State simulator
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close simulator"
              className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              <CloseIcon size={13} />
            </button>
          </div>

          <div className="p-3 flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11.5px] text-white/50">In the library now</span>
              <span className="font-mono text-[12px] font-bold tabular-nums">
                {String(deckCount).padStart(2, '0')} decks
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] font-bold tracking-[0.14em] uppercase text-white/35">
                Seed decks
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SEEDS.map((n) => (
                  <button
                    key={n}
                    onClick={() => apply(() => seedLibrary(n))}
                    className={`${btn} bg-white/8 border-white/15 text-white hover:bg-white/20`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="text-[10.5px] text-white/35 leading-snug">
                Spread over 1&ndash;5 clients and back-dated across today, this week, this
                month and older.
              </span>
            </div>

            <div className="h-px bg-white/10" />

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] font-bold tracking-[0.14em] uppercase text-white/35">
                States
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => apply(clearLibrary)}
                  className={`${btn} bg-white/8 border-white/15 text-white hover:bg-white/20`}
                >
                  No decks
                </button>
                {/* A plain on/off toggle. It stays on until switched off, so the
                    skeleton can actually be looked at. */}
                <button
                  onClick={() => onSetLoading(!loading)}
                  aria-pressed={loading}
                  className={`${btn} ${
                    loading
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-white/8 border-white/15 text-white hover:bg-white/20'
                  }`}
                >
                  Loading {loading ? 'on' : 'off'}
                </button>
              </div>
            </div>

            <div className="h-px bg-white/10" />

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] font-bold tracking-[0.14em] uppercase text-white/35">
                Fit check
              </span>
              <button
                onClick={() => setFitOutline(!outline)}
                aria-pressed={outline}
                className={`${btn} self-start ${
                  outline
                    ? 'bg-amber-500 border-amber-500 text-neutral-900'
                    : 'bg-white/8 border-white/15 text-white hover:bg-white/20'
                }`}
              >
                Outline clipped text {outline ? 'on' : 'off'}
              </button>
              <span className="text-[10.5px] text-white/35 leading-snug">
                Boxes every finding on the slide itself, in the studio and the rail. Amber for an
                overrun, red once a line is gone. The only way to tell a real clip from a
                tolerance that is set too tight.
              </span>
            </div>

            <span className="text-[10px] text-white/30 leading-snug">
              Dev build only. Seeding replaces every deck and brand kit in this browser.
            </span>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title="State simulator (⌘⇧D)"
        aria-label="State simulator"
        className="flex items-center gap-2 h-[34px] px-3 bg-neutral-900 text-white text-[11.5px] font-bold hover:bg-neutral-800 transition-colors cursor-pointer"
        style={{ boxShadow: '0 8px 24px -8px rgba(0,0,0,0.45)' }}
      >
        <FlashIcon size={13} />
        {open ? 'Close' : 'States'}
      </button>
    </div>
  );
}
