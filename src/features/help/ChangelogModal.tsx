import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { CloseIcon, CheckIcon } from '../ui/icons';
import { CHANGELOG, formatReleaseDate, markChangelogSeen, type ChangeKind } from './changelog';

/** We'll use softer colors for the pills and timeline dots to give a premium feel. */
const GROUPS: { kind: ChangeKind; label: string; dot: string; text: string; bg: string }[] = [
  { kind: 'added', label: 'Added', dot: 'var(--emerald-500)', text: 'var(--emerald-700)', bg: 'bg-emerald-50 text-emerald-700' },
  { kind: 'improved', label: 'Improved', dot: 'var(--blue-500)', text: 'var(--blue-700)', bg: 'bg-blue-50 text-blue-700' },
  { kind: 'fixed', label: 'Fixed', dot: 'var(--orange-500)', text: 'var(--orange-700)', bg: 'bg-orange-50 text-orange-700' },
];

export function ChangelogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  const [activeFilter, setActiveFilter] = useState<ChangeKind | null>(null);

  useEffect(() => {
    if (!open) return;
    markChangelogSeen();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const visibleGroups = activeFilter ? GROUPS.filter((g) => g.kind === activeFilter) : GROUPS;
  const visibleReleases = CHANGELOG.filter((release) =>
    visibleGroups.some((g) => (release[g.kind]?.length ?? 0) > 0)
  );

  return createPortal(
    <div
      className="wg-overlay fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-neutral-900/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="What's new"
        className="wg-modal flex flex-col w-full max-w-[680px] max-h-[85vh] overflow-hidden my-auto bg-neutral-50/50 rounded-[var(--radius-sharp)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sleek Header & Filters */}
        <div className="flex flex-col gap-4 px-6 py-5 bg-white border-b border-neutral-150 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[18px] font-bold text-neutral-900 tracking-tight">What&rsquo;s new</h2>
              <span className="px-2 py-0.5 rounded-[var(--radius-sharp)] bg-neutral-100 font-mono text-[10px] text-neutral-500 font-medium">
                {CHANGELOG.length} updates
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-[var(--radius-sharp)] transition-colors cursor-pointer -mr-2"
            >
              <CloseIcon size={16} />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {GROUPS.map(({ kind, label, bg, text }) => {
              const isActive = activeFilter === kind;
              const isInactive = activeFilter !== null && activeFilter !== kind;
              return (
                <button
                  key={kind}
                  onClick={() => setActiveFilter((f) => (f === kind ? null : kind))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sharp)] text-[11px] font-bold tracking-wide uppercase transition-all duration-200 cursor-pointer ${
                    isActive
                      ? bg
                      : isInactive
                      ? 'bg-transparent text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100'
                      : 'bg-transparent text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  <span aria-hidden className="w-[5px] h-[5px] rounded-none" style={{ background: isActive ? text : 'currentColor' }} />
                  {label}
                </button>
              );
            })}
            {activeFilter && (
              <button
                onClick={() => setActiveFilter(null)}
                className="ml-2 px-3 py-1.5 rounded-[var(--radius-sharp)] text-[11px] font-bold tracking-wide uppercase text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Timeline Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-8 relative">
          {visibleReleases.length === 0 && (
            <div className="flex items-center justify-center h-40">
              <p className="text-[14px] text-neutral-400 font-medium">No updates found for this filter.</p>
            </div>
          )}

          <div className="flex flex-col gap-10">
            {visibleReleases.map((release) => {
              const isLatest = release.version === CHANGELOG[0].version;
              
              return (
                <section key={release.version} className="relative flex items-start gap-3 z-10">
                  {/* Timeline dot */}
                  <div className="shrink-0 mt-[15px] w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />

                  {/* Release Card */}
                  <div className="flex-1 bg-white border border-neutral-150 rounded-[var(--radius-sharp)] p-6 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] transition-shadow">
                    <div className="flex items-baseline justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-[18px] font-bold text-neutral-900 tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          Version {release.version}
                        </h3>
                        {isLatest && (
                          <span className="px-2 py-0.5 rounded-[var(--radius-sharp)] bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[9px] font-bold tracking-[0.1em] uppercase">
                            Latest
                          </span>
                        )}
                      </div>
                      <span className="text-[12px] font-medium text-neutral-400">
                        {formatReleaseDate(release.date)}
                      </span>
                    </div>

                    <p className="text-[14px] text-neutral-700 leading-relaxed mb-6 font-medium">
                      {release.summary}
                    </p>

                    <div className="flex flex-col gap-5">
                      {visibleGroups.map(({ kind, label, dot, text }) => {
                        const items = release[kind];
                        if (!items || items.length === 0) return null;
                        
                        return (
                          <div key={kind} className="flex flex-col gap-2.5">
                            <span
                              className="flex items-center gap-2 text-[10.5px] font-bold tracking-[0.08em] uppercase"
                              style={{ color: text }}
                            >
                              <span aria-hidden className="w-1.5 h-1.5 rounded-none shadow-sm" style={{ background: dot }} />
                              {label}
                            </span>
                            <ul className="flex flex-col gap-2.5 pl-3.5 border-l-2 border-neutral-100 ml-[3px]">
                              {items.map((line, j) => (
                                <li
                                  key={j}
                                  className="text-[13px] text-neutral-600 leading-relaxed"
                                >
                                  {line}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
