import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { GeneratorSidebar } from '../features/generator/GeneratorSidebar';
import { PresentationCanvas } from '../features/generator/PresentationCanvas';
import { ReviewModal } from '../features/generator/ReviewModal';
import { PresentMode } from '../features/generator/PresentMode';
// Import types for document parsing and deck configuration
import type { DocumentNode } from '../features/business-record/parser/ast';
import type { Deck, SlideContent } from '../features/deck/types';
import {
  createTemplateDeck,
  buildDeckFromDocument,
  mintInstanceId,
  createBlankSlide,
} from '../features/deck/deckBuilder';
import {
  ensureInitialized,
  listProjects,
  loadProjectSession,
  saveProjectSession,
  setActiveId as setStoreActiveId,
  createProject,
  renameProject,
  deleteProject,
  type ProjectMeta,
  type StoredSession,
} from '../features/deck/deckStore';

// ── Undo/redo history for the committed deck ──────────────────────────────
// Edit-mode drafts have their own Save/Discard, so history tracks only
// committed changes (generate, import, reorder, add/remove, toggle, save-edits).
const HISTORY_LIMIT = 50;

interface DeckHistory {
  past: Deck[];
  present: Deck;
  future: Deck[];
}

type HistoryAction =
  | { type: 'commit'; deck: Deck } // record a new committed state
  | { type: 'set'; deck: Deck } // replace present without touching history (e.g. hydrate)
  | { type: 'undo' }
  | { type: 'redo' };

function historyReducer(state: DeckHistory, action: HistoryAction): DeckHistory {
  switch (action.type) {
    case 'commit': {
      if (action.deck === state.present) return state;
      const past = [...state.past, state.present].slice(-HISTORY_LIMIT);
      return { past, present: action.deck, future: [] };
    }
    case 'set':
      return { past: [], present: action.deck, future: [] };
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

export function MasterTemplatePage() {
  // Bootstrap the active deck once (migrates any legacy session into a project).
  const bootstrapRef = useRef<{ id: string; session: StoredSession } | null>(null);
  if (bootstrapRef.current === null) bootstrapRef.current = ensureInitialized(createTemplateDeck);
  const boot = bootstrapRef.current;

  const [projects, setProjects] = useState<ProjectMeta[]>(() => listProjects());
  const [activeId, setActiveIdState] = useState<string>(boot.id);

  const [ast, setAst] = useState<DocumentNode | null>(boot.session.ast);
  const [history, dispatchHistory] = useReducer(historyReducer, undefined, () => ({
    past: [],
    present: boot.session.deck,
    future: [],
  }));
  const deck = history.present;
  const commitDeck = useCallback((next: Deck) => dispatchHistory({ type: 'commit', deck: next }), []);
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  // Edit mode forks the deck: edits land on the draft until Save commits them.
  const [draft, setDraft] = useState<Deck | null>(boot.session.draft ?? null);
  const [dirty, setDirty] = useState<boolean>(boot.session.dirty ?? false);

  const editing = draft !== null;
  const displayDeck = draft ?? deck;

  // Review & Present overlays.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);

  // Two-step confirm for Reset (disarms after 3 s)
  const [resetArmed, setResetArmed] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const armReset = () => {
    setResetArmed(true);
    resetTimerRef.current = setTimeout(() => setResetArmed(false), 3000);
  };
  const canReset = deck.generated || dirty;
  const handleResetClick = () => {
    if (!canReset) return;
    if (!resetArmed) { armReset(); return; }
    clearTimeout(resetTimerRef.current);
    setResetArmed(false);
    handleReset();
  };

  // Keep toolbar horizontally aligned with the first slide's visual left edge.
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function align() {
      const slide = document.querySelector<HTMLElement>('[data-slide]');
      const tb = toolbarRef.current;
      if (!slide || !tb) return;
      tb.style.left = `${slide.getBoundingClientRect().left}px`;
    }
    // Run after the scaler has applied transforms.
    requestAnimationFrame(align);
    const book = document.querySelector('.book');
    const ro = new ResizeObserver(() => requestAnimationFrame(align));
    if (book) ro.observe(book);
    return () => ro.disconnect();
  }, [displayDeck]);

  // Persist the working session (including an unsaved draft) into the active
  // deck's slot so a refresh doesn't lose generated content or in-progress edits.
  useEffect(() => {
    saveProjectSession(activeId, { ast, deck, draft, dirty });
    setProjects(listProjects()); // keep updatedAt ordering fresh in the switcher
  }, [activeId, ast, deck, draft, dirty]);

  /** Route a deck mutation to the draft while editing, else commit directly. */
  const mutateDeck = useCallback(
    (fn: (prev: Deck) => Deck) => {
      if (draft !== null) {
        setDraft((prev) => (prev ? fn(prev) : prev));
        setDirty(true);
      } else {
        commitDeck(fn(deck));
      }
    },
    [draft, deck, commitDeck]
  );

  const handleGenerate = useCallback(() => {
    if (!ast) return;
    commitDeck(buildDeckFromDocument(ast));
    setDraft(null);
    setDirty(false);
  }, [ast, commitDeck]);

  /** Import path: set the source AND build the deck in one step, so "Import & Load"
   *  in the Source Material modal doubles as Generate (no separate click needed).
   *  Uses the freshly parsed AST directly rather than waiting on `ast` state. */
  const handleImportAndGenerate = useCallback((imported: DocumentNode) => {
    setAst(imported);
    const built = buildDeckFromDocument(imported);
    commitDeck(built);
    setDraft(null);
    setDirty(false);
    // If the deck is still unnamed, adopt the source's title so it's easy to find.
    const current = projects.find((p) => p.id === activeId);
    if (current && current.name === 'Untitled deck') {
      const derived = built.slides[0]?.content.heading || built.slides[0]?.title;
      if (derived) {
        renameProject(activeId, derived);
        setProjects(listProjects());
      }
    }
  }, [commitDeck, projects, activeId]);

  const handleReset = useCallback(() => {
    commitDeck(createTemplateDeck());
    setDraft(null);
    setDirty(false);
    setAst(null); // unload the source too, so Source Material drops its loaded state
  }, [commitDeck]);

  const handleEnterEdit = useCallback(() => {
    setDraft(deck);
    setDirty(false);
  }, [deck]);

  const handleSaveEdits = useCallback(() => {
    if (draft) commitDeck(draft);
    setDraft(null);
    setDirty(false);
  }, [draft, commitDeck]);

  const handleDiscardEdits = useCallback(() => {
    setDraft(null);
    setDirty(false);
  }, []);

  const handleEditSlide = useCallback(
    (instanceId: string, updater: (content: SlideContent) => SlideContent) => {
      setDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          slides: prev.slides.map((s) =>
            s.instanceId === instanceId ? { ...s, content: updater(s.content) } : s
          ),
        };
      });
      setDirty(true);
    },
    []
  );

  const handleRename = useCallback(
    (instanceId: string, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      mutateDeck((prev) => ({
        ...prev,
        slides: prev.slides.map((s) =>
          s.instanceId === instanceId ? { ...s, title: clean } : s
        ),
      }));
    },
    [mutateDeck]
  );

  const handleToggleHidden = useCallback(
    (instanceId: string) => {
      mutateDeck((prev) => ({
        ...prev,
        slides: prev.slides.map((s) =>
          s.instanceId === instanceId ? { ...s, hidden: !s.hidden } : s
        ),
      }));
    },
    [mutateDeck]
  );

  const handleDuplicate = useCallback(
    (instanceId: string) => {
      mutateDeck((prev) => {
        const index = prev.slides.findIndex((s) => s.instanceId === instanceId);
        if (index === -1) return prev;
        const source = prev.slides[index];
        const copy = {
          ...source,
          instanceId: mintInstanceId(source.templateId),
          title: `${source.title} (Copy)`,
          hidden: false,
          content: { ...source.content },
        };
        const slides = [...prev.slides];
        slides.splice(index + 1, 0, copy);
        return { ...prev, slides };
      });
    },
    [mutateDeck]
  );

  const handleDelete = useCallback(
    (instanceId: string) => {
      mutateDeck((prev) => ({
        ...prev,
        slides: prev.slides.filter((s) => s.instanceId !== instanceId),
      }));
    },
    [mutateDeck]
  );

  const handleReorder = useCallback(
    (fromId: string, toId: string) => {
      mutateDeck((prev) => {
        const slides = [...prev.slides];
        const from = slides.findIndex((s) => s.instanceId === fromId);
        let to = slides.findIndex((s) => s.instanceId === toId);
        if (from === -1 || to === -1 || from === to) return prev;
        const [moved] = slides.splice(from, 1);
        to = slides.findIndex((s) => s.instanceId === toId); // recompute after removal
        slides.splice(to, 0, moved);
        // Adopt the group of its new neighbor so the sidebar label reflects
        // where the slide landed, not the section it originally belonged to.
        const neighborGroup = slides[to - 1]?.group ?? slides[to + 1]?.group;
        if (neighborGroup && neighborGroup !== moved.group) {
          slides[to] = { ...moved, group: neighborGroup };
        }
        return { ...prev, slides };
      });
    },
    [mutateDeck]
  );

  // Undo/redo only applies to committed changes, so it's disabled mid-edit
  // (edit mode has its own Save/Discard).
  const handleUndo = useCallback(() => {
    if (!editing) dispatchHistory({ type: 'undo' });
  }, [editing]);
  const handleRedo = useCallback(() => {
    if (!editing) dispatchHistory({ type: 'redo' });
  }, [editing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      if (editing) return; // let the browser handle text-edit undo in edit mode
      // Don't hijack undo while typing in an input/textarea/contentEditable.
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      if (e.shiftKey) dispatchHistory({ type: 'redo' });
      else dispatchHistory({ type: 'undo' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const handleAddBlank = useCallback(() => {
    const blank = createBlankSlide();
    mutateDeck((prev) => ({ ...prev, slides: [...prev.slides, blank] }));
    // Jump to the new slide after it renders.
    setTimeout(() => {
      document.getElementById(blank.instanceId)?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, [mutateDeck]);

  // ── Multiple saved decks ────────────────────────────────────────────────
  /** Replace all in-memory state from a stored session (with cleared history). */
  const hydrate = useCallback((session: StoredSession) => {
    setAst(session.ast);
    dispatchHistory({ type: 'set', deck: session.deck });
    setDraft(session.draft ?? null);
    setDirty(session.draft ? session.dirty ?? false : false);
  }, []);

  const handleSwitchDeck = useCallback(
    (id: string) => {
      if (id === activeId) return;
      saveProjectSession(activeId, { ast, deck, draft, dirty }); // flush current
      setStoreActiveId(id);
      setActiveIdState(id);
      hydrate(loadProjectSession(id) ?? { ast: null, deck: createTemplateDeck() });
      setProjects(listProjects());
    },
    [activeId, ast, deck, draft, dirty, hydrate]
  );

  const handleNewDeck = useCallback(() => {
    saveProjectSession(activeId, { ast, deck, draft, dirty }); // flush current
    const session: StoredSession = { ast: null, deck: createTemplateDeck() };
    const meta = createProject('Untitled deck', session); // also sets store-active
    setActiveIdState(meta.id);
    hydrate(session);
    setProjects(listProjects());
  }, [activeId, ast, deck, draft, dirty, hydrate]);

  const handleRenameDeck = useCallback((id: string, name: string) => {
    renameProject(id, name);
    setProjects(listProjects());
  }, []);

  const handleDeleteDeck = useCallback(
    (id: string) => {
      let nextActive = deleteProject(id);
      if (!nextActive) {
        // Deleted the last deck - start a fresh one so there's always a deck.
        const session: StoredSession = { ast: null, deck: createTemplateDeck() };
        nextActive = createProject('Untitled deck', session).id;
      }
      setProjects(listProjects());
      if (id === activeId) {
        setStoreActiveId(nextActive);
        setActiveIdState(nextActive);
        hydrate(loadProjectSession(nextActive) ?? { ast: null, deck: createTemplateDeck() });
      }
    },
    [activeId, hydrate]
  );

  return (
    <div className="wg-doc">
      <GeneratorSidebar
        hasPresentation={!!ast}
        ast={ast}
        deck={displayDeck}
        deckGenerated={deck.generated}
        editing={editing}
        dirty={dirty}
        onDocumentParsed={setAst}
        onImport={handleImportAndGenerate}
        onGenerate={handleGenerate}
        onToggleHidden={handleToggleHidden}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onRename={handleRename}
        onReorder={handleReorder}
        onAddBlank={handleAddBlank}
        onOpenReview={() => setReviewOpen(true)}
        projects={projects}
        activeId={activeId}
        onSwitchDeck={handleSwitchDeck}
        onNewDeck={handleNewDeck}
        onRenameDeck={handleRenameDeck}
        onDeleteDeck={handleDeleteDeck}
      />

      {/* ── Edit / Reset buttons - fixed, aligned with slide left edge ── */}
      <div
        ref={toolbarRef}
        style={{
          position: 'fixed',
          top: 12,
          left: 276, /* initial fallback; JS keeps it synced with the slide edge */
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          id="btn-edit-content"
          onClick={() => !editing && handleEnterEdit()}
          disabled={editing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 34, padding: '0 14px',
            fontSize: 12, fontWeight: 700,
            border: '1px solid',
            borderRadius: 0,
            cursor: editing ? 'default' : 'pointer',
            transition: 'background .15s, color .15s, border-color .15s',
            borderColor: editing ? 'var(--emerald-200)' : '#d1d5db',
            background: editing ? 'var(--emerald-50)' : '#ffffff',
            color: editing ? 'var(--emerald-600)' : '#374151',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
          {editing ? 'Editing…' : 'Edit Content'}
        </button>

        <button
          id="btn-reset-deck"
          onClick={handleResetClick}
          disabled={!canReset}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 34, padding: '0 14px',
            fontSize: 12, fontWeight: 700,
            border: '1px solid',
            borderRadius: 0,
            cursor: canReset ? 'pointer' : 'not-allowed',
            transition: 'background .15s, color .15s, border-color .15s, opacity .15s',
            opacity: canReset ? 1 : 0.4,
            borderColor: resetArmed ? '#fecaca' : '#d1d5db',
            background: resetArmed ? '#fef2f2' : '#ffffff',
            color: resetArmed ? '#dc2626' : '#374151',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          {!resetArmed && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          )}
          {resetArmed ? 'Confirm Reset?' : 'Reset'}
        </button>

        {/* Undo / redo for committed deck changes (disabled while editing). */}
        {(() => {
          const iconBtn = (enabled: boolean) => ({
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34,
            border: '1px solid #d1d5db',
            borderRadius: 0,
            cursor: enabled ? 'pointer' : 'not-allowed',
            transition: 'background .15s, color .15s, opacity .15s',
            opacity: enabled ? 1 : 0.4,
            background: '#ffffff',
            color: '#374151',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          });
          const undoEnabled = canUndo && !editing;
          const redoEnabled = canRedo && !editing;
          return (
            <>
              <button id="btn-undo" onClick={handleUndo} disabled={!undoEnabled} title="Undo (Cmd/Ctrl+Z)" aria-label="Undo" style={iconBtn(undoEnabled)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
              </button>
              <button id="btn-redo" onClick={handleRedo} disabled={!redoEnabled} title="Redo (Cmd/Ctrl+Shift+Z)" aria-label="Redo" style={iconBtn(redoEnabled)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
              </button>
            </>
          );
        })()}
      </div>

      {/* Present - top-right of the frame, opens fullscreen slideshow. */}
      <button
        onClick={() => displayDeck.slides.some((s) => !s.hidden) && setPresentOpen(true)}
        style={{
          position: 'fixed',
          top: 12,
          right: 28,
          zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 6,
          height: 34, padding: '0 16px',
          fontSize: 12, fontWeight: 700,
          border: 'none',
          borderRadius: 0,
          cursor: 'pointer',
          background: '#111827',
          color: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        Present
      </button>

      <PresentationCanvas
        ast={ast}
        deck={displayDeck}
        editing={editing}
        onEditSlide={handleEditSlide}
        onLogoChange={(v) => mutateDeck((d) => ({ ...d, logoUrl: v }))}
        onRequestEdit={handleEnterEdit}
      />

      {/* Floating edit-session bar: appears while edit mode is active. */}
      {editing && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: 'calc(50% + 150px)', // visually centred over the canvas (half of --sidenav-w: 300px)
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '10px 12px 10px 18px',
            background: 'var(--neutral-900)',
            color: '#fff',
            boxShadow: 'var(--shadow-soft)',
            zIndex: 100,
            borderRadius: 'var(--radius-sharp)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: dirty ? '#fff' : 'rgba(255,255,255,0.55)',
            }}
          >
            {dirty ? 'Unsaved changes' : 'Editing mode - click any text on a slide'}
          </span>
          <button
            onClick={handleSaveEdits}
            className="h-[34px] px-4 text-[12px] font-bold bg-white text-neutral-900 hover:bg-neutral-200 border-none cursor-pointer transition-colors rounded-[var(--radius-sharp)]"
          >
            Save Changes
          </button>
          <button
            onClick={handleDiscardEdits}
            className="h-[34px] px-4 text-[12px] font-bold bg-transparent text-white hover:bg-white/10 border border-white/30 cursor-pointer transition-colors rounded-[var(--radius-sharp)]"
          >
            {dirty ? 'Discard' : 'Cancel'}
          </button>
        </div>
      )}

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        deck={displayDeck}
        ast={ast}
        onPresent={() => { setReviewOpen(false); setPresentOpen(true); }}
        onReorder={handleReorder}
        onToggleHidden={handleToggleHidden}
      />
      <PresentMode
        open={presentOpen}
        onClose={() => setPresentOpen(false)}
        deck={displayDeck}
        ast={ast}
      />
    </div>
  );
}
