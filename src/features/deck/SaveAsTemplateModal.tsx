import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { CloseIcon } from '../ui/icons';
import { useToast } from '../toast/Toast';
import { saveDeckTemplate } from './deckTemplateStore';
import type { Deck } from './types';

/**
 * Save the current deck as a starter for future decks.
 *
 * Deliberately a snapshot of slides only, the same split `deckStarters.ts`
 * documents: the brand belongs to the client, not the template, so a saved
 * template carries no `themeId` and works under any brand kit it's later
 * started with.
 */
export function SaveAsTemplateModal({
  open,
  onClose,
  deck,
  deckName,
}: {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  /** The source deck's own name, offered as a starting point for the template's. */
  deckName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(deckName ? `${deckName} template` : '');
    setDescription('');
  }, [open, deckName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const slideCount = deck.slides.length;
  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    saveDeckTemplate(name, description, deck);
    showToast(`Saved “${name.trim()}” as a template`, 'success');
    onClose();
  };

  return createPortal(
    <div
      className="wg-overlay fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Save as template"
        className="wg-modal flex flex-col w-full max-w-[440px] max-h-[90vh] overflow-hidden my-auto bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-col gap-1 px-5 py-4 border-b border-neutral-150 shrink-0">
          <div className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-600">
            Save as template
          </div>
          <h2 className="text-[15px] font-bold text-neutral-900">
            Start future decks from this one
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <CloseIcon size={15} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
          <p className="text-[12.5px] text-neutral-600 leading-relaxed">
            Saves the {slideCount} slide{slideCount === 1 ? '' : 's'} in this deck - layout and
            content, not the brand colours - as a starter you can pick from next time you create
            a new deck.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-600">
              Template name
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="Client onboarding deck"
              className="h-[38px] px-3 text-[13px] border border-neutral-200 focus:border-emerald-500 outline-none text-neutral-900"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-600">
              Description <span className="text-neutral-300">(optional)</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's on the slides, in the terms of what it's for."
              rows={3}
              className="px-3 py-2 text-[13px] border border-neutral-200 focus:border-emerald-500 outline-none text-neutral-900 resize-none"
            />
          </label>
        </div>

        <div className="shrink-0 flex items-center gap-2.5 px-5 py-3.5 border-t border-neutral-150">
          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="h-[38px] px-4 text-[12.5px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="h-[38px] px-5 text-[12.5px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              Save template
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
