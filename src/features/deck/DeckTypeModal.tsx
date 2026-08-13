import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { CheckIcon, CloseIcon } from '../ui/icons';

export function DeckTypeModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (isSandbox: boolean) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
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
        aria-label="Select deck type"
        className="wg-modal relative flex flex-col w-full max-w-[640px] overflow-hidden my-auto bg-white rounded-[var(--radius-sharp)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-150">
          <h2 className="text-[18px] font-bold text-neutral-900 tracking-tight">
            Where should this deck be saved?
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-[var(--radius-sharp)] transition-colors cursor-pointer -mr-1"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 p-6 bg-neutral-50/50">
          {/* Card 1: Team Repository */}
          <button
            onClick={() => onSelect(false)}
            className="group relative flex-1 flex flex-col text-left bg-white border border-neutral-200 hover:border-emerald-500 p-6 transition-all shadow-sm hover:shadow-md cursor-pointer rounded-[var(--radius-sharp)]"
          >
            <div className="absolute -top-3 -right-2 bg-emerald-600 text-white text-[10.5px] font-bold px-2.5 py-1 rounded-[var(--radius-sharp)] shadow-sm transform -rotate-1 group-hover:rotate-0 transition-transform">
              Recommended
            </div>
            
            <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-neutral-400 uppercase mb-1">
              Option 1
            </span>
            <h3 className="text-[16px] font-bold text-neutral-900 mb-6">
              Team Repository
            </h3>
            
            <div className="flex flex-col gap-3.5">
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-500 mt-0.5"><CheckIcon size={15} /></span>
                <span className="text-[13px] font-semibold text-neutral-600 leading-snug">Saved securely to the shared workspace</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-500 mt-0.5"><CheckIcon size={15} /></span>
                <span className="text-[13px] font-semibold text-neutral-600 leading-snug">Accessible for future edits</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-500 mt-0.5"><CheckIcon size={15} /></span>
                <span className="text-[13px] font-semibold text-neutral-600 leading-snug">Export or share instantly</span>
              </div>
            </div>
          </button>

          {/* Card 2: Quick Sandbox */}
          <button
            onClick={() => onSelect(true)}
            className="group flex-1 flex flex-col text-left bg-white border border-neutral-200 hover:border-blue-500 p-6 transition-all shadow-sm hover:shadow-md cursor-pointer rounded-[var(--radius-sharp)]"
          >
            <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-neutral-400 uppercase mb-1">
              Option 2
            </span>
            <h3 className="text-[16px] font-bold text-neutral-900 mb-6">
              Quick Sandbox
            </h3>
            
            <div className="flex flex-col gap-3.5">
              <div className="flex items-start gap-2.5">
                <span className="text-blue-500 mt-0.5"><CheckIcon size={15} /></span>
                <span className="text-[13px] font-semibold text-neutral-600 leading-snug">Kept strictly local to your device</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-blue-500 mt-0.5"><CheckIcon size={15} /></span>
                <span className="text-[13px] font-semibold text-neutral-600 leading-snug">Can be saved to team repository</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-blue-500 mt-0.5"><CheckIcon size={15} /></span>
                <span className="text-[13px] font-semibold text-neutral-600 leading-snug">Perfect for quick, one-off tasks</span>
              </div>
            </div>
          </button>
        </div>
        <div className="px-6 py-5 border-t border-neutral-150 bg-white">
          <p className="text-[12.5px] font-medium text-neutral-500 leading-relaxed text-center">
            If you want to collaborate with others or access this deck later, we recommend choosing the Team Repository option.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
