import { useCallback, useEffect, useRef, useState } from 'react';
import { GeneratorSidebar } from '../features/generator/GeneratorSidebar';
import { PresentationCanvas } from '../features/generator/PresentationCanvas';
// Import types for document parsing and deck configuration
import type { DocumentNode } from '../features/business-record/parser/ast';
import type { Deck, SlideContent } from '../features/deck/types';
import {
  createTemplateDeck,
  buildDeckFromDocument,
  mintInstanceId,
} from '../features/deck/deckBuilder';

const STORAGE_KEY = 'wozku-master-template-session-v1';

interface PersistedSession {
  ast: DocumentNode | null;
  deck: Deck;
  /** In-flight edit-mode fork of the deck, if the user was mid-edit. */
  draft?: Deck | null;
  dirty?: boolean;
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed.deck || !Array.isArray(parsed.deck.slides)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function MasterTemplatePage() {
  const [ast, setAst] = useState<DocumentNode | null>(() => loadSession()?.ast ?? null);
  const [deck, setDeck] = useState<Deck>(() => loadSession()?.deck ?? createTemplateDeck());
  // Edit mode forks the deck: edits land on the draft until Save commits them.
  const [draft, setDraft] = useState<Deck | null>(() => loadSession()?.draft ?? null);
  const [dirty, setDirty] = useState<boolean>(() => loadSession()?.dirty ?? false);

  const editing = draft !== null;
  const displayDeck = draft ?? deck;

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

  // Persist the working session (including an unsaved draft) so a refresh
  // doesn't lose generated content or in-progress edits.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ast, deck, draft, dirty }));
    } catch {
      // Storage may be unavailable (private mode / quota) — non-fatal.
    }
  }, [ast, deck, draft, dirty]);

  /** Route a deck mutation to the draft while editing, else commit directly. */
  const mutateDeck = useCallback(
    (fn: (prev: Deck) => Deck) => {
      if (draft !== null) {
        setDraft((prev) => (prev ? fn(prev) : prev));
        setDirty(true);
      } else {
        setDeck(fn);
      }
    },
    [draft]
  );

  const handleGenerate = useCallback(() => {
    if (!ast) return;
    setDeck(buildDeckFromDocument(ast));
    setDraft(null);
    setDirty(false);
  }, [ast]);

  const handleReset = useCallback(() => {
    setDeck(createTemplateDeck());
    setDraft(null);
    setDirty(false);
  }, []);

  const handleEnterEdit = useCallback(() => {
    setDraft(deck);
    setDirty(false);
  }, [deck]);

  const handleSaveEdits = useCallback(() => {
    if (draft) setDeck(draft);
    setDraft(null);
    setDirty(false);
  }, [draft]);

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
        onGenerate={handleGenerate}
        onToggleHidden={handleToggleHidden}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onRename={handleRename}
      />

      {/* ── Edit / Reset buttons — fixed, aligned with slide left edge ── */}
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
            borderColor: editing ? '#c7d2fe' : '#d1d5db',
            background: editing ? '#eef2ff' : '#ffffff',
            color: editing ? '#4f46e5' : '#374151',
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
      </div>

      <PresentationCanvas
        ast={ast}
        deck={displayDeck}
        editing={editing}
        onEditSlide={handleEditSlide}
      />

      {/* Floating edit-session bar: appears while edit mode is active. */}
      {editing && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: 'calc(50% + 118px)', // visually centred over the canvas (236px sidenav)
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
            {dirty ? 'Unsaved changes' : 'Editing mode — click any text on a slide'}
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
    </div>
  );
}
