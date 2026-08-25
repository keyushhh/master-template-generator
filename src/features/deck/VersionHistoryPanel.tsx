import { useRef } from 'react';
import { CloseIcon } from '../ui/icons';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { userById } from '../auth/demoUsers';
import type { DeckVersion } from './versionStore';

interface Props {
  open: boolean;
  onClose: () => void;
  versions: DeckVersion[];
  onRestore: (version: DeckVersion) => void;
  /** Restoring is an edit, so a viewer cannot do it. */
  canRestore: boolean;
}

function whenText(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function VersionHistoryPanel({ open, onClose, versions, onRestore, canRestore }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, open);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
      <div
        ref={containerRef}
        className="w-full max-w-[440px] max-h-[70vh] flex flex-col bg-white border border-neutral-200 shadow-2xl rounded-[var(--radius-sharp)] overflow-hidden animate-in fade-in zoom-in-95 duration-120"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 bg-neutral-50 shrink-0">
          <div>
            <h2
              className="text-[16px] font-bold text-neutral-900 tracking-[-0.01em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Version history
            </h2>
            <p className="text-[12px] text-neutral-500">
              Saved automatically as this deck is edited
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close version history"
            className="p-1 text-neutral-400 hover:text-neutral-800 transition-colors cursor-pointer"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-3 flex flex-col gap-1.5">
          {versions.length === 0 ? (
            <p className="text-[12.5px] text-neutral-500 p-4 text-center leading-relaxed">
              No versions yet. The first one is saved shortly after you start editing.
            </p>
          ) : (
            versions.map((v, i) => {
              const author = userById(v.authorId);
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-3 p-2.5 border border-neutral-200 rounded-[var(--radius-sharp)] bg-neutral-50/50"
                >
                  <span
                    className="w-7 h-7 shrink-0 flex items-center justify-center text-[9.5px] font-mono font-bold text-white"
                    style={{ backgroundColor: author?.color ?? '#737373' }}
                  >
                    {(author?.name ?? 'Unknown').split(' ').map((x) => x[0]).join('').slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-bold text-neutral-900 flex items-center gap-1.5">
                      {whenText(v.at)}
                      {i === 0 && (
                        <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5">
                          Current
                        </span>
                      )}
                      {v.restoredFrom !== undefined && (
                        <span className="text-[10px] font-mono font-semibold text-blue-700 bg-blue-100/60 px-1.5 py-0.5">
                          Restored
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-neutral-500 truncate">
                      {author?.name ?? 'Unknown editor'} · {v.deck.slides.length} slides
                    </div>
                  </div>
                  {i !== 0 && canRestore && (
                    <button
                      type="button"
                      onClick={() => onRestore(v)}
                      className="shrink-0 h-7 px-2.5 text-[11.5px] font-bold text-neutral-800 bg-white border border-neutral-200 hover:border-neutral-900 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
                    >
                      Restore
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50 shrink-0">
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Restoring keeps everything newer, adding the restored deck as the latest version.
          </p>
        </div>
      </div>
    </div>
  );
}
