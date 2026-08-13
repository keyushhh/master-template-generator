import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck, ImportedShape, OverlayShape, SlideContent, SlideInstance, SlotOffset, SlotStyle } from '../deck/types';
import { applyToCss, offsetFor, shiftOffsets, styleFor } from '../formatting/resolve';
import { clampToSlide, FINE, guidesFromSiblings, SLIDE_W, snapMove, snapResize, snapValue, type ExtraGuides, type Handle, type Rect } from '../formatting/snap';
import { shapeIdsOf, slotsOf, textMetrics, type Selection, type TextMetrics } from '../formatting/selection';
import { HIT_PAD_X, HIT_PAD_Y } from '../formatting/group';
import { ShapeOverlay } from '../formatting/ShapeOverlay';
import { createOverlayShape, overlayOf, withOverlay } from '../formatting/overlayModel';
import { TrashIcon } from '../ui/icons';
import { ConfirmModal } from '../ui/ConfirmModal';
import { FitProbe } from '../fit/FitProbe';
import { FitFixChip } from '../fit/FitFixChip';
import { css as themeCss, themeCssVars, WOZKU_THEME, type DeckTheme } from '../theme/deckTheme';

/** Overlay shapes actually shown for this slide right now - everything, minus
 *  any shape pinned to a different 'blank' layout than the one in effect
 *  (see `OverlayShape.blankLayoutOnly`). A no-op filter for every non-blank
 *  template, since only blank ever sets that field. */
function visibleOverlay(content: SlideContent): OverlayShape[] {
  const layout = content.blankLayout ?? 'standard';
  return overlayOf(content).filter((s) => !s.blankLayoutOnly || s.blankLayoutOnly === layout);
}

interface PresentationCanvasProps {
  ast: DocumentNode | null;
  deck: Deck;
  /** The deck's resolved theme. Resolved by the page rather than looked up here,
   *  because client brand kits are user data the page owns. */
  theme?: DeckTheme;
  /** Edit mode: text slots become contentEditable and commit via onEditSlide. */
  editing: boolean;
  onEditSlide: (instanceId: string, updater: (content: SlideContent) => SlideContent) => void;
  /** Set/clear the deck-level client logo (edit mode). */
  onLogoChange?: (dataUrl: string | undefined) => void;
  /** Deck-level logo size multiplier, and its setter. */
  logoScale?: number;
  onLogoScaleChange?: (next: number) => void;
  /** Enter edit mode (used so a click on an empty blank-slide field can jump
   *  straight into editing instead of requiring a separate "Edit Content" click). */
  onRequestEdit?: () => void;
  /** What the formatting toolbar is currently pointed at, and how to move it.
   *  Absent outside edit mode. */
  selection?: Selection | null;
  /** `additive` (a shift-click) adds the slot to the current selection instead
   *  of replacing it, which is how a group is built. */
  onSelect?: (selection: Selection, additive?: boolean) => void;
  /** Clicking the slide background (not any editable field or shape) while
   *  something is selected should drop the selection, the way every other
   *  canvas editor behaves - clicking a slot/run/shape itself never reaches
   *  this, since those targets are excluded before it fires. */
  onDeselect?: () => void;
  /** Reports which slide currently holds focus, so the page's Insert controls
   *  know which slide a new shape or a note belongs to. */
  onActiveSlideChange?: (instanceId: string) => void;
  /** Renames a slide - the footer label is editable on the slide itself, not
   *  only in the sidebar. */
  onRenameSlide?: (instanceId: string, title: string) => void;
  /** Bumped on every undo/redo, so the editable text nodes are rebuilt from the
   *  model instead of keeping whatever the user had typed into them. */
  revision?: number;
  /** The slide on the stage. The canvas shows exactly one at a time. */
  currentId?: string | null;
  onNavigate?: (instanceId: string) => void;
  /** Double-clicking a video shape asks for the source picker. */
  onPickVideo?: (shapeId: string) => void;
}

/** Props every slide renderer receives: parsed document (for the logo), the
 *  instance's content slots, its visible slide number ("04"), and edit-mode
 *  wiring (onEdit routes a content patch back to this slide instance). */
interface SlideRenderProps {
  ast: DocumentNode | null;
  content: SlideContent;
  num: string;
  editing: boolean;
  onEdit: (updater: (content: SlideContent) => SlideContent) => void;
  /** Deck-level client logo + its setter (edit mode). */
  logoUrl?: string;
  onLogoChange?: (dataUrl: string | undefined) => void;
  /** Deck-level logo size multiplier, and its setter. */
  logoScale?: number;
  onLogoScaleChange?: (next: number) => void;
  /** DOM id of this slide's wrapper - lets a renderer target its own fields. */
  instanceId?: string;
  /** Enter edit mode from a view-mode click (see SlideBlank). */
  onRequestEdit?: () => void;
  /** Formatting-toolbar target. Templates get this via SlotContext and can
   *  ignore it; the imported renderer needs it directly, because its runs are
   *  addressed by shape/paragraph/run rather than by slot name. */
  selection?: Selection | null;
  /** `additive` (a shift-click) adds the slot to the current selection instead
   *  of replacing it, which is how a group is built. */
  onSelect?: (selection: Selection, additive?: boolean) => void;
}

const PLACEHOLDER =
  'Placeholder content for the Wozku Master Template. This section will automatically populate once a Document is provided.';

// ---------------------------------------------------------------------------
// Design System Typography Scale
// All primary headings across all 14 slide renderers inherit from this base
// ---------------------------------------------------------------------------
const DISPLAY_HEADING_BASE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  lineHeight: 0.85,
  letterSpacing: '-0.05em',
};

// ---------------------------------------------------------------------------
// Editable slot primitive
// ---------------------------------------------------------------------------

/** Per-slide formatting wiring, supplied by context rather than props.
 *
 *  There are ~74 <E> call sites across the 14 renderers. Passing the styles
 *  map, the selection and its setter down through every one of them (and
 *  through the intermediate layout components they sit inside) would be a lot
 *  of prop-drilling for values that are constant per slide, so the slide
 *  wrapper publishes them once and E reads them. Each call site only has to
 *  declare its own `slot`. */
interface SlotContextValue {
  /** Overrides for this slide, keyed by slot name. */
  styles?: Record<string, SlotStyle>;
  /** Drag offsets for this slide, keyed by slot name. */
  offsets?: Record<string, SlotOffset>;
  /** The selected slots on this slide - drives the focus rings. Usually one;
   *  more when the user shift-clicked to build a group. */
  selectedSlots?: string[];
  /** The selection's anchor slot. Chrome that should appear once per selection
   *  rather than once per member (the drag readout) is keyed off this, so a
   *  three-slot group shows one pill instead of three identical ones. */
  anchorSlot?: string;
  /** In-flight drag, applied on top of every selected slot's stored offset.
   *
   *  One shared delta rather than per-slot state is what makes a group move as a
   *  block: each member renders `its own offset + this`, so their relative
   *  positions are preserved by construction rather than by arithmetic that
   *  could drift. */
  dragDelta?: SlotOffset | null;
  /** Reports that a slot became the formatting target. `additive` (shift-click)
   *  adds it to the current group instead of replacing it. */
  onSelectSlot?: (slot: string, metrics: TextMetrics, additive?: boolean) => void;
  /** Starts dragging the whole selection. Owned by the provider, not by the
   *  slot that was grabbed, because every member has to move together. */
  onBeginDrag?: (e: React.PointerEvent) => void;
  /** Bumped by undo/redo. Used as the editable spans' key so they are rebuilt
   *  from the model - see the note on that key in <E>. */
  revision?: number;
}

const SlotContext = createContext<SlotContextValue>({});

/**
 * Published by a wrapper that has taken over a slot's drag offset.
 *
 * Some slots are not a bare span - an eyebrow is a short emerald rule and its
 * text, laid out as a flex row. The rule is decoration the user never thinks of
 * as a separate object, so dragging the eyebrow has to move both. Translating
 * the <E> span alone would slide the text out from under its own rule.
 *
 * When a frame claims a slot, it applies the transform to the whole unit and the
 * slot's <E> stops applying its own (otherwise the displacement would double).
 * <E> keeps the drag gesture, since that is where the user's pointer is.
 */
const FrameContext = createContext<string | null>(null);

/**
 * Where a slot is actually drawn: its stored offset plus any drag in flight.
 *
 * Both <E> and the frames that wrap it resolve position through here, so a
 * decorated slot and a bare one can never disagree about where they are, and a
 * group drag reaches every member without any of them knowing about each other.
 */
function useSlotOffset(slot: string | undefined): SlotOffset | undefined {
  const { offsets, selectedSlots, dragDelta } = useContext(SlotContext);
  const base = offsetFor(offsets, slot);
  if (!slot || !dragDelta || !selectedSlots?.includes(slot)) return base;
  const dx = (base?.dx ?? 0) + dragDelta.dx;
  const dy = (base?.dy ?? 0) + dragDelta.dy;
  return dx || dy ? { dx, dy } : undefined;
}

/**
 * Publishes one slide's formatting wiring and owns dragging its selected slots.
 *
 * The drag lives here rather than in the slot that was grabbed because a
 * selection can span several slots: one owner holding one delta is what makes
 * them move as a block. It also keeps the in-flight offset local to this slide,
 * so following the pointer re-renders one slide instead of the whole deck.
 */
function SlideSlots({
  instanceId,
  content,
  selection,
  onSelect,
  onEditSlide,
  revision,
  children,
}: {
  instanceId: string;
  content: SlideContent;
  selection: Selection | null;
  onSelect?: (sel: Selection, additive?: boolean) => void;
  onEditSlide: (instanceId: string, updater: (c: SlideContent) => SlideContent) => void;
  revision?: number;
  children: React.ReactNode;
}) {
  const [dragDelta, setDragDelta] = useState<SlotOffset | null>(null);
  /** The drag's own bookkeeping. The delta is kept here as well as in state
   *  because the commit reads it: a state updater has to stay pure, and calling
   *  onEditSlide from inside one applies the move twice under StrictMode's
   *  double-invoke - which is exactly the bug this shape avoids. */
  const drag = useRef<{
    sx: number;
    sy: number;
    scale: number;
    slots: string[];
    delta: SlotOffset;
  } | null>(null);

  const selectedSlots =
    selection?.kind === 'slot' && selection.instanceId === instanceId
      ? slotsOf(selection)
      : undefined;

  const onBeginDrag = (e: React.PointerEvent) => {
    if (!selectedSlots?.length) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement)
      .closest<HTMLElement>('[data-slide]')
      ?.getBoundingClientRect();
    drag.current = {
      sx: e.clientX,
      sy: e.clientY,
      // The slide is CSS-scaled to fit the viewport, so pointer travel has to be
      // divided back into design px or text would move faster than the cursor.
      scale: rect?.width ? rect.width / SLIDE_W : 1,
      slots: selectedSlots,
      delta: { dx: 0, dy: 0 },
    };
    setDragDelta({ dx: 0, dy: 0 });
  };

  useEffect(() => {
    if (!dragDelta) return;
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.sx) / d.scale;
      const dy = (e.clientY - d.sy) / d.scale;
      // Alt frees it; otherwise the delta itself lands on the fine step, so a
      // group keeps its internal spacing exactly and still ends up on the grid.
      const next = e.altKey
        ? { dx: Math.round(dx), dy: Math.round(dy) }
        : { dx: Math.round(dx / FINE) * FINE, dy: Math.round(dy / FINE) * FINE };
      d.delta = next;
      setDragDelta(next);
    };
    const finish = () => {
      const d = drag.current;
      drag.current = null;
      setDragDelta(null);
      if (!d || (!d.delta.dx && !d.delta.dy)) return;
      onEditSlide(instanceId, (c) => ({
        ...c,
        offsets: shiftOffsets(c.offsets, d.slots, d.delta),
      }));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    // Without this a drag that ends outside the window (or is cancelled by the
    // OS) would leave the text stuck following a pointer that no longer exists.
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [dragDelta, instanceId, onEditSlide]);

  return (
    <SlotContext.Provider
      value={{
        styles: content.styles,
        offsets: content.offsets,
        selectedSlots,
        anchorSlot:
          selection?.kind === 'slot' && selection.instanceId === instanceId
            ? selection.slot
            : undefined,
        dragDelta,
        onBeginDrag,
        revision,
        onSelectSlot: onSelect
          ? (slot, metrics, additive) => onSelect({ kind: 'slot', instanceId, slot, ...metrics }, additive)
          : undefined,
      }}
    >
      {children}
    </SlotContext.Provider>
  );
}

interface EditableProps {
  value: string;
  editing: boolean;
  onCommit: (value: string) => void;
  /** Allow Enter to create new lines (headings/bodies that support \n). */
  multiline?: boolean;
  /** Tags the contentEditable span so a caller can find + focus it by
   *  selector after programmatically entering edit mode (see SlideBlank). */
  dataField?: string;
  /** Called when this field is clicked while still in view mode - lets a
   *  slide jump straight into editing that exact field with one click. */
  onActivate?: () => void;
  /** Stable slot name - the SlideContent field this slot writes ('heading'),
   *  or a dotted path for a list item ('bars.0.label'). Present on every slot
   *  that should be formattable; a slot without one still edits its text but
   *  the toolbar cannot target it. */
  slot?: string;
}

/**
 * Vector corner anchors on a selected slot's bounding box.
 *
 * Purely indicative - a text slot is sized by its own content, so there is
 * nothing to resize by dragging a corner. They exist because a bare outline
 * reads as a focus ring while anchored corners read as "this is an object you
 * have hold of", which is the distinction every vector editor draws.
 *
 * Sized in the slide's 1920px design space (the stage transform scales them
 * down with everything else), and pointer-transparent so they never intercept
 * a click meant for the text or the drag grip.
 */
function CornerAnchors() {
  const A = 9;
  const corner = (pos: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    width: A,
    height: A,
    background: '#fff',
    border: '1.5px solid var(--emerald-500)',
    borderRadius: 'var(--radius-sharp)',
    zIndex: 29,
    ...pos,
  });
  const off = -(A / 2) - 2;
  return (
    <span contentEditable={false} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <span style={corner({ left: off, top: off })} />
      <span style={corner({ right: off, top: off })} />
      <span style={corner({ left: off, bottom: off })} />
      <span style={corner({ right: off, bottom: off })} />
    </span>
  );
}

/** Renders plain text normally; in edit mode becomes a contentEditable span
 *  that commits on blur. Committing an empty string signals "revert to the
 *  template placeholder" (callers map '' → undefined). */
function E({ value, editing, onCommit, multiline, dataField, onActivate, slot }: EditableProps) {
  const { styles, selectedSlots, anchorSlot, onSelectSlot, onBeginDrag, revision, dragDelta } =
    useContext(SlotContext);
  const framedSlot = useContext(FrameContext);
  const override = styleFor(styles, slot);
  const css = applyToCss(override);
  const offset = useSlotOffset(slot);

  /** A frame around this slot (an eyebrow's rule, say) moves the whole unit, so
   *  this span must not move itself as well - the displacement would double. */
  const framed = !!slot && framedSlot === slot;
  const shown = framed ? undefined : offset;

  /** Whether the click currently in progress held Shift - set on mousedown and
   *  read on mouseup, because only mouse events carry modifier state. */
  const additiveClick = useRef(false);

  // translate() rather than left/top: the slot is laid out by its template
  // (flex, padding, computed sizes), so nudging it must not take it out of that
  // flow - otherwise moving one slot would reflow everything around it.
  const moved: React.CSSProperties = shown
    ? { transform: `translate(${shown.dx}px, ${shown.dy}px)`, position: 'relative' }
    : {};

  if (!editing) {
    // View mode still applies the override - otherwise saved formatting would
    // vanish the moment edit mode closed, and (worse) the exported PDF/PNG
    // capture, which renders view mode, would disagree with the editor.
    const viewCss = { ...css, ...moved };
    const hasCss = Object.keys(viewCss).length > 0;
    if (!onActivate) return hasCss ? <span style={viewCss}>{value}</span> : <>{value}</>;
    return (
      <span onClick={onActivate} style={{ cursor: 'text', ...viewCss }}>
        {value}
      </span>
    );
  }

  const selected = !!slot && !!selectedSlots?.includes(slot);
  const grouped = (selectedSlots?.length ?? 0) > 1;

  /** Tell the toolbar what it points at, with the metrics this slot is actually rendering at. */
  const select = (el: HTMLElement, additive = false) => {
    if (!slot || !onSelectSlot) return;
    onSelectSlot(slot, textMetrics(el), additive);
  };

  return (
    <span
      // Changing the key discards this node and builds a fresh one from `value`.
      //
      // A contentEditable is uncontrolled: the user's keystrokes mutate the DOM
      // behind React's back, while React still believes the text is whatever it
      // last rendered. Undo hits that head-on - it commits the typed text on
      // blur and then reverts it, so the net prop change across the batch is
      // zero, React patches nothing, and the typing the user just undid stays on
      // screen over a model that no longer contains it. Remounting rebuilds the
      // node from props, which is exactly what undo means.
      key={revision}
      data-editable
      data-field={dataField}
      data-slot={slot}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      title="Shift-click to add to the selection · Esc reverts this field"
      // Focus fires between mousedown and mouseup, so on a shift-click it would
      // report a plain selection first and the mouseup would then toggle that
      // single member straight back off. Deferring to mouseup keeps the gesture
      // in one place.
      onMouseDown={(e) => { additiveClick.current = e.shiftKey; }}
      onFocus={(e) => { if (!additiveClick.current) select(e.currentTarget); }}
      onMouseUp={(e) => {
        const additive = additiveClick.current;
        additiveClick.current = false;
        // Shift-click in a contentEditable also extends the caret across the
        // text; the user meant "add this field", not "select these words".
        // Guarded on rangeCount: collapseToEnd throws outright when there is no
        // range - which is exactly the case when the first thing a user does is
        // shift-click, and an exception here would abort before the selection
        // was ever reported.
        const dom = additive ? window.getSelection() : null;
        if (dom?.rangeCount) dom.collapseToEnd();
        select(e.currentTarget, additive);
      }}
      style={{
        ...css,
        ...moved,
        // Always positioned so the drag grip has something to anchor to. On an
        // inline span this changes nothing visually.
        position: 'relative',
        // Small labels (eyebrows, HUD lines, footers) render at 10-12 design px,
        // which is ~6px on screen at typical zoom - too small to click reliably.
        // Padding gives them a real hit area in edit mode; the negative margin
        // cancels it so nothing on the slide shifts. Group measurement subtracts
        // the same constants, so alignment reads the text's real edges.
        padding: `${HIT_PAD_Y}px ${HIT_PAD_X}px`,
        margin: `${-HIT_PAD_Y}px ${-HIT_PAD_X}px`,
        // A visible target for the toolbar. Uses outline, not border, so it
        // costs no layout space and cannot reflow the slide it sits on. The
        // hairline is thinner than the corner anchors it pairs with, so the
        // corners read as the grabbable part.
        ...(selected
          ? { outline: '1.5px solid var(--emerald-500)', outlineOffset: 2, borderRadius: 'var(--radius-sharp)' }
          : {}),
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
        if (e.key === 'Escape') {
          (e.target as HTMLElement).innerText = value;
          (e.target as HTMLElement).blur();
        }
      }}
      onPaste={(e) => {
        // Keep pasted content plain-text so slide markup stays clean.
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      }}
      onBlur={(e) => {
        const text = (e.target as HTMLElement).innerText.replace(/ /g, ' ').trim();
        if (text !== value) onCommit(text);
      }}
    >
      {value}
      {/* Vector corner anchors on the selected slot's box. */}
      {selected && <CornerAnchors />}
      {/* Live displacement readout while the selection is being dragged, so a
          move is a number the user can aim at (and match on another slide)
          rather than pure eyeballing. Design-px, the same units the nudge
          shortcuts and the snap grid use. */}
      {selected && slot === anchorSlot && dragDelta && (dragDelta.dx !== 0 || dragDelta.dy !== 0) && (
        <span
          contentEditable={false}
          style={{
            position: 'absolute',
            bottom: -14,
            left: '50%',
            transform: 'translate(-50%, 100%)',
            padding: '2px 10px',
            borderRadius: 'var(--radius-sharp)',
            background: 'var(--emerald-600)',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.6,
            whiteSpace: 'nowrap',
            zIndex: 31,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {dragDelta.dx >= 0 ? '+' : ''}{dragDelta.dx} · {dragDelta.dy >= 0 ? '+' : ''}{dragDelta.dy}
        </span>
      )}
      {/* Drag grip. Appears only on the selected slot, and moving is kept a
          separate gesture from typing: dragging the text itself must go on
          selecting words, or editing would break. Select first, then drag. */}
      {selected && onBeginDrag && (
        <span
          contentEditable={false}
          role="button"
          aria-label={grouped ? 'Drag to move the selected text' : 'Drag to move this text'}
          title={
            (grouped ? 'Drag to move all selected text \u00b7 ' : 'Drag to move \u00b7 ') +
            'arrow keys to nudge \u00b7 Alt ignores the grid'
          }
          onPointerDown={onBeginDrag}
          style={{
            position: 'absolute',
            top: -11,
            left: -11,
            width: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--emerald-500)',
            color: '#fff',
            cursor: 'move',
            borderRadius: 2,
            zIndex: 30,
            userSelect: 'none',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <circle cx="5" cy="4" r="1.3" /><circle cx="11" cy="4" r="1.3" />
            <circle cx="5" cy="8" r="1.3" /><circle cx="11" cy="8" r="1.3" />
            <circle cx="5" cy="12" r="1.3" /><circle cx="11" cy="12" r="1.3" />
          </svg>
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Media-editing primitives - all affordances render only in edit mode, so the
// exported (view-mode) DOM captured by html2canvas / print stays clean.
// Sized in the slide's native 1920px coordinate space (scaled with the slide).
// ---------------------------------------------------------------------------

/** Downscale an uploaded image to a JPEG data URL so decks stay light in
 *  localStorage and on export. Falls back to the raw data URL if canvas fails. */
async function fileToDataUrl(file: File, maxDim = 1600, mime: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<string> {
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error('read failed'));
    r.readAsDataURL(file);
  });
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = raw;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, w, h);
    // PNG preserves transparency (used for logos); JPEG keeps photos small.
    return mime === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return raw;
  }
}

/** Pill button to append an item to a list (a bar, KPI, row, phase, …). */
function AddBtn({ label, onClick, style }: { label: string; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        height: 52, padding: '0 24px',
        fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--emerald-600)', background: 'var(--emerald-50)',
        border: '1.5px dashed var(--emerald-400)', cursor: 'pointer',
        borderRadius: 'var(--radius-sharp)', ...style,
      }}
    >
      <span style={{ fontSize: 26, lineHeight: 1 }}>+</span> {label}
    </button>
  );
}

/** Circular remove control shown on each editable list item. */
function RemoveBtn({ onClick, style, label = 'Remove' }: { onClick: () => void; style?: React.CSSProperties; label?: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 40, height: 40, flexShrink: 0, padding: 0,
        background: '#fff', color: '#dc2626',
        border: '1.5px solid #fecaca', cursor: 'pointer',
        borderRadius: '50%', fontSize: 30, lineHeight: 1, fontWeight: 400,
        boxShadow: '0 2px 6px rgba(0,0,0,0.14)', ...style,
      }}
    >
      ×
    </button>
  );
}

/** Image slot: renders the image (or placeholder) in both modes so it captures
 *  cleanly, and overlays Upload / Replace / Remove controls in edit mode.
 *  `onDeleteContainer`, if given, adds a control that removes the whole slot
 *  (not just its image) - the template falls back to a text-only layout. */
function ImageSlot({ src, editing, onChange, placeholder, style, onDeleteContainer }: {
  src?: string;
  editing: boolean;
  onChange: (dataUrl: string | undefined) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  onDeleteContainer?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Local to this one image slot instance, so confirming "Delete Container" on
  // one image placeholder never opens the modal for a different slot on the
  // same slide.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      try { onChange(await fileToDataUrl(f)); } catch { /* ignore bad file */ }
    }
    e.target.value = '';
  };
  const btn: React.CSSProperties = {
    height: 52, padding: '0 22px', fontSize: 18, fontWeight: 700,
    border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sharp)', color: '#fff',
  };
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}>
      {src ? (
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div
          onClick={() => editing && inputRef.current?.click()}
          style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--neutral-100)',
            border: editing ? '3px dashed var(--neutral-300)' : 'none',
            cursor: editing ? 'pointer' : 'default',
            fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--neutral-400)',
            textTransform: 'uppercase', letterSpacing: '0.12em', textAlign: 'center', padding: 40,
          }}
        >
          {editing ? (placeholder ?? 'Click to add image') : (placeholder ?? 'Image Asset Placeholder')}
        </div>
      )}

      {editing && onDeleteContainer && (
        <div style={{ position: 'absolute', top: 24, left: 24, zIndex: 20 }}>
          <button
            onClick={() => setConfirmingDelete(true)}
            title="Remove this image area entirely"
            style={{ ...btn, background: 'rgba(220,38,38,0.92)', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <TrashIcon size={16} />
            Delete Container
          </button>
          <ConfirmModal
            open={confirmingDelete}
            title="Remove this image?"
            message="You can add a new one anytime, but this one will need to be re-uploaded."
            confirmLabel="Remove"
            onConfirm={() => { setConfirmingDelete(false); onDeleteContainer(); }}
            onCancel={() => setConfirmingDelete(false)}
          />
        </div>
      )}

      {editing && (
        <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', gap: 12, zIndex: 20 }}>
          <button onClick={() => inputRef.current?.click()} style={{ ...btn, background: 'rgba(0,0,0,0.78)' }}>
            {src ? 'Replace' : 'Upload'}
          </button>
          {src && (
            <button onClick={() => onChange(undefined)} style={{ ...btn, background: 'rgba(220,38,38,0.92)' }}>
              Remove
            </button>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared micro-components (slide-internal only, not exported)
// ---------------------------------------------------------------------------

/** Hairline grid overlay present on most light slides.
 *  Uses explicit z-index to stay strictly behind text content layers.
 */
function SlideGrid() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
        backgroundSize: '120px 120px',
        opacity: 1.0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

/** Radial glow for light slides - uses accent colour.
 *  Uses explicit z-index to avoid overlaying text.
 */
function Glow({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 1400,
        height: 1400,
        background:
          'radial-gradient(circle, color-mix(in srgb, var(--emerald-500) 8%, transparent) 0%, transparent 70%)',
        zIndex: 0,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}

/** Top HUD bar: slide label left, slide number right.
 *  Always stacked nicely above background layers.
 */
function HudTop({ label, num }: { label: React.ReactNode; num: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 80,
        right: 80,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)',
        // Corner metadata floor: 16 design px = 8pt exported. At 12 it came out
        // 6pt, which is below anything legible on a projected slide.
        fontSize: 16,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: 'var(--neutral-500)',
        zIndex: 10,
        borderBottom: '1px solid var(--neutral-200)',
        paddingBottom: 20,
      }}
    >
      <span>{label}</span>
      <span>{num}</span>
    </div>
  );
}

/** Editorial eyebrow label with leading rule (uses accent colour).
 *
 *  Pass `slot` when the label wraps a single editable slot: the label then acts
 *  as that slot's frame (see FrameContext), so dragging the text carries the
 *  emerald rule with it instead of leaving it stranded. Labels holding fixed
 *  text ('Navigation') take no slot and never move. */
function EditorialLabel({
  children,
  style,
  slot,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  slot?: string;
}) {
  const shown = useSlotOffset(slot);

  const row = (
    <div
      // Marks this row as the slot's movable unit, so group measurement can find
      // the rule as well as the text (see measureSlot).
      data-slot-frame={slot}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 14,
        textTransform: 'uppercase',
        color: 'var(--emerald-600)',
        letterSpacing: '0.25em',
        marginBottom: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 15,
        fontWeight: 600,
        ...style,
        // After `style` so a call site's own styling can never drop the offset.
        ...(shown
          ? { transform: `translate(${shown.dx}px, ${shown.dy}px)`, position: 'relative' }
          : {}),
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 40,
          height: 1,
          background: 'var(--emerald-500)',
          flexShrink: 0,
        }}
      />
      {children}
    </div>
  );

  return slot ? <FrameContext.Provider value={slot}>{row}</FrameContext.Provider> : row;
}

/** Oversized background numeral used by dark divider / monument slides. */
function GhostNumeral({
  num,
  dark,
  style,
}: {
  num: string;
  dark?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      // Runs off the corner of the slide by design, so the fit check has to be
      // told not to read it as clipped copy. It is the one piece of text on a
      // slide that is *meant* to be cut.
      data-no-fit
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 600,
        fontWeight: 700,
        color: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        position: 'absolute',
        bottom: -100,
        right: -50,
        lineHeight: 1,
        pointerEvents: 'none',
        zIndex: 0,
        ...style,
      }}
    >
      {num}
    </div>
  );
}

/** Bounds for uploaded-media scaling. Below a quarter the image is unreadable;
 *  above 4x a logo would dominate the slide it's meant to sign. */
const SCALE_MIN = 0.25;
const SCALE_MAX = 4;

/**
 * Corner grip that scales an uploaded image proportionally.
 *
 * Aspect ratio is never editable here on purpose - a stretched client logo is
 * always a mistake, so the only gesture offered is "bigger" or "smaller". The
 * drag is measured against the element's own rendered width, which makes the
 * grip feel the same whether the slide is zoomed to 40% or 100%.
 */
function ScaleHandle({
  scale,
  onScale,
  onLive,
  title = 'Drag to resize',
}: {
  scale: number;
  onScale: (next: number) => void;
  /** In-progress value during a drag, and null when it ends. The host renders
   *  this so the image actually grows under the pointer - without it the badge
   *  counts up while the image sits still, which reads as broken. */
  onLive?: (next: number | null) => void;
  title?: string;
}) {
  const [live, setLive] = useState<number | null>(null);
  const drag = useRef<{ sx: number; sy: number; startScale: number; startW: number } | null>(null);

  useEffect(() => {
    if (live === null) return;
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      // The grip sits at the top-left, so dragging away from the image (up or
      // left) grows it - the same direction sense as any corner handle. Whichever
      // axis the user moved most drives the change, so a pure horizontal or
      // vertical drag feels as responsive as a diagonal one.
      const travel = Math.abs(dx) > Math.abs(dy) ? -dx : -dy;
      const next = d.startScale * (1 + travel / Math.max(24, d.startW));
      const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, next));
      setLive(clamped);
      onLive?.(clamped);
    };
    const finish = () => {
      if (live !== null) onScale(Math.round(live * 100) / 100);
      drag.current = null;
      setLive(null);
      onLive?.(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [live, onScale, onLive]);

  const shown = live ?? scale;

  return (
    <>
      <span
        role="button"
        aria-label="Resize image"
        title={title}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const host = (e.currentTarget as HTMLElement).parentElement;
          drag.current = {
            sx: e.clientX,
            sy: e.clientY,
            startScale: scale,
            startW: host?.getBoundingClientRect().width ?? 100,
          };
          setLive(scale);
        }}
        style={{
          position: 'absolute',
          // Top-left, not bottom-right: a corner grip tucked under the
          // bottom-right edge of a small logo reads as decoration and gets
          // missed. Top-left is the first place the eye lands on the element.
          left: -13,
          top: -13,
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--emerald-500)',
          color: '#fff',
          cursor: 'nwse-resize',
          borderRadius: 3,
          boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
          zIndex: 30,
          userSelect: 'none',
        }}
      >
        {/* Arrow pointing up-left: the direction that makes it bigger. */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 10V2h8" /><path d="M2 2l7 7" />
        </svg>
      </span>
      {/* Live percentage, so scaling is a number the user can aim at rather than
          pure guesswork - and so two logos can be matched across slides. */}
      {live !== null && (
        <span
          style={{
            position: 'absolute',
            left: -13,
            top: -19,
            transform: 'translateY(-100%)',
            padding: '3px 7px',
            background: 'var(--neutral-900)',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            borderRadius: 2,
            whiteSpace: 'nowrap',
            zIndex: 31,
            pointerEvents: 'none',
          }}
        >
          {Math.round(shown * 100)}%
        </span>
      )}
    </>
  );
}

/** Client logo slot. Deck-level `logoUrl` (seeded from the Business Record's
 *  optional `logo` frontmatter). In edit mode the slot becomes click-to-upload
 *  with a remove control, so users can set the brand logo without a URL. */
function Logo({
  src,
  editing,
  onChange,
  onScaleChange,
  scale = 1,
  style,
}: {
  src?: string;
  editing?: boolean;
  onChange?: (dataUrl: string | undefined) => void;
  /** Commits a new deck-level logo scale. Absent means scaling isn't offered. */
  onScaleChange?: (next: number) => void;
  scale?: number;
  style?: React.CSSProperties;
}) {
  // The template's resting logo height; the scale multiplies it.
  const LOGO_H = 40;
  const [preview, setPreview] = useState<number | null>(null);
  const h = Math.round(LOGO_H * (preview ?? scale));
  const inputRef = useRef<HTMLInputElement>(null);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      try { onChange?.(await fileToDataUrl(f, 600, 'image/png')); } catch { /* ignore */ }
    }
    e.target.value = '';
  };

  const uploadIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );

  // Resting placeholder (not editing): a clear, readable "add your logo" hint
  // rather than a faint whisper that gets missed.
  const placeholder: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, padding: '0 18px',
    // Long-hand: callers override borderColor alone (dark slides need a light
    // dashed pill), and mixing that with the `border` shorthand makes React warn
    // and can drop the colour on re-render.
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(120,120,135,0.6)',
    borderRadius: 'var(--radius-sharp)',
    fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: 'rgba(90,90,105,0.9)', whiteSpace: 'nowrap',
  };

  if (!editing) {
    return src ? (
      <img src={src} alt="Client logo" style={{ height: h, width: 'auto', objectFit: 'contain', zIndex: 10, ...style }} />
    ) : (
      <div style={{ zIndex: 10, ...placeholder, ...style }}>{uploadIcon}Client Logo</div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', zIndex: 20, ...style }}>
      <div
        onClick={() => inputRef.current?.click()}
        title={src ? 'Replace logo' : 'Upload logo'}
        style={{
          cursor: 'pointer',
          ...placeholder,
          padding: src ? 4 : '0 18px',
          border: '2px solid var(--emerald-500, #10b981)',
          background: src ? 'transparent' : 'rgba(16,185,129,0.10)',
          color: 'var(--emerald-600, #059669)',
          boxShadow: src ? 'none' : '0 1px 4px rgba(5,150,105,0.18)',
        }}
      >
        {src
          ? <img src={src} alt="Client logo" style={{ height: h, width: 'auto', objectFit: 'contain' }} />
          : <>{uploadIcon}Upload Logo</>}
      </div>
      {src && onScaleChange && (
        <ScaleHandle
          scale={scale}
          onScale={onScaleChange}
          onLive={setPreview}
          title="Drag to resize the logo"
        />
      )}
      {src && (
        <button
          onClick={(e) => { e.stopPropagation(); onChange?.(undefined); }}
          title="Remove logo"
          aria-label="Remove logo"
          style={{ position: 'absolute', top: -12, right: -12, width: 26, height: 26, borderRadius: '50%', background: '#fff', color: '#dc2626', border: '1.5px solid #fecaca', cursor: 'pointer', fontSize: 18, lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.14)' }}
        >
          ×
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual slide renderers
// ---------------------------------------------------------------------------

function SlideCover({ ast, content, editing, onEdit, logoUrl, onLogoChange, logoScale, onLogoScaleChange }: SlideRenderProps) {
  const lines = content.headingLines ?? ['Master Primary', 'Heading.'];
  // Auto-fit the hero: shrink the font and tighten the top padding for longer
  // titles so the headline never overflows the fixed 1080px slide and keeps a
  // clean bottom gap. Short titles keep the full 180px display size.
  const longestLine = Math.max(...lines.map((l) => l.length), 1);
  const heroFont = Math.round(
    Math.max(72, Math.min(180, 1640 / (longestLine * 0.6), 620 / (lines.length * 0.95)))
  );
  const heroTopPad = lines.length >= 4 ? 160 : lines.length === 3 ? 210 : 280;
  return (
    <>
      <SlideGrid />
      <Glow style={{ top: -300, right: -300 }} />
      <HudTop
        label={
          <E slot="projectLabel"
            value={content.projectLabel ?? 'Project Name Placeholder'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
          />
        }
        num={
          <E slot="versionLabel"
            value={content.versionLabel ?? 'YYYY // Version 0.0'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, versionLabel: v || undefined }))}
          />
        }
      />
      {/* Top padding adapts to the number of hero lines so long titles fit cleanly. */}
      <div style={{ padding: `${heroTopPad}px 140px`, position: 'relative', zIndex: 10 }}>
        <EditorialLabel slot="eyebrow">
          <E slot="eyebrow"
            value={content.eyebrow ?? 'Presentation Subtitle'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: heroFont,
            fontWeight: 700,
            color: 'var(--neutral-900)',
            whiteSpace: 'pre-line',
          }}
        >
          {editing ? (
            <E
              slot="headingLines"
              value={lines.join('\n')}
              editing
              multiline
              onCommit={(v) =>
                onEdit((c) => ({
                  ...c,
                  headingLines: v
                    ? v.split('\n').map((l) => l.trim()).filter(Boolean)
                    : undefined,
                }))
              }
            />
          ) : (
            lines.map((line, i) => (
              <span key={i}>
                {i === lines.length - 1 && lines.length > 1 ? (
                  <span style={{ color: 'var(--emerald-500)' }}>{line}</span>
                ) : (
                  line
                )}
                {i < lines.length - 1 && <br />}
              </span>
            ))
          )}
        </h1>
        <div style={{ marginTop: 96, display: 'flex', alignItems: 'center', gap: 48 }}>
          <div style={{ width: 135, height: 1, background: 'var(--emerald-500)' }} />
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 18,
              textTransform: 'uppercase',
              letterSpacing: '0.25em',
              color: 'var(--neutral-500)',
            }}
          >
            <E slot="tagline"
              value={content.tagline ?? PLACEHOLDER}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, tagline: v || undefined }))}
            />
          </p>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 80,
          right: 80,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 16,
          color: 'var(--neutral-400)',
          zIndex: 10,
        }}
      >
        {/* Editable, and clearable: not every deck is confidential, so an empty
            value removes the line rather than leaving a stuck legal notice. */}
        {(content.confidentialLabel ?? 'PROPRIETARY AND CONFIDENTIAL') !== '' && (
          <span>
            <E
              slot="confidentialLabel"
              value={content.confidentialLabel ?? 'PROPRIETARY AND CONFIDENTIAL'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, confidentialLabel: v }))}
            />
          </span>
        )}
        <Logo src={logoUrl} editing={editing} onChange={onLogoChange} scale={logoScale} onScaleChange={onLogoScaleChange} />
      </div>
    </>
  );
}

const DEFAULT_INDEX_PARTS = [
  { title: 'Introduction', description: PLACEHOLDER },
  { title: 'Context', description: PLACEHOLDER },
  { title: 'Performance', description: PLACEHOLDER },
  { title: 'Strategy', description: PLACEHOLDER },
];

function SlideIndex({ content, num, editing, onEdit }: SlideRenderProps) {
  const parts = content.parts ?? DEFAULT_INDEX_PARTS;
  const editPart = (i: number, patch: Partial<(typeof parts)[number]>) =>
    onEdit((c) => {
      const arr = (c.parts ?? DEFAULT_INDEX_PARTS).map((p, j) =>
        j === i ? { ...p, ...patch } : p
      );
      return { ...c, parts: arr };
    });
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E slot="hudLabel"
            value={content.hudLabel ?? 'Agenda'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', display: 'flex', gap: 140, position: 'relative', zIndex: 10 }}>
        <div style={{ flex: 1 }}>
          <EditorialLabel>Navigation</EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 100,
              fontWeight: 600,
              marginBottom: 60,
              color: 'var(--neutral-900)',
              whiteSpace: 'pre-line',
            }}
          >
            <E slot="heading"
              value={content.heading ?? 'Presentation\nStructure.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
            />
          </h2>
        </div>
        <div style={{ flex: 1.5, paddingTop: 20 }}>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}
          >
            {parts.slice(0, 4).map((part, i) => (
              <div
                key={i}
                style={{
                  borderLeft: `2px solid ${i === 0 ? 'var(--emerald-500)' : 'var(--neutral-200)'}`,
                  paddingLeft: 30,
                  marginBottom: 40,
                }}
              >
                <EditorialLabel style={{ fontSize: 10 }}>Part 0{i + 1}</EditorialLabel>
                <h4
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 32,
                    fontWeight: 600,
                    marginBottom: 10,
                    color: 'var(--neutral-900)',
                  }}
                >
                  <E
                    slot={`parts.${i}.title`}
                    value={part.title}
                    editing={editing}
                    onCommit={(v) => editPart(i, { title: v || part.title })}
                  />
                </h4>
                <p style={{ fontSize: 18, color: 'var(--neutral-500)', lineHeight: 1.5 }}>
                  <E
                    slot={`parts.${i}.description`}
                    value={part.description}
                    editing={editing}
                    multiline
                    onCommit={(v) => editPart(i, { description: v || PLACEHOLDER })}
                  />
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function SlideExecutiveSummary({ content, num, editing, onEdit }: SlideRenderProps) {
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E slot="hudLabel"
            value={content.hudLabel ?? 'Executive Summary'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel slot="eyebrow">
          <E slot="eyebrow"
            value={content.eyebrow ?? 'Executive Summary'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 100,
            fontWeight: 600,
            marginBottom: 48,
            color: 'var(--neutral-900)',
            whiteSpace: 'pre-line',
          }}
        >
          <E slot="heading"
            value={content.heading ?? 'Core Strategic\nObjective.'}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 120 }}>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line' }}>
            <E slot="body"
              value={content.body ?? PLACEHOLDER}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
          </p>
          <div
            style={{
              borderLeft: '1px solid var(--neutral-200)',
              paddingLeft: 66,
              alignSelf: 'center',
            }}
          >
            <EditorialLabel slot="metricLabel">
              <E slot="metricLabel"
                value={content.metricLabel ?? 'Variable Metric'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, metricLabel: v || undefined }))}
              />
            </EditorialLabel>
            <p
              style={{
                ...DISPLAY_HEADING_BASE,
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1.1,
                color: 'var(--neutral-900)',
                whiteSpace: 'pre-line',
                margin: '18px 0 24px',
              }}
            >
              <E slot="metricText"
                value={content.metricText ?? '00.0%'}
                editing={editing}
                multiline
                onCommit={(v) => onEdit((c) => ({ ...c, metricText: v || undefined }))}
              />
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function SlideSectionDivider({ ast, content, num, editing, onEdit, logoUrl, onLogoChange, logoScale, onLogoScaleChange }: SlideRenderProps) {
  return (
    <>
      {/* Clean, flat design layout for SlideSectionDivider - no shadows or glow blurs */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 80,
          zIndex: 10,
        }}
      >
        <Logo
          src={logoUrl}
          editing={editing}
          onChange={onLogoChange}
          scale={logoScale}
          onScaleChange={onLogoScaleChange}
          style={
            logoUrl
              ? undefined
              : { borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.6)' }
          }
        />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 60,
          right: 80,
          zIndex: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: 16,
          letterSpacing: '0.2em',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        <E slot="hudLabel"
          value={content.hudLabel ?? 'Section Marker'}
          editing={editing}
          onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
        />
      </div>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          padding: '0 150px',
          zIndex: 10,
        }}
      >
        <EditorialLabel slot="eyebrow" style={{ color: 'var(--emerald-500)' }}>
          <E slot="eyebrow"
            value={content.eyebrow ?? 'Part 02'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 180,
            fontWeight: 700,
            color: '#ffffff',
            margin: '42px 0 48px',
          }}
        >
          <E slot="heading"
            value={content.heading ?? 'Section Title.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 30,
            lineHeight: 1.5,
            maxWidth: 960,
            margin: 0,
          }}
        >
          <E slot="subtitle"
            value={content.subtitle ?? PLACEHOLDER}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, subtitle: v || undefined }))}
          />
        </p>
      </div>
      <GhostNumeral num={num} dark style={{ bottom: -105, right: -45, fontSize: 630, color: 'rgba(255,255,255,0.03)' }} />
    </>
  );
}

const DEFAULT_ATTRIBUTES = ['Placeholder Attribute', 'Placeholder Attribute', 'Placeholder Attribute'];

function SlideTwoColumnContext({ content, num, editing, onEdit }: SlideRenderProps) {
  const attributes = content.leftAttributes ?? DEFAULT_ATTRIBUTES;
  const editAttribute = (i: number, v: string) =>
    onEdit((c) => {
      const arr = (c.leftAttributes ?? DEFAULT_ATTRIBUTES).map((a, j) => (j === i ? v || a : a));
      return { ...c, leftAttributes: arr };
    });
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E slot="hudLabel"
            value={content.hudLabel ?? 'Strategic Context'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ display: 'flex', height: '100%', position: 'relative', zIndex: 10 }}>
        <div
          style={{
            flex: 1,
            padding: '160px 100px 140px 140px',
            borderRight: '1px solid var(--neutral-200)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <EditorialLabel slot="leftLabel">
            <E slot="leftLabel"
              value={content.leftLabel ?? 'Condition A'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, leftLabel: v || undefined }))}
            />
          </EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 72,
              fontWeight: 600,
              marginBottom: 40,
              color: 'var(--neutral-900)',
              whiteSpace: 'pre-line',
            }}
          >
            <E slot="leftHeading"
              value={content.leftHeading ?? 'Current State\nEnvironment.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, leftHeading: v || undefined }))}
            />
          </h2>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)', marginBottom: 40, whiteSpace: 'pre-line' }}>
            <E slot="leftBody"
              value={content.leftBody ?? PLACEHOLDER}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, leftBody: v || undefined }))}
            />
          </p>
          <ul
            style={{
              listStyle: 'none',
              fontSize: 20,
              fontFamily: 'var(--font-mono)',
              color: 'var(--neutral-400)',
            }}
          >
            {attributes.map((attr, i) => (
              <li key={i} style={{ marginBottom: 10 }}>
                [{String(i + 1).padStart(2, '0')}]{' '}
                <E slot={`leftAttributes.${i}`} value={attr} editing={editing} onCommit={(v) => editAttribute(i, v)} />
              </li>
            ))}
          </ul>
        </div>
        <div
          style={{
            flex: 1,
            padding: '160px 140px 140px 100px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: 'var(--neutral-50)',
          }}
        >
          <EditorialLabel slot="rightLabel">
            <E slot="rightLabel"
              value={content.rightLabel ?? 'Condition B'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, rightLabel: v || undefined }))}
            />
          </EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 72,
              fontWeight: 600,
              marginBottom: 40,
              color: 'var(--neutral-900)',
              whiteSpace: 'pre-line',
            }}
          >
            <E slot="rightHeading"
              value={content.rightHeading ?? 'Strategic Pivot\nTarget State.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, rightHeading: v || undefined }))}
            />
          </h2>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-900)', whiteSpace: 'pre-line' }}>
            <E slot="rightBody"
              value={content.rightBody ?? PLACEHOLDER}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, rightBody: v || undefined }))}
            />
          </p>
        </div>
      </div>
    </>
  );
}

function SlideDataMonument({ content, num, editing, onEdit }: SlideRenderProps) {
  return (
    <>
      <SlideGrid />
      <Glow style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: 140,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <EditorialLabel slot="eyebrow">
          <E slot="eyebrow"
            value={content.eyebrow ?? 'Performance Metric'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 240,
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: '-0.06em',
            display: 'flex',
            alignItems: 'baseline',
            color: 'var(--neutral-900)',
          }}
        >
          <E slot="value"
            value={content.value ?? '000.0'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, value: v || undefined }))}
          />
          <span style={{ color: 'var(--emerald-500)', fontSize: '0.35em', marginLeft: 16 }}>
            <E slot="unit"
              value={content.unit ?? 'M'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, unit: v || undefined }))}
            />
          </span>
        </div>
        <h3
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 56,
            fontWeight: 600,
            marginTop: 16,
            color: 'var(--neutral-900)',
          }}
        >
          <E slot="heading"
            value={content.heading ?? 'Primary Performance Variable Title.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h3>
        <p style={{ marginTop: 24, maxWidth: 800, fontSize: 24, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line' }}>
          <E slot="body"
            value={content.body ?? PLACEHOLDER}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
          />
        </p>
      </div>
      <GhostNumeral num={num} />
    </>
  );
}

const DEFAULT_BARS = [
  { label: 'P1', pct: 30 },
  { label: 'P2', pct: 45 },
  { label: 'P3', pct: 70 },
  { label: 'P4', pct: 95, active: true },
];
const DEFAULT_KPIS = [
  { label: 'Metric Alpha', value: '00.0%' },
  { label: 'Metric Beta', value: '00.0x' },
  { label: 'Metric Gamma', value: '-00%' },
];

function SlideMetricsDashboard({ content, num, editing, onEdit }: SlideRenderProps) {
  const bars = content.bars ?? DEFAULT_BARS;
  const kpis = content.kpis ?? DEFAULT_KPIS;
  const patchBar = (i: number, patch: Partial<(typeof bars)[number]>) =>
    onEdit((c) => ({ ...c, bars: (c.bars ?? DEFAULT_BARS).map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const editBar = (i: number, label: string) => patchBar(i, { label: label || bars[i].label });
  const setBarPct = (i: number, v: string) =>
    patchBar(i, { pct: Math.max(0, Math.min(100, Math.round(parseFloat(v) || 0))) });
  const toggleBarActive = (i: number) =>
    onEdit((c) => ({ ...c, bars: (c.bars ?? DEFAULT_BARS).map((b, j) => ({ ...b, active: j === i ? !b.active : b.active })) }));
  const addBar = () =>
    onEdit((c) => ({ ...c, bars: [...(c.bars ?? DEFAULT_BARS), { label: 'New', pct: 50, active: false }] }));
  const removeBar = (i: number) =>
    onEdit((c) => ({ ...c, bars: (c.bars ?? DEFAULT_BARS).filter((_, j) => j !== i) }));
  const editKpi = (i: number, patch: Partial<(typeof kpis)[number]>) =>
    onEdit((c) => ({ ...c, kpis: (c.kpis ?? DEFAULT_KPIS).map((k, j) => (j === i ? { ...k, ...patch } : k)) }));
  const addKpi = () =>
    onEdit((c) => ({ ...c, kpis: [...(c.kpis ?? DEFAULT_KPIS), { label: 'New Metric', value: '000' }] }));
  const removeKpi = (i: number) =>
    onEdit((c) => ({ ...c, kpis: (c.kpis ?? DEFAULT_KPIS).filter((_, j) => j !== i) }));
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E slot="hudLabel"
            value={content.hudLabel ?? 'Metrics Dashboard'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel slot="eyebrow">
          <E slot="eyebrow"
            value={content.eyebrow ?? 'Temporal Performance'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 20,
            height: 350,
            borderBottom: '2px solid var(--neutral-900)',
            marginTop: 60,
          }}
        >
          {bars.map((b, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: b.active ? 'var(--emerald-500)' : 'var(--neutral-200)',
                height: `${b.pct}%`,
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: -40,
                  left: 0,
                  width: '100%',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  color: 'var(--neutral-500)',
                }}
              >
                <E slot={`bars.${i}.label`} value={b.label} editing={editing} onCommit={(v) => editBar(i, v)} />
              </span>
            </div>
          ))}
        </div>
        {/* Per-bar edit controls (value, highlight, remove), aligned under each bar. */}
        {editing && (
          <div style={{ display: 'flex', gap: 20, marginTop: 18 }}>
            {bars.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--neutral-900)' }}>
                  <E value={String(b.pct)} editing onCommit={(v) => setBarPct(i, v)} />%
                </div>
                <button
                  onClick={() => toggleBarActive(i)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, padding: '6px 12px', cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    background: b.active ? 'var(--emerald-500)' : '#fff',
                    color: b.active ? '#fff' : 'var(--neutral-500)',
                    border: `1px solid ${b.active ? 'var(--emerald-500)' : 'var(--neutral-300)'}`,
                    borderRadius: 'var(--radius-sharp)',
                  }}
                >
                  {b.active ? 'Highlighted' : 'Highlight'}
                </button>
                <RemoveBtn onClick={() => removeBar(i)} />
              </div>
            ))}
          </div>
        )}
        {editing && (
          <div style={{ marginTop: 22 }}>
            <AddBtn label="Add bar" onClick={addBar} />
          </div>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            marginTop: 80,
            gap: 40,
          }}
        >
          {kpis.map((k, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {editing && (
                <RemoveBtn onClick={() => removeKpi(i)} style={{ position: 'absolute', top: -12, right: -12, zIndex: 20 }} />
              )}
              <EditorialLabel style={{ fontSize: 10 }}>
                <E
                  slot={`kpis.${i}.label`}
                  value={k.label}
                  editing={editing}
                  onCommit={(v) => editKpi(i, { label: v || k.label })}
                />
              </EditorialLabel>
              <h3
                style={{
                  ...DISPLAY_HEADING_BASE,
                  fontSize: 64,
                  fontWeight: 600,
                  color: 'var(--neutral-900)',
                }}
              >
                <E
                  slot={`kpis.${i}.value`}
                  value={k.value}
                  editing={editing}
                  onCommit={(v) => editKpi(i, { value: v || k.value })}
                />
              </h3>
            </div>
          ))}
        </div>
        {editing && (
          <div style={{ marginTop: 40 }}>
            <AddBtn label="Add KPI" onClick={addKpi} />
          </div>
        )}
      </div>
    </>
  );
}

const DEFAULT_ROWS = [
  { dim: 'Dimension 01', cur: '00.0', tgt: '00.0', delta: '+00.0%' },
  { dim: 'Dimension 02', cur: '0.00%', tgt: '0.00%', delta: '+00.0%' },
  { dim: 'Dimension 03', cur: '0,000', tgt: '0,000', delta: '+00.0%' },
  { dim: 'Dimension 04', cur: 'XXX.X', tgt: 'XXX.X', delta: '+00.0%' },
];

function SlideComparativeTable({ content, num, editing, onEdit }: SlideRenderProps) {
  const rows = content.rows ?? DEFAULT_ROWS;
  const editRow = (i: number, patch: Partial<(typeof rows)[number]>) =>
    onEdit((c) => {
      const arr = (c.rows ?? DEFAULT_ROWS).map((r, j) => (j === i ? { ...r, ...patch } : r));
      return { ...c, rows: arr };
    });
  const addRow = () =>
    onEdit((c) => ({ ...c, rows: [...(c.rows ?? DEFAULT_ROWS), { dim: 'New Dimension', cur: '-', tgt: '-', delta: '-' }] }));
  const removeRow = (i: number) =>
    onEdit((c) => ({ ...c, rows: (c.rows ?? DEFAULT_ROWS).filter((_, j) => j !== i) }));
  // Scale type + row padding down as rows grow so content stays on-slide and clean.
  const cellFont = rows.length > 6 ? 18 : rows.length > 4 ? 22 : 26;
  const cellPadV = rows.length > 6 ? 16 : rows.length > 4 ? 24 : 32;
  const cellStyle: React.CSSProperties = {
    padding: `${cellPadV}px 36px ${cellPadV}px 0`,
    borderBottom: '1px solid var(--neutral-200)',
    fontSize: cellFont,
    lineHeight: 1.35,
    color: 'var(--neutral-900)',
    verticalAlign: 'top',
  };
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E slot="hudLabel"
            value={content.hudLabel ?? 'Comparative Framework'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel slot="eyebrow">
          <E slot="eyebrow"
            value={content.eyebrow ?? 'Benchmark Comparison'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '19%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: editing ? '21%' : '27%' }} />
            {editing && <col style={{ width: '6%' }} />}
          </colgroup>
          <thead>
            <tr>
              {['Analysis Category', 'Current Variable', 'Target Variable', 'Performance Delta'].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '0 36px 22px 0',
                      borderBottom: '2px solid var(--neutral-900)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      color: 'var(--neutral-500)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      verticalAlign: 'bottom',
                    }}
                  >
                    {h}
                  </th>
                )
              )}
              {editing && <th style={{ borderBottom: '2px solid var(--neutral-900)' }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={cellStyle}>
                  <E slot={`rows.${i}.dim`} value={r.dim} editing={editing} onCommit={(v) => editRow(i, { dim: v || r.dim })} />
                </td>
                <td style={cellStyle}>
                  <E slot={`rows.${i}.cur`} value={r.cur} editing={editing} onCommit={(v) => editRow(i, { cur: v || r.cur })} />
                </td>
                <td style={cellStyle}>
                  <E slot={`rows.${i}.tgt`} value={r.tgt} editing={editing} onCommit={(v) => editRow(i, { tgt: v || r.tgt })} />
                </td>
                <td style={{ ...cellStyle, color: 'var(--emerald-600)' }}>
                  <E slot={`rows.${i}.delta`} value={r.delta} editing={editing} onCommit={(v) => editRow(i, { delta: v || r.delta })} />
                </td>
                {editing && (
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    <RemoveBtn onClick={() => removeRow(i)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {editing && (
          <div style={{ marginTop: 30 }}>
            <AddBtn label="Add row" onClick={addRow} />
          </div>
        )}
      </div>
    </>
  );
}

const DEFAULT_PHASES = [
  { title: 'Initiation', description: PLACEHOLDER, completed: true },
  { title: 'Integration', description: PLACEHOLDER, completed: true },
  { title: 'Optimization', description: PLACEHOLDER, completed: false },
];

function SlideStrategicRoadmap({ content, num, editing, onEdit }: SlideRenderProps) {
  const phases = content.phases ?? DEFAULT_PHASES;
  const editPhase = (i: number, patch: Partial<(typeof phases)[number]>) =>
    onEdit((c) => ({ ...c, phases: (c.phases ?? DEFAULT_PHASES).map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const toggleDone = (i: number) => editPhase(i, { completed: !phases[i].completed });
  const addPhase = () =>
    onEdit((c) => ({ ...c, phases: [...(c.phases ?? DEFAULT_PHASES), { title: 'New Phase', description: '', completed: false }] }));
  const removePhase = (i: number) =>
    onEdit((c) => ({ ...c, phases: (c.phases ?? DEFAULT_PHASES).filter((_, j) => j !== i) }));
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E slot="hudLabel"
            value={content.hudLabel ?? 'Execution Timeline'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel slot="eyebrow">
          <E slot="eyebrow"
            value={content.eyebrow ?? 'Milestone Projection'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 100,
            fontWeight: 600,
            marginBottom: 90,
            color: 'var(--neutral-900)',
          }}
        >
          <E slot="heading"
            value={content.heading ?? 'Pathway to Execution.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>
        <div style={{ position: 'relative', paddingTop: 60 }}>
          {/* timeline rail - centered on the 20px phase dots, which sit at paddingTop (60) */}
          <div
            style={{
              position: 'absolute',
              top: 69,
              left: 0,
              right: 0,
              height: 2,
              background: 'var(--neutral-200)',
              zIndex: 1,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {phases.map((p, i) => (
              <div key={i} style={{ width: 320, position: 'relative' }}>
                {editing && (
                  <RemoveBtn onClick={() => removePhase(i)} style={{ position: 'absolute', top: -8, right: 0, zIndex: 20 }} />
                )}
                <div
                  onClick={() => editing && toggleDone(i)}
                  title={editing ? 'Toggle completed' : undefined}
                  style={{
                    width: 20,
                    height: 20,
                    background: p.completed ? 'var(--emerald-500)' : 'var(--neutral-300)',
                    borderRadius: '50%',
                    position: 'relative',
                    zIndex: 2,
                    cursor: editing ? 'pointer' : 'default',
                    boxShadow: editing ? '0 0 0 4px rgba(0,0,0,0.06)' : 'none',
                  }}
                />
                <div style={{ marginTop: 30 }}>
                  <EditorialLabel style={{ fontSize: 12 }}>
                    Phase {String(i + 1).padStart(2, '0')}
                  </EditorialLabel>
                  <h4
                    style={{
                      ...DISPLAY_HEADING_BASE,
                      fontSize: 32,
                      fontWeight: 600,
                      marginBottom: 15,
                      color: 'var(--neutral-900)',
                    }}
                  >
                    <E
                      slot={`phases.${i}.title`}
                      value={p.title}
                      editing={editing}
                      onCommit={(v) => editPhase(i, { title: v || p.title })}
                    />
                  </h4>
                  <p style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--neutral-500)' }}>
                    <E
                      slot={`phases.${i}.description`}
                      value={p.description || PLACEHOLDER}
                      editing={editing}
                      multiline
                      onCommit={(v) => editPhase(i, { description: v })}
                    />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {editing && (
          <div style={{ marginTop: 60 }}>
            <AddBtn label="Add phase" onClick={addPhase} />
          </div>
        )}
      </div>
    </>
  );
}

function SlideImageEditorial({ content, editing, onEdit }: SlideRenderProps) {
  const showImage = !content.hideImage;
  return (
    <>
      <SlideGrid />
      <div style={{ display: 'flex', height: '100%', position: 'relative', zIndex: 10 }}>
        <div
          style={{
            flex: 1,
            padding: showImage ? 140 : '140px 200px',
            maxWidth: showImage ? undefined : 1200,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <EditorialLabel slot="eyebrow">
            <E slot="eyebrow"
              value={content.eyebrow ?? 'Visual Narrative'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 100,
              fontWeight: 600,
              color: 'var(--neutral-900)',
            }}
          >
            <E slot="heading"
              value={content.heading ?? 'Primary Insight Statement.'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
            />
          </h2>
          <p style={{ marginTop: 40, fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line' }}>
            <E slot="body"
              value={content.body ?? PLACEHOLDER}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
          </p>
          {!showImage && editing && (
            <div style={{ marginTop: 40 }}>
              <AddBtn label="Add image area back" onClick={() => onEdit((c) => ({ ...c, hideImage: false }))} />
            </div>
          )}
        </div>
        {showImage && (
          <div style={{ flex: 1.2, position: 'relative' }}>
            <ImageSlot
              src={content.imageUrl}
              editing={editing}
              onChange={(v) => onEdit((c) => ({ ...c, imageUrl: v }))}
              onDeleteContainer={() => onEdit((c) => ({ ...c, hideImage: true, imageUrl: undefined }))}
            />
            {/* Left-edge blend into the text column (kept above the image, below edit controls). */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, #fff 0%, transparent 20%)',
                pointerEvents: 'none',
                zIndex: 15,
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

const DEFAULT_STEPS = [
  { title: 'Input', description: PLACEHOLDER },
  { title: 'Process', description: PLACEHOLDER },
  { title: 'Output', description: PLACEHOLDER },
];

function SlideProcessArchitecture({ content, num, editing, onEdit }: SlideRenderProps) {
  const steps = content.steps ?? DEFAULT_STEPS;
  const editStep = (i: number, patch: Partial<(typeof steps)[number]>) =>
    onEdit((c) => ({ ...c, steps: (c.steps ?? DEFAULT_STEPS).map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const addStep = () =>
    onEdit((c) => ({ ...c, steps: [...(c.steps ?? DEFAULT_STEPS), { title: 'New Step', description: '' }] }));
  const removeStep = (i: number) =>
    onEdit((c) => ({ ...c, steps: (c.steps ?? DEFAULT_STEPS).filter((_, j) => j !== i) }));
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E slot="hudLabel"
            value={content.hudLabel ?? 'System Logic'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel slot="eyebrow">
          <E slot="eyebrow"
            value={content.eyebrow ?? 'Architectural Protocol'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 100,
            fontWeight: 600,
            marginBottom: 80,
            color: 'var(--neutral-900)',
          }}
        >
          <E slot="heading"
            value={content.heading ?? 'Operational Flow.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
          {steps.map((s, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                border: `1px solid ${i === 1 ? 'var(--emerald-500)' : 'var(--neutral-200)'}`,
                padding: 40,
                marginTop: i * 40,
                position: 'relative',
              }}
            >
              {editing && (
                <RemoveBtn onClick={() => removeStep(i)} style={{ position: 'absolute', top: 12, right: 12, zIndex: 20 }} />
              )}
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 48,
                  color: 'var(--emerald-500)',
                  marginBottom: 20,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <h4
                style={{
                  ...DISPLAY_HEADING_BASE,
                  fontSize: 32,
                  fontWeight: 600,
                  marginBottom: 15,
                  color: 'var(--neutral-900)',
                }}
              >
                <E
                  slot={`steps.${i}.title`}
                  value={s.title}
                  editing={editing}
                  onCommit={(v) => editStep(i, { title: v || s.title })}
                />
              </h4>
              <p style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--neutral-500)' }}>
                <E
                  slot={`steps.${i}.description`}
                  value={s.description || PLACEHOLDER}
                  editing={editing}
                  multiline
                  onCommit={(v) => editStep(i, { description: v })}
                />
              </p>
            </div>
          ))}
        </div>
        {editing && (
          <div style={{ marginTop: 50 }}>
            <AddBtn label="Add step" onClick={addStep} />
          </div>
        )}
      </div>
    </>
  );
}

const DEFAULT_SECTORS = [
  { label: 'Sector A', value: '0.0M Metric' },
  { label: 'Sector B', value: '0.0M Metric' },
  { label: 'Sector C', value: '0.0M Metric' },
];

// Map slide: inherits DISPLAY_HEADING_BASE for visual alignment
function SlideGlobalMap({ content, num, editing, onEdit }: SlideRenderProps) {
  const sectors = content.sectors ?? DEFAULT_SECTORS;
  const editSector = (i: number, patch: Partial<(typeof sectors)[number]>) =>
    onEdit((c) => ({ ...c, sectors: (c.sectors ?? DEFAULT_SECTORS).map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const addSector = () =>
    onEdit((c) => ({ ...c, sectors: [...(c.sectors ?? DEFAULT_SECTORS), { label: 'New Region', value: '0.0M Metric' }] }));
  const removeSector = (i: number) =>
    onEdit((c) => ({ ...c, sectors: (c.sectors ?? DEFAULT_SECTORS).filter((_, j) => j !== i) }));
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E slot="hudLabel"
            value={content.hudLabel ?? 'Reach Distribution'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div
        style={{
          padding: '160px 140px 0',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 105,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 100,
              fontWeight: 600,
              marginBottom: 45,
              color: 'var(--neutral-900)',
            }}
          >
            <E slot="heading"
              value={content.heading ?? 'Regional Impact.'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
            />
          </h2>
          {content.hideImage ? (
            editing && (
              <div style={{ marginBottom: 10 }}>
                <AddBtn label="Add map / visual back" onClick={() => onEdit((c) => ({ ...c, hideImage: false }))} />
              </div>
            )
          ) : (
            <div
              style={{
                flex: 1,
                position: 'relative',
                border: '1px solid var(--neutral-200)',
                overflow: 'hidden',
              }}
            >
              <ImageSlot
                src={content.imageUrl}
                editing={editing}
                onChange={(v) => onEdit((c) => ({ ...c, imageUrl: v }))}
                placeholder={editing ? 'Click to add a map / visual' : 'Geographic Visualisation Placeholder'}
                onDeleteContainer={() => onEdit((c) => ({ ...c, hideImage: true, imageUrl: undefined }))}
              />
            </div>
          )}
        </div>
        <div style={{ alignSelf: 'center', display: 'flex', flexDirection: 'column' }}>
          {sectors.map((s, i) => (
            <div
              key={i}
              style={{ position: 'relative', borderTop: '1px solid var(--neutral-200)', padding: '39px 0' }}
            >
              {editing && (
                <RemoveBtn onClick={() => removeSector(i)} style={{ position: 'absolute', top: 15, right: -40, zIndex: 20 }} />
              )}
              <EditorialLabel style={{ fontSize: 10 }}>
                <E
                  slot={`sectors.${i}.label`}
                  value={s.label}
                  editing={editing}
                  onCommit={(v) => editSector(i, { label: v || s.label })}
                />
              </EditorialLabel>
              <h4
                style={{
                  ...DISPLAY_HEADING_BASE,
                  fontSize: 72,
                  fontWeight: 600,
                  marginTop: 12,
                  color: 'var(--neutral-900)',
                }}
              >
                <E
                  slot={`sectors.${i}.value`}
                  value={s.value}
                  editing={editing}
                  onCommit={(v) => editSector(i, { value: v || s.value })}
                />
              </h4>
            </div>
          ))}
          {editing && (
            <div style={{ paddingTop: 20 }}>
              <AddBtn label="Add region" onClick={addSector} style={{ height: 44 }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Quote slide: inherits DISPLAY_HEADING_BASE for large-scale typography alignment
function SlideFeaturedQuote({ content, num, editing, onEdit }: SlideRenderProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // PNG preserves transparency; 400px is plenty for a circular avatar at 2× export.
      const dataUrl = await fileToDataUrl(file, 400, 'image/png');
      onEdit((c) => ({ ...c, avatarUrl: dataUrl }));
    } catch {
      // ignore bad files
    }
    e.target.value = '';
  };

  const avatarSrc = content.avatarUrl;
  // The template's resting headshot diameter; avatarScale multiplies it.
  const AVATAR_D = 84;
  const avatarScale = content.avatarScale ?? 1;
  const [avatarPreview, setAvatarPreview] = useState<number | null>(null);
  const avatarD = Math.round(AVATAR_D * (avatarPreview ?? avatarScale));

  return (
    <>
      <SlideGrid />
      <Glow style={{ bottom: -500, left: -500 }} />
      <HudTop
        label={
          <E slot="eyebrow"
            value={content.eyebrow ?? 'Key Insight'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        }
        num={num}
      />
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 195px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 300,
            lineHeight: 0.5,
            color: 'var(--emerald-500)',
            height: 105,
          }}
        >
          "
        </div>
        <blockquote
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 84,
            fontWeight: 500,
            lineHeight: 1.12,
            letterSpacing: '-0.03em',
            margin: '0 0 72px',
            maxWidth: 1440,
            color: 'var(--neutral-900)',
          }}
        >
          <E slot="quote"
            value={content.quote ?? PLACEHOLDER}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, quote: v || undefined }))}
          />
        </blockquote>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          {/* Circular avatar - static in view mode, uploadable in edit mode */}
          <div
            style={{ position: 'relative', flexShrink: 0, width: avatarD, height: avatarD }}
          >
            {/* The circle itself */}
            <div
              onClick={() => editing && avatarInputRef.current?.click()}
              title={editing ? (avatarSrc ? 'Replace photo' : 'Upload author photo') : undefined}
              style={{
                width: avatarD,
                height: avatarD,
                borderRadius: '50%',
                overflow: 'hidden',
                background: avatarSrc ? 'transparent' : 'var(--neutral-200)',
                cursor: editing ? 'pointer' : 'default',
                border: editing && !avatarSrc ? '2px dashed var(--emerald-400)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 0.15s',
              }}
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Author"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                editing && (
                  /* Upload hint icon shown only in edit mode when empty */
                  <svg
                    width="28" height="28" viewBox="0 0 24 24"
                    fill="none" stroke="var(--emerald-500)" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )
              )}
            </div>
            {editing && avatarSrc && (
              <ScaleHandle
                scale={avatarScale}
                onScale={(next) => onEdit((c) => ({ ...c, avatarScale: next === 1 ? undefined : next }))}
                onLive={setAvatarPreview}
                title="Drag to resize the photo"
              />
            )}
            {editing && avatarSrc && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit((c) => ({ ...c, avatarUrl: undefined })); }}
                title="Remove photo"
                aria-label="Remove photo"
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#fff',
                  color: '#dc2626',
                  border: '1.5px solid #fecaca',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.14)',
                  zIndex: 10,
                }}
              >
                ×
              </button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFile}
              style={{ display: 'none' }}
            />
          </div>

          <div>
            <h4
              style={{
                ...DISPLAY_HEADING_BASE,
                fontSize: 27,
                fontWeight: 600,
                color: 'var(--neutral-900)',
              }}
            >
              <E slot="author"
                value={content.author ?? 'Author Name'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, author: v || undefined }))}
              />
            </h4>
            <p
              style={{
                fontSize: 18,
                fontFamily: 'var(--font-mono)',
                color: 'var(--neutral-500)',
              }}
            >
              <E slot="role"
                value={content.role ?? 'Author Title Placeholder'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, role: v || undefined }))}
              />
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

const DEFAULT_CONTACTS = ['email@placeholder.com', '@social_handle', 'www.domain.com'];

// Exit slide: inherits DISPLAY_HEADING_BASE for unified presentation style
function SlideExit({ ast, content, editing, onEdit, logoUrl, onLogoChange, logoScale, onLogoScaleChange }: SlideRenderProps) {
  const contacts = content.contacts && content.contacts.length ? content.contacts : DEFAULT_CONTACTS;
  const editContact = (i: number, v: string) =>
    onEdit((c) => {
      const base = c.contacts && c.contacts.length ? c.contacts : DEFAULT_CONTACTS;
      const arr = base.map((x, j) => (j === i ? v || x : x));
      return { ...c, contacts: arr };
    });
  return (
    <>
      {/* Clean, flat design layout for SlideExit - no shadows or glow blurs */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 80,
          zIndex: 10,
        }}
      >
        <Logo
          src={logoUrl}
          editing={editing}
          onChange={onLogoChange}
          scale={logoScale}
          onScaleChange={onLogoScaleChange}
          style={
            logoUrl
              ? undefined
              : { borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.6)' }
          }
        />
      </div>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: 140,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <EditorialLabel slot="eyebrow">
          <E slot="eyebrow"
            value={content.eyebrow ?? 'Conclusion'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 180,
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: 40,
          }}
        >
          <E slot="heading"
            value={content.heading ?? 'Thank You.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 32,
            maxWidth: 800,
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
          }}
        >
          <E slot="body"
            value={content.body ?? PLACEHOLDER}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
          />
        </p>
        <div
          style={{
            marginTop: 100,
            display: 'flex',
            gap: 60,
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            color: 'var(--emerald-400)',
          }}
        >
          {contacts.map((c, i) => (
            <span key={i}>
              <E slot={`contacts.${i}`} value={c} editing={editing} onCommit={(v) => editContact(i, v)} />
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

const BLANK_LAYOUTS: { id: 'standard' | 'two-column' | 'full-bleed'; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'two-column', label: 'Two-Column' },
  { id: 'full-bleed', label: 'Full-Bleed' },
];

/** Layout picker shown only in edit mode - lets a custom slide choose its shape. */
function BlankLayoutPicker({
  value,
  onChange,
}: {
  value: 'standard' | 'two-column' | 'full-bleed';
  onChange: (v: 'standard' | 'two-column' | 'full-bleed') => void;
}) {
  return (
    <div style={{ position: 'absolute', top: 60, right: 80, zIndex: 20, display: 'flex', gap: 6 }}>
      {BLANK_LAYOUTS.map((l) => (
        <button
          key={l.id}
          onClick={() => onChange(l.id)}
          style={{
            height: 36,
            padding: '0 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            // Long-hand, since borderColor is set conditionally alongside it.
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: value === l.id ? 'var(--emerald-500)' : 'var(--neutral-300)',
            background: value === l.id ? 'var(--emerald-500)' : '#ffffff',
            color: value === l.id ? '#ffffff' : 'var(--neutral-600)',
            cursor: 'pointer',
            borderRadius: 'var(--radius-sharp)',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

type BlankField = 'eyebrow' | 'heading' | 'body' | 'secondHeading' | 'secondBody';

/** Freeform user slide - editable eyebrow, heading, body, and an optional image,
 *  in one of three layouts the author can switch between while editing.
 *
 *  Clicking a field while still in view mode enters edit mode AND focuses
 *  that exact field in one step - no separate "Edit Content" click needed to
 *  start typing on a fresh blank slide. */
function SlideBlank({ content, num, editing, onEdit, instanceId, onRequestEdit }: SlideRenderProps) {
  const layout = content.blankLayout ?? 'standard';
  const setLayout = (v: 'standard' | 'two-column' | 'full-bleed') =>
    onEdit((c) => {
      const next = { ...c, blankLayout: v };
      // Two-column's right-hand table is a real OverlayShape (draggable,
      // resizable, editable like any inserted table) rather than fixed
      // template content - seed one the first time this layout is picked, so
      // switching to it doesn't hand the user an empty column. `blankLayoutOnly`
      // keeps it from leaking into Standard/Full-bleed once seeded. Sized and
      // centred on the same vertical mid-line as the left column's text (see
      // the two-column render below: top:160, bottom:0 → centre at y=620), and
      // nudged left of where the old image slot sat so it doesn't hug the edge.
      if (v === 'two-column' && !(c.overlay ?? []).some((s) => s.blankLayoutOnly === 'two-column')) {
        const tableShape = createOverlayShape('table', (c.overlay ?? []).length);
        const h = 560;
        Object.assign(tableShape, { x: 940, y: 620 - h / 2, w: 620, h, blankLayoutOnly: 'two-column' });
        return withOverlay(next, [...overlayOf(next), tableShape]);
      }
      return next;
    });

  const pendingFocusField = useRef<BlankField | null>(null);
  useEffect(() => {
    if (!editing || !instanceId || !pendingFocusField.current) return;
    const field = pendingFocusField.current;
    pendingFocusField.current = null;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`#${instanceId} [data-field="${field}"]`);
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }, [editing, instanceId]);

  const activate = (field: BlankField) => {
    if (editing || !onRequestEdit) return undefined;
    return () => {
      pendingFocusField.current = field;
      onRequestEdit();
    };
  };

  const eyebrow = (
    <EditorialLabel slot="eyebrow">
      <E slot="eyebrow"
        value={content.eyebrow ?? 'Section'}
        editing={editing}
        dataField="eyebrow"
        onActivate={activate('eyebrow')}
        onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
      />
    </EditorialLabel>
  );
  const heading = (fontSize: number) => (
    <h2 style={{ ...DISPLAY_HEADING_BASE, fontSize, fontWeight: 600, marginBottom: 40 }}>
      <E slot="heading"
        value={content.heading ?? 'Blank Slide.'}
        editing={editing}
        multiline
        dataField="heading"
        onActivate={activate('heading')}
        onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
      />
    </h2>
  );
  const body = (maxWidth?: number) => (
    <p style={{ fontSize: 28, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line', maxWidth }}>
      <E slot="body"
        value={content.body ?? 'Click to add your content…'}
        editing={editing}
        multiline
        dataField="body"
        onActivate={activate('body')}
        onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
      />
    </p>
  );
  const image = (placeholder: string, style?: React.CSSProperties, onDeleteContainer?: () => void) => (
    <ImageSlot
      src={content.imageUrl}
      editing={editing}
      onChange={(v) => onEdit((c) => ({ ...c, imageUrl: v }))}
      placeholder={editing ? placeholder : ''}
      style={style}
      onDeleteContainer={onDeleteContainer}
    />
  );
  /** Full-bleed has no "optional" image slot - the layout IS the image area -
   *  so "deleting" it means dropping back to the Standard layout. */
  const dropToStandard = () => onEdit((c) => ({ ...c, blankLayout: 'standard', imageUrl: undefined }));
  const secondHeading = (fontSize: number) => (
    <h3 style={{ ...DISPLAY_HEADING_BASE, fontSize, fontWeight: 600, marginBottom: 20 }}>
      <E slot="secondHeading"
        value={content.secondHeading ?? 'Second Section.'}
        editing={editing}
        multiline
        dataField="secondHeading"
        onActivate={activate('secondHeading')}
        onCommit={(v) => onEdit((c) => ({ ...c, secondHeading: v || undefined }))}
      />
    </h3>
  );
  const secondBody = (maxWidth?: number) => (
    <p style={{ fontSize: 28, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line', maxWidth }}>
      <E slot="secondBody"
        value={content.secondBody ?? 'Click to add more content…'}
        editing={editing}
        multiline
        dataField="secondBody"
        onActivate={activate('secondBody')}
        onCommit={(v) => onEdit((c) => ({ ...c, secondBody: v || undefined }))}
      />
    </p>
  );
  const hudLabel = (
    <E slot="hudLabel"
      value={content.hudLabel ?? 'Custom Slide'}
      editing={editing}
      onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
    />
  );

  if (layout === 'full-bleed') {
    return (
      <>
        <div style={{ position: 'absolute', inset: 0 }}>{image('Click to add a background image', { width: '100%', height: '100%' }, dropToStandard)}</div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(0deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)',
            zIndex: 5,
          }}
        />
        <HudTop label={<span style={{ color: '#fff' }}>{hudLabel}</span>} num={<span style={{ color: '#fff' }}>{num}</span>} />
        {editing && <BlankLayoutPicker value={layout} onChange={setLayout} />}
        <div style={{ position: 'absolute', left: 140, right: 140, bottom: 120, zIndex: 10, color: '#fff' }}>
          {eyebrow}
          {heading(72)}
          {body(1200)}
        </div>
      </>
    );
  }

  if (layout === 'two-column') {
    return (
      <>
        <SlideGrid />
        <HudTop label={hudLabel} num={num} />
        {editing && <BlankLayoutPicker value={layout} onChange={setLayout} />}
        {/* The right-hand table is a draggable OverlayShape, seeded by
            setLayout above - nothing template-fixed renders in that half. */}
        <div style={{ position: 'absolute', top: 160, bottom: 0, left: 140, right: '50%', zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 60 }}>
          {eyebrow}
          {heading(64)}
          {body()}
        </div>
      </>
    );
  }

  return (
    <>
      <SlideGrid />
      <HudTop label={hudLabel} num={num} />
      {editing && <BlankLayoutPicker value={layout} onChange={setLayout} />}
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {eyebrow}
        <div style={{ color: 'var(--neutral-900)' }}>{heading(88)}</div>
        {body(1200)}
        <div style={{ marginTop: 48, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {secondHeading(40)}
          {secondBody(1200)}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Slide type registry - maps template id → renderer
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// s-imported - a slide lifted from an uploaded .pptx, original layout intact
// ---------------------------------------------------------------------------

/** True when an imported slide's own background is dark, so the footer and
 *  chrome flip to light-on-dark like the s4/s14 templates do. */
export function importedIsDark(base?: string): boolean {
  if (!base) return false;
  const h = base.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

/**
 * Renders an imported slide's shapes at their original coordinates in the
 * 1920x1080 design space, over the brand's grid and ambient glow.
 *
 * Every text run is separately editable, rather than the paragraph as a whole,
 * so editing a bold label inside a mixed-format line doesn't flatten the rest
 * of it back to plain text.
 */
function SlideImported({ content, editing, onEdit, instanceId, selection, onSelect }: SlideRenderProps) {
  const shapes = content.shapes ?? [];
  const base = content.importedBase ?? 'FFFFFF';
  const dark = importedIsDark(base);

  /** Live geometry during a drag/resize, so the shape follows the pointer
   *  without writing to the deck (and pushing an undo entry) on every move. */
  const [live, setLive] = useState<{ id: string; rect: Rect } | null>(null);
  const dragRef = useRef<{
    id: string;
    handle: Handle | null;
    startRect: Rect;
    startX: number;
    startY: number;
    scale: number;
    moved: boolean;
    extras: ExtraGuides;
  } | null>(null);

  /** Shift held on mousedown, for a run's shift-click-to-add-to-selection
   *  gesture - see the run span below for why this can't just be read off
   *  the mouseup event. */
  const additiveRunClick = useRef(false);

  useEffect(() => {
    if (!live) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / d.scale;
      const dy = (e.clientY - d.startY) / d.scale;
      if (!d.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      d.moved = true;
      const free = e.altKey;
      const rect = d.handle
        ? snapResize(d.startRect, d.handle, dx, dy, free, d.extras)
        : clampToSlide(snapMove({ ...d.startRect, x: d.startRect.x + dx, y: d.startRect.y + dy }, free, d.extras));
      setLive({ id: d.id, rect });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d?.moved && live) {
        onEdit((c) => ({
          ...c,
          shapes: (c.shapes ?? []).map((sh) => (sh.id === live.id ? { ...sh, ...live.rect } : sh)),
        }));
      }
      dragRef.current = null;
      setLive(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [live, onEdit]);

  const slideScale = (el: HTMLElement | null): number => {
    const slide = el?.closest<HTMLElement>('[data-slide]');
    const rect = slide?.getBoundingClientRect();
    return rect?.width ? rect.width / SLIDE_W : 1;
  };

  const beginDrag = (e: React.PointerEvent, sh: ImportedShape, handle: Handle | null) => {
    if (!editing) return;
    e.stopPropagation();
    e.preventDefault();
    const rect: Rect = { x: sh.x, y: sh.y, w: sh.w, h: sh.h };
    dragRef.current = {
      id: sh.id,
      handle,
      startRect: rect,
      startX: e.clientX,
      startY: e.clientY,
      scale: slideScale(e.currentTarget as HTMLElement),
      moved: false,
      extras: guidesFromSiblings(shapes.filter((s) => s.id !== sh.id)),
    };
    setLive({ id: sh.id, rect });
  };

  /** True if the toolbar is currently pointed at this exact run. */
  const runSelected = (shapeId: string, p: number, r: number) =>
    selection?.kind === 'run' &&
    selection.instanceId === instanceId &&
    selection.shapeId === shapeId &&
    selection.paragraph === p &&
    selection.run === r;

  /** True if the selection belongs to this shape at all, regardless of which
   *  run inside it - drag/resize handles are shape-level, not run-level. Also
   *  true for every shape shift-clicked alongside the anchor, so a group (a
   *  box and its caption, say) shows handles on every member, not just one. */
  const shapeSelected = (shapeId: string) =>
    selection?.kind === 'run' && selection.instanceId === instanceId && shapeIdsOf(selection).includes(shapeId);

  /** Selects a shape that has no text of its own to focus (an image, a plain
   *  rect/line, or a table) - the (0,0) placeholder paragraph/run address is
   *  never read for these, only `shapeId` is, by `shapeSelected` and the
   *  bottom toolbar's fill/stroke/delete controls. `additive` (shift-click)
   *  adds it to whatever else is already selected instead of replacing. */
  const selectShape = (shapeId: string, additive = false) => {
    if (editing && instanceId) onSelect?.({ kind: 'run', instanceId, shapeId, paragraph: 0, run: 0 }, additive);
  };

  /** Imported runs are addressed by shape/paragraph/run rather than by slot
   *  name, so they can't go through SlotContext like a template slot does -
   *  the run span reports its own selection instead. */
  const selectRun = (shapeId: string, p: number, r: number, el: HTMLElement, additive = false) => {
    if (!onSelect || !instanceId) return;
    onSelect({ kind: 'run', instanceId, shapeId, paragraph: p, run: r, ...textMetrics(el) }, additive);
  };

  const patchRun = (shapeId: string, p: number, r: number, text: string) =>
    onEdit((c) => ({
      ...c,
      shapes: (c.shapes ?? []).map((sh) =>
        sh.id !== shapeId
          ? sh
          : {
            ...sh,
            paragraphs: (sh.paragraphs ?? []).map((para, pi) =>
              pi !== p
                ? para
                : {
                  ...para,
                  runs: para.runs.map((run, ri) => (ri === r ? { ...run, text } : run)),
                }),
          }),
    }));

  return (
    <div style={{ position: 'absolute', inset: 0, background: `#${base}`, overflow: 'hidden' }}>
      {dark ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.11) 1px, transparent 1px),'
              + ' linear-gradient(90deg, rgba(255,255,255,0.11) 1px, transparent 1px)',
            backgroundSize: '120px 120px',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      ) : (
        <SlideGrid />
      )}
      <Glow style={{ top: -260, right: -300 }} />
      <Glow style={{ bottom: -420, left: -360, opacity: 0.6 }} />

      {shapes.map((sh) => {
        const rect = live?.id === sh.id ? live.rect : sh;
        const selected = editing && shapeSelected(sh.id);

        const boxStyle: React.CSSProperties = {
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          zIndex: 1,
          borderRadius: sh.kind === 'ellipse' ? '50%' : 0,
          background: sh.fill ? `#${sh.fill}` : undefined,
          border: sh.line ? `${Math.max(1, sh.line.widthPx)}px solid #${sh.line.color}` : undefined,
          boxSizing: 'border-box',
          cursor: editing ? 'move' : undefined,
          outline: selected ? '2px dashed color-mix(in srgb, var(--emerald-500) 60%, transparent)' : undefined,
          outlineOffset: 3,
        };

        // Drag/resize is available on every imported shape, text included -
        // grabbing the body moves it, the eight edge handles resize it. Text
        // boxes reflow live because their width comes straight from `rect.w`.
        // Fill/stroke/delete live in the bottom toolbar, not here - a second,
        // tiny colour picker floating over the shape duplicated it and was easy
        // to fire by accident while trying to format the text inside.
        const handles = selected && (
          <>
            <div
              onPointerDown={(e) => beginDrag(e, sh, null)}
              style={{
                position: 'absolute', top: 4, left: 4, width: 18, height: 18,
                borderRadius: 4, background: 'var(--emerald-500)', cursor: 'move',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 0v10M0 5h10" stroke="#fff" strokeWidth="1.4" />
              </svg>
            </div>
            {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as Handle[]).map((h) => {
              const pos: React.CSSProperties = { position: 'absolute' };
              if (h.includes('n')) pos.top = -5;
              if (h.includes('s')) pos.bottom = -5;
              if (h.includes('w')) pos.left = -5;
              if (h.includes('e')) pos.right = -5;
              if (h === 'n' || h === 's') { pos.left = '50%'; pos.marginLeft = -5; }
              if (h === 'e' || h === 'w') { pos.top = '50%'; pos.marginTop = -5; }
              return (
                <div
                  key={h}
                  onPointerDown={(e) => beginDrag(e, sh, h)}
                  style={{
                    ...pos, width: 10, height: 10, background: '#fff',
                    border: '2px solid var(--emerald-500)', cursor: `${h}-resize`, zIndex: 3,
                  }}
                />
              );
            })}
          </>
        );

        if (sh.kind === 'image') {
          return (
            <div
              key={sh.id}
              data-selectable
              style={boxStyle}
              onPointerDown={(e) => editing && beginDrag(e, sh, null)}
              onClick={(e) => selectShape(sh.id, e.shiftKey)}
            >
              <img src={sh.imageUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }} />
              {handles}
            </div>
          );
        }

        if (sh.kind === 'table' && sh.rows) {
          // Column/row proportions are fixed at import time; a resize scales
          // every column and row by the same factor the box itself grew by,
          // rather than resizing only the last one.
          const wScale = sh.w ? rect.w / sh.w : 1;
          const hScale = sh.h ? rect.h / sh.h : 1;
          return (
            <div
              key={sh.id}
              data-selectable
              style={{ ...boxStyle, display: 'flex', flexDirection: 'column' }}
              // Cells fill the whole box, so there's no bare "background" spot
              // to require a target === currentTarget match against - nothing
              // inside a cell sets its own selection, unlike a text run.
              onPointerDown={(e) => editing && (e.target as HTMLElement) === e.currentTarget && beginDrag(e, sh, null)}
              onClick={(e) => selectShape(sh.id, e.shiftKey)}
            >
              {sh.rows.map((row, ri) => (
                // minHeight, not height: a source row height of 0 (common when a
                // deck never set one explicitly, letting content size it) must
                // not collapse the row - it's a floor once remapped brand fonts
                // are in play, not an exact size.
                <div key={ri} style={{ display: 'flex', minHeight: row.heightPx * hScale, flexShrink: 0 }}>
                  {row.cells.map((cell, ci) => (
                    <div
                      key={ci}
                      style={{
                        width: (sh.colWidthsPx?.[ci] ?? sh.w / row.cells.length) * wScale,
                        flexShrink: 0,
                        background: cell.fill ? `#${cell.fill}` : undefined,
                        border: '1px solid color-mix(in srgb, var(--neutral-900) 12%, transparent)',
                        boxSizing: 'border-box',
                        padding: '4px 10px',
                        overflow: 'hidden',
                      }}
                    >
                      {(cell.paragraphs ?? []).map((para, pi) => (
                        <div key={pi} style={{ textAlign: para.align ?? 'left', lineHeight: 1.35 }}>
                          {para.runs.map((run, runI) => (
                            <span
                              key={runI}
                              style={{
                                fontFamily: run.font ? `"${run.font}", var(--font-sans)` : 'var(--font-sans)',
                                fontSize: run.sizePx ?? 16,
                                fontWeight: run.bold ? 700 : 400,
                                fontStyle: run.italic ? 'italic' : undefined,
                                textDecoration: run.underline ? 'underline' : undefined,
                                color: run.color ? `#${run.color}` : dark ? '#ffffff' : 'var(--neutral-900)',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {run.text}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              {handles}
            </div>
          );
        }

        if (!sh.paragraphs?.length) {
          return (
            <div
              key={sh.id}
              data-selectable
              style={boxStyle}
              onPointerDown={(e) => editing && beginDrag(e, sh, null)}
              onClick={(e) => selectShape(sh.id, e.shiftKey)}
            >
              {handles}
            </div>
          );
        }

        return (
          <div
            key={sh.id}
            data-selectable
            style={{
              ...boxStyle,
              display: 'flex',
              flexDirection: 'column',
              justifyContent:
                sh.vAlign === 'middle' ? 'center' : sh.vAlign === 'bottom' ? 'flex-end' : 'flex-start',
              // Imported boxes are sized to the source deck's font metrics. Once
              // the type is remapped to the brand stack a line can run a few px
              // long, so text is allowed to spill rather than be clipped.
              overflow: 'visible',
            }}
            onPointerDown={(e) => {
              // Only the body of the box drags the shape - a click that lands on
              // a run (handled below) has to reach the run's own selection first.
              if (editing && (e.target as HTMLElement) === e.currentTarget) beginDrag(e, sh, null);
            }}
            onClick={(e) => {
              // A click that missed every run (empty padding within the box)
              // still selects the shape itself, so drag/resize handles appear
              // without requiring a run to click first.
              if (editing && (e.target as HTMLElement) === e.currentTarget) selectShape(sh.id, e.shiftKey);
            }}
          >
            {sh.paragraphs.map((para, pi) => (
              <div
                key={pi}
                style={{
                  textAlign: para.align ?? 'left',
                  minHeight: para.runs.length ? undefined : '0.7em',
                  lineHeight: 1.35,
                }}
              >
                {para.runs.map((run, ri) => (
                  <span
                    key={ri}
                    // Focus fires before mouseup on a shift-click, so capturing
                    // the modifier on mousedown (like the template-slot fields
                    // do) keeps the gesture from toggling the run straight back
                    // off before mouseup ever sees it.
                    onMouseDown={(e) => { additiveRunClick.current = e.shiftKey; }}
                    // Focus bubbles, so listening here catches the editable span
                    // inside without wrapping every run in another element.
                    onFocus={(e) => { if (editing && !additiveRunClick.current) selectRun(sh.id, pi, ri, e.currentTarget); }}
                    onMouseUp={(e) => {
                      const additive = additiveRunClick.current;
                      additiveRunClick.current = false;
                      if (editing) selectRun(sh.id, pi, ri, e.currentTarget, additive);
                    }}
                    style={{
                      fontFamily: run.font ? `"${run.font}", var(--font-sans)` : 'var(--font-sans)',
                      fontSize: run.sizePx ?? 18,
                      fontWeight: run.bold ? 700 : 400,
                      fontStyle: run.italic ? 'italic' : undefined,
                      textDecoration: run.underline ? 'underline' : undefined,
                      color: run.color ? `#${run.color}` : dark ? '#ffffff' : 'var(--neutral-900)',
                      whiteSpace: 'pre-wrap',
                      ...(editing && runSelected(sh.id, pi, ri)
                        ? { outline: '2px solid var(--emerald-500)', outlineOffset: 2, borderRadius: 2 }
                        : {}),
                    }}
                  >
                    <E
                      value={run.text}
                      editing={editing}
                      onCommit={(v) => patchRun(sh.id, pi, ri, v)}
                    />
                  </span>
                ))}
              </div>
            ))}
            {handles}
          </div>
        );
      })}
    </div>
  );
}

const SLIDE_RENDERERS: Record<string, (props: SlideRenderProps) => React.ReactElement> = {
  s1: SlideCover,
  s2: SlideIndex,
  s3: SlideExecutiveSummary,
  s4: SlideSectionDivider,
  s5: SlideTwoColumnContext,
  s6: SlideDataMonument,
  s7: SlideMetricsDashboard,
  s8: SlideComparativeTable,
  s9: SlideStrategicRoadmap,
  s10: SlideImageEditorial,
  s11: SlideProcessArchitecture,
  s12: SlideGlobalMap,
  s13: SlideFeaturedQuote,
  s14: SlideExit,
  blank: SlideBlank,
  imported: SlideImported,
};

const DARK_TEMPLATES = new Set(['s4', 's14']);

/** Imported slides carry their own background colour, so darkness is a
 *  property of the slide instance rather than of its template id. */
export function slideIsDark(slide: SlideInstance): boolean {
  if (slide.templateId === 'imported') return importedIsDark(slide.content.importedBase);
  return DARK_TEMPLATES.has(slide.templateId);
}

/**
 * Renders a single slide at an arbitrary scale, read-only. Shared by the Review
 * grid (thumbnails) and Present mode (full-screen). The 1920×1080 slide is scaled
 * from its top-left into a box sized to the scaled dimensions.
 */
export function SlideStage({
  slide,
  ast,
  num,
  scale,
  logoUrl,
  /** The deck's theme. Defaults to Wozku's, so a caller that has no deck in
   *  scope still renders the house look rather than an unstyled slide. */
  theme = WOZKU_THEME,
  /** Check this slide's text for anything the layout is cutting off. Set by the
   *  thumbnail rail, which is the one place every slide is mounted at once.
   *  Off elsewhere: Present mode should not be measuring anything. */
  measureFit = false,
}: {
  slide: SlideInstance;
  ast: DocumentNode | null;
  num: string;
  scale: number;
  logoUrl?: string;
  theme?: DeckTheme;
  measureFit?: boolean;
}) {
  const Renderer = SLIDE_RENDERERS[slide.templateId];
  const isDark = slideIsDark(slide);
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <div style={{ width: 1920 * scale, height: 1080 * scale, flexShrink: 0, overflow: 'hidden' }}>
      <div
        ref={rootRef}
        className="wg-doc"
        style={{
          // The theme's custom properties are scoped to the slide's own root, so
          // the ~150 var(--emerald-500) / var(--neutral-200) references inside the
          // template renderers resolve from the deck's theme while the studio
          // chrome around the slide keeps its own tone.
          ...themeCssVars(theme),
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
          overflow: 'hidden',
          padding: 0,
          background: isDark ? themeCss(theme.surface.dark) : themeCss(theme.surface.light),
          color: isDark ? themeCss(theme.ink.onDark) : themeCss(theme.ink.onLight),
        }}
      >
        {Renderer && <Renderer ast={ast} content={slide.content} num={num} editing={false} onEdit={() => { }} logoUrl={logoUrl} />}
        {/* Inserted shapes must appear here too, or Present mode and the Review
            thumbnails would disagree with the editor (and with the export). */}
        <ShapeOverlay
          shapes={visibleOverlay(slide.content)}
          editing={false}
          onSelect={() => { }}
          onPatch={() => { }}
        />
        {!slide.content.hideFooter && (
          <div className="footer-row" style={{ zIndex: 10 }}>
            <span>{slide.title}</span>
            <span>{num}</span>
          </div>
        )}
        {measureFit && <FitProbe rootRef={rootRef} slideId={slide.instanceId} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresentationCanvas
// ---------------------------------------------------------------------------
export function PresentationCanvas({
  ast, deck, editing, onEditSlide, onLogoChange, onLogoScaleChange, onRequestEdit,
  selection, onSelect, onDeselect, onActiveSlideChange, onRenameSlide, revision,
  currentId, onNavigate, onPickVideo, theme = WOZKU_THEME,
}: PresentationCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.5);
  /** 1 = fit to stage. Multiplies the fitted scale. */
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const visibleSlides = deck.slides.filter((s) => !s.hidden);
  const index = Math.max(0, visibleSlides.findIndex((s) => s.instanceId === currentId));
  const current = visibleSlides[index];

  // Wheel zoom (Pinch / Ctrl + Scroll)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom((z) => Math.max(0.1, Math.min(4, Math.round(z * factor * 100) / 100)));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Space key listener for canvas panning
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.isContentEditable || t?.closest('input, textarea')) return;
      if (e.code === 'Space' && !e.repeat) {
        setSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Pointer panning handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (spacePressed || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }
  };

  // Fit slide canvas
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - 96;
      const h = el.clientHeight - 200;
      if (w > 0 && h > 0) setFit(Math.min(w / SLIDE_W, h / 1080));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = fit * zoom;

  const go = useCallback((delta: number) => {
    const next = visibleSlides[index + delta];
    if (next) onNavigate?.(next.instanceId);
  }, [visibleSlides, index, onNavigate]);

  // Keyboard deck navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.isContentEditable || t?.closest('input, textarea')) return;
      if (editing && selection) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, editing, selection]);

  if (!current) {
    return (
      <div ref={stageRef} className="book" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 340, padding: 24 }}>
          <div
            style={{
              width: 92, height: 52, margin: '0 auto 18px',
              border: '1.5px dashed var(--neutral-300)',
              background: '#fff',
            }}
          />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--neutral-700)' }}>
            Nothing to show yet
          </div>
          <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: 'var(--neutral-500)' }}>
            Every slide is hidden, or this deck is empty. Add a slide from the
            rail, or bring in a source to build one.
          </p>
        </div>
      </div>
    );
  }

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, padding: 0,
    background: 'transparent', border: 'none',
    color: 'var(--chrome-text-dim)', cursor: 'pointer',
    borderRadius: 'var(--radius-sharp)',
  };
  const cluster: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 2,
    pointerEvents: 'auto',
    height: 32, padding: '0 4px',
    background: '#fff',
    border: '1px solid var(--neutral-200)',
    boxShadow: '0 1px 2px rgba(15,23,20,0.05)',
  };

  return (
    <div
      ref={stageRef}
      className="book"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => {
        if (!editing || !onDeselect) return;
        const target = e.target as HTMLElement;
        if (target.closest('[contenteditable], [data-overlay-shape], [data-selectable]')) return;
        onDeselect();
      }}
      style={{
        cursor: spacePressed ? (isPanning ? 'grabbing' : 'grab') : undefined,
      }}
    >
      {visibleSlides.map((slide, i) => {
        const Renderer = SLIDE_RENDERERS[slide.templateId];
        const isDark = slideIsDark(slide);
        const num = String(i + 1).padStart(2, '0');
        const isCurrent = i === index;

        return (
          <div
            key={slide.instanceId}
            id={slide.instanceId}
            data-slide
            className="page"
            onPointerDown={() => { if (editing) onActiveSlideChange?.(slide.instanceId); }}
            style={{
              ...themeCssVars(theme),
              width: SLIDE_W,
              height: 1080,
              position: 'absolute',
              left: '50%',
              top: 'calc(50% + 18px)',
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + 18px + ${pan.y}px)) scale(${scale})`,
              transformOrigin: 'center center',
              overflow: 'hidden',
              background: isDark ? themeCss(theme.surface.dark) : themeCss(theme.surface.light),
              color: isDark ? themeCss(theme.ink.onDark) : themeCss(theme.ink.onLight),
              boxShadow: isDark
                ? 'var(--shadow-stage)'
                : 'var(--shadow-stage), inset 0 0 0 1px rgba(0,0,0,0.06)',
              // Every slide stays mounted so the exporter can still capture any
              // of them by id; only the current one is shown.
              opacity: isCurrent ? 1 : 0,
              pointerEvents: isCurrent ? 'auto' : 'none',
              zIndex: isCurrent ? 1 : 0,
            }}
          >
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              {Renderer && (
                <SlideSlots
                  instanceId={slide.instanceId}
                  content={slide.content}
                  selection={selection ?? null}
                  onSelect={onSelect}
                  onEditSlide={onEditSlide}
                  revision={revision}
                >
                  <Renderer
                    ast={ast}
                    content={slide.content}
                    num={num}
                    editing={editing}
                    onEdit={(updater) => onEditSlide(slide.instanceId, updater)}
                    logoUrl={deck.logoUrl}
                    onLogoChange={onLogoChange}
                    logoScale={deck.logoScale}
                    onLogoScaleChange={onLogoScaleChange}
                    instanceId={slide.instanceId}
                    onRequestEdit={onRequestEdit}
                    selection={selection}
                    onSelect={onSelect}
                  />
                </SlideSlots>
              )}

              <ShapeOverlay
                shapes={visibleOverlay(slide.content)}
                editing={editing}
                selectedId={
                  selection?.kind === 'overlay' && selection.instanceId === slide.instanceId
                    ? selection.shapeId
                    : undefined
                }
                selectedCell={
                  selection?.kind === 'overlay' && selection.instanceId === slide.instanceId
                    ? selection.cell
                    : undefined
                }
                onSelect={(shapeId, cell) =>
                  onSelect?.({ kind: 'overlay', instanceId: slide.instanceId, shapeId, cell })
                }
                onPatch={(shapeId, patch) =>
                  onEditSlide(slide.instanceId, (c) =>
                    withOverlay(
                      c,
                      overlayOf(c).map((s) => (s.id === shapeId ? { ...s, ...patch } : s))
                    )
                  )
                }
                onPickVideo={onPickVideo}
              />

              {!slide.content.hideFooter && (
                <div className="footer-row" style={{ zIndex: 10, position: 'relative' }}>
                  <span>
                    {editing ? (
                      <span
                        data-editable
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                        title="Slide label - also shown in the sidebar"
                        style={{ padding: '6px 8px', margin: '-6px -8px', outline: 'none' }}
                        onBlur={(e) => {
                          const next = (e.target as HTMLElement).innerText.trim();
                          if (next && next !== slide.title) onRenameSlide?.(slide.instanceId, next);
                          else if (!next) (e.target as HTMLElement).innerText = slide.title;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
                          if (e.key === 'Escape') {
                            (e.target as HTMLElement).innerText = slide.title;
                            (e.target as HTMLElement).blur();
                          }
                        }}
                      >
                        {slide.title}
                      </span>
                    ) : (
                      slide.title
                    )}
                  </span>
                  <span>
                    {i + 1} / {visibleSlides.length}
                  </span>
                  {editing && (
                    <button
                      onClick={() => onEditSlide(slide.instanceId, (c) => ({ ...c, hideFooter: true }))}
                      title="Remove this slide's footer"
                      aria-label="Remove footer"
                      style={{
                        position: 'absolute', right: -34, top: '50%', transform: 'translateY(-50%)',
                        width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: '#fff', color: '#dc2626',
                        border: '1px solid #fecaca', cursor: 'pointer',
                        borderRadius: '50%', fontSize: 18, lineHeight: 1, padding: 0,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
              {editing && slide.content.hideFooter && (
                <button
                  onClick={() => onEditSlide(slide.instanceId, (c) => ({ ...c, hideFooter: undefined }))}
                  title="Bring the footer back"
                  style={{
                    position: 'absolute', bottom: 24, left: 80, zIndex: 20,
                    height: 34, padding: '0 16px',
                    fontFamily: 'var(--font-mono)', fontSize: 15,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--emerald-600)', background: 'var(--emerald-50)',
                    border: '1.5px dashed var(--emerald-400)', cursor: 'pointer',
                    borderRadius: 'var(--radius-sharp)',
                  }}
                >
                  + Footer
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Deck position on the left, zoom on the right; the centre stays clear
          for the edit toolbar. */}
      <div
        style={{
          position: 'absolute', bottom: 18, left: 24, right: 24, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={cluster}>
          <button onClick={() => go(-1)} disabled={index === 0} title="Previous slide (←)" aria-label="Previous slide"
            style={{ ...btn, opacity: index === 0 ? 0.3 : 1, cursor: index === 0 ? 'default' : 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em',
              color: 'var(--chrome-text-dim)', minWidth: 62, textAlign: 'center', userSelect: 'none',
            }}
          >
            {String(index + 1).padStart(2, '0')} / {String(visibleSlides.length).padStart(2, '0')}
          </span>
          <button onClick={() => go(1)} disabled={index >= visibleSlides.length - 1} title="Next slide (→)" aria-label="Next slide"
            style={{ ...btn, opacity: index >= visibleSlides.length - 1 ? 0.3 : 1, cursor: index >= visibleSlides.length - 1 ? 'default' : 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
        <span
          style={{
            marginLeft: 10, fontSize: 12, color: 'var(--neutral-500)',
            maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', userSelect: 'none', pointerEvents: 'none',
          }}
        >
          {current.title}
        </span>
        {/* Beside the counter and title because this strip is already the layer
            that speaks about the current slide. Absent unless there is something
            wrong with this one. */}
        <FitFixChip
          slide={current}
          editing={editing}
          onRequestEdit={onRequestEdit}
          onEditSlide={onEditSlide}
        />
        </div>

        <div style={cluster}>
          <button onClick={() => setZoom((z) => Math.max(0.1, Math.round((z - 0.15) * 100) / 100))} title="Zoom out" aria-label="Zoom out" style={btn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            title="Reset view and fit to screen (100%)"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
              color: 'var(--chrome-text-dim)', background: 'transparent', border: 'none',
              cursor: 'pointer', minWidth: 46, height: 28,
            }}
          >
            {Math.round(scale * 100)}%
          </button>
          <button onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.15) * 100) / 100))} title="Zoom in" aria-label="Zoom in" style={btn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>

    </div>
  );
}
