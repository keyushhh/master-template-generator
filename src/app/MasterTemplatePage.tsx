import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { GeneratorSidebar } from '../features/generator/GeneratorSidebar';
import { PresentationCanvas, slideIsDark } from '../features/generator/PresentationCanvas';
import { fontLabel, slotLabel } from '../features/formatting/labels';
import { patchOffset, patchStyles, shiftOffsets } from '../features/formatting/resolve';
import { sameSelection, shapeIdsOf, slotsOf, toggleShape, toggleSlot, type Selection } from '../features/formatting/selection';
import { alignDelta, measureGroup, type GroupAlign } from '../features/formatting/group';
import { ExportSheet } from '../features/generator/ExportSheet';
import { SlideSorter } from '../features/generator/SlideSorter';
import { PresentMode } from '../features/generator/PresentMode';
import { KeyboardShortcutsHelp } from '../features/generator/KeyboardShortcutsHelp';
import { FindReplaceModal } from '../features/search/FindReplaceModal';
import {
  duplicateShape,
  duplicateSlide,
  getCopiedShape,
  getCopiedSlide,
  setCopiedShape,
  setCopiedSlide,
} from '../features/formatting/clipStore';
import { BorrowSlideModal } from '../features/generator/BorrowSlideModal';
import { NewDeckModal } from '../features/deck/NewDeckModal';
import { SaveAsTemplateModal } from '../features/deck/SaveAsTemplateModal';
import { CommandPalette, type Command } from '../features/command/CommandPalette';
import { SWITCHABLE } from '../features/deck/templateSwitch';
import { MOD_KEY } from '../features/help/platform';
import { ensureFonts } from '../features/fonts/loadFont';
import { planAutoFitForSlides } from '../features/fit/autoFit';
import { clippedSlideIds } from '../features/fit/fitStore';
import { familiesInDeck } from '../features/fonts/deckFonts';
import { StudioHeader } from '../features/generator/StudioHeader';
import { ShareModal } from '../features/share/ShareModal';
import { useToast } from '../features/toast/Toast';
import type { DocumentNode } from '../features/business-record/parser/ast';
import type { Deck, OverlayChartSeries, OverlayChartType, OverlayShape, SlideContent, SlideInstance, SlideTemplateId, SlotStyle } from '../features/deck/types';
import { applySwitch } from '../features/deck/templateSwitch';
import { TemplateSwitchModal } from '../features/generator/TemplateSwitchModal';
import { EditToolbar } from '../features/formatting/EditToolbar';
import { StageRail } from '../features/formatting/StageRail';
import { NotesPanel } from '../features/formatting/NotesPanel';
import { ChartDataEditor } from '../features/formatting/ChartDataEditor';
import { VideoSourceModal } from '../features/formatting/VideoSourceModal';
import { themeById, type KitFonts } from '../features/theme/deckTheme';
import { BrandKitModal } from '../features/theme/BrandKitModal';
import {
  brandKitThemes,
  createBrandKit,
  deleteBrandKit,
  listBrandKits,
  updateBrandKit,
  type BrandKit,
} from '../features/theme/brandKitStore';
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
import { DOCUMENT_TEMPLATE_BUILDERS, fitSlideText } from '../features/deck/templateDocumentBuilders';
import { canCustomizeBackground } from '../features/deck/slideBackground';
import { ConfirmModal } from '../features/ui/ConfirmModal';
import { PRESENTATION_TEMPLATES } from '../features/templates/presentationTemplates';
import {
  ensureInitialized,
  listProjects,
  loadProjectSession,
  saveProjectSession,
  setActiveId as setStoreActiveId,
  createProject,
  renameProject,
  deleteProject,
  promoteToRepository,
  claimOwnerless,
  onProjectsChanged,
  canEdit,
  roleFor,
  shareProject,
  unshareProject,
  visibleProjects,
  type ProjectMeta,
  type StoredSession,
} from '../features/deck/deckStore';
import { listVersions, saveVersion, shouldSnapshot, type DeckVersion } from '../features/deck/versionStore';
import { useAuth } from '../features/auth/authStore';
import { useCollab } from '../features/collab/useCollab';
import { PresenceStack } from '../features/collab/PresenceStack';
import { RemoteCursors } from '../features/collab/RemoteCursors';
import { VersionHistoryPanel } from '../features/deck/VersionHistoryPanel';

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
  | { type: 'remote'; deck: Deck }
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
    // Someone else's edit, arriving from another tab. It replaces what is on
    // screen but never enters this person's undo stack: Undo means "take back
    // what I did", and walking it back through a collaborator's edits would
    // silently overwrite their work.
    case 'remote':
      return { ...state, present: action.deck };
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

  const { user } = useAuth();
  // Decks made before sharing existed have no owner; the first person to sign
  // in adopts them rather than the app showing them to everybody.
  if (user) claimOwnerless(user.id);

  const [projects, setProjects] = useState<ProjectMeta[]>(() => listProjects());
  const [activeId, setActiveIdState] = useState<string>(boot.id);

  const [ast, setAst] = useState<DocumentNode | null>(boot.session.ast);
  const [history, dispatchHistory] = useReducer(historyReducer, undefined, () => ({
    past: boot.session.historyPast ?? [],
    present: boot.session.deck,
    future: boot.session.historyFuture ?? [],
  }));
  const deck = history.present;
  // Set while a remote edit is being applied, so echoing it back is impossible.
  const applyingRemoteRef = useRef(false);
  const broadcastRef = useRef<(deck: Deck) => void>(() => {});
  const commitDeck = useCallback((next: Deck) => {
    dispatchHistory({ type: 'commit', deck: next });
    if (!applyingRemoteRef.current) broadcastRef.current(next);
  }, []);
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
  const [dirtyFlag, setDirty] = useState<boolean>(boot.session.dirty ?? false);

  /**
   * Whether the draft actually differs from the committed deck.
   *
   * The raw flag is sticky - anything that mutates the draft sets it and
   * nothing ever unsets it - so undoing every change still left the header
   * claiming "Unsaved changes" and Save emphasised over a deck identical to the
   * one on disk. Undo restores the exact object the draft was opened with, so a
   * reference check settles it for free.
   *
   * The flag still has to gate it: after a reload the draft is deserialised
   * into a different object than the deck, so identity alone would report every
   * restored session as dirty.
   */
  const dirty = draft !== null && dirtyFlag && draft !== deck;

  const editing = draft !== null;
  // Which stack the buttons and Cmd+Z act on depends on whether the deck is
  // forked - inside edit mode the committed stack is not the one the user is
  // making changes to.
  const canUndo = editing ? draftHistory.past.length > 0 : history.past.length > 0;
  const canRedo = editing ? draftHistory.future.length > 0 : history.future.length > 0;
  const displayDeck = draft ?? deck;

  // Review & Present overlays.
  const [reviewOpen, setReviewOpen] = useState(false);
  /** The slide sorter - the whole deck at once, for reordering and bulk edits. */
  const [sorterOpen, setSorterOpen] = useState(false);
  const [brandKitOpen, setBrandKitOpen] = useState(false);
  /** Saved client brand kits, mirrored in React state so the canvas repaints the
   *  moment one is edited rather than on the next reload. */
  const [brandKits, setBrandKits] = useState<BrandKit[]>(() => listBrandKits());
  /** The deck's name. The one place it is resolved: the header shows it, the
   *  export sheet titles itself with it, and it is the export filename - which
   *  used to be derived from the first slide's heading, so every untouched deck
   *  downloaded as `cover.pptx`. */
  const projectName = projects.find((p) => p.id === activeId)?.name ?? 'Untitled deck';
  const [presentOpen, setPresentOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<DeckVersion[]>(() => listVersions(boot.id));

  const activeProject = projects.find((p) => p.id === activeId);
  // No project record yet (a deck mid-creation) is this person's own doing.
  const mayEdit = !user || !activeProject || canEdit(activeProject, user.id);

  // Another tab's edit replaces what is on screen without touching undo.
  const applyRemoteDeck = useCallback((incoming: Deck) => {
    applyingRemoteRef.current = true;
    dispatchHistory({ type: 'remote', deck: incoming });
    applyingRemoteRef.current = false;
  }, []);

  const { peers, broadcastDeck, reportSlide, reportPointer } = useCollab({
    projectId: activeId,
    user,
    onRemoteDeck: applyRemoteDeck,
  });

  // Access can change from a tab that is not on this deck at all, so this
  // listens to the store rather than to the deck's own channel.
  useEffect(() => onProjectsChanged(() => setProjects(listProjects())), []);
  broadcastRef.current = broadcastDeck;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);

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

  // The old top bar was pinned to the first slide's measured left edge, which
  // needed a ResizeObserver to stay in sync. StudioHeader spans the canvas
  // instead, so its position is pure CSS and that machinery is gone.

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

    // A restorable snapshot, coalesced so one person's burst of edits is one
    // entry while a handover between two people always gets its own.
    if (ok && user && shouldSnapshot(activeId, user.id)) {
      saveVersion(activeId, deck, user.id);
      setVersions(listVersions(activeId));
    }
  }, [activeId, ast, deck, draft, dirty, history.past, history.future, baselineDeck, showToast, user]);

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

/** The empty deck a presentation template starts from, built the same way
 *  New deck builds it, so Reset lands on the placeholders the user first saw
 *  rather than on whatever was generated over them. */
function pristineDeckFor(templateId: string | undefined): Deck {
  const template = templateId ? PRESENTATION_TEMPLATES.find((t) => t.id === templateId) : undefined;
  if (!template) return createTemplateDeck();
  const deck = template.build();
  return { ...deck, themeId: template.defaultThemeId || deck.themeId, presentationTemplateId: template.id };
}

/** Which template family the active deck was built from decides which
   *  Business-Record builder should run. A template with no builder of its
   *  own (image-driven ones, or one that predates this system) falls back to
   *  the classic Wozku Master mapping. */
  const builderForActiveTemplate = useCallback(
    (astDoc: DocumentNode) => {
      const templateId = deck.presentationTemplateId;
      const builder = templateId ? DOCUMENT_TEMPLATE_BUILDERS[templateId] : undefined;
      return builder ? builder(astDoc) : buildDeckFromDocument(astDoc);
    },
    [deck.presentationTemplateId]
  );

  /** True only for templates with no fixed slide structure at all (Blank
   *  Presentation) - every other template has its own Business-Record builder
   *  and keeps its selected layout and theme when generating. */
  const needsClassicSwitchWarning = useCallback(() => {
    const templateId = deck.presentationTemplateId;
    return !!templateId && !DOCUMENT_TEMPLATE_BUILDERS[templateId];
  }, [deck.presentationTemplateId]);

  /** A generate/import that would land on the classic template instead of the
   *  active one (no Business-Record mapping exists for it) is held here until
   *  the user confirms the switch. */
  const [pendingClassicSwitch, setPendingClassicSwitch] = useState<{ ast: DocumentNode; isImport: boolean } | null>(null);

  const runGenerate = useCallback((astDoc: DocumentNode, isImport: boolean) => {
    if (isImport) setAst(astDoc);
    const built = builderForActiveTemplate(astDoc);
    commitDeck(built);
    dispatchDraft({ type: 'close' });
    setDirty(false);
    // Reset goes back to the empty template, not to the generated deck. Making
    // the generated deck its own baseline left Reset committing an identical
    // deck, which the history reducer drops - so the button did nothing.
    setBaselineDeck(pristineDeckFor(deck.presentationTemplateId));
    if (isImport) {
      // If the deck is still unnamed, adopt the source's title so it's easy to find.
      const current = projects.find((p) => p.id === activeId);
      if (current && current.name === 'Untitled deck') {
        const derived = built.slides[0]?.content.heading || built.slides[0]?.title;
        if (derived) {
          renameProject(activeId, derived);
          setProjects(listProjects());
        }
      }
    }
  }, [builderForActiveTemplate, commitDeck, projects, activeId, deck.presentationTemplateId]);

  const handleGenerate = useCallback(() => {
    if (!ast) return;
    if (needsClassicSwitchWarning()) {
      setPendingClassicSwitch({ ast, isImport: false });
      return;
    }
    runGenerate(ast, false);
  }, [ast, needsClassicSwitchWarning, runGenerate]);

  /** Import path: set the source AND build the deck in one step, so "Import & Load"
   *  in the Source Material modal doubles as Generate (no separate click needed).
   *  Uses the freshly parsed AST directly rather than waiting on `ast` state. */
  const handleImportAndGenerate = useCallback((imported: DocumentNode) => {
    if (needsClassicSwitchWarning()) {
      setPendingClassicSwitch({ ast: imported, isImport: true });
      return;
    }
    runGenerate(imported, true);
  }, [needsClassicSwitchWarning, runGenerate]);

  /** Deck built from an uploaded .pptx. There is no Business Record behind it,
   *  so the AST is cleared - the imported slides carry their own shapes and the
   *  Generate path must not overwrite them with template placeholders. */
  const handleImportDeck = useCallback((built: Deck, name: string, warnings: string[], relit?: boolean) => {
    setAst(null);
    commitDeck(built);
    dispatchDraft({ type: 'close' });
    setDirty(false);
    setBaselineDeck(built);
    showToast(
      warnings.length
        ? `Imported ${built.slides.length} slides. ${warnings.length} note${warnings.length > 1 ? 's' : ''}: ${warnings[0]}`
        : `Imported ${built.slides.length} slides on the ${themeById(built.themeId).name} theme.`
          + (relit ? ' Colours were re-lit to match it.' : ' Your content is unchanged.')
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

  /** The slide on the stage - the canvas shows one at a time, so this is the
   *  deck's cursor: the rail selects it, the canvas renders it. */
  const [currentSlideId, setCurrentSlideId] = useState<string | null>(null);
  // Following someone needs the slide they are on, whether or not they are
  // moving the mouse, so this is reported apart from the pointer.
  useEffect(() => reportSlide(currentSlideId ?? undefined), [currentSlideId, reportSlide]);

  /** Slides someone can be followed to: a peer on a hidden or since-deleted
   *  slide is still shown, just not offered as somewhere to go. */
  const followableSlideIds = useMemo(
    () => new Set(displayDeck.slides.filter((sl) => !sl.hidden).map((sl) => sl.instanceId)),
    [displayDeck]
  );

  // Keep the cursor on something that exists and is visible.
  useEffect(() => {
    const visible = displayDeck.slides.filter((s) => !s.hidden);
    if (!visible.length) { setCurrentSlideId(null); return; }
    if (!visible.some((s) => s.instanceId === currentSlideId)) {
      setCurrentSlideId(visible[0].instanceId);
    }
  }, [displayDeck, currentSlideId]);

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
      const shape = selectedSlide.content.overlay?.find((s) => s.id === selection.shapeId);
      // A table cell owns its style independently of the shape - a header
      // cell and a body cell need to diverge from each other, not just from
      // the template.
      if (selection.cell && shape?.kind === 'table') {
        return shape.rows?.[selection.cell.row]?.cells[selection.cell.col]?.style;
      }
      // An overlay text box owns its style outright, so it is already a
      // SlotStyle - no translation needed.
      return shape?.style;
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
      fontFamily: run.font,
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
        const cell = sel.cell;
        // Overlay text box or table cell: the style lives on the shape (or,
        // for a table, on the specific cell), so the patch merges straight
        // in. Undefined fields are stripped so "unset" really unsets.
        const merge = (prevStyle: SlotStyle | undefined) => {
          const merged: SlotStyle = { ...(prevStyle ?? {}), ...patch };
          for (const k of Object.keys(patch) as (keyof SlotStyle)[]) {
            if (patch[k] === undefined) delete merged[k];
          }
          return Object.keys(merged).length ? merged : undefined;
        };
        handleEditSlide(sel.instanceId, (c) => ({
          ...c,
          overlay: (c.overlay ?? []).map((s) => {
            if (s.id !== sel.shapeId) return s;
            if (cell && s.kind === 'table') {
              return {
                ...s,
                rows: (s.rows ?? []).map((r, ri) => ri !== cell.row ? r : {
                  ...r,
                  cells: r.cells.map((c2, ci) => (ci !== cell.col ? c2 : { ...c2, style: merge(c2.style) })),
                }),
              };
            }
            return { ...s, style: merge(s.style) };
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
                  if ('fontFamily' in patch) next.font = patch.fontFamily;
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
    const onStage = currentSlideId
      ? displayDeck.slides.find((s) => s.instanceId === currentSlideId)
      : undefined;
    return byFocus ?? onStage ?? displayDeck.slides.find((s) => !s.hidden);
  })();

  /** Where Present opens: the stage's own slide, counted among the visible ones
   *  since that is the sequence the presentation runs through. */
  const presentStartIndex = (() => {
    const visible = displayDeck.slides.filter((s) => !s.hidden);
    const at = visible.findIndex((s) => s.instanceId === currentSlideId);
    return at === -1 ? 0 : at;
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
      selectedOverlayShape?.kind === 'text' ||
      (selection.kind === 'overlay' && !!selection.cell && selectedOverlayShape?.kind === 'table'));

  const handleInsertShape = useCallback(
    (kind: OverlayShape['kind']) => {
      if (!targetSlide) return;
      // Inserting from view mode enters edit mode rather than refusing: reaching
      // for a shape tool *is* the intent to edit. The draft has to be opened
      // first or the insert would be dropped - handleEditSlide dispatches to the
      // draft, and the draft reducer ignores edits while there is no draft.
      // Both actions queue on the same reducer in order, so the open lands
      // before the edit applies.
      if (draft === null) {
        dispatchDraft({ type: 'open', deck });
        setDirty(false);
      }
      const id = targetSlide.instanceId;
      const shape = createOverlayShape(kind, (targetSlide.content.overlay ?? []).length);
      handleEditSlide(id, (c) => withOverlay(c, [...overlayOf(c), shape]));
      // Select it immediately: an inserted shape you then have to hunt for is a
      // worse experience than one that arrives ready to move or type into.
      setSelection({ kind: 'overlay', instanceId: id, shapeId: shape.id });
    },
    [targetSlide, handleEditSlide, draft, deck]
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

  /** Patches an overlay shape by id, wherever it is - the video picker is opened
   *  by double-click, which need not have left the shape selected. */
  const patchShapeById = useCallback(
    (shapeId: string, patch: Partial<OverlayShape>) => {
      const slide = displayDeck.slides.find((s) => overlayOf(s.content).some((o) => o.id === shapeId));
      if (!slide) return;
      handleEditSlide(slide.instanceId, (c) =>
        withOverlay(c, overlayOf(c).map((o) => (o.id === shapeId ? { ...o, ...patch } : o)))
      );
    },
    [displayDeck.slides, handleEditSlide]
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

  const handleCopyCurrentShape = useCallback(() => {
    if (selectedOverlayShape) {
      setCopiedShape(selectedOverlayShape);
      showToast('Copied shape to clipboard', 'info');
    }
  }, [selectedOverlayShape, showToast]);

  const handleDuplicateCurrentShape = useCallback(() => {
    if (selectedOverlayShape && targetSlide) {
      const dup = duplicateShape(selectedOverlayShape);
      handleEditSlide(targetSlide.instanceId, (c) => withOverlay(c, [...overlayOf(c), dup]));
      setSelection({ kind: 'overlay', instanceId: targetSlide.instanceId, shapeId: dup.id });
      showToast('Duplicated shape', 'success');
    }
  }, [selectedOverlayShape, targetSlide, handleEditSlide, setSelection, showToast]);

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

  /** Adds a row the same height as the table's existing rows (or a sensible
   *  default for a table with none), with as many empty cells as columns. */
  const handleTableAddRow = useCallback(() => {
    if (!selectedOverlayShape || selectedOverlayShape.kind !== 'table') return;
    const rows = selectedOverlayShape.rows ?? [];
    const cols = selectedOverlayShape.colWidthsPx?.length ?? rows[0]?.cells.length ?? 1;
    const heightPx = rows[rows.length - 1]?.heightPx ?? 60;
    patchSelectedShape({
      rows: [...rows, { heightPx, cells: Array.from({ length: cols }, () => ({})) }],
    });
  }, [selectedOverlayShape, patchSelectedShape]);

  const handleTableDeleteRow = useCallback(() => {
    if (!selectedOverlayShape || selectedOverlayShape.kind !== 'table') return;
    const rows = selectedOverlayShape.rows ?? [];
    if (rows.length <= 1) return;
    patchSelectedShape({ rows: rows.slice(0, -1) });
  }, [selectedOverlayShape, patchSelectedShape]);

  /** Adds a column by giving every existing row one more empty cell, and
   *  shrinking every column's width so the new one fits within the table's
   *  existing box rather than growing it. */
  const handleTableAddCol = useCallback(() => {
    if (!selectedOverlayShape || selectedOverlayShape.kind !== 'table') return;
    const prevCols = selectedOverlayShape.colWidthsPx ?? [];
    const nextCount = prevCols.length + 1;
    const colWidthsPx = Array.from({ length: nextCount }, () => selectedOverlayShape.w / nextCount);
    const rows = (selectedOverlayShape.rows ?? []).map((r) => ({ ...r, cells: [...r.cells, {}] }));
    patchSelectedShape({ colWidthsPx, rows });
  }, [selectedOverlayShape, patchSelectedShape]);

  const handleTableDeleteCol = useCallback(() => {
    if (!selectedOverlayShape || selectedOverlayShape.kind !== 'table') return;
    const prevCols = selectedOverlayShape.colWidthsPx ?? [];
    if (prevCols.length <= 1) return;
    const nextCount = prevCols.length - 1;
    const colWidthsPx = Array.from({ length: nextCount }, () => selectedOverlayShape.w / nextCount);
    const rows = (selectedOverlayShape.rows ?? []).map((r) => ({ ...r, cells: r.cells.slice(0, -1) }));
    patchSelectedShape({ colWidthsPx, rows });
  }, [selectedOverlayShape, patchSelectedShape]);

  const handleSetChartType = useCallback(
    (t: OverlayChartType) => {
      // A pie slice is one value per category, not one per series - collapsing
      // down to the first series on switch keeps the data that survives visible
      // rather than silently discarding it.
      patchSelectedShape({
        chartType: t,
        chartSeries: t === 'pie' ? selectedOverlayShape?.chartSeries?.slice(0, 1) : selectedOverlayShape?.chartSeries,
      });
    },
    [selectedOverlayShape, patchSelectedShape]
  );

  const [chartEditorOpen, setChartEditorOpen] = useState(false);
  /** Shape id whose video source is being chosen, if the picker is open. */
  const [videoPickerFor, setVideoPickerFor] = useState<string | null>(null);
  const videoTargetShape = videoPickerFor
    ? displayDeck.slides.flatMap((s) => overlayOf(s.content)).find((o) => o.id === videoPickerFor)
    : undefined;
  /** Speaker-notes panel. Slide-level, so it follows the stage cursor rather
   *  than the selection. */
  const [notesOpen, setNotesOpen] = useState(false);

  // Follow-the-selection: the data panel belongs to whichever chart is
  // selected, so it closes rather than silently editing whatever the user
  // clicks next.
  useEffect(() => {
    if (selectedOverlayShape?.kind !== 'chart') setChartEditorOpen(false);
  }, [selectedOverlayShape]);

  const handleChartDataChange = useCallback(
    (next: { categories: string[]; series: OverlayChartSeries[] }) => {
      patchSelectedShape({ chartCategories: next.categories, chartSeries: next.series });
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
      fontFamily: undefined,
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

  /**
   * Put one slide on a different layout.
   *
   * Takes the slide id explicitly so the switcher modal and the command palette
   * are the same operation. The palette names a layout directly ("Data
   * Monument") without opening a picker, and that path must not be a second
   * implementation of the switch, or one of the two will forget to clear the
   * selection or to say that nothing was thrown away.
   */
  const applyLayout = useCallback(
    (instanceId: string, to: SlideTemplateId) => {
      mutateDeck((prev) => ({
        ...prev,
        // Re-fit on arrival: copy written for a 96px heading overflows a 180px
        // one, and nothing else re-measures it after the move.
        slides: prev.slides.map((s) => (s.instanceId === instanceId ? fitSlideText(applySwitch(s, to)) : s)),
      }));
      setSwitchTargetId(null);
      // The old selection may point at a slot the new template doesn't render.
      setSelection(null);
      showToast('Layout changed. Nothing was deleted: parked content returns if you switch back.', 'success');
    },
    [mutateDeck, showToast]
  );

  const handleConfirmSwitch = useCallback(
    (to: SlideTemplateId) => {
      if (switchTargetId) applyLayout(switchTargetId, to);
    },
    [switchTargetId, applyLayout]
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

  // "?" opens the keyboard shortcuts overlay and "G" the slide sorter, unless
  // the user is typing somewhere. Both are guarded on the same "is this a text
  // field" check, since a bare letter key is only a shortcut outside one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' && e.key.toLowerCase() !== 'g') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      if (e.key === '?') setShortcutsOpen((v) => !v);
      // Present mode owns 'G' for its own jump-to-slide grid while it is up.
      else if (!presentOpen) setSorterOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentOpen]);

  // Cmd/Ctrl + K opens the palette. Deliberately the same key the library uses
  // for its search: in both places it means "let me type what I want instead of
  // going to find it". Allowed while a text field has focus, since the palette
  // is how you leave what you are doing.
  const overlayUp =
    reviewOpen ||
    sorterOpen ||
    presentOpen ||
    brandKitOpen ||
    borrowOpen ||
    shortcutsOpen ||
    newDeckOpen ||
    saveTemplateOpen ||
    findReplaceOpen ||
    shareOpen;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
      // Closing is always allowed; opening is not, while something else is up.
      // A palette stacked over the export sheet or, worse, over a live
      // presentation is two dialogs deep with commands that act on the screen
      // behind both of them.
      if (!paletteOpen && overlayUp) return;
      e.preventDefault();
      setPaletteOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, overlayUp]);

  /** Add a blank slide at `index` (default: the end of the deck). */
  const handleAddBlank = useCallback((index?: number) => {
    const blank = createBlankSlide();
    mutateDeck((prev) => {
      const at = index === undefined ? prev.slides.length : Math.max(0, Math.min(index, prev.slides.length));
      const slides = [...prev.slides];
      slides.splice(at, 0, blank);
      return { ...prev, slides };
    });
    setCurrentSlideId(blank.instanceId);
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
    setCurrentSlideId(blank.instanceId);
  }, [mutateDeck]);

  // ── Find & Replace Handlers ──────────────────────────────────────────────
  const handleReplaceCurrent = useCallback(
    (slideId: string, findText: string, replaceText: string, caseSensitive: boolean) => {
      if (!findText) return;
      mutateDeck((prev) => {
        const regex = new RegExp(
          findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          caseSensitive ? '' : 'i'
        );
        const replaceMatch = (t?: string) => (t ? t.replace(regex, replaceText) : t);
        const slides = prev.slides.map((s) => {
          if (s.instanceId !== slideId) return s;
          const c = { ...s.content };
          if (c.heading) c.heading = replaceMatch(c.heading);
          if (c.eyebrow) c.eyebrow = replaceMatch(c.eyebrow);
          if (c.body) c.body = replaceMatch(c.body);
          if (c.subtitle) c.subtitle = replaceMatch(c.subtitle);
          if (c.quote) c.quote = replaceMatch(c.quote);
          if (c.author) c.author = replaceMatch(c.author);
          if (c.role) c.role = replaceMatch(c.role);
          if (c.leftHeading) c.leftHeading = replaceMatch(c.leftHeading);
          if (c.leftBody) c.leftBody = replaceMatch(c.leftBody);
          if (c.rightHeading) c.rightHeading = replaceMatch(c.rightHeading);
          if (c.rightBody) c.rightBody = replaceMatch(c.rightBody);
          if (c.secondHeading) c.secondHeading = replaceMatch(c.secondHeading);
          if (c.secondBody) c.secondBody = replaceMatch(c.secondBody);
          if (c.metricLabel) c.metricLabel = replaceMatch(c.metricLabel);
          if (c.metricText) c.metricText = replaceMatch(c.metricText);
          if (c.tagline) c.tagline = replaceMatch(c.tagline);
          if (c.projectLabel) c.projectLabel = replaceMatch(c.projectLabel);
          if (c.confidentialLabel) c.confidentialLabel = replaceMatch(c.confidentialLabel);
          if (c.value) c.value = replaceMatch(c.value);
          if (c.unit) c.unit = replaceMatch(c.unit);

          if (c.parts) {
            c.parts = c.parts.map((p) => ({
              ...p,
              title: replaceMatch(p.title) || '',
              description: replaceMatch(p.description) || '',
            }));
          }
          if (c.bars) {
            c.bars = c.bars.map((b) => ({
              ...b,
              label: replaceMatch(b.label) || '',
            }));
          }
          if (c.kpis) {
            c.kpis = c.kpis.map((k) => ({
              ...k,
              label: replaceMatch(k.label) || '',
              value: replaceMatch(k.value) || '',
            }));
          }
          if (c.phases) {
            c.phases = c.phases.map((p) => ({
              ...p,
              title: replaceMatch(p.title) || '',
              description: replaceMatch(p.description) || '',
            }));
          }
          if (c.steps) {
            c.steps = c.steps.map((st) => ({
              ...st,
              title: replaceMatch(st.title) || '',
              description: replaceMatch(st.description) || '',
            }));
          }
          if (c.overlay) {
            c.overlay = c.overlay.map((sh) => {
              if (sh.kind === 'text' && sh.text) {
                return { ...sh, text: replaceMatch(sh.text) };
              }
              if (sh.kind === 'table' && sh.rows) {
                return {
                  ...sh,
                  rows: sh.rows.map((r) => ({
                    ...r,
                    cells: r.cells.map((cell) => ({
                      ...cell,
                      text: replaceMatch(cell.text),
                    })),
                  })),
                };
              }
              return sh;
            });
          }
          return { ...s, content: c };
        });
        return { ...prev, slides };
      });
      bumpTextRevision();
      showToast('Replaced text on slide.', 'success');
    },
    [mutateDeck, bumpTextRevision, showToast]
  );

  const handleReplaceAll = useCallback(
    (findText: string, replaceText: string, caseSensitive: boolean) => {
      if (!findText) return;
      let totalCount = 0;
      mutateDeck((prev) => {
        const regex = new RegExp(
          findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          caseSensitive ? 'g' : 'gi'
        );
        const replaceMatch = (t?: string) => {
          if (!t) return t;
          const matches = t.match(regex);
          if (matches) totalCount += matches.length;
          return t.replace(regex, replaceText);
        };
        const slides = prev.slides.map((s) => {
          const c = { ...s.content };
          if (c.heading) c.heading = replaceMatch(c.heading);
          if (c.eyebrow) c.eyebrow = replaceMatch(c.eyebrow);
          if (c.body) c.body = replaceMatch(c.body);
          if (c.subtitle) c.subtitle = replaceMatch(c.subtitle);
          if (c.quote) c.quote = replaceMatch(c.quote);
          if (c.author) c.author = replaceMatch(c.author);
          if (c.role) c.role = replaceMatch(c.role);
          if (c.leftHeading) c.leftHeading = replaceMatch(c.leftHeading);
          if (c.leftBody) c.leftBody = replaceMatch(c.leftBody);
          if (c.rightHeading) c.rightHeading = replaceMatch(c.rightHeading);
          if (c.rightBody) c.rightBody = replaceMatch(c.rightBody);
          if (c.secondHeading) c.secondHeading = replaceMatch(c.secondHeading);
          if (c.secondBody) c.secondBody = replaceMatch(c.secondBody);
          if (c.metricLabel) c.metricLabel = replaceMatch(c.metricLabel);
          if (c.metricText) c.metricText = replaceMatch(c.metricText);
          if (c.tagline) c.tagline = replaceMatch(c.tagline);
          if (c.projectLabel) c.projectLabel = replaceMatch(c.projectLabel);
          if (c.confidentialLabel) c.confidentialLabel = replaceMatch(c.confidentialLabel);
          if (c.value) c.value = replaceMatch(c.value);
          if (c.unit) c.unit = replaceMatch(c.unit);

          if (c.parts) {
            c.parts = c.parts.map((p) => ({
              ...p,
              title: replaceMatch(p.title) || '',
              description: replaceMatch(p.description) || '',
            }));
          }
          if (c.bars) {
            c.bars = c.bars.map((b) => ({
              ...b,
              label: replaceMatch(b.label) || '',
            }));
          }
          if (c.kpis) {
            c.kpis = c.kpis.map((k) => ({
              ...k,
              label: replaceMatch(k.label) || '',
              value: replaceMatch(k.value) || '',
            }));
          }
          if (c.phases) {
            c.phases = c.phases.map((p) => ({
              ...p,
              title: replaceMatch(p.title) || '',
              description: replaceMatch(p.description) || '',
            }));
          }
          if (c.steps) {
            c.steps = c.steps.map((st) => ({
              ...st,
              title: replaceMatch(st.title) || '',
              description: replaceMatch(st.description) || '',
            }));
          }
          if (c.overlay) {
            c.overlay = c.overlay.map((sh) => {
              if (sh.kind === 'text' && sh.text) {
                return { ...sh, text: replaceMatch(sh.text) };
              }
              if (sh.kind === 'table' && sh.rows) {
                return {
                  ...sh,
                  rows: sh.rows.map((r) => ({
                    ...r,
                    cells: r.cells.map((cell) => ({
                      ...cell,
                      text: replaceMatch(cell.text),
                    })),
                  })),
                };
              }
              return sh;
            });
          }
          return { ...s, content: c };
        });
        return { ...prev, slides };
      });
      bumpTextRevision();
      showToast(`Replaced ${totalCount} occurrence${totalCount === 1 ? '' : 's'} across deck.`, 'success');
    },
    [mutateDeck, bumpTextRevision, showToast]
  );

  // ── Keyboard shortcuts: Cmd+F, Cmd+Enter, N, Cmd+C, Cmd+V, Cmd+D ─────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const isInput = el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

      // Cmd+F (Find & Replace)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        if (!findReplaceOpen && overlayUp) return;
        e.preventDefault();
        setFindReplaceOpen((v) => !v);
        return;
      }

      // Cmd+Enter (Present mode)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        setPresentOpen(true);
        return;
      }

      // N for new slide outside text inputs
      if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n') {
        if (overlayUp) return;
        e.preventDefault();
        if (currentSlideId) handleInsertAfter(currentSlideId);
        else handleAddBlank();
        return;
      }

      // Cmd+C (Copy)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        if (isInput) return;
        if (selectedOverlayShape) {
          e.preventDefault();
          setCopiedShape(selectedOverlayShape);
          showToast('Copied shape to clipboard', 'info');
        } else if (targetSlide) {
          e.preventDefault();
          setCopiedSlide(targetSlide);
          showToast('Copied slide to clipboard', 'info');
        }
        return;
      }

      // Cmd+V (Paste)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        if (isInput) return;
        const cShape = getCopiedShape();
        if (cShape && targetSlide) {
          e.preventDefault();
          const dup = duplicateShape(cShape);
          handleEditSlide(targetSlide.instanceId, (c) => withOverlay(c, [...overlayOf(c), dup]));
          setSelection({ kind: 'overlay', instanceId: targetSlide.instanceId, shapeId: dup.id });
          showToast('Pasted shape', 'success');
          return;
        }
        const cSlide = getCopiedSlide();
        if (cSlide && currentSlideId) {
          e.preventDefault();
          const dup = duplicateSlide(cSlide);
          mutateDeck((prev) => {
            const idx = prev.slides.findIndex((s) => s.instanceId === currentSlideId);
            const at = idx === -1 ? prev.slides.length : idx + 1;
            const slides = [...prev.slides];
            slides.splice(at, 0, dup);
            return { ...prev, slides };
          });
          setCurrentSlideId(dup.instanceId);
          showToast('Pasted slide', 'success');
          return;
        }
      }

      // Cmd+D (Duplicate)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        if (isInput) return;
        if (selectedOverlayShape && targetSlide) {
          e.preventDefault();
          const dup = duplicateShape(selectedOverlayShape);
          handleEditSlide(targetSlide.instanceId, (c) => withOverlay(c, [...overlayOf(c), dup]));
          setSelection({ kind: 'overlay', instanceId: targetSlide.instanceId, shapeId: dup.id });
          showToast('Duplicated shape', 'success');
          return;
        }
        if (targetSlide) {
          e.preventDefault();
          const dup = duplicateSlide(targetSlide);
          mutateDeck((prev) => {
            const idx = prev.slides.findIndex((s) => s.instanceId === targetSlide.instanceId);
            const at = idx === -1 ? prev.slides.length : idx + 1;
            const slides = [...prev.slides];
            slides.splice(at, 0, dup);
            return { ...prev, slides };
          });
          setCurrentSlideId(dup.instanceId);
          showToast('Duplicated slide', 'success');
          return;
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    findReplaceOpen,
    overlayUp,
    currentSlideId,
    targetSlide,
    selectedOverlayShape,
    handleInsertAfter,
    handleAddBlank,
    handleEditSlide,
    mutateDeck,
    showToast,
  ]);

  // ── Brand kits ──────────────────────────────────────────────────────────
  /**
   * The deck's theme, resolved in exactly one place and handed down.
   *
   * Every renderer used to look this up itself from `deck.themeId`, which was
   * fine while the only themes were the built-in ones. Client kits are user data
   * living in this component's state, so a lookup further down the tree could not
   * see them - and a stale kit in a thumbnail is precisely the canvas/export
   * disagreement the theme work exists to prevent.
   */
  const deckTheme = useMemo(
    () => themeById(displayDeck.themeId, brandKitThemes(brandKits)),
    [displayDeck.themeId, brandKits]
  );

  /**
   * Pull in every typeface this deck uses.
   *
   * The house three come with the document; anything a slot has been switched to
   * is a Google Font that has to be requested. Without this, opening a saved deck
   * paints it in the fallback stack until something happens to request the real
   * face - and worse, the fit check would measure the fallback and report clipping
   * that is not there.
   */
  useEffect(() => {
    void ensureFonts(familiesInDeck(displayDeck, deckTheme));
  }, [displayDeck, deckTheme]);

  /**
   * Fit every slide the check has flagged, in one action.
   *
   * The per-slide button under the canvas is the right tool when you are looking
   * at the slide. It is the wrong one when the export sheet has just told you six
   * slides are cut off, because then it means visiting six slides to press the
   * same button six times.
   *
   * Needs edit mode, for the same reason the single-slide fix does: the search
   * resolves a clipped box to a slot through `data-slot`, which only exists on an
   * editable slide. So this enters edit mode if it has to, waits a frame for the
   * attributes to exist, and lands you in the deck where the change happened -
   * which is also where a single Cmd+Z can undo the whole sweep.
   */
  const fitAllPending = useRef(false);

  const runFitAll = useCallback(() => {
    const ids = clippedSlideIds();
    if (ids.length === 0) {
      showToast('Nothing is being cut off.', 'info');
      return;
    }

    const { plans, stubborn } = planAutoFitForSlides(ids);

    if (plans.length) {
      // One mutation for the whole sweep. Twelve slides fixed is one undo.
      mutateDeck((prev) => ({
        ...prev,
        slides: prev.slides.map((slide) => {
          const found = plans.find((p) => p.instanceId === slide.instanceId);
          if (!found) return slide;
          let styles = slide.content.styles;
          for (const p of found.plan) styles = patchStyles(styles, p.slot, { sizePx: p.sizePx });
          return { ...slide, content: { ...slide.content, styles } };
        }),
      }));
    }

    const fixed = plans.length
      ? `Fitted ${plans.length} slide${plans.length === 1 ? '' : 's'}`
      : '';
    const left = stubborn.length
      ? `${stubborn.length} still need${stubborn.length === 1 ? 's' : ''} shorter copy rather than smaller type`
      : '';
    if (fixed && left) showToast(`${fixed}. ${left}.`, 'info');
    else if (fixed) showToast(`${fixed}.`, 'success');
    else showToast(`Resizing cannot fix ${stubborn.length === 1 ? 'this' : 'these'}. ${left}.`, 'error');
  }, [mutateDeck, showToast]);

  const handleFitAll = useCallback(() => {
    if (editing) runFitAll();
    else {
      handleEnterEdit();
      fitAllPending.current = true;
    }
  }, [editing, runFitAll, handleEnterEdit]);

  // Edit mode has arrived, so the slots exist. One frame so the attributes are
  // actually in the DOM before anything looks for them.
  useEffect(() => {
    if (!fitAllPending.current || !editing) return;
    const raf = requestAnimationFrame(() => {
      fitAllPending.current = false;
      runFitAll();
    });
    return () => cancelAnimationFrame(raf);
  }, [editing, runFitAll]);

  /** Put the deck on a theme. `undefined` means the house look, which is also
   *  what an absent `themeId` has always meant, so this clears rather than
   *  storing a redundant 'wozku'. */
  const handleApplyTheme = useCallback(
    (themeId: string | undefined) => {
      mutateDeck((prev) => (prev.themeId === themeId ? prev : { ...prev, themeId }));
    },
    [mutateDeck]
  );

  const handleCreateKit = useCallback((name: string, accent: string, fonts?: KitFonts) => {
    const kit = createBrandKit(name, accent, fonts);
    setBrandKits(listBrandKits());
    // Adopt it immediately: creating a kit inside a deck is how you say "this
    // deck is for this client", and making them then pick it from the list would
    // be asking the same question twice.
    mutateDeck((prev) => ({ ...prev, themeId: kit.id }));
  }, [mutateDeck]);

  const handleUpdateKit = useCallback((id: string, patch: { name?: string; accent?: string; fonts?: KitFonts }) => {
    updateBrandKit(id, patch);
    setBrandKits(listBrandKits());
  }, []);

  const handleDeleteKit = useCallback((id: string) => {
    deleteBrandKit(id);
    setBrandKits(listBrandKits());
    // A deck pointing at the deleted kit is dropped back to the house look here
    // rather than left holding a dangling id. `themeById` already falls back, so
    // this is about the stored deck being honest, not about the render.
    mutateDeck((prev) => (prev.themeId === id ? { ...prev, themeId: undefined } : prev));
  }, [mutateDeck]);

  /**
   * Drop slides borrowed from another deck in after the current one.
   *
   * After, not at the end: you go looking for the case study slide because of
   * where you are in the deck, and a slide that lands fourteen positions away
   * from the thought that summoned it has to be dragged back.
   */
  const handleBorrowSlides = useCallback(
    (borrowed: SlideInstance[]) => {
      if (borrowed.length === 0) return;
      mutateDeck((prev) => {
        const idx = prev.slides.findIndex((s) => s.instanceId === currentSlideId);
        const at = idx === -1 ? prev.slides.length : idx + 1;
        const slides = [...prev.slides];
        slides.splice(at, 0, ...borrowed);
        return { ...prev, slides };
      });
      setCurrentSlideId(borrowed[0].instanceId);
      showToast(
        `Added ${borrowed.length} slide${borrowed.length === 1 ? '' : 's'} from another deck.`,
        'success'
      );
    },
    [mutateDeck, currentSlideId, showToast]
  );

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

  /**
   * Create a deck from the starter and brand chosen on the new-deck screen.
   *
   * The old version took no arguments and always built the house master template
   * in house colours, which is why the brand had to be corrected afterwards from
   * a button in the rail.
   */
  const handleCreateDeck = useCallback(
    (name: string, built: Deck) => {
      flushCurrent();
      const session: StoredSession = { ast: null, deck: built };
      const meta = createProject(name, session, undefined, user?.id); // also sets store-active
      setActiveIdState(meta.id);
      hydrate(session);
      setProjects(listProjects());
    },
    [flushCurrent, hydrate]
  );

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
        nextActive = createProject('Untitled deck', session, undefined, user?.id).id;
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

  /**
   * Everything the palette can do.
   *
   * Assembled here because this component is where the verbs already live. A
   * palette that owned its own actions would be a second copy of them, and the
   * two would drift the first time one of these handlers changed.
   *
   * Ordering is deliberate and fixed. Actions first, because they are what
   * someone opening the palette on purpose usually wants; slides next, because
   * jumping is the most frequent single use; layouts last and marked
   * `secondary`, so sixteen layout rows do not bury the six things above them
   * until you actually type a layout's name.
   */
  const commands = useMemo<Command[]>(() => {
    const out: Command[] = [];
    const visible = displayDeck.slides.filter((s) => !s.hidden);
    const currentId = currentSlideId ?? visible[0]?.instanceId ?? null;

    out.push(
      {
        id: 'present',
        group: 'Deck',
        label: 'Present',
        hint: 'P',
        keywords: 'play full screen present mode',
        disabled: visible.length === 0,
        run: () => setPresentOpen(true),
      },
      {
        id: 'export',
        group: 'Deck',
        label: 'Export…',
        keywords: 'download pptx powerpoint pdf png save',
        disabled: visible.length === 0,
        run: () => setReviewOpen(true),
      },
      {
        id: 'find_replace',
        group: 'Deck',
        label: 'Find and replace…',
        hint: `${MOD_KEY}F`,
        keywords: 'search find replace text deck',
        run: () => setFindReplaceOpen(true),
      },
      {
        id: 'duplicate_slide',
        group: 'Deck',
        label: 'Duplicate slide',
        hint: `${MOD_KEY}D`,
        keywords: 'duplicate copy slide clone',
        disabled: !currentId,
        run: () => {
          const s = displayDeck.slides.find((sl) => sl.instanceId === currentId);
          if (s) {
            const dup = duplicateSlide(s);
            mutateDeck((prev) => {
              const idx = prev.slides.findIndex((sl) => sl.instanceId === currentId);
              const at = idx === -1 ? prev.slides.length : idx + 1;
              const slides = [...prev.slides];
              slides.splice(at, 0, dup);
              return { ...prev, slides };
            });
            setCurrentSlideId(dup.instanceId);
            showToast('Duplicated slide', 'success');
          }
        },
      },
      {
        id: 'organize',
        group: 'Deck',
        label: 'Organize slides',
        hint: 'G',
        keywords: 'sorter reorder hide bulk',
        run: () => setSorterOpen(true),
      },
      {
        id: 'brandkit',
        // The brand is chosen when a deck is created, so this is the way to
        // change it afterwards. In the palette rather than back in the rail: it
        // is a once-per-deck decision and does not need standing screen space.
        group: 'Deck',
        label: 'Change this deck’s brand…',
        keywords: 'brand kit theme client accent colour palette',
        run: () => setBrandKitOpen(true),
      },
      {
        id: 'new-deck',
        group: 'Deck',
        label: 'New deck…',
        keywords: 'create start template blank client',
        run: () => setNewDeckOpen(true),
      },
      {
        id: 'save-as-template',
        group: 'Deck',
        label: 'Save deck as template…',
        keywords: 'starter reuse export save new deck',
        run: () => setSaveTemplateOpen(true),
      },
      {
        id: 'notes',
        group: 'Deck',
        label: notesOpen ? 'Hide speaker notes' : 'Speaker notes',
        keywords: 'script talk track',
        run: () => setNotesOpen((v) => !v),
      }
    );

    out.push(
      {
        id: 'add-blank',
        group: 'Insert',
        label: 'Add a blank slide',
        keywords: 'new empty freeform',
        run: () => handleAddBlank(),
      },
      {
        id: 'insert-after',
        group: 'Insert',
        label: 'Insert a blank slide after this one',
        keywords: 'new empty here',
        disabled: !currentId,
        run: () => currentId && handleInsertAfter(currentId),
      },
      {
        id: 'borrow',
        group: 'Insert',
        label: 'Borrow a slide from another deck…',
        keywords: 'copy reuse steal case study previous',
        run: () => setBorrowOpen(true),
      },
      {
        id: 'change-layout',
        group: 'Insert',
        label: 'Change this slide’s layout…',
        keywords: 'template switch',
        disabled: !currentId,
        run: () => currentId && setSwitchTargetId(currentId),
      }
    );

    out.push(
      {
        id: 'edit-mode',
        group: 'Editing',
        label: editing ? 'Done editing' : 'Edit content',
        keywords: editing ? 'save exit finish' : 'write type change',
        run: () => (editing ? handleSaveEdits() : handleEnterEdit()),
      },
      {
        id: 'undo',
        group: 'Editing',
        label: 'Undo',
        hint: `${MOD_KEY}Z`,
        disabled: !canUndo,
        run: handleUndo,
      },
      {
        id: 'redo',
        group: 'Editing',
        label: 'Redo',
        hint: `${MOD_KEY}⇧Z`,
        disabled: !canRedo,
        run: handleRedo,
      },
      {
        id: 'fit-all',
        group: 'Editing',
        label: 'Fit text on every clipped slide',
        keywords: 'overflow clipped shrink cut off resize all',
        run: handleFitAll,
      },
      {
        id: 'shortcuts',
        group: 'Editing',
        label: 'Keyboard shortcuts',
        hint: '?',
        keywords: 'help keys',
        run: () => setShortcutsOpen(true),
      }
    );

    // One row per slide. Hidden slides are left out: you cannot navigate to a
    // slide that is not in the deck being shown, and offering it would jump to
    // nothing.
    for (const [i, s] of visible.entries()) {
      out.push({
        id: `goto-${s.instanceId}`,
        group: 'Go to slide',
        label: s.title,
        hint: String(i + 1).padStart(2, '0'),
        keywords: `slide ${i + 1} ${s.templateId}`,
        secondary: i > 5,
        run: () => setCurrentSlideId(s.instanceId),
      });
    }

    for (const layout of SWITCHABLE) {
      out.push({
        id: `layout-${layout.id}`,
        group: 'Change layout to',
        label: layout.title,
        hint: layout.group,
        keywords: `layout template ${layout.group}`,
        secondary: true,
        disabled: !currentId,
        run: () => currentId && applyLayout(currentId, layout.id),
      });
    }

    return out;
  }, [
    displayDeck.slides,
    currentSlideId,
    editing,
    notesOpen,
    canUndo,
    canRedo,
    handleAddBlank,
    handleInsertAfter,
    handleSaveEdits,
    handleEnterEdit,
    handleUndo,
    handleRedo,
    applyLayout,
    handleFitAll,
  ]);

  return (
    <div className="wg-doc">
      <GeneratorSidebar
        hasPresentation={!!ast}
        ast={ast}
        deck={displayDeck}
        deckGenerated={deck.generated}
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
        currentId={currentSlideId}
        onNavigate={setCurrentSlideId}
        theme={deckTheme}
        presentationTemplateId={deck.presentationTemplateId}
      />

      {/* One floating frosted header carries identity, mode and actions.
          This replaced an Edit/Reset/Undo cluster measured onto the slide's
          left edge plus a detached Present button in the opposite corner. */}
      <StudioHeader
        projectName={projectName}
        onRenameProject={(name) => handleRenameDeck(activeId, name)}
        mode={editing ? 'edit' : 'view'}
        presenting={presentOpen}
        dirty={dirty}
        onEnterEdit={handleEnterEdit}
        onExitEdit={handleSaveEdits}
        onDiscard={handleDiscardEdits}
        onPresent={() => setPresentOpen(true)}
        canPresent={displayDeck.slides.some((s) => !s.hidden)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canReset={canReset}
        resetArmed={resetArmed}
        onResetClick={handleResetClick}
        onOpenReview={() => setReviewOpen(true)}
        canExport={displayDeck.slides.some((s) => !s.hidden)}
        onOpenShare={() => setShareOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        peers={peers}
        onFollowPeer={setCurrentSlideId}
        reachableSlideIds={followableSlideIds}
        canEditDeck={mayEdit}
        projects={projects}
        activeId={activeId}
        onSwitchDeck={handleSwitchDeck}
        onNewDeck={() => setNewDeckOpen(true)}
        onRenameDeck={handleRenameDeck}
        onDeleteDeck={handleDeleteDeck}
      />

      <div
        onPointerMove={(e) => {
          const stage = (e.target as HTMLElement).closest?.('[data-slide]')
            ?? document.querySelector('[data-slide]');
          const rect = (stage as HTMLElement | null)?.getBoundingClientRect();
          if (!rect || rect.width <= 0) return;
          const scale = rect.width / 1920;
          reportPointer((e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
        }}
        onPointerLeave={() => reportPointer()}
      >
      <PresentationCanvas
        ast={ast}
        deck={displayDeck}
        theme={deckTheme}
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
        currentId={currentSlideId}
        onNavigate={setCurrentSlideId}
        onPickVideo={setVideoPickerFor}
      />
      </div>
      <RemoteCursors peers={peers} slideId={currentSlideId} />

      {/* One editing toolbar. This used to be three stacked bars (insert,
          format, session); the stack was heavier than the tools we're competing
          with and it moved as the selection changed. Session actions now live in
          the top bar beside Edit Content, leaving a single contextual bar here. */}
      {editing && targetSlide && (
        <div
          style={{
            position: 'fixed',
            // Clears the stage's own nav/zoom bar along the bottom edge.
            bottom: 74,
            // Derived from the reserved rail column rather than a hardcoded
            // half-width, so changing the rail can't silently push the toolbar
            // off-centre over the stage.
            left: 'calc(50% + (var(--sidenav-w) / 2))',
            transform: 'translateX(-50%)',
            zIndex: 101,
          }}
        >
          <EditToolbar
            textStyle={selectedStyle}
            effectiveSizePx={selection?.effectiveSizePx}
            effectiveLineHeight={selection?.effectiveLineHeight}
            effectiveTrackingEm={selection?.effectiveTrackingEm}
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
            onTableAddRow={handleTableAddRow}
            onTableDeleteRow={handleTableDeleteRow}
            onTableAddCol={handleTableAddCol}
            onTableDeleteCol={handleTableDeleteCol}
            onSetChartType={handleSetChartType}
            onOpenChartData={() => setChartEditorOpen(true)}
            onPickVideo={setVideoPickerFor}
            onPatchShape={patchSelectedShape}
            importedShape={selectedImportedShape}
            isImportedSelection={selection?.kind === 'run'}
            importedShapeGroupCount={importedShapeIds.length}
            onAlignShapes={handleAlignShapes}
            onDeleteImportedShape={handleDeleteImportedShape}
            onSetImportedFill={handleSetImportedShapeFill}
            onSetImportedLine={handleSetImportedShapeLine}
            onCopyShape={handleCopyCurrentShape}
            onDuplicateShape={handleDuplicateCurrentShape}
            showBackgroundControl={canCustomizeBackground(targetSlide.templateId)}
            background={targetSlide.content.background}
            onSetBackground={(bg) => handleEditSlide(targetSlide.instanceId, (c) => ({ ...c, background: bg }))}
          />
        </div>
      )}

      {/* Slide-level tools. Shown in both modes: speaker notes are worth
          jotting without entering edit mode, and an insert click enters it. */}
      {targetSlide && (
        <StageRail
          onInsert={handleInsertShape}
          hasNotes={!!targetSlide.notes?.trim()}
          notesOpen={notesOpen}
          onToggleNotes={() => setNotesOpen((o) => !o)}
          findReplaceOpen={findReplaceOpen}
          onToggleFindReplace={() => setFindReplaceOpen((o) => !o)}
        />
      )}

      {notesOpen && targetSlide && (
        <NotesPanel
          key={targetSlide.instanceId}
          slideTitle={targetSlide.title}
          notes={targetSlide.notes ?? ''}
          onChange={handleNotesChange}
          onClose={() => setNotesOpen(false)}
        />
      )}

      {editing && chartEditorOpen && selectedOverlayShape?.kind === 'chart' && (
        <ChartDataEditor
          chartType={selectedOverlayShape.chartType ?? 'bar'}
          categories={selectedOverlayShape.chartCategories ?? []}
          series={selectedOverlayShape.chartSeries ?? []}
          onChange={handleChartDataChange}
          onClose={() => setChartEditorOpen(false)}
        />
      )}

      <VideoSourceModal
        open={editing && !!videoPickerFor}
        shape={videoTargetShape}
        onApply={(patch) => { if (videoPickerFor) patchShapeById(videoPickerFor, patch); }}
        onClose={() => setVideoPickerFor(null)}
      />

      <TemplateSwitchModal
        open={!!switchTargetId}
        slide={switchTargetSlide}
        onClose={() => setSwitchTargetId(null)}
        onConfirm={handleConfirmSwitch}
        ast={ast}
        logoUrl={displayDeck.logoUrl}
        theme={deckTheme}
      />

      <ConfirmModal
        open={!!pendingClassicSwitch}
        title="Switch to the Classic template?"
        message={(() => {
          const templateId = deck.presentationTemplateId;
          const name = PRESENTATION_TEMPLATES.find((t) => t.id === templateId)?.name ?? 'This template';
          return `${name} has no fixed slide layout for a document's sections to land on. Generating from your source will replace it with the Classic Wozku Master layout instead.`;
        })()}
        confirmLabel="Switch & Generate"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (pendingClassicSwitch) runGenerate(pendingClassicSwitch.ast, pendingClassicSwitch.isImport);
          setPendingClassicSwitch(null);
        }}
        onCancel={() => setPendingClassicSwitch(null)}
      />

      {/* Export and deck organization used to be one modal doing both jobs
          (plus source QA, plus a share link that shared nothing). Two screens,
          one job each. */}
      <ExportSheet
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        deck={displayDeck}
        ast={ast}
        projectName={projectName}
        onOpenSorter={() => setSorterOpen(true)}
        onFitAll={handleFitAll}
        theme={deckTheme}
        isSandbox={projects.find(p => p.id === activeId)?.isSandbox}
        onPromoteToRepository={() => {
          if (activeId) {
            promoteToRepository(activeId);
            setProjects(listProjects());
            setReviewOpen(false);
          }
        }}
      />
      <SlideSorter
        open={sorterOpen}
        onClose={() => setSorterOpen(false)}
        deck={displayDeck}
        ast={ast}
        projectName={projectName}
        onReorder={handleReorder}
        onBulkSetHidden={handleBulkSetHidden}
        onBulkDelete={handleBulkDelete}
        onDuplicate={handleDuplicate}
        onJumpTo={setCurrentSlideId}
        theme={deckTheme}
      />
      <PresentMode
        open={presentOpen}
        onClose={() => setPresentOpen(false)}
        deck={displayDeck}
        ast={ast}
        theme={deckTheme}
        // Presents from the slide on the stage, not from slide one. Hitting
        // Present while looking at slide nine to rehearse it should not mean
        // arrowing back through eight slides first.
        startIndex={presentStartIndex}
      />
      <BrandKitModal
        open={brandKitOpen}
        onClose={() => setBrandKitOpen(false)}
        deck={displayDeck}
        ast={ast}
        kits={brandKits}
        activeThemeId={displayDeck.themeId}
        onApply={handleApplyTheme}
        onCreateKit={handleCreateKit}
        onUpdateKit={handleUpdateKit}
        onDeleteKit={handleDeleteKit}
      />
      <KeyboardShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <FindReplaceModal
        open={findReplaceOpen}
        onClose={() => setFindReplaceOpen(false)}
        slides={displayDeck.slides}
        activeSlideId={currentSlideId || ''}
        onJumpToSlide={(slideId) => setCurrentSlideId(slideId)}
        onReplaceCurrent={handleReplaceCurrent}
        onReplaceAll={handleReplaceAll}
      />
      <BorrowSlideModal
        open={borrowOpen}
        onClose={() => setBorrowOpen(false)}
        currentProjectId={activeId}
        onInsert={handleBorrowSlides}
      />
      <NewDeckModal
        open={newDeckOpen}
        onClose={() => setNewDeckOpen(false)}
        onCreate={handleCreateDeck}
      />
      <SaveAsTemplateModal
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        deck={deck}
        deckName={projectName}
      />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        deckName={projectName}
        onOpenExport={() => setReviewOpen(true)}
        onOpenPresent={() => setPresentOpen(true)}
        onShowToast={showToast}
        isSandbox={activeProject?.isSandbox}
        onPromoteToRepository={() => {
          if (activeId) {
            promoteToRepository(activeId);
            setProjects(listProjects());
            setShareOpen(false);
          }
        }}
        collaborators={activeProject?.collaborators ?? []}
        ownerId={activeProject?.ownerId}
        currentUserId={user?.id}
        onInvite={(userId, role) => {
          shareProject(activeId, userId, role);
          setProjects(listProjects());
        }}
        onRemoveCollaborator={(userId) => {
          unshareProject(activeId, userId);
          setProjects(listProjects());
        }}
      />
      <VersionHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        versions={versions}
        canRestore={mayEdit}
        onRestore={(version) => {
          // Everything newer is kept: the restored deck simply becomes the
          // latest version, so a restore is never itself a loss.
          commitDeck(version.deck);
          if (user) saveVersion(activeId, version.deck, user.id, version.at);
          setVersions(listVersions(activeId));
          setHistoryOpen(false);
          showToast('Restored an earlier version of this deck.', 'success');
        }}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />
    </div>
  );
}
