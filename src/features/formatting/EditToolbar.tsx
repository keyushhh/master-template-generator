/**
 * The single editing toolbar.
 *
 * This replaced three separate floating bars (insert, format, session). Three
 * stacked panels was the wrong shape for the problem: it made the editor feel
 * heavier than the generic tools we're trying to beat, the user had to work out
 * which bar owned which control, and the stack grew and shrank as the selection
 * changed, so the thing you were reaching for moved.
 *
 * The rules that keep it calm:
 *
 *  - One bar, one background, fixed height. It never grows a second row.
 *  - Its middle section is contextual: text controls for text, shape controls
 *    for shapes, and a hint when nothing is selected. Controls that cannot
 *    apply are absent, not disabled.
 *  - Anything with more than about four options lives behind a labelled
 *    dropdown rather than a row of guessable icons. Four bare arrows for
 *    layer order was the worst offender.
 *  - Session actions (Save/Discard) are *not* here - they live in the top bar
 *    next to Edit Content, because they belong to the editing session, not to
 *    the current selection.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ImportedShape, OverlayChartType, OverlayShape, SlotStyle } from '../deck/types';
import {
  ACCENT_SWATCHES,
  FONT_CHOICES,
  NEUTRAL_SWATCHES,
  SIZE_MAX,
  SIZE_MIN,
  clampSize,
  isBrandColor,
  normalizeHex,
  stepSize,
} from './rails';
import { layerBounds, type LayerMove } from './overlayModel';
import { GROUP_ALIGNMENTS, type GroupAlign } from './group';
import { TrashIcon } from '../ui/icons';
import { EyedropIcon, RefreshIcon } from '../ui/icons';

const BAR_H = 44;

const ctl: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: 28, padding: '0 8px',
  border: '1px solid transparent', background: 'transparent',
  color: 'var(--neutral-600)', cursor: 'pointer',
  borderRadius: 'var(--radius-sharp)',
  fontSize: 12, fontWeight: 600, lineHeight: 1,
  whiteSpace: 'nowrap',
};

const ctlOn: React.CSSProperties = { background: 'var(--emerald-500)', color: '#fff' };

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10,
  textTransform: 'uppercase', letterSpacing: '0.12em',
};

function Sep() {
  return <span style={{ width: 1, height: 18, background: 'var(--neutral-200)', flexShrink: 0 }} />;
}

function Caret() {
  return (
    <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <path d="M1 3l4 4 4-4z" />
    </svg>
  );
}

/**
 * A labelled dropdown. Closes on outside click and Esc, and never steals focus
 * from the slide - the caller's mousedown guard keeps the caret alive so the
 * field being formatted stays selected.
 */
function Menu({
  label,
  icon,
  title,
  width = 200,
  active,
  badge,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  title: string;
  width?: number;
  active?: boolean;
  badge?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  /** Where to pin the panel, in viewport coordinates. */
  const [at, setAt] = useState<{ bottom: number; left: number } | null>(null);

  const place = () => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setAt({
      // Opens upward from the trigger, and is clamped so a menu near either end
      // of the bar cannot run off screen.
      bottom: window.innerHeight - r.top + 10,
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
    });
  };

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrap.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    // Fixed coordinates stop tracking the trigger once anything moves.
    const moved = () => setOpen(false);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', moved);
    window.addEventListener('scroll', moved, true);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', moved);
      window.removeEventListener('scroll', moved, true);
    };
  }, [open]);

  return (
    <div ref={wrap} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        title={title}
        aria-label={title}
        aria-expanded={open}
        onClick={() => { if (!open) place(); setOpen((o) => !o); }}
        style={{ ...ctl, ...(open || active ? ctlOn : {}) }}
      >
        {icon}
        {label}
        {badge && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--emerald-500)' }} />}
        <Caret />
      </button>
      {/* Portalled to the body on purpose. The bar clamps its own width and
          scrolls horizontally when a table or chart selection expands its
          middle, which makes it a scroll container - and a panel opening
          upward out of a scroll container is simply clipped away. */}
      {open && at &&
        createPortal(
          <div
            ref={panel}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest('textarea, input')) return;
              e.preventDefault();
            }}
            style={{
              position: 'fixed', bottom: at.bottom, left: at.left, zIndex: 300,
              width, padding: 8,
              background: '#fff',
              border: '1px solid var(--neutral-200)',
              boxShadow: '0 2px 4px rgba(15,23,20,0.05), 0 16px 40px -12px rgba(15,23,20,0.20)',
              borderRadius: 'var(--radius-sharp)',
            }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body
        )}
    </div>
  );
}

/** A row inside a Menu: icon, label, and an optional right-hand hint. */
function Row({
  label, hint, icon, onClick, disabled, active,
}: {
  label: string; hint?: string; icon?: React.ReactNode;
  onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        height: 32, padding: '0 8px',
        border: 'none', background: active ? 'var(--emerald-50)' : 'transparent',
        color: disabled ? 'var(--neutral-300)' : active ? 'var(--emerald-700)' : 'var(--neutral-700)',
        cursor: disabled ? 'default' : 'pointer',
        borderRadius: 'var(--radius-sharp)',
        fontSize: 12.5, fontWeight: 600, textAlign: 'left',
      }}
    >
      {icon && <span style={{ display: 'inline-flex', width: 14, justifyContent: 'center' }}>{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
      {hint && <span style={{ ...mono, fontSize: 9, color: 'var(--neutral-400)' }}>{hint}</span>}
    </button>
  );
}

// ── Text controls ───────────────────────────────────────────────────────────

function SizeStepper({
  shown, onSet,
}: { shown?: number; onSet: (px: number) => void }) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  useEffect(() => { setTyping(false); setDraft(''); }, [shown]);

  const bump = (dir: 1 | -1) => { if (shown !== undefined) onSet(clampSize(stepSize(shown, dir))); };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <button title="Smaller" aria-label="Smaller" onClick={() => bump(-1)} style={{ ...ctl, padding: '0 6px' }}>−</button>
      <input
        title={`Font size in px (${SIZE_MIN}–${SIZE_MAX})`}
        aria-label="Font size"
        value={typing ? draft : (shown ?? '')}
        onChange={(e) => { setTyping(true); setDraft(e.target.value); }}
        onFocus={() => { setTyping(true); setDraft(String(shown ?? '')); }}
        onBlur={(e) => {
          setTyping(false);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onSet(clampSize(n));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'ArrowUp') { e.preventDefault(); bump(1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); }
        }}
        style={{
          width: 42, height: 28, textAlign: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
          color: 'var(--neutral-900)', background: '#fff',
          border: '1px solid var(--neutral-200)',
          borderRadius: 'var(--radius-sharp)',
        }}
      />
      <button title="Larger" aria-label="Larger" onClick={() => bump(1)} style={{ ...ctl, padding: '0 6px' }}>+</button>
    </span>
  );
}

function ColorMenu({
  value, onDark, onPick, title = 'Text colour', noneLabel = 'Template colour',
  paletteLabel = 'Brand palette', noneSwatch, emptySwatch,
}: {
  value?: string; onDark?: boolean; onPick: (hex: string | undefined) => void;
  title?: string; noneLabel?: string; paletteLabel?: string;
  /** Puts a dedicated "remove colour" chip at the front of the swatch grid,
   *  always visible rather than only appearing once something is picked - a
   *  shape's fill/stroke has "none" as a real, common choice, not a fallback
   *  you'd only look for after already picking a colour. */
  noneSwatch?: boolean;
  /** Icon shown when nothing is picked - a diagonal split by default (text),
   *  or a plain checkerboard-ish outline when "none" means transparent. */
  emptySwatch?: React.ReactNode;
}) {
  const [hex, setHex] = useState('');
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const neutrals = onDark ? [...NEUTRAL_SWATCHES].reverse() : NEUTRAL_SWATCHES;
  const custom = !!value && !isBrandColor(value);

  /** Every path that sets a colour goes through here, so the memory can't
   *  miss one (palette chip, typed hex, or eyedropper). */
  const pick = (h: string, close?: () => void) => {
    onPick(h);
    setRecent(pushRecent(h));
    close?.();
  };

  const chip = (h: string, label: string, light?: boolean, close?: () => void) => {
    const on = value?.toUpperCase() === h.toUpperCase();
    return (
      <button
        key={h}
        title={label}
        aria-label={label}
        onClick={() => pick(h, close)}
        style={{
          width: 22, height: 22, padding: 0, cursor: 'pointer', background: `#${h}`,
          border: on ? '2px solid var(--emerald-500)'
            : light ? '1px solid var(--neutral-300)' : '1px solid var(--neutral-200)',
          borderRadius: 'var(--radius-sharp)',
        }}
      />
    );
  };

  return (
    <Menu
      title={title}
      label=""
      width={214}
      icon={
        emptySwatch && !value ? emptySwatch : (
          <span
            style={{
              width: 15, height: 15, flexShrink: 0, borderRadius: 2,
              background: value ? `#${value}` : 'linear-gradient(135deg,#fff 50%,#10B981 50%)',
              border: '1px solid var(--neutral-300)',
            }}
          />
        )
      }
    >
      {(close) => (
        <>
          <div style={{ ...mono, color: 'var(--neutral-400)', padding: '2px 4px 8px' }}>{paletteLabel}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 2px' }}>
            {noneSwatch && (
              <button
                title={noneLabel}
                aria-label={noneLabel}
                onClick={() => { onPick(undefined); close(); }}
                style={{
                  width: 22, height: 22, padding: 0, cursor: 'pointer', position: 'relative',
                  background: 'transparent',
                  border: !value ? '2px solid var(--emerald-500)' : '1px solid var(--neutral-300)',
                  borderRadius: 'var(--radius-sharp)',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 22 22" style={{ position: 'absolute', inset: 0 }} aria-hidden>
                  <line x1="4" y1="18" x2="18" y2="4" stroke="#f87171" strokeWidth="1.6" />
                </svg>
              </button>
            )}
            {neutrals.map((s) => chip(s.hex, s.label, s.light, close))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, padding: '0 2px' }}>
            {ACCENT_SWATCHES.map((s) => chip(s.hex, s.label, false, close))}
          </div>
          {/* Colours this deck has actually used, most recent first. */}
          {recent.length > 0 && (
            <>
              <div style={{ ...mono, color: 'var(--neutral-400)', padding: '12px 4px 6px' }}>Recent</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 2px' }}>
                {recent.map((h) => chip(h, `#${h}`, false, close))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center', padding: '0 2px' }}>
            <span style={{ color: 'var(--neutral-400)', fontSize: 12 }}>#</span>
            <input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const h = normalizeHex(hex);
                if (h) { pick(h, close); setHex(''); }
              }}
              placeholder={custom ? value : 'custom hex'}
              spellCheck={false}
              style={{
                flex: 1, minWidth: 0, height: 26, padding: '0 6px',
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--neutral-900)', background: '#fff',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-sharp)',
              }}
            />
            {/* Screen eyedropper. Chromium-only, so it is absent rather than
                disabled where the API doesn't exist. */}
            {eyeDropper() && (
              <button
                title="Pick a colour from anywhere on screen"
                aria-label="Pick a colour from screen"
                onClick={async () => {
                  const Ctor = eyeDropper();
                  if (!Ctor) return;
                  try {
                    const { sRGBHex } = await new Ctor().open();
                    const h = normalizeHex(sRGBHex);
                    if (h) pick(h, close);
                  } catch {
                    /* the user dismissed the picker - not an error */
                  }
                }}
                style={{
                  ...ctl, width: 26, height: 26, padding: 0, flexShrink: 0,
                  border: '1px solid var(--neutral-200)',
                }}
              >
<EyedropIcon size={14} />
              </button>
            )}
          </div>
          {value && !noneSwatch && (
            <div style={{ marginTop: 8 }}>
              <Row label={noneLabel} onClick={() => { onPick(undefined); close(); }} />
            </div>
          )}
        </>
      )}
    </Menu>
  );
}

/**
 * Recently-used colours, remembered across selections and sessions.
 *
 * The brand rails deliberately offer a small fixed palette, but a deck often
 * has one or two off-palette colours (a client's brand red, say) that then have
 * to be re-typed as hex on every element they're applied to. This is the memory
 * for exactly that: it records what was actually picked rather than widening
 * the palette everyone starts from.
 *
 * Module-level so every ColorMenu in the bar shares one list, and mirrored to
 * localStorage so it survives a reload the way the deck itself does.
 */
const RECENT_KEY = 'wozku.recentColors';
const RECENT_MAX = 8;

function loadRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((h) => typeof h === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(hex: string): string[] {
  const up = hex.toUpperCase();
  // Most-recent-first, de-duplicated: re-picking a colour promotes it rather
  // than adding a second copy that pushes something else out.
  const next = [up, ...loadRecent().filter((h) => h.toUpperCase() !== up)].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* quota - not worth failing a colour pick over */ }
  return next;
}

/** Chromium exposes a real screen eyedropper; everywhere else the button is
 *  simply absent rather than present-and-broken. */
interface EyeDropperCtor { new (): { open: () => Promise<{ sRGBHex: string }> } }
function eyeDropper(): EyeDropperCtor | undefined {
  return (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
}

function AlignIcon({ a }: { a: 'left' | 'center' | 'right' }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      {[3, 6, 9, 12].map((y, i) => {
        const len = i % 2 === 0 ? 12 : 7;
        const x = a === 'left' ? 2 : a === 'right' ? 14 - len : (16 - len) / 2;
        return <line key={y} x1={x} y1={y} x2={x + len} y2={y} />;
      })}
    </svg>
  );
}

// ── The bar ─────────────────────────────────────────────────────────────────

interface EditToolbarProps {
  /** Text formatting target, when the selection carries text. */
  textStyle?: SlotStyle;
  effectiveSizePx?: number;
  fontName?: string;
  fieldLabel?: string;
  hasTextSelection: boolean;
  onDark?: boolean;
  onPatch: (patch: Partial<SlotStyle>) => void;
  onReset: () => void;
  styleDirty: boolean;

  /** How many template slots are selected. Above one, the bar swaps the field
   *  name for a count and offers group alignment. */
  selectedSlotCount: number;
  onAlignGroup: (to: GroupAlign) => void;

  /** Shape target, when an inserted shape is selected. */
  selectedShape?: OverlayShape;
  shapes: OverlayShape[];
  onLayerMove: (move: LayerMove) => void;
  onToggleBehind: () => void;
  onDeleteShape: () => void;
  onSetFill: (hex: string | undefined) => void;

  /** Table-specific structure edits, when the selected shape is kind==='table'. */
  onTableAddRow: () => void;
  onTableDeleteRow: () => void;
  onTableAddCol: () => void;
  onTableDeleteCol: () => void;

  /** Chart-specific controls, when the selected shape is kind==='chart'. */
  onSetChartType: (t: OverlayChartType) => void;
  onOpenChartData: () => void;

  /** The imported shape a 'run' selection points at, when it has one - the
   *  shape itself, not the particular run, since fill/stroke/delete are
   *  shape-level. */
  importedShape?: ImportedShape;
  /** True whenever the current selection is an imported shape at all (text or
   *  not) - a text one still needs a delete button, just no fill/stroke. */
  isImportedSelection?: boolean;
  /** How many imported shapes are selected together. Above one, the bar shows
   *  group alignment instead of any single shape's fill/stroke/text controls -
   *  a box and its caption have nothing in common to show one set of. */
  importedShapeGroupCount?: number;
  onAlignShapes: (to: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => void;
  onDeleteImportedShape: () => void;
  onSetImportedFill: (hex: string | undefined) => void;
  onSetImportedLine: (line: { color: string; widthPx: number } | undefined) => void;

}

export function EditToolbar({
  textStyle,
  effectiveSizePx,
  fontName,
  fieldLabel,
  hasTextSelection,
  onDark,
  onPatch,
  onReset,
  styleDirty,
  selectedSlotCount,
  onAlignGroup,
  selectedShape,
  shapes,
  onLayerMove,
  onToggleBehind,
  onDeleteShape,
  onSetFill,
  onTableAddRow,
  onTableDeleteRow,
  onTableAddCol,
  onTableDeleteCol,
  onSetChartType,
  onOpenChartData,
  importedShape,
  isImportedSelection,
  importedShapeGroupCount,
  onAlignShapes,
  onDeleteImportedShape,
  onSetImportedFill,
  onSetImportedLine,
}: EditToolbarProps) {
  const bounds = selectedShape ? layerBounds(shapes, selectedShape.id) : null;
  const shown = textStyle?.sizePx ?? effectiveSizePx;
  const grouped = selectedSlotCount > 1;
  const isFillable = selectedShape && (selectedShape.kind === 'rect' || selectedShape.kind === 'ellipse');
  const tableDims = selectedShape?.kind === 'table'
    ? { rows: selectedShape.rows?.length ?? 0, cols: selectedShape.colWidthsPx?.length ?? 0 }
    : null;

  return (
    <div
      // Keeps the caret in the slide: a plain click on a control would blur the
      // field, and blur is what commits its text. Real inputs are exempt
      // because they need focus of their own.
      data-edit-toolbar
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('textarea, input')) return;
        e.preventDefault();
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: BAR_H, padding: '0 14px',
        // Never wider than the stage it floats over: the contextual middle
        // still expands for a table or chart selection.
        maxWidth: 'calc(100vw - var(--sidenav-w) - 48px)',
        overflowX: 'auto',
        overflowY: 'hidden',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: '0 1px 2px rgba(15,23,20,0.04), 0 12px 32px -8px rgba(15,23,20,0.14)',
        border: '1px solid rgba(226,232,240,0.9)',
        borderRadius: 'var(--radius-sharp)',
      }}
    >
      {/* Session banner. Anchors the bar's left edge with something that never
          changes with the selection, and is the one place the undo/redo
          shortcuts are advertised now that those buttons live in the header
          rather than beside the canvas. */}
      <span
        title="Edit mode · Undo ⌘Z · Redo ⌘⇧Z · Esc drops the selection"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          ...mono, fontSize: 9.5, fontWeight: 700,
          color: 'var(--emerald-700)', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        <span
          className="wg-pulse"
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--emerald-500)', flexShrink: 0 }}
        />
        Edit Mode
      </span>

      <Sep />

      {/* Contextual middle. Exactly one of these three renders, so the bar's
          width changes but its structure never does. */}
      {hasTextSelection ? (
        <>
          {grouped ? (
            // A group has no single font to name, and naming just the anchor's
            // would imply the controls only affect that one. The count says what
            // is actually about to change.
            <span
              title="Formatting, nudging and dragging apply to all of these"
              style={{ ...mono, color: 'var(--emerald-600)', whiteSpace: 'nowrap' }}
            >
              {selectedSlotCount} fields
            </span>
          ) : (
            <Menu
              title={`Typeface: ${fieldLabel}`}
              label=""
              width={200}
              active={!!textStyle?.fontFamily}
              icon={
                <span
                  style={{
                    fontFamily: fontName ? `"${fontName}", var(--font-sans)` : 'var(--font-sans)',
                    fontSize: 12,
                    maxWidth: 116, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {fontName ?? fieldLabel}
                </span>
              }
            >
              {(close) => (
                <>
                  {/* Each option renders in the face it applies, so the choice
                      is made by looking rather than by reading a name. */}
                  {FONT_CHOICES.map((f) => (
                    <button
                      key={f.face}
                      onClick={() => { onPatch({ fontFamily: f.face }); close(); }}
                      style={{
                        display: 'flex', alignItems: 'baseline', gap: 10, width: '100%',
                        height: 38, padding: '0 8px', border: 'none', cursor: 'pointer',
                        background: textStyle?.fontFamily === f.face ? 'var(--emerald-50)' : 'transparent',
                        color: textStyle?.fontFamily === f.face ? 'var(--emerald-700)' : 'var(--neutral-700)',
                        borderRadius: 'var(--radius-sharp)', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontFamily: f.stack, fontSize: 15, fontWeight: 600 }}>Ag</span>
                      <span style={{ fontFamily: f.stack, fontSize: 12.5 }}>{f.face}</span>
                      <span style={{ ...mono, fontSize: 9, color: 'var(--neutral-400)', marginLeft: 'auto' }}>{f.label}</span>
                    </button>
                  ))}
                  {textStyle?.fontFamily && (
                    <>
                      <div style={{ height: 1, background: 'var(--neutral-200)', margin: '6px 4px' }} />
                      <Row label="Template typeface" onClick={() => { onPatch({ fontFamily: undefined }); close(); }} />
                    </>
                  )}
                </>
              )}
            </Menu>
          )}

          <SizeStepper shown={shown} onSet={(px) => onPatch({ sizePx: px })} />

          <button title="Bold" aria-label="Bold" aria-pressed={!!textStyle?.bold}
            onClick={() => onPatch({ bold: textStyle?.bold ? undefined : true })}
            style={{ ...ctl, minWidth: 26, ...(textStyle?.bold ? ctlOn : {}), fontWeight: 800 }}>B</button>
          <button title="Italic" aria-label="Italic" aria-pressed={!!textStyle?.italic}
            onClick={() => onPatch({ italic: textStyle?.italic ? undefined : true })}
            style={{ ...ctl, minWidth: 26, ...(textStyle?.italic ? ctlOn : {}), fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>I</button>
          <button title="Underline" aria-label="Underline" aria-pressed={!!textStyle?.underline}
            onClick={() => onPatch({ underline: textStyle?.underline ? undefined : true })}
            style={{ ...ctl, minWidth: 26, ...(textStyle?.underline ? ctlOn : {}), textDecoration: 'underline' }}>U</button>

          <ColorMenu value={textStyle?.color} onDark={onDark} onPick={(hex) => onPatch({ color: hex })} />

          {/* One "align" at a time. On a single field the icons set text
              alignment inside that field; on a group the meaningful operation is
              moving the block onto the slide's own margins, and offering both
              would put two different meanings of the word side by side. */}
          {grouped ? (
            <Menu
              title="Move the selected block onto the slide’s margins"
              label="Align"
              width={230}
              icon={<AlignIcon a="left" />}
            >
              {(close) => (
                <>
                  {GROUP_ALIGNMENTS.map((a, i) => (
                    <span key={a.key}>
                      {/* Horizontal targets, then vertical. */}
                      {i === 3 && <div style={{ height: 1, background: 'var(--neutral-200)', margin: '6px 4px' }} />}
                      <Row label={a.label} hint={a.hint} onClick={() => { onAlignGroup(a.key); close(); }} />
                    </span>
                  ))}
                  <div style={{ ...mono, fontSize: 9, color: 'var(--neutral-400)', padding: '8px 6px 2px', letterSpacing: '0.08em', textTransform: 'none', lineHeight: 1.5 }}>
                    Moves all {selectedSlotCount} together. Spacing between them
                    doesn’t change.
                  </div>
                </>
              )}
            </Menu>
          ) : (
            (['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                title={`Align ${a}`}
                aria-label={`Align ${a}`}
                aria-pressed={textStyle?.align === a}
                onClick={() => onPatch({ align: textStyle?.align === a ? undefined : a })}
                style={{ ...ctl, padding: '0 6px', ...(textStyle?.align === a ? ctlOn : {}) }}
              >
                <AlignIcon a={a} />
              </button>
            ))
          )}

          {styleDirty && (
            <button
              title={grouped
                ? 'Return all selected text to template styling and position'
                : 'Return this text to template styling'}
              aria-label="Reset formatting"
              onClick={onReset} style={{ ...ctl, ...mono, gap: 5 }}>
              <RefreshIcon size={12} />
              Reset
            </button>
          )}

          {isImportedSelection && (
            <button title="Delete this text box" aria-label="Delete text box" onClick={onDeleteImportedShape}
              style={{ ...ctl, padding: '0 7px', color: '#dc2626' }}>
              <TrashIcon size={13} />
            </button>
          )}

          {/* Formatting a table cell still needs the table's own delete
              button - the shape-controls branch below is skipped entirely
              while a cell is the text target. */}
          {selectedShape?.kind === 'table' && (
            <button title="Delete this table" aria-label="Delete table" onClick={onDeleteShape}
              style={{ ...ctl, padding: '0 7px', color: '#dc2626' }}>
              <TrashIcon size={13} />
            </button>
          )}
        </>
      ) : selectedShape ? (
        <>
          {isFillable && (
            <>
              <button title="Outlined, for context and process" aria-label="Outline fill"
                onClick={() => onSetFill(undefined)} style={{ ...ctl, padding: '0 7px' }}>
                <span style={{ width: 14, height: 14, border: '1.5px solid var(--neutral-400)' }} />
              </button>
              <button title="Emerald tint, for the payoff (one per slide)" aria-label="Emerald tint fill"
                onClick={() => onSetFill('ECFDF5')} style={{ ...ctl, padding: '0 7px' }}>
                <span style={{ width: 14, height: 14, background: '#ECFDF5', border: '1.5px solid #10B981' }} />
              </button>
              <Sep />
            </>
          )}

          {selectedShape.kind === 'table' && tableDims && (
            <>
              <Menu title="Table structure" label="Table" width={190}>
                {(close) => (
                  <>
                    <Row label="Add row" onClick={() => { onTableAddRow(); close(); }} />
                    <Row label="Delete row" disabled={tableDims.rows <= 1}
                      onClick={() => { onTableDeleteRow(); close(); }} />
                    <div style={{ height: 1, background: 'var(--neutral-200)', margin: '6px 4px' }} />
                    <Row label="Add column" onClick={() => { onTableAddCol(); close(); }} />
                    <Row label="Delete column" disabled={tableDims.cols <= 1}
                      onClick={() => { onTableDeleteCol(); close(); }} />
                  </>
                )}
              </Menu>
              <Sep />
            </>
          )}

          {selectedShape.kind === 'chart' && (
            <>
              {(['bar', 'line', 'pie'] as const).map((t) => (
                <button
                  key={t}
                  title={`${t[0].toUpperCase()}${t.slice(1)} chart`}
                  aria-label={`${t} chart`}
                  aria-pressed={(selectedShape.chartType ?? 'bar') === t}
                  onClick={() => onSetChartType(t)}
                  style={{ ...ctl, padding: '0 8px', textTransform: 'capitalize', ...((selectedShape.chartType ?? 'bar') === t ? ctlOn : {}) }}
                >
                  {t}
                </button>
              ))}
              <button title="Edit chart data" aria-label="Edit chart data" onClick={onOpenChartData} style={{ ...ctl, padding: '0 8px' }}>
                Data
              </button>
              <Sep />
            </>
          )}

          {/* Layer order behind one labelled menu. Four bare arrows in a row was
              unreadable - nobody can tell "back" from "backward" by arrowhead. */}
          <Menu title="Layer order" label="Arrange" width={216} active={!!selectedShape.behind}>
            {(close) => (
              <>
                <Row label="Bring to front" hint="⌥⇧↑" disabled={bounds?.isLast}
                  onClick={() => { onLayerMove('front'); close(); }} />
                <Row label="Bring forward" hint="⌥↑" disabled={bounds?.isLast}
                  onClick={() => { onLayerMove('forward'); close(); }} />
                <Row label="Send backward" hint="⌥↓" disabled={bounds?.isFirst}
                  onClick={() => { onLayerMove('backward'); close(); }} />
                <Row label="Send to back" hint="⌥⇧↓" disabled={bounds?.isFirst}
                  onClick={() => { onLayerMove('back'); close(); }} />
                <div style={{ height: 1, background: 'var(--neutral-200)', margin: '6px 4px' }} />
                <Row
                  label="Behind slide content"
                  active={!!selectedShape.behind}
                  onClick={() => { onToggleBehind(); close(); }}
                />
                <div style={{ ...mono, fontSize: 9, color: 'var(--neutral-400)', padding: '6px 6px 2px', letterSpacing: '0.08em', textTransform: 'none', lineHeight: 1.5 }}>
                  {bounds && `Layer ${bounds.index + 1} of ${bounds.total}`}
                  {selectedShape.behind ? ' · behind the slide’s own text' : ''}
                </div>
              </>
            )}
          </Menu>

          <button title="Delete this shape" aria-label="Delete shape" onClick={onDeleteShape}
            style={{ ...ctl, padding: '0 7px', color: '#dc2626' }}>
            <TrashIcon size={13} />
          </button>
        </>
      ) : importedShapeGroupCount && importedShapeGroupCount > 1 ? (
        <>
          <span
            title="Alignment, nudging, dragging and delete apply to all of these"
            style={{ ...mono, color: 'var(--emerald-600)', whiteSpace: 'nowrap' }}
          >
            {importedShapeGroupCount} shapes
          </span>

          <Menu title="Align the selected shapes to each other" label="Align" width={200}>
            {(close) => (
              <>
                <div style={{ ...mono, color: 'var(--neutral-400)', padding: '2px 4px 6px' }}>Horizontal</div>
                <Row label="Left" onClick={() => { onAlignShapes('left'); close(); }} />
                <Row label="Centre" onClick={() => { onAlignShapes('centerX'); close(); }} />
                <Row label="Right" onClick={() => { onAlignShapes('right'); close(); }} />
                <div style={{ height: 1, background: 'var(--neutral-200)', margin: '8px 4px' }} />
                <div style={{ ...mono, color: 'var(--neutral-400)', padding: '2px 4px 6px' }}>Vertical</div>
                <Row label="Top" onClick={() => { onAlignShapes('top'); close(); }} />
                <Row label="Middle" onClick={() => { onAlignShapes('centerY'); close(); }} />
                <Row label="Bottom" onClick={() => { onAlignShapes('bottom'); close(); }} />
              </>
            )}
          </Menu>

          <button title="Delete selected shapes" aria-label="Delete selected shapes" onClick={onDeleteImportedShape}
            style={{ ...ctl, padding: '0 7px', color: '#dc2626' }}>
            <TrashIcon size={13} />
          </button>
        </>
      ) : importedShape ? (
        <>
          {(importedShape.kind === 'rect' || importedShape.kind === 'ellipse') && (
            <ColorMenu
              title="Fill colour"
              paletteLabel="Fill colour"
              noneLabel="No fill"
              noneSwatch
              value={importedShape.fill}
              onDark={onDark}
              onPick={onSetImportedFill}
              emptySwatch={<span style={{ width: 15, height: 15, border: '1.5px solid var(--neutral-400)', borderRadius: 2 }} />}
            />
          )}

          <ColorMenu
            title="Stroke colour"
            paletteLabel="Stroke colour"
            noneLabel="No stroke"
            noneSwatch
            value={importedShape.line?.color}
            onDark={onDark}
            onPick={(hex) => onSetImportedLine(hex ? { color: hex, widthPx: importedShape.line?.widthPx ?? 1 } : undefined)}
            emptySwatch={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-400)" strokeWidth="2" aria-hidden>
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            }
          />

          {importedShape.line && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <button title="Thinner stroke" aria-label="Thinner stroke"
                onClick={() => onSetImportedLine({ color: importedShape.line!.color, widthPx: Math.max(1, importedShape.line!.widthPx - 1) })}
                style={{ ...ctl, padding: '0 6px' }}>−</button>
              <span style={{ ...mono, fontSize: 10, color: 'var(--neutral-500)', minWidth: 14, textAlign: 'center' }}>
                {importedShape.line.widthPx}
              </span>
              <button title="Thicker stroke" aria-label="Thicker stroke"
                onClick={() => onSetImportedLine({ color: importedShape.line!.color, widthPx: Math.min(12, importedShape.line!.widthPx + 1) })}
                style={{ ...ctl, padding: '0 6px' }}>+</button>
            </span>
          )}

          <Sep />

          <button title="Delete this shape" aria-label="Delete shape" onClick={onDeleteImportedShape}
            style={{ ...ctl, padding: '0 7px', color: '#dc2626' }}>
            <TrashIcon size={13} />
          </button>
        </>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--neutral-400)', whiteSpace: 'nowrap' }}>
          Click any text to format it · shift-click to add more
        </span>
      )}

    </div>
  );
}
