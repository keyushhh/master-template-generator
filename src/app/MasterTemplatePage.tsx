import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { GeneratorSidebar } from '../features/generator/GeneratorSidebar';
import { PresentationCanvas, slideIsDark } from '../features/generator/PresentationCanvas';
import { fontLabel, slotLabel } from '../features/formatting/labels';
import { patchOffset, patchStyles, shiftOffsets } from '../features/formatting/resolve';
import { sameSelection, shapeIdsOf, slotsOf, toggleShape, toggleSlot, type Selection } from '../features/formatting/selection';
import { alignDelta, measureGroup, type GroupAlign } from '../features/formatting/group';
import { ReviewModal } from '../features/generator/ReviewModal';
import { PresentMode } from '../features/generator/PresentMode';
import { KeyboardShortcutsHelp } from '../features/generator/KeyboardShortcutsHelp';
import { useToast } from '../features/toast/Toast';
import type { DocumentNode } from '../features/business-record/parser/ast';
import type { Deck, OverlayShape, SlideContent, SlideTemplateId, SlotStyle } from '../features/deck/types';
import { applySwitch } from '../features/deck/templateSwitch';
import { TemplateSwitchModal } from '../features/generator/TemplateSwitchModal';
import { EditToolbar } from '../features/formatting/EditToolbar';
import {
  createOverlayShape,
  moveLayer,
  overlayOf,
  withOverlay,
  type LayerMove,
} from '../features/formatting/overlayModel';
import { FINE, GRID, clampToSlide } from '../features/formatting/snap';
import {
  createTemplateDeck,
  deckIsPristine,
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

// Undo/redo history for the committed deck.
const HISTORY_LIMIT = 50;
/** Smaller cap for what gets written to localStorage - each entry is a full
 *  deck snapshot (images included), so persisting all 50 would balloon
 *  storage fast. A reload only needs to recover a few recent steps. */
const PERSISTED_HISTORY_LIMIT = 10;

interface DeckHistory {
  past: Deck[];
  present: Deck;
  future: Deck[];
}

type HistoryAction =
  | { type: 'commit'; deck: Deck }
  | { type: 'set'; deck: Deck; past?: Deck[]; future?: Deck[] }
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
      return { past: action.past ?? [], present: action.deck, future: action.future ?? [] };
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

/**
 * Undo/redo for the edit-mode draft.
 *
 * Edit mode forks the deck, and the committed history above cannot see inside
 * that fork - which is why Undo used to sit disabled for the whole editing
 * session, i.e. precisely when a user most wants it. The draft therefore carries
 * its own past/future, cleared whenever the fork opens or closes: undoing past
 * the moment you entered edit mode is what Discard is for.
 *
 * Every draft mutation goes through the `edit` action, so there is exactly one
 * place that can add a history entry. A mutation that returns the same object is
 * dropped rather than recorded, so a no-op edit can't leave a dead step the user
 * has to press Undo twice to get past.
 *
 * Deliberately not persisted: each entry is a whole deck snapshot, images
 * included, and the committed history already caps what it writes for that
 * reason. A reload keeps your unsaved draft and starts its undo stack fresh.
 */
interface DraftHistory {
  past: Deck[];
  present: Deck | null;
  future: Deck[];
}

type DraftAction =
  | { type: 'open'; deck: Deck | null }
  | { type: 'close' }
  | { type: 'edit'; fn: (prev: Deck) => Deck }
  | { type: 'undo' }
  | { type: 'redo' };

function draftReducer(state: DraftHistory, action: DraftAction): DraftHistory {
  switch (action.type) {
    case 'open':
      return { past: [], present: action.deck, future: [] };
    case 'close':
      return { past: [], present: null, future: [] };
    case 'edit': {
      if (!state.present) return state;
      const next = action.fn(state.present);
      if (next === state.present) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    }
    case 'undo': {
      if (!state.present || state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      if (!state.present || state.future.length === 0) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

export function MasterTemplatePage() {
  const { showToast } = useToast();

  // Bootstrap the active deck once (migrates any legacy session into a project).
  const bootstrapRef = useRef<{ id: string; session: StoredSession } | null>(null);
  if (bootstrapRef.current === null) bootstrapRef.current = ensureInitialized(createTemplateDeck);
  const boot = bootstrapRef.current;

  const [projects, setProjects] = useState<ProjectMeta[]>(() => listProjects());
  const [activeId, setActiveIdState] = useState<string>(boot.id);

  const [ast, setAst] = useState<DocumentNode | null>(boot.session.ast);
  const [history, dispatchHistory] = useReducer(historyReducer, undefined, () => ({
    past: boot.session.historyPast ?? [],
    present: boot.session.deck,
    future: boot.session.historyFuture ?? [],
  }));
  const deck = history.present;
  const commitDeck = useCallback((next: Deck) => dispatchHistory({ type: 'commit', deck: next }), []);
  // What Reset restores to - the deck as it stood right after import/generation,
  // not the generic placeholder. Falls back to the placeholder for a deck that
  // never had a source (a brand-new blank deck).
  const [baselineDeck, setBaselineDeck] = useState<Deck>(boot.session.baselineDeck ?? boot.session.deck);
  // Edit mode forks the deck: edits land on the draft until Save commits them.
  // The fork carries its own undo stack (see draftReducer).
  const [draftHistory, dispatchDraft] = useReducer(draftReducer, undefined, () => ({
    past: [],
    present: boot.session.draft ?? null,
    future: [],
  }));
  const draft = draftHistory.present;
  const [dirty, setDirty] = useState<boolean>(boot.session.dirty ?? false);

  const editing = draft !== null;
  // Which stack the buttons and Cmd+Z act on depends on whether the deck is
  // forked - inside edit mode the committed stack is not the one the user is
  // making changes to.
  const canUndo = editing ? draftHistory.past.length > 0 : history.past.length > 0;
  const canRedo = editing ? draftHistory.future.length > 0 : history.future.length > 0;
  const displayDeck = draft ?? deck;

  // Review & Present overlays.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Two-step confirm for Reset (disarms after 3 s)
  const [resetArmed, setResetArmed] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const armReset = () => {
    setResetArmed(true);
    resetTimerRef.current = setTimeout(() => setResetArmed(false), 3000);
  };
  // Reset is available whenever the deck differs from the pristine template -
  // including after edits have been saved, which the old `generated || dirty`
  // test missed entirely.
  const canReset = !deckIsPristine(deck) || dirty;
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

  // Persist the working session (including an unsaved draft and a capped
  // undo/redo window) into the active deck's slot on every change.
  const saveFailedRef = useRef(false);
  useEffect(() => {
    const ok = saveProjectSession(activeId, {
      ast,
      deck,
      draft,
      dirty,
      historyPast: history.past.slice(-PERSISTED_HISTORY_LIMIT),
      historyFuture: history.future.slice(0, PERSISTED_HISTORY_LIMIT),
      baselineDeck,
    });
    if (!ok && !saveFailedRef.current) {
      saveFailedRef.current = true;
      showToast("Couldn't save your changes - browser storage is full. Remove some images or free up space.", 'error');
    } else if (ok) {
      saveFailedRef.current = false;
    }
    setProjects(listProjects()); // keep updatedAt ordering fresh in the switcher
  }, [activeId, ast, deck, draft, dirty, history.past, history.future, baselineDeck, showToast]);

  /** Route a deck mutation to the draft while editing, else commit directly. */
  const mutateDeck = useCallback(
    (fn: (prev: Deck) => Deck) => {
      if (draft !== null) {
        dispatchDraft({ type: 'edit', fn });
        setDirty(true);
      } else {
        commitDeck(fn(deck));
      }
    },
    [draft, deck, commitDeck]
  );

  const handleGenerate = useCallback(() => {
    if (!ast) return;
    const built = buildDeckFromDocument(ast);
    commitDeck(built);
    dispatchDraft({ type: 'close' });
    setDirty(false);
    setBaselineDeck(built);
  }, [ast, commitDeck]);

  /** Import path: set the source AND build the deck in one step, so "Import & Load"
   *  in the Source Material modal doubles as Generate (no separate click needed).
   *  Uses the freshly parsed AST directly rather than waiting on `ast` state. */
  const handleImportAndGenerate = useCallback((imported: DocumentNode) => {
    setAst(imported);
    const built = buildDeckFromDocument(imported);
    commitDeck(built);
    dispatchDraft({ type: 'close' });
    setDirty(false);
    setBaselineDeck(built);
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

  /** Deck built from an uploaded .pptx. There is no Business Record behind it,
   *  so the AST is cleared - the imported slides carry their own shapes and the
   *  Generate path must not overwrite them with template placeholders. */
  const handleImportDeck = useCallback((built: Deck, name: string, warnings: string[]) => {
    setAst(null);
    commitDeck(built);
    dispatchDraft({ type: 'close' });
    setDirty(false);
    setBaselineDeck(built);
    showToast(
      warnings.length
        ? `Imported ${built.slides.length} slides. ${warnings.length} note${warnings.length > 1 ? 's' : ''}: ${warnings[0]}`
        : `Imported ${built.slides.length} slides on the Wozku theme. Your content is unchanged.`
    );
    const current = projects.find((p) => p.id === activeId);
    if (current && current.name === 'Untitled deck' && name) {
      renameProject(activeId!, name);
      setProjects(listProjects());
    }
  }, [commitDeck, projects, activeId, showToast]);

  // Reverts to this deck's own baseline - the imported/generated content as it
  // stood right after import, not the generic placeholder. A deck that never
  // had a source (baselineDeck falls back to the placeholder itself) resets to
  // the placeholder exactly as before.
  const handleReset = useCallback(() => {
    commitDeck(baselineDeck);
    dispatchDraft({ type: 'close' });
    setDirty(false);
  }, [commitDeck, baselineDeck]);

  const handleEnterEdit = useCallback(() => {
    dispatchDraft({ type: 'open', deck });
    setDirty(false);
  }, [deck]);

  const handleSaveEdits = useCallback(() => {
    if (draft) commitDeck(draft);
    dispatchDraft({ type: 'close' });
    setDirty(false);
  }, [draft, commitDeck]);

  const handleDiscardEdits = useCallback(() => {
    dispatchDraft({ type: 'close' });
    setDirty(false);
  }, []);

  // ── Formatting ─────────────────────────────────────────────────────────────
  // What the format toolbar is pointed at. Owned here rather than in the canvas
  // because the toolbar renders outside it, and both have to agree.
  const [selection, setSelection] = useState<Selection | null>(null);

  // Leaving edit mode drops the selection: the toolbar is edit-mode-only, and a
  // stale target would reappear pointing at a slide that may since have been
  // deleted or reordered.
  useEffect(() => {
    if (!editing) setSelection(null);
  }, [editing]);

  /** Which slide has focus, so Insert and Notes act on the slide the user is
   *  looking at rather than the first one in the deck. */
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);

  const handleSelect = useCallback((next: Selection, additive?: boolean) => {
    // Shift-click builds a group instead of replacing the selection. Slots and
    // imported shapes can each be grouped among their own kind - a box and its
    // caption are both imported shapes, so shift-clicking between them has to
    // work the same way shift-clicking two template fields does. Overlay
    // shapes aren't included: they have their own controls per shape and
    // mixing kinds would leave most of the toolbar unable to act on most of
    // what was selected.
    if (additive && next.kind === 'slot') {
      setSelection((prev) => toggleSlot(prev, next));
      return;
    }
    if (additive && next.kind === 'run') {
      setSelection((prev) => toggleShape(prev, next));
      return;
    }
    // Re-focusing the field you're already typing in fires on every blur/focus
    // cycle; bailing keeps that from re-rendering the whole canvas per keystroke.
    setSelection((prev) => (sameSelection(prev, next) ? prev : next));
  }, []);

  const selectedSlide = selection
    ? displayDeck.slides.find((s) => s.instanceId === selection.instanceId)
    : undefined;

  /** The override currently in effect on the selection.
   *
   *  Templates and imported slides store formatting differently: a template
   *  slot carries a SlotStyle override layered over the renderer, while an
   *  imported run owns its formatting outright (it was read out of the source
   *  .pptx). Both are presented to the toolbar as a SlotStyle so there is one
   *  toolbar rather than two. */
  const selectedStyle: SlotStyle | undefined = (() => {
    if (!selection || !selectedSlide) return undefined;
    if (selection.kind === 'slot') return selectedSlide.content.styles?.[selection.slot];
    if (selection.kind === 'overlay') {
      // An overlay text box owns its style outright, so it is already a
      // SlotStyle - no translation needed.
      return selectedSlide.content.overlay?.find((s) => s.id === selection.shapeId)?.style;
    }
    const shape = selectedSlide.content.shapes?.find((s) => s.id === selection.shapeId);
    const para = shape?.paragraphs?.[selection.paragraph];
    const run = para?.runs[selection.run];
    if (!run) return undefined;
    return {
      sizePx: run.sizePx,
      bold: run.bold,
      italic: run.italic,
      underline: run.underline,
      color: run.color,
      align: para?.align,
    };
  })();

  const handleEditSlide = useCallback(
    (instanceId: string, updater: (content: SlideContent) => SlideContent) => {
      dispatchDraft({
        type: 'edit',
        fn: (prev) => ({
          ...prev,
          slides: prev.slides.map((s) =>
            s.instanceId === instanceId ? { ...s, content: updater(s.content) } : s
          ),
        }),
      });
      setDirty(true);
    },
    []
  );

  /**
   * Applies a formatting patch to whatever is selected.
   *
   * A patch field set to `undefined` means "unset this property", which is how
   * the toggles turn themselves off - the property is removed so the template's
   * own value takes over again, rather than being frozen to today's value.
   */
  const handleFormatPatch = useCallback(
    (patch: Partial<SlotStyle>) => {
      if (!selection) return;
      const sel = selection;

      if (sel.kind === 'slot') {
        // Applies to every slot in the selection, so formatting a group is one
        // action rather than one per member - and one undo, not three.
        const slots = slotsOf(sel);
        handleEditSlide(sel.instanceId, (c) => {
          let styles = c.styles;
          for (const slot of slots) styles = patchStyles(styles, slot, patch);
          return { ...c, styles };
        });
        return;
      }

      if (sel.kind === 'overlay') {
        // Overlay text box: the style lives on the shape, so the patch merges
        // straight in. Undefined fields are stripped so "unset" really unsets.
        handleEditSlide(sel.instanceId, (c) => ({
          ...c,
          overlay: (c.overlay ?? []).map((s) => {
            if (s.id !== sel.shapeId) return s;
            const merged = { ...(s.style ?? {}), ...patch };
            for (const k of Object.keys(patch) as (keyof typeof merged)[]) {
              if (patch[k] === undefined) delete merged[k];
            }
            return { ...s, style: Object.keys(merged).length ? merged : undefined };
          }),
        }));
        return;
      }

      // Imported run: formatting lives on the run itself. Alignment is a
      // paragraph property in OOXML (and in our model), so it is applied one
      // level up from the rest of the patch.
      handleEditSlide(sel.instanceId, (c) => ({
        ...c,
        shapes: (c.shapes ?? []).map((sh) => {
          if (sh.id !== sel.shapeId) return sh;
          return {
            ...sh,
            paragraphs: (sh.paragraphs ?? []).map((para, pi) => {
              if (pi !== sel.paragraph) return para;
              const nextAlign = 'align' in patch ? patch.align : para.align;
              return {
                ...para,
                align: nextAlign,
                runs: para.runs.map((run, ri) => {
                  if (ri !== sel.run) return run;
                  const next = { ...run };
                  if ('sizePx' in patch) next.sizePx = patch.sizePx;
                  if ('bold' in patch) next.bold = patch.bold;
                  if ('italic' in patch) next.italic = patch.italic;
                  if ('underline' in patch) next.underline = patch.underline;
                  if ('color' in patch) next.color = patch.color;
                  return next;
                }),
              };
            }),
          };
        }),
      }));
    },
    [selection, handleEditSlide]
  );

  // ── Overlay shapes, layers and notes ───────────────────────────────────────

  /** The slide Insert and Notes act on: whatever is selected, else the focused
   *  slide, else the first visible one so the controls are never dead. */
  const targetSlide = (() => {
    const bySelection = selection
      ? displayDeck.slides.find((s) => s.instanceId === selection.instanceId)
      : undefined;
    if (bySelection) return bySelection;
    const byFocus = activeSlideId
      ? displayDeck.slides.find((s) => s.instanceId === activeSlideId)
      : undefined;
    return byFocus ?? displayDeck.slides.find((s) => !s.hidden);
  })();

  const selectedOverlayShape =
    selection?.kind === 'overlay' && targetSlide
      ? targetSlide.content.overlay?.find((s) => s.id === selection.shapeId)
      : undefined;

  /** The imported shape a 'run' selection points at, if any - it's the shape
   *  itself that fill/stroke/delete act on, regardless of which run inside it
   *  the selection happens to be addressing. */
  const selectedImportedShape =
    selection?.kind === 'run' && targetSlide
      ? targetSlide.content.shapes?.find((s) => s.id === selection.shapeId)
      : undefined;
  const importedShapeHasText = !!selectedImportedShape?.paragraphs?.length;

  /** Every imported shape currently selected together (a box shift-clicked
   *  with its caption, say). Above one, the toolbar swaps individual
   *  fill/stroke/text controls for group alignment - a mixed box-and-text
   *  selection has no single font or fill to show anyway. */
  const importedShapeIds = shapeIdsOf(selection);
  const importedShapeGroup = importedShapeIds.length > 1;

  /** Whether the toolbar should show text controls. True for template slots,
   *  a single imported run that actually carries text, and an inserted text
   *  box - but not for a rectangle, a multi-shape group, or an imported shape
   *  with no text of its own, which get shape controls instead. */
  const hasTextSelection =
    !!selection &&
    (selection.kind === 'slot' ||
      (selection.kind === 'run' && importedShapeHasText && !importedShapeGroup) ||
      selectedOverlayShape?.kind === 'text');

  const handleInsertShape = useCallback(
    (kind: OverlayShape['kind']) => {
      if (!targetSlide) return;
      const id = targetSlide.instanceId;
      const shape = createOverlayShape(kind, (targetSlide.content.overlay ?? []).length);
      handleEditSlide(id, (c) => withOverlay(c, [...overlayOf(c), shape]));
      // Select it immediately: an inserted shape you then have to hunt for is a
      // worse experience than one that arrives ready to move or type into.
      setSelection({ kind: 'overlay', instanceId: id, shapeId: shape.id });
    },
    [targetSlide, handleEditSlide]
  );

  /** Applies a change to the selected overlay shape. */
  const patchSelectedShape = useCallback(
    (patch: Partial<OverlayShape>) => {
      if (selection?.kind !== 'overlay') return;
      const sel = selection;
      handleEditSlide(sel.instanceId, (c) =>
        withOverlay(
          c,
          overlayOf(c).map((s) => (s.id === sel.shapeId ? { ...s, ...patch } : s))
        )
      );
    },
    [selection, handleEditSlide]
  );

  const handleLayerMove = useCallback(
    (move: LayerMove) => {
      if (selection?.kind !== 'overlay') return;
      const sel = selection;
      handleEditSlide(sel.instanceId, (c) =>
        withOverlay(c, moveLayer(overlayOf(c), sel.shapeId, move))
      );
    },
    [selection, handleEditSlide]
  );

  const handleDeleteShape = useCallback(() => {
    if (selection?.kind !== 'overlay') return;
    const sel = selection;
    handleEditSlide(sel.instanceId, (c) =>
      withOverlay(c, overlayOf(c).filter((s) => s.id !== sel.shapeId))
    );
    setSelection(null);
  }, [selection, handleEditSlide]);

  /** Sets a shape's fill, and pairs the emerald tint with its emerald border so
   *  the house treatment lands in one click rather than two. */
  const handleSetShapeFill = useCallback(
    (hex: string | undefined) => {
      patchSelectedShape({
        fill: hex,
        line: hex === 'ECFDF5'
          ? { color: '10B981', widthPx: 1 }
          : { color: 'E5E5E5', widthPx: 1 },
      });
    },
    [patchSelectedShape]
  );

  /** Deletes every shape in the current selection, not just the anchor - a
   *  shift-clicked group deletes as one action. */
  const handleDeleteImportedShape = useCallback(() => {
    if (selection?.kind !== 'run') return;
    const sel = selection;
    const ids = shapeIdsOf(sel);
    handleEditSlide(sel.instanceId, (c) => ({
      ...c,
      shapes: (c.shapes ?? []).filter((s) => !ids.includes(s.id)),
    }));
    setSelection(null);
  }, [selection, handleEditSlide]);

  const handleSetImportedShapeFill = useCallback(
    (hex: string | undefined) => {
      if (selection?.kind !== 'run') return;
      const sel = selection;
      const ids = shapeIdsOf(sel);
      handleEditSlide(sel.instanceId, (c) => ({
        ...c,
        shapes: (c.shapes ?? []).map((s) => (ids.includes(s.id) ? { ...s, fill: hex } : s)),
      }));
    },
    [selection, handleEditSlide]
  );

  const handleSetImportedShapeLine = useCallback(
    (line: { color: string; widthPx: number } | undefined) => {
      if (selection?.kind !== 'run') return;
      const sel = selection;
      const ids = shapeIdsOf(sel);
      handleEditSlide(sel.instanceId, (c) => ({
        ...c,
        shapes: (c.shapes ?? []).map((s) => (ids.includes(s.id) ? { ...s, line } : s)),
      }));
    },
    [selection, handleEditSlide]
  );

  /**
   * Aligns every selected imported shape to the others, the way Google
   * Slides' "Align" acts on a multi-object selection: relative to the
   * combined bounding box of the group, not to the slide. This is what makes
   * "centre this caption inside its box" possible - the box and its caption
   * are separate shapes with no relationship in the model, so centering only
   * makes sense as a geometric operation on the pair.
   */
  const handleAlignShapes = useCallback(
    (to: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => {
      if (selection?.kind !== 'run') return;
      const sel = selection;
      const ids = shapeIdsOf(sel);
      if (ids.length < 2) return;
      handleEditSlide(sel.instanceId, (c) => {
        const shapes = c.shapes ?? [];
        const members = shapes.filter((s) => ids.includes(s.id));
        if (members.length < 2) return c;
        const minX = Math.min(...members.map((s) => s.x));
        const maxX = Math.max(...members.map((s) => s.x + s.w));
        const minY = Math.min(...members.map((s) => s.y));
        const maxY = Math.max(...members.map((s) => s.y + s.h));
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        return {
          ...c,
          shapes: shapes.map((s) => {
            if (!ids.includes(s.id)) return s;
            let x = s.x;
            let y = s.y;
            if (to === 'left') x = minX;
            else if (to === 'right') x = maxX - s.w;
            else if (to === 'centerX') x = cx - s.w / 2;
            else if (to === 'top') y = minY;
            else if (to === 'bottom') y = maxY - s.h;
            else if (to === 'centerY') y = cy - s.h / 2;
            return { ...s, x: Math.round(x), y: Math.round(y) };
          }),
        };
      });
    },
    [selection, handleEditSlide]
  );

  const handleNotesChange = useCallback(
    (notes: string) => {
      if (!targetSlide) return;
      const id = targetSlide.instanceId;
      const clean = notes.trim() ? notes : undefined;
      mutateDeck((prev) => ({
        ...prev,
        slides: prev.slides.map((s) => (s.instanceId === id ? { ...s, notes: clean } : s)),
      }));
    },
    [targetSlide, mutateDeck]
  );

  /**
   * Keyboard handling for a selected shape.
   *
   * The Arrange menu advertises these shortcuts, so they have to exist - a menu
   * that shows a shortcut that does nothing is worse than one that shows none.
   * Alt is the modifier because Cmd/Ctrl+arrow is already claimed by the browser
   * for caret navigation inside the text fields on the same canvas.
   */
  useEffect(() => {
    if (!editing || !selection) return;
    if (selection.kind !== 'overlay' && selection.kind !== 'slot' && selection.kind !== 'run') return;
    const sel = selection;

    const onKey = (e: KeyboardEvent) => {
      // Never hijack keys while the user is typing into a field. Guard on
      // Element: the event target can be window or document (no focused
      // element), and calling closest() on those throws.
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.isContentEditable || t?.closest('input, textarea')) return;

      if (sel.kind === 'overlay' && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const up = e.key === 'ArrowUp';
        handleLayerMove(e.shiftKey ? (up ? 'front' : 'back') : up ? 'forward' : 'backward');
        return;
      }
      // Delete removes an inserted shape. It deliberately does nothing to a
      // template slot: those are part of the layout, and clearing their text is
      // what "removing" one means.
      if (sel.kind === 'overlay' && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        handleDeleteShape();
        return;
      }
      // An imported shape works the same way, as long as the caret isn't
      // sitting inside its text - the isContentEditable guard above already
      // covers that case, so reaching here means the shape itself is targeted.
      if (sel.kind === 'run' && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        handleDeleteImportedShape();
        return;
      }
      if (e.key === 'Escape') {
        setSelection(null);
        return;
      }
      // Nudge: one fine step, or a full grid cell with Shift.
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      const d = nudge[e.key];
      if (!d) return;
      e.preventDefault();
      const step = e.shiftKey ? GRID : FINE;

      if (sel.kind === 'slot') {
        // Template slots move by a delta from wherever their template put them,
        // so nudging just adds to that delta - for every selected slot at once,
        // which is what keeps a group's internal spacing intact.
        const slots = slotsOf(sel);
        handleEditSlide(sel.instanceId, (c) => ({
          ...c,
          offsets: shiftOffsets(c.offsets, slots, { dx: d[0] * step, dy: d[1] * step }),
        }));
        return;
      }

      if (sel.kind === 'run') {
        // Every shape in the selection moves by the same delta, so a group (a
        // box and its caption) keeps its internal layout while nudging.
        const ids = shapeIdsOf(sel);
        handleEditSlide(sel.instanceId, (c) => ({
          ...c,
          shapes: (c.shapes ?? []).map((s) => {
            if (!ids.includes(s.id)) return s;
            const moved = clampToSlide({ ...s, x: s.x + d[0] * step, y: s.y + d[1] * step });
            return { ...s, x: moved.x, y: moved.y };
          }),
        }));
        return;
      }

      const shape = displayDeck.slides
        .find((s) => s.instanceId === sel.instanceId)
        ?.content.overlay?.find((s) => s.id === sel.shapeId);
      if (!shape) return;
      const moved = clampToSlide({
        ...shape,
        x: shape.x + d[0] * step,
        y: shape.y + d[1] * step,
      });
      patchSelectedShape({ x: moved.x, y: moved.y });
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, selection, handleLayerMove, handleDeleteShape, handleDeleteImportedShape, patchSelectedShape, handleEditSlide, displayDeck]);

  /** Returns the selection to template styling (or, on an imported run, strips
   *  the formatting the toolbar can control). */
  const handleFormatReset = useCallback(() => {
    if (!selection) return;
    // A dragged slot is part of "how this text was changed", so Reset returns
    // its position too - otherwise Reset would look like it half-worked.
    if (selection.kind === 'slot') {
      const slots = slotsOf(selection);
      handleEditSlide(selection.instanceId, (c) => {
        let offsets = c.offsets;
        for (const slot of slots) offsets = patchOffset(offsets, slot, undefined);
        return { ...c, offsets };
      });
    }
    handleFormatPatch({
      sizePx: undefined,
      bold: undefined,
      italic: undefined,
      underline: undefined,
      color: undefined,
      align: undefined,
    });
  }, [selection, handleFormatPatch, handleEditSlide]);

  /**
   * Moves the selected slots as one block onto a slide margin or centre line.
   *
   * The box has to be measured from the rendered DOM: a template slot's position
   * is produced by its renderer's flex/padding layout (and, on the cover, by a
   * hero size computed from the title's length), so there is no coordinate in
   * the model to read. Everything downstream is a plain delta, which is why
   * relative positions inside the group survive untouched.
   */
  const handleAlignGroup = useCallback(
    (to: GroupAlign) => {
      if (selection?.kind !== 'slot') return;
      const sel = selection;
      const slots = slotsOf(sel);
      const slideEl = document.getElementById(sel.instanceId);
      if (!slideEl) return;
      const box = measureGroup(slideEl, slots);
      if (!box) return;
      const delta = alignDelta(box, to);
      if (!delta.dx && !delta.dy) return;
      handleEditSlide(sel.instanceId, (c) => ({
        ...c,
        offsets: shiftOffsets(c.offsets, slots, delta),
      }));
    },
    [selection, handleEditSlide]
  );

  const handleRename = useCallback(
    (instanceId: string, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      mutateDeck((prev) => ({
        ...prev,
        slides: prev.slides.map((s) =>
          // titleCustomized records that this name is the user's choice, so a
          // later layout switch keeps it instead of adopting the new template's
          // default name.
          s.instanceId === instanceId ? { ...s, title: clean, titleCustomized: true } : s
        ),
      }));
    },
    [mutateDeck]
  );

  // ── Layout switching ───────────────────────────────────────────────────────
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null);
  const switchTargetSlide = switchTargetId
    ? displayDeck.slides.find((s) => s.instanceId === switchTargetId)
    : undefined;

  const handleConfirmSwitch = useCallback(
    (to: SlideTemplateId) => {
      const id = switchTargetId;
      if (!id) return;
      mutateDeck((prev) => ({
        ...prev,
        slides: prev.slides.map((s) => (s.instanceId === id ? applySwitch(s, to) : s)),
      }));
      setSwitchTargetId(null);
      // The old selection may point at a slot the new template doesn't render.
      setSelection(null);
      showToast('Layout changed. Nothing was deleted — parked content returns if you switch back.', 'success');
    },
    [switchTargetId, mutateDeck, showToast]
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

  const handleBulkSetHidden = useCallback(
    (instanceIds: string[], hidden: boolean) => {
      const ids = new Set(instanceIds);
      mutateDeck((prev) => ({
        ...prev,
        slides: prev.slides.map((s) => (ids.has(s.instanceId) ? { ...s, hidden } : s)),
      }));
    },
    [mutateDeck]
  );

  const handleBulkDelete = useCallback(
    (instanceIds: string[]) => {
      const ids = new Set(instanceIds);
      mutateDeck((prev) => ({ ...prev, slides: prev.slides.filter((s) => !ids.has(s.instanceId)) }));
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

  /**
   * Undo/redo, routed to whichever stack the user is actually changing: the
   * draft's while the deck is forked, the committed deck's otherwise.
   *
   * Both the buttons and Cmd+Z come through here so the three things a step has
   * to do - flush any pending typing, bump the text revision, move the stack -
   * can't drift apart between the two entry points.
   */
  const [textRevision, bumpTextRevision] = useReducer((n: number) => n + 1, 0);

  const timeTravel = useCallback(
    (dir: 'undo' | 'redo') => {
      // A slide's text only enters the deck on blur, so a field with unsaved
      // typing has to be flushed before the stack moves - otherwise the step
      // would skip over the change the user can see.
      const el = document.activeElement;
      if (el instanceof HTMLElement && el.isContentEditable) el.blur();
      // Rebuild the editable nodes from the model. Without this, undoing text
      // the user typed a moment ago leaves it on screen: see the note on the
      // `key` in the canvas's <E>.
      bumpTextRevision();
      if (editing) dispatchDraft({ type: dir });
      else dispatchHistory({ type: dir });
    },
    [editing]
  );

  const handleUndo = useCallback(() => timeTravel('undo'), [timeTravel]);
  const handleRedo = useCallback(() => timeTravel('redo'), [timeTravel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      // Real form fields (the notes textarea, the size box, a project name) keep
      // the browser's own text undo - that is what someone typing into an input
      // expects, and those values aren't in either deck history anyway.
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      timeTravel(e.shiftKey ? 'redo' : 'undo');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [timeTravel]);

  // "?" opens the keyboard shortcuts overlay, unless the user is typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      setShortcutsOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleAddBlank = useCallback(() => {
    const blank = createBlankSlide();
    mutateDeck((prev) => ({ ...prev, slides: [...prev.slides, blank] }));
    // Jump to the new slide after it renders.
    setTimeout(() => {
      document.getElementById(blank.instanceId)?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, [mutateDeck]);

  const handleInsertAfter = useCallback((instanceId: string) => {
    const blank = createBlankSlide();
    mutateDeck((prev) => {
      const idx = prev.slides.findIndex((s) => s.instanceId === instanceId);
      const next = idx === -1
        ? [...prev.slides, blank]
        : [...prev.slides.slice(0, idx + 1), blank, ...prev.slides.slice(idx + 1)];
      return { ...prev, slides: next };
    });
    setTimeout(() => {
      document.getElementById(blank.instanceId)?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, [mutateDeck]);

  // ── Multiple saved decks ────────────────────────────────────────────────
  /** Replace all in-memory state (including undo/redo history) from a stored session. */
  const hydrate = useCallback((session: StoredSession) => {
    setAst(session.ast);
    dispatchHistory({ type: 'set', deck: session.deck, past: session.historyPast, future: session.historyFuture });
    dispatchDraft({ type: 'open', deck: session.draft ?? null });
    setDirty(session.draft ? session.dirty ?? false : false);
    setBaselineDeck(session.baselineDeck ?? session.deck);
  }, []);

  const flushCurrent = useCallback(() => {
    saveProjectSession(activeId, {
      ast,
      deck,
      draft,
      dirty,
      historyPast: history.past.slice(-PERSISTED_HISTORY_LIMIT),
      historyFuture: history.future.slice(0, PERSISTED_HISTORY_LIMIT),
      baselineDeck,
    });
  }, [activeId, ast, deck, draft, dirty, history.past, history.future, baselineDeck]);

  const handleSwitchDeck = useCallback(
    (id: string) => {
      if (id === activeId) return;
      flushCurrent();
      setStoreActiveId(id);
      setActiveIdState(id);
      hydrate(loadProjectSession(id) ?? { ast: null, deck: createTemplateDeck() });
      setProjects(listProjects());
    },
    [activeId, flushCurrent, hydrate]
  );

  const handleNewDeck = useCallback(() => {
    flushCurrent();
    const session: StoredSession = { ast: null, deck: createTemplateDeck() };
    const meta = createProject('Untitled deck', session); // also sets store-active
    setActiveIdState(meta.id);
    hydrate(session);
    setProjects(listProjects());
  }, [flushCurrent, hydrate]);

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
        onImportDeck={handleImportDeck}
        onGenerate={handleGenerate}
        onToggleHidden={handleToggleHidden}
        onDuplicate={handleDuplicate}
        onChangeLayout={setSwitchTargetId}
        onDelete={handleDelete}
        onRename={handleRename}
        onReorder={handleReorder}
        onAddBlank={handleAddBlank}
        onInsertAfter={handleInsertAfter}
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
            // Long-hand, not the `border` shorthand: these buttons also set
            // borderColor conditionally, and mixing the two makes React warn
            // (and can drop the colour on re-render).
            borderWidth: 1,
            borderStyle: 'solid',
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
            // Long-hand, not the `border` shorthand: these buttons also set
            // borderColor conditionally, and mixing the two makes React warn
            // (and can drop the colour on re-render).
            borderWidth: 1,
            borderStyle: 'solid',
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

        {/* Undo / redo. Acts on the draft's own stack while editing, so the
            controls stay live through an editing session rather than going dead
            exactly when the user is making the most changes. */}
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
          const undoEnabled = canUndo;
          const redoEnabled = canRedo;
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

        {/* Session actions sit here, next to Edit Content, rather than in a
            floating bar of their own: they end the editing session, so they
            belong with the control that started it - not with the tools that
            act on the current selection. */}
        {editing && (
          <>
            <span style={{ width: 1, height: 22, background: '#e5e7eb', margin: '0 2px' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: dirty ? 'var(--emerald-600)' : '#9ca3af',
                whiteSpace: 'nowrap', paddingRight: 2,
              }}
            >
              {dirty ? 'Unsaved' : 'No changes'}
            </span>
            <button
              onClick={handleSaveEdits}
              style={{
                height: 34, padding: '0 14px', fontSize: 12, fontWeight: 700,
                border: 'none', borderRadius: 0, cursor: 'pointer',
                background: dirty ? '#111827' : '#e5e7eb',
                color: dirty ? '#fff' : '#6b7280',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              Save
            </button>
            <button
              onClick={handleDiscardEdits}
              style={{
                height: 34, padding: '0 14px', fontSize: 12, fontWeight: 700,
                borderWidth: 1, borderStyle: 'solid', borderColor: '#d1d5db',
                borderRadius: 0, cursor: 'pointer',
                background: '#fff', color: '#374151',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              {dirty ? 'Discard' : 'Done'}
            </button>
          </>
        )}
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
        logoScale={displayDeck.logoScale}
        onLogoScaleChange={(v) => mutateDeck((d) => ({ ...d, logoScale: v === 1 ? undefined : v }))}
        onRequestEdit={handleEnterEdit}
        selection={selection}
        onSelect={handleSelect}
        onDeselect={() => setSelection(null)}
        onActiveSlideChange={setActiveSlideId}
        onRenameSlide={handleRename}
        revision={textRevision}
      />

      {/* One editing toolbar. This used to be three stacked bars (insert,
          format, session); the stack was heavier than the tools we're competing
          with and it moved as the selection changed. Session actions now live in
          the top bar beside Edit Content, leaving a single contextual bar here. */}
      {editing && targetSlide && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: 'calc(50% + 150px)', // centred over the canvas (half of --sidenav-w)
            transform: 'translateX(-50%)',
            zIndex: 101,
          }}
        >
          <EditToolbar
            targetSlideTitle={targetSlide.title}
            onInsert={handleInsertShape}
            textStyle={selectedStyle}
            effectiveSizePx={selection?.effectiveSizePx}
            fontName={fontLabel(selection?.effectiveFont)}
            fieldLabel={selection?.kind === 'slot' ? slotLabel(selection.slot) : 'Text'}
            hasTextSelection={hasTextSelection}
            onDark={selectedSlide ? slideIsDark(selectedSlide) : false}
            onPatch={handleFormatPatch}
            onReset={handleFormatReset}
            // Reset appears if the text was restyled OR dragged - either is a
            // change from the template, and offering Reset for one but not the
            // other would look like a bug.
            styleDirty={
              (!!selectedStyle && Object.keys(selectedStyle).some(
                (k) => selectedStyle[k as keyof SlotStyle] !== undefined
              ))
              // Any member being restyled or moved arms Reset, so a group that
              // has been dragged can be put back even when the anchor itself
              // carries no override of its own.
              || slotsOf(selection).some(
                (slot) =>
                  !!selectedSlide?.content.offsets?.[slot] ||
                  !!selectedSlide?.content.styles?.[slot]
              )
            }
            selectedSlotCount={slotsOf(selection).length}
            onAlignGroup={handleAlignGroup}
            selectedShape={selectedOverlayShape}
            shapes={targetSlide.content.overlay ?? []}
            onLayerMove={handleLayerMove}
            onToggleBehind={() => patchSelectedShape({ behind: !selectedOverlayShape?.behind })}
            onDeleteShape={handleDeleteShape}
            onSetFill={handleSetShapeFill}
            importedShape={selectedImportedShape}
            isImportedSelection={selection?.kind === 'run'}
            importedShapeGroupCount={importedShapeIds.length}
            onAlignShapes={handleAlignShapes}
            onDeleteImportedShape={handleDeleteImportedShape}
            onSetImportedFill={handleSetImportedShapeFill}
            onSetImportedLine={handleSetImportedShapeLine}
            notes={targetSlide.notes ?? ''}
            onNotesChange={handleNotesChange}
          />
        </div>
      )}

      <TemplateSwitchModal
        open={!!switchTargetId}
        slide={switchTargetSlide}
        onClose={() => setSwitchTargetId(null)}
        onConfirm={handleConfirmSwitch}
      />

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        deck={displayDeck}
        ast={ast}
        onPresent={() => { setReviewOpen(false); setPresentOpen(true); }}
        onReorder={handleReorder}
        onToggleHidden={handleToggleHidden}
        onBulkSetHidden={handleBulkSetHidden}
        onBulkDelete={handleBulkDelete}
        onJumpTo={(instanceId) => {
          setReviewOpen(false);
          setTimeout(() => {
            document.getElementById(instanceId)?.scrollIntoView({ behavior: 'smooth' });
          }, 80);
        }}
      />
      <PresentMode
        open={presentOpen}
        onClose={() => setPresentOpen(false)}
        deck={displayDeck}
        ast={ast}
      />
      <KeyboardShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
