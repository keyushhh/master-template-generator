import { useEffect, useRef, useState } from 'react';
import { FitStage } from './FitStage';
import { useFocusTrap } from '../a11y/useFocusTrap';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';
import { CheckIcon, CloseIcon, CopyIcon, EyeIcon, EyeOffIcon, TrashIcon } from '../ui/icons';
import { WOZKU_THEME, type DeckTheme } from '../theme/deckTheme';
import { ConfirmModal } from '../ui/ConfirmModal';

interface SlideSorterProps {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  ast: DocumentNode | null;
  /** The deck's name, so this screen and the export sheet agree about what you
   *  have open. */
  projectName: string;
  /** Move the slide with `fromId` to the position of `toId`. */
  onReorder: (fromId: string, toId: string) => void;
  /** Force hidden state for a batch of slides. */
  onBulkSetHidden: (instanceIds: string[], hidden: boolean) => void;
  /** Delete a batch of slides. */
  onBulkDelete: (instanceIds: string[]) => void;
  onDuplicate: (instanceId: string) => void;
  /** Close and scroll the canvas to this slide. */
  onJumpTo: (instanceId: string) => void;
  /** The deck's resolved theme. */
  theme?: DeckTheme;
}

/**
 * The whole deck at once: reorder, hide, delete.
 *
 * Split out of the old Review & Export modal, which tried to be this *and* the
 * export screen. The clutter there wasn't the number of controls so much as the
 * fact that a card carried two competing ways to act on itself - a checkbox that
 * fed bulk actions, and an eye that acted immediately - so neither one told you
 * what clicking the card would do.
 *
 * Here there is exactly one model: **clicking a card selects it**, and every
 * action in the toolbar operates on the selection, whether that's one slide or
 * twelve. Per-slide quick actions still live where they were always more useful,
 * on the rail's thumbnail hover. Double-click opens a slide on the canvas.
 *
 * A view rather than a modal card, because it is a way of looking at the deck.
 */
export function SlideSorter({
  open,
  onClose,
  deck,
  ast,
  projectName,
  onReorder,
  onBulkSetHidden,
  onBulkDelete,
  onDuplicate,
  onJumpTo,
  theme = WOZKU_THEME,
}: SlideSorterProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  /** Whether the bulk-delete confirmation is open. A boolean, not the pending
   *  ids, since the modal's copy only needs the count and `selectedList` is
   *  still available when it confirms. */
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  /** Anchor for shift-click range selection. */
  const lastClickedId = useRef<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      lastClickedId.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Clear a selection before leaving, so Escape never discards the
        // selection and the view in one press.
        if (selected.size > 0) setSelected(new Set());
        else onClose();
      }
      if ((e.key === 'a' || e.key === 'A') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSelected(new Set(deck.slides.map((s) => s.instanceId)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, selected.size, deck.slides]);

  if (!open) return null;

  const ids = deck.slides.map((s) => s.instanceId);
  const visibleIds = deck.slides.filter((s) => !s.hidden).map((s) => s.instanceId);
  const allSelected = ids.length > 0 && selected.size === ids.length;
  const selectedList = [...selected];
  /** Drives whether the toolbar offers Show or Hide as the obvious next step. */
  const anySelectedVisible = deck.slides.some((s) => selected.has(s.instanceId) && !s.hidden);

  const clickCard = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedId.current) {
      // Range select, anchored on the last plain click.
      const from = ids.indexOf(lastClickedId.current);
      const to = ids.indexOf(id);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from];
        setSelected((prev) => {
          const next = new Set(prev);
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
          return next;
        });
        return;
      }
    }
    if (e.metaKey || e.ctrlKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      lastClickedId.current = id;
      return;
    }
    // Plain click: toggle, so a single slide can be deselected without a
    // modifier and the card is its own checkbox.
    setSelected((prev) => (prev.has(id) && prev.size === 1 ? new Set() : new Set([id])));
    lastClickedId.current = id;
  };

  const bulkHide = () => {
    onBulkSetHidden(selectedList, anySelectedVisible);
    setSelected(new Set());
  };
  const bulkDuplicate = () => {
    // Back-to-front: each duplicate is spliced in after its source, so doing the
    // later slides first keeps the earlier indices valid.
    [...selectedList]
      .sort((a, b) => ids.indexOf(b) - ids.indexOf(a))
      .forEach((id) => onDuplicate(id));
    setSelected(new Set());
  };
  const bulkDelete = () => setConfirmingBulkDelete(true);
  const confirmBulkDelete = () => {
    onBulkDelete(selectedList);
    setSelected(new Set());
    setConfirmingBulkDelete(false);
  };

  const toolBtn =
    'flex items-center gap-2 h-[32px] px-3 text-[12px] font-bold rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div ref={panelRef} className="wg-overlay fixed inset-0 z-[190] flex flex-col" style={{ background: 'var(--stage-bg)' }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-5 h-[60px] shrink-0 bg-white border-b border-neutral-200">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-400">
            Organize
          </div>
          <span className="text-[15px] font-bold text-neutral-900 truncate">
            {projectName}
            <span className="text-neutral-400 font-medium">
              {' · '}
              {visibleIds.length} slide{visibleIds.length === 1 ? '' : 's'}
              {deck.slides.length - visibleIds.length > 0 &&
                `, ${deck.slides.length - visibleIds.length} excluded`}
            </span>
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 h-[34px] px-4 text-[12.5px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>

      {/* ── Toolbar. One row, always in the same place: it holds the count at
             rest and the actions once something is selected, rather than
             appearing and shoving the grid down. ───────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-5 h-[46px] shrink-0 bg-white border-b border-neutral-200">
        <div className="flex items-center gap-2 min-w-0">
          {selected.size > 0 ? (
            <>
              <span className="text-[12.5px] font-bold text-emerald-700 whitespace-nowrap pr-1">
                {selected.size} selected
              </span>
              <button onClick={bulkHide} className={`${toolBtn} text-neutral-700 hover:bg-neutral-100`}>
                {anySelectedVisible ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                {anySelectedVisible ? 'Hide' : 'Show'}
              </button>
              <button onClick={bulkDuplicate} className={`${toolBtn} text-neutral-700 hover:bg-neutral-100`}>
                <CopyIcon size={14} />
                Duplicate
              </button>
              <button onClick={bulkDelete} className={`${toolBtn} text-red-600 hover:bg-red-50`}>
                <TrashIcon size={14} />
                Delete
              </button>
              <span className="w-px h-5 bg-neutral-200 mx-1" />
              <button
                onClick={() => setSelected(new Set())}
                className={`${toolBtn} text-neutral-500 hover:bg-neutral-100`}
              >
                Clear
              </button>
            </>
          ) : (
            <span className="text-[12px] text-neutral-500">
              Click to select · shift-click for a range · drag to reorder · double-click to open a slide
            </span>
          )}
        </div>
        <button
          onClick={() => (allSelected ? setSelected(new Set()) : setSelected(new Set(ids)))}
          className={`${toolBtn} shrink-0 text-neutral-700 border border-neutral-200 hover:bg-neutral-50`}
        >
          {allSelected ? 'Clear selection' : 'Select all'}
        </button>
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-5 py-6"
        // A click on the empty desk clears the selection, the same as every
        // canvas tool.
        onClick={() => setSelected(new Set())}
      >
        {deck.slides.length === 0 ? (
          <div className="text-center text-[13px] text-neutral-500 py-20">
            No slides yet. Add one from the rail.
          </div>
        ) : (
          <div
            className="grid gap-x-5 gap-y-6 mx-auto max-w-[1500px]"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}
          >
            {deck.slides.map((slide) => {
              const pos = visibleIds.indexOf(slide.instanceId); // -1 when hidden
              const num = pos === -1 ? '--' : String(pos + 1).padStart(2, '0');
              const isSelected = selected.has(slide.instanceId);
              const isDragging = dragId === slide.instanceId;
              const isOver = overId === slide.instanceId && dragId !== slide.instanceId;
              return (
                <div
                  key={slide.instanceId}
                  draggable
                  onDragStart={() => setDragId(slide.instanceId)}
                  onDragEnter={() => setOverId(slide.instanceId)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId && dragId !== slide.instanceId) onReorder(dragId, slide.instanceId);
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  onClick={(e) => { e.stopPropagation(); if (!dragId) clickCard(slide.instanceId, e); }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    onJumpTo(slide.instanceId);
                  }}
                  className={`relative flex flex-col gap-2 select-none ${
                    isDragging ? 'opacity-40 cursor-grabbing' : 'cursor-pointer'
                  }`}
                >
                  {/* Insertion rule, on the leading edge of the card the dragged
                      slide would land in front of. */}
                  {isOver && (
                    <span aria-hidden className="absolute -left-2.5 top-0 bottom-6 w-[3px] bg-emerald-500 z-20" />
                  )}

                  <div
                    className="relative bg-white transition-shadow"
                    style={{
                      boxShadow: isSelected
                        ? '0 0 0 2px var(--emerald-500), 0 6px 18px -6px rgba(15,23,20,0.22)'
                        : '0 0 0 1px var(--neutral-200), 0 1px 3px rgba(15,23,20,0.06)',
                      opacity: slide.hidden ? 0.5 : 1,
                    }}
                  >
                    <FitStage slide={slide} ast={ast} num={num} logoUrl={deck.logoUrl} theme={theme} />

                    {/* Selection tick. A state readout, not a second control -
                        the card itself is the hit target. */}
                    {isSelected && (
                      <span
                        aria-hidden
                        className="absolute top-2 left-2 z-10 w-[22px] h-[22px] flex items-center justify-center bg-emerald-500 text-white shadow-sm"
                      >
                        <CheckIcon size={13} />
                      </span>
                    )}

                    {slide.hidden && (
                      <span className="absolute bottom-2 left-2 z-10 font-mono text-[9px] font-bold uppercase tracking-[0.1em] bg-neutral-900/85 text-white px-1.5 py-0.5">
                        Hidden
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2 text-[11.5px] min-w-0">
                    <span className={`font-mono ${isSelected ? 'text-emerald-600 font-bold' : 'text-neutral-400'}`}>
                      {num}
                    </span>
                    <span
                      className={`truncate ${
                        isSelected ? 'text-emerald-700 font-semibold' : 'text-neutral-500'
                      } ${slide.hidden ? 'line-through' : ''}`}
                    >
                      {slide.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Escape hatch that doesn't need the header. */}
      <button
        onClick={onClose}
        aria-label="Close organizer"
        className="absolute top-[13px] right-[130px] w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
      >
        <CloseIcon size={16} />
      </button>

      <ConfirmModal
        open={confirmingBulkDelete}
        title={`Delete ${selected.size} slide${selected.size === 1 ? '' : 's'}?`}
        message={`Delete ${selected.size} slide${selected.size === 1 ? '' : 's'}? This can be undone with Cmd/Ctrl+Z.`}
        onConfirm={confirmBulkDelete}
        onCancel={() => setConfirmingBulkDelete(false)}
      />
    </div>
  );
}
