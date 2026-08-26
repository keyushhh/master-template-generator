import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { mintInstanceId } from '../deck/deckBuilder';
import { listProjectSummaries, type ProjectSummary } from '../deck/deckStore';
import type { SlideInstance } from '../deck/types';
import { relativeTime } from '../library/relativeTime';
import { brandKitThemes, listBrandKits } from '../theme/brandKitStore';
import { themeById } from '../theme/deckTheme';
import { ensureFonts } from '../fonts/loadFont';
import { CheckIcon, CloseIcon } from '../ui/icons';
import { FitStage } from './FitStage';

/**
 * Take a slide from another deck.
 *
 * The agency case this exists for: the case study slide, the pricing table, the
 * team page. They were built once, they are good, and until now the only way to
 * get one into this month's deck was to rebuild it from the layout and retype
 * the copy. That is the difference between owning a set of decks and owning a
 * library of work.
 *
 * Two things make it safe to lift a slide across a deck boundary, and both are
 * consequences of decisions already made elsewhere:
 *
 *  - **The theme is not in the slide.** It is applied as CSS custom properties
 *    on the slide root from the deck being viewed, so a slide borrowed from a
 *    deck on one client's brand kit arrives already wearing this deck's. You are
 *    lifting the content and the layout, never the other client's colour.
 *  - **Instance ids are minted, not copied.** The canvas keys slides by id and
 *    the exporter finds them with `getElementById`, so a duplicated id would
 *    quietly export the wrong slide. Every borrowed slide gets a fresh one.
 */
export function BorrowSlideModal({
  open,
  onClose,
  currentProjectId,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  /** Excluded from the deck list: borrowing from yourself is Duplicate. */
  currentProjectId: string;
  /** Slides already re-keyed, in the order they were picked. */
  onInsert: (slides: SlideInstance[]) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  /** Read once per opening. Loading every deck's full content is not something
   *  to do on a keystroke, and nothing can change underneath us while a modal
   *  is up. */
  const [decks, setDecks] = useState<ProjectSummary[]>([]);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const all = listProjectSummaries().filter((p) => p.id !== currentProjectId && p.deck);
    setDecks(all);
    setDeckId(all[0]?.id ?? null);
    setPicked([]);
  }, [open, currentProjectId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const source = decks.find((d) => d.id === deckId) ?? null;
  const slides = source?.deck?.slides.filter((s) => !s.hidden) ?? [];

  // The source deck's own theme, so its slides are shown as they look at home
  // rather than already restyled. You are choosing a slide you recognise; it
  // gets this deck's colours on the way in, not before you have picked it.
  const sourceTheme = useMemo(
    // Kits are read here rather than passed in: this modal is opened from a
    // palette command with no theme in scope, and a kit list is a cheap read.
    () => themeById(source?.deck?.themeId, brandKitThemes(listBrandKits())),
    [source]
  );

  // The source deck's kit may set its own typefaces, and these thumbnails are how
  // you recognise the slide you are after. Loaded per source deck rather than up
  // front: you only ever look at one at a time.
  useEffect(() => {
    void ensureFonts([
      sourceTheme.fonts.display.family,
      sourceTheme.fonts.sans.family,
      sourceTheme.fonts.mono.family,
    ]);
  }, [sourceTheme]);

  // Selection is per deck. Switching decks with three slides still ticked and
  // then pressing Add would insert slides you can no longer see.
  useEffect(() => setPicked([]), [deckId]);

  if (!open) return null;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const insert = () => {
    if (!source?.deck || picked.length === 0) return;
    const byId = new Map(source.deck.slides.map((s) => [s.instanceId, s]));
    const out = picked
      .map((id) => byId.get(id))
      .filter((s): s is SlideInstance => !!s)
      // Fresh ids, and the content deep-copied: the borrowed slide must not
      // share a styles or overlay object with the deck it came from, or editing
      // it here would silently edit the original too.
      .map((s) => ({
        ...s,
        instanceId: mintInstanceId(s.templateId),
        content: structuredClone(s.content),
      }));
    onInsert(out);
    onClose();
  };

  return createPortal(
    <div
      className="wg-overlay fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Borrow a slide"
        className="wg-modal flex flex-col w-full max-w-[840px] max-h-[86vh] overflow-hidden bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-col gap-0.5 px-5 py-3.5 border-b border-neutral-150 shrink-0">
          <h2 className="text-[15px] font-bold text-neutral-900">Borrow a slide</h2>
          <span className="text-[11.5px] text-neutral-600">
            Pick from any other deck. Slides arrive in this deck&rsquo;s brand colours.
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <CloseIcon size={15} />
          </button>
        </div>

        {decks.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[13px] font-bold text-neutral-700">No other decks yet</p>
            <p className="mt-1 text-[12px] text-neutral-600">
              Once you have a second deck, its slides become available here.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            {/* Decks on the left, their slides on the right. Two panes rather
                than a dropdown of deck names: choosing which deck to raid is
                itself a browse, and a select would hide the dates that tell you
                which one is last quarter's. */}
            <div className="w-[224px] shrink-0 border-r border-neutral-150 overflow-y-auto">
              {decks.map((d) => {
                const active = d.id === deckId;
                const count = d.deck?.slides.filter((s) => !s.hidden).length ?? 0;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDeckId(d.id)}
                    className={`w-full flex flex-col gap-0.5 px-3.5 py-2.5 text-left border-l-2 transition-colors cursor-pointer ${
                      active
                        ? 'border-emerald-500 bg-emerald-50/60'
                        : 'border-transparent hover:bg-neutral-50'
                    }`}
                  >
                    <span
                      className={`text-[12.5px] truncate ${
                        active ? 'font-bold text-emerald-900' : 'font-semibold text-neutral-700'
                      }`}
                    >
                      {d.name}
                    </span>
                    <span className="font-mono text-[9.5px] text-neutral-600">
                      {count} slides &middot; {relativeTime(d.updatedAt)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-w-0 overflow-y-auto p-4">
              {slides.length === 0 ? (
                <p className="text-[12px] text-neutral-600 text-center py-10">
                  Every slide in this deck is hidden.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {slides.map((s, i) => {
                    const on = picked.includes(s.instanceId);
                    const order = picked.indexOf(s.instanceId) + 1;
                    return (
                      <button
                        key={s.instanceId}
                        onClick={() => toggle(s.instanceId)}
                        className="group relative flex flex-col gap-1 text-left cursor-pointer"
                        aria-pressed={on}
                      >
                        <div className="relative w-full">
                          <FitStage
                            slide={s}
                            ast={null}
                            num={String(i + 1).padStart(2, '0')}
                            logoUrl={source?.deck?.logoUrl}
                            theme={sourceTheme}
                          />
                          <span
                            aria-hidden
                            className="absolute inset-0 pointer-events-none transition-shadow"
                            style={{
                              boxShadow: on
                                ? '0 0 0 2px var(--emerald-500)'
                                : '0 0 0 1px var(--neutral-200)',
                            }}
                          />
                          {/* Numbered, not just ticked: the order you pick them
                              in is the order they are inserted, so it has to be
                              visible while you are picking. */}
                          {on && (
                            <span className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center gap-0.5 bg-emerald-500 text-white font-mono text-[10px] font-bold">
                              {order}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-600 truncate">{s.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="shrink-0 flex items-center gap-2.5 px-5 py-3 border-t border-neutral-150">
          <span className="text-[11.5px] text-neutral-600">
            {picked.length === 0
              ? 'Nothing picked yet'
              : `${picked.length} slide${picked.length === 1 ? '' : 's'} picked`}
          </span>
          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="h-[34px] px-4 text-[12.5px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={insert}
              disabled={picked.length === 0}
              className="h-[34px] px-4 flex items-center gap-1.5 text-[12.5px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              <CheckIcon size={13} />
              Add after this slide
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
