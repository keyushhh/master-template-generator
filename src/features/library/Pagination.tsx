import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ChevronBackIcon, ChevronDownIcon, ChevronForwardIcon } from '../ui/icons';

export const PAGE_SIZES = [10, 25, 50, 100] as const;

interface PaginationProps {
  /** Rows in the filtered set, across every page. */
  total: number;
  /** 1-based. */
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

/**
 * Page numbers with an ellipsis where the run is too long to print.
 *
 * Always yields the first page, the last page, and the current one with its
 * neighbours. A fixed-width run rather than every page keeps the control from
 * reflowing as you move through it, which is what otherwise makes Next drift out
 * from under the cursor on a long list.
 */
function pageRun(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const run: (number | 'gap')[] = [1];
  const from = Math.max(2, Math.min(page - 1, pages - 4));
  const to = Math.min(pages - 1, Math.max(page + 1, 5));
  if (from > 2) run.push('gap');
  for (let i = from; i <= to; i++) run.push(i);
  if (to < pages - 1) run.push('gap');
  run.push(pages);
  return run;
}

/** Rows-per-page, as a menu rather than a native `<select>`.
 *
 *  A select renders as the OS widget, which is the one control on this page that
 *  would not be ours - and it cannot show the current value as a tick, so on a
 *  narrow footer the chosen size and the label ran together. */
function PageSizeMenu({ pageSize, onPageSize }: { pageSize: number; onPageSize: (n: number) => void }) {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex items-center gap-1.5 h-[30px] px-2.5 text-[11.5px] border transition-colors cursor-pointer ${
          open
            ? 'border-neutral-500 bg-white text-neutral-900'
            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
        }`}
      >
        <span className="font-bold tabular-nums">{pageSize}</span>
        <span className="text-neutral-500">per page</span>
        <span
          aria-hidden
          className="text-neutral-400"
          style={{ display: 'flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        >
          <ChevronDownIcon size={12} />
        </span>
      </button>

      {open && (
        // Opens upward: this control sits at the bottom of the table card, so a
        // downward menu would hang past the end of the page it belongs to.
        <div
          role="listbox"
          className="absolute left-0 bottom-[calc(100%+5px)] z-30 w-[150px] py-1 bg-white border border-neutral-200"
          style={{ boxShadow: '0 12px 34px -10px rgba(15,23,20,0.30)' }}
        >
          {PAGE_SIZES.map((n) => {
            const active = n === pageSize;
            return (
              <button
                key={n}
                role="option"
                aria-selected={active}
                onClick={() => { onPageSize(n); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] text-[12px] text-left transition-colors cursor-pointer ${
                  active ? 'bg-emerald-50 font-bold text-emerald-800' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span
                  className={`shrink-0 w-[15px] h-[15px] flex items-center justify-center border ${
                    active ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-neutral-300 text-transparent'
                  }`}
                >
                  <CheckIcon size={10} />
                </span>
                <span className="tabular-nums">{n} per page</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Pagination, shared by the library's table and its grid.
 *
 * Replaces a "Show more" button, which was the wrong shape: it only ever grew the
 * page, so the way back from a long library was a scroll, and there was no way to
 * ask for "the older half".
 *
 * Carries First and Last as well as Back and Next. On a library of forty decks
 * that is a convenience; on one of four hundred it is the difference between
 * reaching the oldest deck in one press and in nineteen.
 */
export function Pagination({ total, page, pageSize, onPage, onPageSize }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const atFirst = page <= 1;
  const atLast = page >= pages;

  const cell =
    'h-[30px] min-w-[30px] flex items-center justify-center text-[11.5px] font-bold border transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed';
  const quiet = 'text-neutral-600 border-neutral-200 bg-white hover:border-neutral-400 hover:text-neutral-900';

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="text-[11.5px] text-neutral-500 tabular-nums whitespace-nowrap">
          {first}&ndash;{last} of {total}
        </span>
        <PageSizeMenu pageSize={pageSize} onPageSize={onPageSize} />
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(1)}
            disabled={atFirst}
            aria-label="First page"
            className={`${cell} ${quiet} px-2 gap-1`}
          >
            <span aria-hidden className="flex -mr-[3px]"><ChevronBackIcon size={11} /></span>
            <span aria-hidden className="flex"><ChevronBackIcon size={11} /></span>
            <span className="hidden md:inline ml-0.5">First</span>
          </button>
          <button
            onClick={() => onPage(page - 1)}
            disabled={atFirst}
            aria-label="Previous page"
            className={`${cell} ${quiet} px-2 gap-1`}
          >
            <ChevronBackIcon size={12} />
            <span className="hidden sm:inline">Back</span>
          </button>

          {pageRun(page, pages).map((entry, i) =>
            entry === 'gap' ? (
              <span
                key={`gap${i}`}
                aria-hidden
                className="min-w-[24px] text-center text-[11.5px] text-neutral-400 select-none"
              >
                &hellip;
              </span>
            ) : (
              <button
                key={entry}
                onClick={() => onPage(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? 'page' : undefined}
                className={`${cell} tabular-nums px-1.5 ${
                  entry === page ? 'bg-neutral-900 text-white border-neutral-900' : quiet
                }`}
              >
                {entry}
              </button>
            )
          )}

          <button
            onClick={() => onPage(page + 1)}
            disabled={atLast}
            aria-label="Next page"
            className={`${cell} ${quiet} px-2 gap-1`}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronForwardIcon size={12} />
          </button>
          <button
            onClick={() => onPage(pages)}
            disabled={atLast}
            aria-label="Last page"
            className={`${cell} ${quiet} px-2 gap-1`}
          >
            <span className="hidden md:inline mr-0.5">Last</span>
            <span aria-hidden className="flex -mr-[3px]"><ChevronForwardIcon size={11} /></span>
            <span aria-hidden className="flex"><ChevronForwardIcon size={11} /></span>
          </button>
        </div>
      )}
    </div>
  );
}
