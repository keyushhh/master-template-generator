import { useRef, useState } from 'react';
import { SlideNavList } from './SlideNavList';
import { SourceMaterialModal } from './SourceMaterialModal';
import { AddIcon, DocumentIcon, FlashIcon } from '../ui/icons';
// Sidebar for presenting the generated slides list and actions
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';

/** How many px off a scroll extreme still counts as "at the top" / "at the
 *  bottom". Sub-pixel scroll heights mean an exact comparison never matches. */
const SCROLL_EDGE_SLOP = 4;

interface GeneratorSidebarProps {
  hasPresentation: boolean;
  /** Parsed document - carried into PDF export so the client logo renders. */
  ast: DocumentNode | null;
  deck: Deck;
  /** True once the committed deck was produced by Generate (guards regenerate). */
  deckGenerated: boolean;
  onDocumentParsed: (ast: DocumentNode | null) => void;
  /** Import a source AND build the deck in one step (Import & Load in the modal). */
  onImport: (ast: DocumentNode) => void;
  /** Load a deck built from an uploaded .pptx (no Business Record behind it). */
  onImportDeck: (deck: Deck, name: string, warnings: string[]) => void;
  onGenerate: () => void;
  onToggleHidden: (instanceId: string) => void;
  onDuplicate: (instanceId: string) => void;
  onChangeLayout: (instanceId: string) => void;
  onDelete: (instanceId: string) => void;
  onRename: (instanceId: string, title: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  /** Add a blank slide at `index` in the deck. */
  onAddBlank: (index: number) => void;
  /** Insert a blank slide immediately after the given slide. */
  onInsertAfter: (instanceId: string) => void;
  /** The slide on the stage. */
  currentId: string | null;
  onNavigate: (instanceId: string) => void;
}

export function GeneratorSidebar({
  hasPresentation,
  ast,
  deck,
  deckGenerated,
  onDocumentParsed,
  onImport,
  onImportDeck,
  onGenerate,
  onToggleHidden,
  onDuplicate,
  onChangeLayout,
  onDelete,
  onRename,
  onReorder,
  onAddBlank,
  onInsertAfter,
  currentId,
  onNavigate,
}: GeneratorSidebarProps) {
  const [sourceOpen, setSourceOpen] = useState(false);
  /** Whether the filmstrip has been scrolled at all. The fade under the pinned
   *  button only makes sense once something is actually passing beneath it -
   *  shown at rest it just looks like a smudge across the first thumbnail. */
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Where a new slide should land, read off the filmstrip's scroll position.
   *
   * Always appending is wrong the moment a deck is longer than the rail: the
   * user is looking at slide 3, presses Add slide, and the slide appears
   * off-screen 12 rows below. So the insert point follows the view instead:
   *
   *   - scrolled to the top    → before the first slide
   *   - scrolled to the bottom → after the last slide (the old behaviour)
   *   - anywhere in between    → after the last thumbnail still on screen
   *
   * A rail short enough not to scroll at all has one unambiguous answer, the
   * end, since every thumbnail is equally "in view".
   */
  const insertIndexFromScroll = (): number => {
    const el = scrollRef.current;
    const total = deck.slides.length;
    if (!el) return total;

    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= SCROLL_EDGE_SLOP) return total;
    if (el.scrollTop <= SCROLL_EDGE_SLOP) return 0;
    if (el.scrollTop >= scrollable - SCROLL_EDGE_SLOP) return total;

    // Mid-scroll: find the last row whose top edge is above the rail's bottom,
    // i.e. the last thumbnail the user can actually see, and go in after it.
    const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-slide-row]'));
    const railBottom = el.getBoundingClientRect().bottom;
    let last = -1;
    rows.forEach((row, i) => {
      if (row.getBoundingClientRect().top < railBottom) last = i;
    });
    return last === -1 ? total : last + 1;
  };

  const handleAddSlide = () => {
    const index = insertIndexFromScroll();
    onAddBlank(index);
    // Bring the slide that was just created into view. Two frames: one for
    // React to commit the new row, one for the browser to lay it out.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const rows = scrollRef.current?.querySelectorAll<HTMLElement>('[data-slide-row]');
        rows?.[index]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      })
    );
  };

  return (
    <>
      {/* The rail holds slide thumbnails and nothing else. */}
      <aside className="sidenav">
        {/* Pinned: stays put while the filmstrip scrolls beneath it. */}
        <div className="sidenav-head">
          <button
            type="button"
            onClick={handleAddSlide}
            className="w-full flex items-center justify-center gap-2 h-[34px] rounded-[var(--radius-sharp)] border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer text-[12.5px] font-bold"
          >
            <AddIcon size={14} />
            Add slide
          </button>
        </div>

        <div className="sidenav-body">
          <div
            ref={scrollRef}
            className="sidenav-scroll"
            onScroll={() => {
              const next = (scrollRef.current?.scrollTop ?? 0) > 2;
              setScrolled((prev) => (prev === next ? prev : next));
            }}
          >
            <SlideNavList
              slides={deck.slides}
              ast={ast}
              logoUrl={deck.logoUrl}
              onToggleHidden={onToggleHidden}
              onDuplicate={onDuplicate}
              onChangeLayout={onChangeLayout}
              onDelete={onDelete}
              onRename={onRename}
              onReorder={onReorder}
              onInsertAfter={onInsertAfter}
              currentId={currentId}
              onNavigate={onNavigate}
            />
          </div>
          {/* Thumbnails dissolve into the pinned button as they pass under it. */}
          <div className={`sidenav-fade${scrolled ? ' is-visible' : ''}`} aria-hidden />
        </div>
      </aside>

      {/* Primary action, floating beneath the rail. */}
      <div className="sidenav-cta">
        {hasPresentation && !deckGenerated && (
          <button
            onClick={onGenerate}
            className="w-full flex items-center justify-center gap-2 h-[38px] px-3 rounded-[var(--radius-sharp)] font-sans font-bold text-[12.5px] border border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-sm transition-colors cursor-pointer"
          >
            <FlashIcon size={14} />
            Generate deck
          </button>
        )}
        <button
          onClick={() => setSourceOpen(true)}
          className="w-full flex items-center justify-center gap-2 h-[46px] px-4 rounded-[var(--radius-sharp)] font-sans font-bold text-[13px] bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white shadow-lg transition-colors cursor-pointer"
        >
          <DocumentIcon size={15} />
          {hasPresentation ? 'Change source' : 'Add content'}
        </button>
      </div>

      <SourceMaterialModal
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onDocumentParsed={onDocumentParsed}
        onImport={onImport}
        onImportDeck={onImportDeck}
        hasSource={hasPresentation}
      />
    </>
  );
}
