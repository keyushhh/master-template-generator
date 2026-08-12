import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../a11y/useFocusTrap';
import type { FolderMeta } from './deckStore';

/**
 * Deleting a folder is really two different actions wearing one button: "get
 * rid of this grouping" (decks survive, unfiled) or "get rid of everything in
 * it" (decks gone too). A single "delete folder?" confirmation can't say which
 * one is about to happen, so it has to ask - the choice, not just a yes/no.
 */
export function DeleteFolderModal({
  open,
  folder,
  deckCount,
  onCancel,
  onKeepDecks,
  onDeleteDecks,
}: {
  open: boolean;
  folder: FolderMeta | null;
  deckCount: number;
  onCancel: () => void;
  /** Delete the folder; its decks move to Uncategorised. */
  onKeepDecks: () => void;
  /** Delete the folder and every deck inside it. */
  onDeleteDecks: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  const [choice, setChoice] = useState<'keep' | 'delete'>('keep');

  useEffect(() => {
    if (open) setChoice('keep');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || !folder) return null;

  const hasDecks = deckCount > 0;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4" onMouseDown={onCancel}>
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={`Delete folder "${folder.name}"`}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] bg-white border border-neutral-200 shadow-xl p-5"
      >
        <h3 className="text-[15px] font-bold text-neutral-900">Delete “{folder.name}”?</h3>

        {!hasDecks ? (
          <p className="mt-1.5 text-[13px] text-neutral-500 leading-relaxed">
            This folder is empty. This action cannot be undone.
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-[13px] text-neutral-500 leading-relaxed">
              It has {deckCount} deck{deckCount === 1 ? '' : 's'} in it. Choose what happens to
              {deckCount === 1 ? ' it' : ' them'}.
            </p>

            <div className="mt-3 flex flex-col gap-2">
              <label
                className={`flex items-start gap-2.5 p-3 border cursor-pointer ${
                  choice === 'keep' ? 'border-emerald-500 bg-emerald-50/60' : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <input
                  type="radio"
                  name="folder-delete-choice"
                  checked={choice === 'keep'}
                  onChange={() => setChoice('keep')}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-[13px] font-bold text-neutral-800">
                    Keep the deck{deckCount === 1 ? '' : 's'}
                  </span>
                  <span className="block text-[12px] text-neutral-500 leading-snug">
                    Move {deckCount === 1 ? 'it' : 'them'} to Uncategorised and delete the folder.
                  </span>
                </span>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 border cursor-pointer ${
                  choice === 'delete' ? 'border-red-500 bg-red-50/60' : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <input
                  type="radio"
                  name="folder-delete-choice"
                  checked={choice === 'delete'}
                  onChange={() => setChoice('delete')}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-[13px] font-bold text-red-700">
                    Delete the deck{deckCount === 1 ? '' : 's'} too
                  </span>
                  <span className="block text-[12px] text-neutral-500 leading-snug">
                    The folder and everything in it are gone for good. This action cannot be
                    undone.
                  </span>
                </span>
              </label>
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="h-8 px-3.5 text-[13px] font-bold text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={hasDecks ? (choice === 'delete' ? onDeleteDecks : onKeepDecks) : onKeepDecks}
            className="h-8 px-3.5 text-[13px] font-bold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
          >
            Delete folder
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
