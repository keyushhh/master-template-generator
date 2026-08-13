import { useRef, useState } from 'react';
import type { Deck } from '../deck/types';
import { CloseIcon, CopyIcon, DownloadIcon } from '../ui/icons';
import { useFocusTrap } from '../a11y/useFocusTrap';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  deckName: string;
  onOpenExport: () => void;
  onOpenPresent: () => void;
  onShowToast: (msg: string, type: 'info' | 'success') => void;
}

export function ShareModal({
  open,
  onClose,
  deck,
  deckName,
  onOpenExport,
  onOpenPresent,
  onShowToast,
}: ShareModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPackage, setCopiedPackage] = useState(false);

  useFocusTrap(containerRef, open);

  if (!open) return null;

  const presentUrl = `${window.location.origin}${window.location.pathname}?present=true`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(presentUrl);
      setCopiedLink(true);
      onShowToast('Copied presenter link to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      onShowToast('Could not copy link.', 'info');
    }
  };

  const handleDownloadDeckFile = () => {
    const payload = JSON.stringify({ version: '1.5.0', deckName, deck }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deckName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.wozku`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Downloaded editable .wozku deck file!', 'success');
  };

  const handleCopyDeckJson = async () => {
    try {
      const payload = JSON.stringify({ version: '1.5.0', deckName, deck });
      await navigator.clipboard.writeText(payload);
      setCopiedPackage(true);
      onShowToast('Copied deck package JSON to clipboard!', 'success');
      setTimeout(() => setCopiedPackage(false), 2500);
    } catch {
      onShowToast('Failed to copy deck package.', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
      <div
        ref={containerRef}
        className="w-full max-w-[500px] bg-white border border-neutral-200 shadow-2xl rounded-[var(--radius-sharp)] overflow-hidden animate-in fade-in zoom-in-95 duration-120"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 bg-neutral-50">
          <div>
            <h2
              className="text-[16px] font-bold text-neutral-900 tracking-[-0.01em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Share Presentation
            </h2>
            <p className="text-[12px] text-neutral-500">{deckName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Share dialog"
            className="p-1 text-neutral-400 hover:text-neutral-800 transition-colors cursor-pointer"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          {/* Privacy Guarantee Badge */}
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-[var(--radius-sharp)] flex items-start gap-3">
            <span className="text-[16px] select-none">🔒</span>
            <div className="text-[12px] text-emerald-950 leading-relaxed">
              <strong className="font-bold text-emerald-900 block">Client Privacy & Storage Guarantee</strong>
              This deck remains 100% private to your browser local storage. Share files directly with colleagues without cloud uploads.
            </div>
          </div>

          {/* Share Option 1: Editable Deck Package */}
          <div className="p-3.5 border border-neutral-200 rounded-[var(--radius-sharp)] bg-neutral-50/50 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-neutral-900">Editable Deck File (`.wozku`)</span>
              <span className="text-[11px] font-mono text-emerald-700 font-semibold bg-emerald-100/60 px-1.5 py-0.5 rounded">On-Brand</span>
            </div>
            <p className="text-[12px] text-neutral-500 leading-normal">
              Export an editable deck file that team members can import into Wozku Studio on any computer.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadDeckFile}
                className="flex-1 h-8 text-[12px] font-bold text-neutral-800 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-[var(--radius-sharp)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <DownloadIcon size={13} />
                Download `.wozku`
              </button>
              <button
                type="button"
                onClick={handleCopyDeckJson}
                className="h-8 px-3 text-[12px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-[var(--radius-sharp)] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CopyIcon size={13} />
                {copiedPackage ? 'Copied!' : 'Copy Data'}
              </button>
            </div>
          </div>

          {/* Share Option 2: Presenter Mode Link */}
          <div className="p-3.5 border border-neutral-200 rounded-[var(--radius-sharp)] bg-neutral-50/50 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-neutral-900">Presenter View</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={presentUrl}
                className="flex-1 h-8 px-2.5 bg-neutral-100 border border-neutral-200 rounded text-[11.5px] font-mono text-neutral-600 select-all outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="h-8 px-3 text-[12px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-[var(--radius-sharp)] transition-colors cursor-pointer shrink-0"
              >
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Share Option 3: Export Native Formats */}
          <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
            <span className="text-[12px] text-neutral-600 font-medium">Need standard deliverables?</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenExport();
              }}
              className="text-[12.5px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
            >
              Export PowerPoint (.pptx) or PDF →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
