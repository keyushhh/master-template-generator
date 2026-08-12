import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../a11y/useFocusTrap';

/**
 * One shared "are you sure?" for every destructive action in the app.
 *
 * Before this, each delete button either fired immediately, or rolled its own
 * `window.confirm` (a browser dialog with no styling and no room to explain the
 * consequence) or its own copy of this same little card (`DeckSwitcher.tsx`,
 * `BrandKitModal.tsx`). One component means "this can't be undone" reads the
 * same way everywhere, and a new delete action gets it for free instead of by
 * remembering to add it.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** e.g. `Delete "Q3 review"?` */
  title: string;
  /** The consequence, plainly stated. Callers should say what is lost, not
   *  just that something will be deleted. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={onCancel}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[380px] bg-white border border-neutral-200 shadow-xl p-5"
      >
        <h3 className="text-[15px] font-bold text-neutral-900">{title}</h3>
        <p className="mt-1.5 text-[13px] text-neutral-500 leading-relaxed">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="h-8 px-3.5 text-[13px] font-bold text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className="h-8 px-3.5 text-[13px] font-bold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Copy every destructive-action message should follow: what happens, then the
 *  irreversibility, stated the same way everywhere. */
export function cannotBeUndone(consequence: string): string {
  return `${consequence} This action cannot be undone.`;
}
