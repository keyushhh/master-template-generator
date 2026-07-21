import { useEffect, useRef, useState } from 'react';
import { CAMPAIGN_TYPES, type CampaignType } from '../business-record/sampleDecks';
import { useFocusTrap } from '../a11y/useFocusTrap';

interface SaveToLibraryModalProps {
  open: boolean;
  onClose: () => void;
  /** Prefilled from the deck's own title so saving is a one-field confirm, not a form. */
  suggestedName: string;
  onSave: (name: string, description: string, campaignType: CampaignType) => void;
}

/**
 * Small confirm-with-fields modal opened from Review & Export's "Save to Library"
 * button. Tags the current deck with a campaign type so it resurfaces later in
 * the Source Material Samples tab's filter/search alongside the seed samples.
 */
export function SaveToLibraryModal({ open, onClose, suggestedName, onSave }: SaveToLibraryModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [campaignType, setCampaignType] = useState<CampaignType>(CAMPAIGN_TYPES[0]);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (open) {
      setName(suggestedName);
      setDescription('');
      setCampaignType(CAMPAIGN_TYPES[0]);
    }
  }, [open, suggestedName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), description.trim(), campaignType);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm p-6"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        ref={panelRef}
        className="flex flex-col w-full max-w-md bg-white rounded-[var(--radius-sharp)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="flex flex-col gap-1">
            <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-400">Use Case Library</div>
            <h2 className="text-[17px] font-bold text-neutral-900">Save this deck</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 pb-6">
          <p className="text-[12.5px] text-neutral-600 leading-relaxed">
            Saved decks show up in Source Material's Samples tab, so the next similar campaign starts from this one instead of a blank page.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-bold text-neutral-700">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Acme Partner Advocacy Program"
              className="w-full h-[38px] px-3 text-[13px] text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-[var(--radius-sharp)] focus:outline-none focus:ring-2 focus:ring-neutral-900/10 placeholder:text-neutral-400"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-bold text-neutral-700">Campaign type</span>
            <select
              value={campaignType}
              onChange={(e) => setCampaignType(e.target.value as CampaignType)}
              className="w-full h-[38px] px-3 text-[13px] text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-[var(--radius-sharp)] focus:outline-none focus:ring-2 focus:ring-neutral-900/10 cursor-pointer"
            >
              {CAMPAIGN_TYPES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-bold text-neutral-700">Description <span className="font-medium text-neutral-400">(optional)</span></span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One line describing when this deck is a good starting point"
              rows={2}
              className="w-full resize-none px-3 py-2 text-[13px] text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-[var(--radius-sharp)] focus:outline-none focus:ring-2 focus:ring-neutral-900/10 placeholder:text-neutral-400"
            />
          </label>

          <div className="flex items-center justify-end gap-2 mt-1">
            <button
              onClick={onClose}
              className="h-[38px] px-4 text-[13px] font-semibold text-neutral-600 hover:text-neutral-900 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="h-[38px] px-5 text-[13px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save to Library
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
