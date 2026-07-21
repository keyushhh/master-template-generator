import { useEffect, useRef, useState } from 'react';
import { Columns3, Sun, Moon } from 'lucide-react';
import { SlideNavList } from './SlideNavList';
import { SourceMaterialModal } from './SourceMaterialModal';
import { DeckSwitcher } from './DeckSwitcher';
// Sidebar for presenting the generated slides list and actions
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';
import type { ProjectMeta } from '../deck/deckStore';
import type { LibraryEntry } from '../business-record/libraryStore';
import logoBlack from '../../assets/Logo_Black_Transparent.png';

interface GeneratorSidebarProps {
  hasPresentation: boolean;
  /** Parsed document - carried into PDF export so the client logo renders. */
  ast: DocumentNode | null;
  deck: Deck;
  /** True once the committed deck was produced by Generate (guards regenerate). */
  deckGenerated: boolean;
  editing: boolean;
  dirty: boolean;
  onDocumentParsed: (ast: DocumentNode | null) => void;
  /** Import a source AND build the deck in one step (Import & Load in the modal). */
  onImport: (ast: DocumentNode) => void;
  /** Load a saved use case library entry directly (restores its exact deck). */
  onLoadLibraryEntry: (entry: LibraryEntry) => void;
  onGenerate: () => void;
  onToggleHidden: (instanceId: string) => void;
  onDuplicate: (instanceId: string) => void;
  onDelete: (instanceId: string) => void;
  onRename: (instanceId: string, title: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onAddBlank: () => void;
  /** Insert a blank slide immediately after the given slide. */
  onInsertAfter: (instanceId: string) => void;
  /** Open the Review & Export screen (preview all slides before sharing). */
  onOpenReview: () => void;
  // Multiple saved decks.
  projects: ProjectMeta[];
  activeId: string | null;
  onSwitchDeck: (id: string) => void;
  onNewDeck: () => void;
  onRenameDeck: (id: string, name: string) => void;
  onDeleteDeck: (id: string) => void;
  onSetThemeMode?: (mode: 'hybrid' | 'light' | 'dark') => void;
}

/** Two-step confirm state that disarms itself after a short pause. */
function useArmedConfirm(timeoutMs = 3000): [boolean, (armed: boolean) => void] {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (armed) {
      timer.current = window.setTimeout(() => setArmed(false), timeoutMs);
    }
    return () => window.clearTimeout(timer.current);
  }, [armed, timeoutMs]);
  return [armed, setArmed];
}

export function GeneratorSidebar({
  hasPresentation,
  ast,
  deck,
  deckGenerated,
  editing,
  dirty,
  onDocumentParsed,
  onImport,
  onLoadLibraryEntry,
  onGenerate,
  onToggleHidden,
  onDuplicate,
  onDelete,
  onRename,
  onReorder,
  onAddBlank,
  onInsertAfter,
  onOpenReview,
  projects,
  activeId,
  onSwitchDeck,
  onNewDeck,
  onRenameDeck,
  onDeleteDeck,
  onSetThemeMode,
}: GeneratorSidebarProps) {
  const [sourceOpen, setSourceOpen] = useState(false);

  // Deck can be reviewed/exported once at least one slide is visible.
  const hasVisibleSlides = deck.slides.some((s) => !s.hidden);

  return (
    <aside className="sidenav">
      {/* Sidenav Brand container with token-aligned visual spacing */}
      <div className="sidenav-brand flex flex-col gap-4 px-[20px] pt-6 pb-4 border-b border-neutral-150">
        <img src={logoBlack} alt="Wozku" className="w-[110px] h-auto pl-[8px]" />
        <DeckSwitcher
          projects={projects}
          activeId={activeId}
          onSwitch={onSwitchDeck}
          onNew={onNewDeck}
          onRename={onRenameDeck}
          onDelete={onDeleteDeck}
        />

        {/* Deck Theme Mode Segmented Controller */}
        <div className="w-full mt-1">
          <div className="grid grid-cols-3 gap-0.5 bg-neutral-100 p-0.5 rounded-none border border-neutral-200 shadow-none">
            <button
              onClick={() => onSetThemeMode?.('hybrid')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-none transition-all cursor-pointer font-sans text-[12px] font-normal tracking-normal shadow-none ${
                (deck.themeMode ?? 'hybrid') === 'hybrid'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
              title="Default Theme: Dark Cover/Dividers, Light Content"
            >
              <Columns3 size={13} strokeWidth={1.5} />
              <span>Default</span>
            </button>

            <button
              onClick={() => onSetThemeMode?.('light')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-none transition-all cursor-pointer font-sans text-[12px] font-normal tracking-normal shadow-none ${
                deck.themeMode === 'light'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
              title="Light Theme: Pure white corporate background"
            >
              <Sun size={13} strokeWidth={1.5} />
              <span>Light</span>
            </button>

            <button
              onClick={() => onSetThemeMode?.('dark')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-none transition-all cursor-pointer font-sans text-[12px] font-normal tracking-normal shadow-none ${
                deck.themeMode === 'dark'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
              title="Dark Theme: Executive obsidian keynote background"
            >
              <Moon size={13} strokeWidth={1.5} />
              <span>Dark</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Navigation section */}
      <div className="sidenav-scroll flex-1 overflow-y-auto px-3 py-4">
        <SlideNavList
          slides={deck.slides}
          onToggleHidden={onToggleHidden}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onRename={onRename}
          onReorder={onReorder}
          onAddBlank={onAddBlank}
          onInsertAfter={onInsertAfter}
        />
      </div>

      {/* Tools Section at the bottom with premium vertical layout rhythm */}
      <div className="sidenav-tools flex flex-col gap-3 p-4 border-t border-neutral-150 bg-neutral-50/50">
        {/* Opens the 3-tab Source Material modal (Conversion Prompt / Paste / Upload). */}
        <button
          onClick={() => setSourceOpen(true)}
          className="w-full flex items-center justify-center gap-2 h-[44px] px-4 rounded-[var(--radius-sharp)] font-sans font-bold text-[14px] bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white transition-colors cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          Source Material
          {hasPresentation && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          )}
        </button>

        {/* "Import & Load" in the Source Material modal auto-builds the deck, so this
            is only the fallback once a source loaded without building. Locks once
            generated to prevent discarding edits; Reset + Source Material to rebuild. */}
        <button
          disabled={!hasPresentation || deckGenerated}
          onClick={() => hasPresentation && !deckGenerated && onGenerate()}
          className={`w-full flex items-center justify-center gap-2 h-[44px] px-4 rounded-[var(--radius-sharp)] font-sans font-bold text-[14px] transition-colors ${
            !hasPresentation
              ? 'border-none bg-neutral-200 text-neutral-400 cursor-not-allowed'
              : deckGenerated
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default'
                : 'border-none bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white cursor-pointer'
          }`}
        >
          {deckGenerated && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          )}
          {deckGenerated ? 'Deck Generated' : 'Generate Deck'}
        </button>

        {/* Opens the preview screen; all export/share runs there. */}
        <button
          disabled={!hasVisibleSlides}
          onClick={() => hasVisibleSlides && onOpenReview()}
          className={`w-full flex items-center justify-center gap-2 h-[44px] px-4 text-[14px] rounded-[var(--radius-sharp)] font-bold transition-all ${
            hasVisibleSlides
              ? 'text-neutral-900 bg-neutral-100 hover:bg-neutral-200 cursor-pointer border border-neutral-200'
              : 'text-neutral-400 bg-neutral-50 cursor-not-allowed opacity-60 border border-neutral-150'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
          </svg>
          Review &amp; Export
        </button>
      </div>

      <SourceMaterialModal
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onDocumentParsed={onDocumentParsed}
        onImport={onImport}
        onLoadLibraryEntry={onLoadLibraryEntry}
        hasSource={hasPresentation}
      />
    </aside>
  );
}
