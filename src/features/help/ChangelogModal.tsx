import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { CloseIcon } from '../ui/icons';
import { CHANGELOG, formatReleaseDate, markChangelogSeen, type ChangeKind } from './changelog';

/** Each group's label and the colour that carries it. Added is the accent because
 *  new capability is the thing worth spotting; fixed is deliberately quiet. */
const GROUPS: { kind: ChangeKind; label: string; dot: string; text: string }[] = [
  { kind: 'added', label: 'Added', dot: 'var(--emerald-500)', text: 'var(--emerald-700)' },
  { kind: 'improved', label: 'Improved', dot: 'var(--neutral-900)', text: 'var(--neutral-800)' },
  { kind: 'fixed', label: 'Fixed', dot: 'var(--neutral-400)', text: 'var(--neutral-500)' },
];

/**
 * What's new.
 *
 * Set as a running record rather than a marketing page: releases newest-first,
 * each with a version, a date and its changes grouped by what kind of change they
 * are. Opening it marks the newest release read, which is what clears the dot on
 * the help button.
 *
 * Rendered into `document.body` rather than in place. The help button lives in
 * the library masthead, and that masthead carries a `backdrop-filter` - which
 * silently makes the header a containing block for `position: fixed`
 * descendants. So `inset-0` resolved against the 68px-tall header instead of
 * the viewport, and the modal appeared as a sliver clipped to the top bar. A
 * portal takes it out of that ancestor chain entirely.
 */
export function ChangelogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    markChangelogSeen();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="wg-overlay fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Changelog"
        className="wg-modal flex flex-col w-full max-w-[460px] max-h-[68vh] overflow-hidden my-auto bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center gap-2.5 px-5 py-3.5 border-b border-neutral-150 shrink-0">
          <h2 className="text-[14px] font-bold text-neutral-900">What&rsquo;s new</h2>
          <span className="font-mono text-[10px] text-neutral-400">{CHANGELOG.length} releases</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2.5 right-3 w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <CloseIcon size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {CHANGELOG.map((release, i) => (
            <section key={release.version} className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className="font-mono text-[11.5px] font-bold text-neutral-900"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {release.version}
                </span>
                {i === 0 && (
                  <span className="font-mono text-[8px] font-bold tracking-[0.1em] uppercase px-1 py-[1px] bg-emerald-500 text-white">
                    Latest
                  </span>
                )}
                <span className="text-[10.5px] text-neutral-400">{formatReleaseDate(release.date)}</span>
              </div>

              <p className="text-[12px] font-semibold text-neutral-800 leading-snug">
                {release.summary}
              </p>

              {GROUPS.map(({ kind, label, dot, text }) => {
                const items = release[kind];
                if (!items || items.length === 0) return null;
                return (
                  <div key={kind} className="flex flex-col gap-1 mt-0.5">
                    <span
                      className="flex items-center gap-1.5 font-mono text-[8.5px] font-bold tracking-[0.12em] uppercase"
                      style={{ color: text }}
                    >
                      <span aria-hidden className="w-[5px] h-[5px]" style={{ background: dot }} />
                      {label}
                    </span>
                    <ul className="flex flex-col gap-1 pl-[12px]">
                      {items.map((line, j) => (
                        <li
                          key={j}
                          className="relative text-[11.5px] text-neutral-600 leading-[1.5] before:absolute before:-left-[12px] before:top-[8px] before:w-[4px] before:h-[1px] before:bg-neutral-300"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {i < CHANGELOG.length - 1 && <div className="h-px bg-neutral-150 mt-2" />}
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
