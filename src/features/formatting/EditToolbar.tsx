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
import type { ImportedShape, OverlayChartType, OverlayShape, SlideBackground, SlotStyle } from '../deck/types';
import { fileToDataUrl } from '../generator/PresentationCanvas';
import {
  ACCENT_SWATCHES,
  INDENT_STEP_PX,
  LETTER_SPACINGS,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  LINE_HEIGHTS,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  NEUTRAL_SWATCHES,
  OPACITIES,
  OPACITY_MAX,
  OPACITY_MIN,
  PARA_SPACES,
  PARA_SPACE_MAX,
  ROTATIONS,
  SIZE_MAX,
  SIZE_MIN,
  TEXT_CASES,
  clampIndent,
  clampLetterSpacing,
  clampLineHeight,
  clampOpacity,
  clampParaSpace,
  clampRotation,
  clampSize,
  fontStack,
  isBrandColor,
  normalizeHex,
  stepScale,
  stepSize,
} from './rails';
import { layerBounds, type LayerMove } from './overlayModel';
import { GROUP_ALIGNMENTS, type GroupAlign } from './group';
import { FontPicker } from '../fonts/FontPicker';
import { CopyIcon, DuplicateIcon, EyedropIcon, RefreshIcon, TrashIcon, VideoIcon } from '../ui/icons';
import { ConfirmModal, cannotBeUndone } from '../ui/ConfirmModal';
import { parseVideoSource, sourceLabel } from './videoSource';

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
    /**
     * The page scrolled under us - not a list inside us.
     *
     * This listener is in the capture phase, and scroll events do reach a
     * capturing window listener from any descendant. So a panel with its own
     * scrolling region closed itself the instant you touched the wheel over it,
     * which read as "the list will not scroll". Anything inside the panel is the
     * panel's own business.
     */
    const scrolled = (e: Event) => {
      if (e.target instanceof Node && panel.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', moved);
    window.addEventListener('scroll', scrolled, true);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', moved);
      window.removeEventListener('scroll', scrolled, true);
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
            /**
             * Swallowing mousedown is what keeps the canvas selection alive while
             * you use the menu - without it, pressing a row blurs the slot being
             * formatted and the patch lands on nothing.
             *
             * So the exemptions have to be exact. A text field needs its caret. A
             * scrollbar needs its drag, and a scrollbar press is distinguishable:
             * its target is the scrolling element itself, whereas a press on a row
             * targets that row's button or one of its spans. Exempting the whole
             * scrolling *subtree* instead - which is what a `closest()` on the
             * container does - takes the rows with it, and every click in the list
             * silently stops working.
             */
            onMouseDown={(e) => {
              const t = e.target as HTMLElement;
              if (t.closest('textarea, input')) return;
              if (t.hasAttribute('data-menu-scroll')) return;
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

/**
 * Rotation and opacity for an inserted shape.
 *
 * One menu rather than two bar buttons, for the same reason spacing is one: both
 * are "how this shape sits" and neither is reached often enough to hold width in
 * a single-row bar. Angles are offered as the ones that read as deliberate, with
 * the typed box as the escape hatch; opacity steps coarsely, because the values
 * between the steps do not survive a projector.
 */
function TransformMenu({
  shape, onPatchShape,
}: {
  shape: OverlayShape;
  onPatchShape: (patch: Partial<OverlayShape>) => void;
}) {
  const rotation = shape.rotation ?? 0;
  const opacity = shape.opacity ?? 1;
  const touched = rotation !== 0 || opacity !== 1;

  return (
    <Menu title="Rotation and opacity" label="Transform" width={252} badge={touched}>
      {() => (
        <>
          <div style={{ display: 'flex', gap: 4, padding: '2px 4px 6px' }}>
            {([0, 90, 180, 270] as const).map((deg) => (
              <button
                key={deg}
                title={deg === 0 ? 'Square to the grid' : `Rotate to ${deg} degrees`}
                aria-pressed={rotation === deg}
                onClick={() => onPatchShape({ rotation: deg === 0 ? undefined : deg })}
                style={{
                  ...ctl, flex: 1, padding: 0, ...mono, fontSize: 10,
                  ...(rotation === deg ? ctlOn : { border: '1px solid var(--neutral-200)' }),
                }}
              >
                {deg}°
              </button>
            ))}
          </div>
          <StepRow
            label="Rotation"
            hint="deg"
            shown={rotation}
            format={(v) => String(Math.round(v))}
            onStep={(dir) =>
              onPatchShape({ rotation: nextRotation(rotation, dir) || undefined })
            }
            onType={(raw) => {
              const n = Number(raw.replace(/[^0-9.-]/g, ''));
              if (!Number.isFinite(n)) return;
              onPatchShape({ rotation: clampRotation(n) || undefined });
            }}
            onClear={() => onPatchShape({ rotation: undefined })}
            overridden={rotation !== 0}
          />
          <StepRow
            label="Opacity"
            hint="%"
            shown={Math.round(opacity * 100)}
            format={(v) => String(Math.round(v))}
            onStep={(dir) => {
              const next = stepScale([...OPACITIES].sort((a, b) => a - b), opacity, dir, OPACITY_MIN, OPACITY_MAX);
              onPatchShape({ opacity: next === 1 ? undefined : clampOpacity(next) });
            }}
            onType={(raw) => {
              const n = Number(raw.replace(/[^0-9.]/g, ''));
              if (!Number.isFinite(n) || n <= 0) return;
              const frac = clampOpacity(n / 100);
              onPatchShape({ opacity: frac === 1 ? undefined : frac });
            }}
            onClear={() => onPatchShape({ opacity: undefined })}
            overridden={opacity !== 1}
          />
        </>
      )}
    </Menu>
  );
}

/** Next angle along the preset list, wrapping. Kept beside the menu rather than
 *  in rails.ts because the wrap is a control behaviour, not a brand rail. */
function nextRotation(current: number, dir: 1 | -1): number {
  const sorted = [...ROTATIONS].sort((a, b) => a - b);
  const next = dir === 1
    ? sorted.find((v) => v > current)
    : [...sorted].reverse().find((v) => v < current);
  if (next !== undefined) return clampRotation(next);
  return dir === 1 ? sorted[0] : clampRotation(sorted[sorted.length - 1]);
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
      {hint && <span style={{ ...mono, fontSize: 9, color: 'var(--neutral-600)' }}>{hint}</span>}
    </button>
  );
}

// ── Text controls ───────────────────────────────────────────────────────────

/** Alt text for an image slot - a screen reader description that also
 *  becomes the picture's alt text in the exported .pptx. Commits on blur/Enter
 *  like the size stepper, so typing doesn't spam the deck's undo history. */
/**
 * Where a filled image is anchored, as a nine-point grid.
 *
 * A free drag would be more expressive and less useful: nine anchors cover the
 * cases people actually need (a face top-centre, a product bottom-right), each
 * one is a single click, and each maps exactly onto what the exporter can bake.
 */
function FocalPad({
  focal,
  onPick,
}: {
  focal?: { x: number; y: number };
  onPick: (focal: { x: number; y: number }) => void;
}) {
  const points = [0, 0.5, 1];
  const current = { x: focal?.x ?? 0.5, y: focal?.y ?? 0.5 };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, width: 96 }}>
      {points.flatMap((y) =>
        points.map((x) => {
          const on = current.x === x && current.y === y;
          return (
            <button
              key={`${x}-${y}`}
              type="button"
              title={`Anchor ${x === 0 ? 'left' : x === 1 ? 'right' : 'centre'} ${y === 0 ? 'top' : y === 1 ? 'bottom' : 'middle'}`}
              onClick={() => onPick({ x, y })}
              style={{
                height: 26, cursor: 'pointer',
                border: `1px solid ${on ? 'var(--emerald-500)' : 'var(--neutral-200)'}`,
                background: on ? 'var(--emerald-50)' : '#fff',
              }}
            />
          );
        })
      )}
    </div>
  );
}

function AltTextField({
  value, onCommit,
}: { value?: string; onCommit: (text: string) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  return (
    <input
      title="Alt text - describes this image for screen readers and in the exported file"
      aria-label="Alt text"
      placeholder="Describe this image…"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      style={{
        width: 160, height: 28, padding: '0 8px',
        fontSize: 12, color: 'var(--neutral-900)', background: '#fff',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-sharp)',
      }}
    />
  );
}

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

/** A −/value/+ row inside a menu, with a reset when the value is overridden. */
function StepRow({
  label, hint, shown, format, onStep, onType, onClear, overridden,
}: {
  label: string;
  hint?: string;
  shown?: number;
  format: (v: number) => string;
  onStep: (dir: 1 | -1) => void;
  onType: (raw: string) => void;
  onClear: () => void;
  overridden: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => { setDraft(null); }, [shown]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 4px' }}>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-700)' }}>
        {label}
        {hint && <span style={{ ...mono, fontSize: 9, color: 'var(--neutral-600)', marginLeft: 6 }}>{hint}</span>}
      </span>
      <button title={`Less ${label.toLowerCase()}`} onClick={() => onStep(-1)} style={{ ...ctl, padding: '0 6px' }}>−</button>
      <input
        aria-label={label}
        value={draft ?? (shown !== undefined ? format(shown) : '')}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => { setDraft(null); onType(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'ArrowUp') { e.preventDefault(); onStep(1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onStep(-1); }
        }}
        style={{
          width: 46, height: 26, textAlign: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600,
          color: overridden ? 'var(--emerald-700)' : 'var(--neutral-900)',
          background: '#fff',
          border: `1px solid ${overridden ? 'var(--emerald-500)' : 'var(--neutral-200)'}`,
          borderRadius: 'var(--radius-sharp)',
        }}
      />
      <button title={`More ${label.toLowerCase()}`} onClick={() => onStep(1)} style={{ ...ctl, padding: '0 6px' }}>+</button>
      <button
        title={`Reset ${label.toLowerCase()} to the template`}
        aria-label={`Reset ${label}`}
        onClick={onClear}
        disabled={!overridden}
        style={{ ...ctl, padding: '0 4px', color: overridden ? 'var(--neutral-500)' : 'var(--neutral-300)' }}
      >
        <RefreshIcon size={11} />
      </button>
    </div>
  );
}

/**
 * Leading, tracking, paragraph space, indent and bullets.
 *
 * One menu rather than five bar buttons: they're all "how the text sits" and none
 * is reached often enough to earn permanent width in a single-row bar.
 */
function SpacingMenu({
  style, effectiveLineHeight, effectiveTrackingEm, onPatch,
}: {
  style?: SlotStyle;
  effectiveLineHeight?: number;
  effectiveTrackingEm?: number;
  onPatch: (patch: Partial<SlotStyle>) => void;
}) {
  const lh = style?.lineHeight ?? effectiveLineHeight;
  const tr = style?.letterSpacing ?? effectiveTrackingEm;
  const indent = style?.indentLevel ?? 0;
  const touched =
    style?.lineHeight !== undefined || style?.letterSpacing !== undefined ||
    style?.spaceBefore !== undefined || style?.spaceAfter !== undefined ||
    style?.indentLevel !== undefined || style?.bullet !== undefined;

  return (
    <Menu title="Line height, tracking, paragraph space and bullets" label="Spacing" width={266} badge={touched}>
      {() => (
        <>
          <div style={{ ...mono, color: 'var(--neutral-600)', padding: '2px 4px 4px' }}>Line</div>
          <StepRow
            label="Line height"
            shown={lh}
            format={(v) => v.toFixed(2).replace(/0$/, '')}
            overridden={style?.lineHeight !== undefined}
            onStep={(dir) => onPatch({ lineHeight: clampLineHeight(stepScale(LINE_HEIGHTS, lh ?? 1.2, dir, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX)) })}
            onType={(raw) => { const n = parseFloat(raw); if (Number.isFinite(n)) onPatch({ lineHeight: clampLineHeight(n) }); }}
            onClear={() => onPatch({ lineHeight: undefined })}
          />
          <StepRow
            label="Letter spacing"
            hint="em"
            shown={tr}
            format={(v) => (v === 0 ? '0' : v.toFixed(3).replace(/0+$/, ''))}
            overridden={style?.letterSpacing !== undefined}
            onStep={(dir) => onPatch({ letterSpacing: clampLetterSpacing(stepScale(LETTER_SPACINGS, tr ?? 0, dir, LETTER_SPACING_MIN, LETTER_SPACING_MAX)) })}
            onType={(raw) => { const n = parseFloat(raw); if (Number.isFinite(n)) onPatch({ letterSpacing: clampLetterSpacing(n) }); }}
            onClear={() => onPatch({ letterSpacing: undefined })}
          />

          <div style={{ height: 1, background: 'var(--neutral-200)', margin: '8px 4px' }} />
          <div style={{ ...mono, color: 'var(--neutral-600)', padding: '2px 4px 4px' }}>Paragraph</div>
          <StepRow
            label="Space before"
            hint="px"
            shown={style?.spaceBefore ?? 0}
            format={(v) => String(v)}
            overridden={style?.spaceBefore !== undefined}
            onStep={(dir) => onPatch({ spaceBefore: clampParaSpace(stepScale(PARA_SPACES, style?.spaceBefore ?? 0, dir, 0, PARA_SPACE_MAX)) })}
            onType={(raw) => { const n = parseFloat(raw); if (Number.isFinite(n)) onPatch({ spaceBefore: clampParaSpace(n) }); }}
            onClear={() => onPatch({ spaceBefore: undefined })}
          />
          <StepRow
            label="Space after"
            hint="px"
            shown={style?.spaceAfter ?? 0}
            format={(v) => String(v)}
            overridden={style?.spaceAfter !== undefined}
            onStep={(dir) => onPatch({ spaceAfter: clampParaSpace(stepScale(PARA_SPACES, style?.spaceAfter ?? 0, dir, 0, PARA_SPACE_MAX)) })}
            onType={(raw) => { const n = parseFloat(raw); if (Number.isFinite(n)) onPatch({ spaceAfter: clampParaSpace(n) }); }}
            onClear={() => onPatch({ spaceAfter: undefined })}
          />

          <div style={{ height: 1, background: 'var(--neutral-200)', margin: '8px 4px' }} />
          <div style={{ ...mono, color: 'var(--neutral-600)', padding: '2px 4px 4px' }}>List</div>
          <StepRow
            label="Indent"
            hint={`${INDENT_STEP_PX}px steps`}
            shown={indent}
            format={(v) => String(v)}
            overridden={style?.indentLevel !== undefined}
            onStep={(dir) => {
              const next = clampIndent(indent + dir);
              onPatch({ indentLevel: next === 0 ? undefined : next });
            }}
            onType={(raw) => { const n = parseFloat(raw); if (Number.isFinite(n)) { const v = clampIndent(n); onPatch({ indentLevel: v === 0 ? undefined : v }); } }}
            onClear={() => onPatch({ indentLevel: undefined })}
          />
          <Row
            label="Bulleted"
            hint={style?.bullet ? 'on' : undefined}
            active={!!style?.bullet}
            onClick={() => onPatch({ bullet: style?.bullet ? undefined : true })}
          />
        </>
      )}
    </Menu>
  );
}

/** Case shown, without changing what was typed. */
function CaseMenu({
  style, onPatch,
}: { style?: SlotStyle; onPatch: (patch: Partial<SlotStyle>) => void }) {
  return (
    <Menu
      title="Letter case"
      label=""
      width={186}
      active={!!style?.textCase}
      icon={<span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '-0.02em' }}>Aa</span>}
    >
      {(close) => (
        <>
          {TEXT_CASES.map((c) => (
            <Row
              key={c.key}
              label={c.label}
              active={style?.textCase === c.key}
              onClick={() => { onPatch({ textCase: style?.textCase === c.key ? undefined : c.key }); close(); }}
            />
          ))}
          <div style={{ height: 1, background: 'var(--neutral-200)', margin: '6px 4px' }} />
          <Row label="As typed" active={!style?.textCase} onClick={() => { onPatch({ textCase: undefined }); close(); }} />
        </>
      )}
    </Menu>
  );
}

/**
 * The swatch grid, hex input and eyedropper, with no `Menu` of its own -
 * `ColorMenu` wraps this in one for its usual toolbar-button-with-dropdown
 * look, but a caller that's already inside another `Menu`'s panel (the
 * Background control) embeds this directly instead. Nesting a `Menu` inside
 * a `Menu`'s panel doesn't work: `Menu` detects outside clicks via a
 * document-level `mousedown` listener that only recognises its own `wrap`/
 * `panel` refs, and a second, separately-portalled `Menu` inside the first
 * is neither - so the outer one reads a click inside the inner one as
 * "outside" and closes itself on `mousedown`, unmounting the inner menu
 * before its `onClick` ever fires. Embedding the picker flat sidesteps that
 * entirely: one panel, one set of refs, no race.
 */
function ColorPickerBody({
  value, onDark, onPick, noneLabel = 'Template colour', paletteLabel = 'Brand palette',
  noneSwatch, close,
}: {
  value?: string; onDark?: boolean; onPick: (hex: string | undefined) => void;
  noneLabel?: string; paletteLabel?: string; noneSwatch?: boolean;
  /** Omit when embedded flat in a panel that isn't itself a `Menu` - there's
   *  nothing of its own to close. */
  close?: () => void;
}) {
  const [hex, setHex] = useState('');
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const neutrals = onDark ? [...NEUTRAL_SWATCHES].reverse() : NEUTRAL_SWATCHES;
  const custom = !!value && !isBrandColor(value);

  /** Every path that sets a colour goes through here, so the memory can't
   *  miss one (palette chip, typed hex, or eyedropper). */
  const pick = (h: string) => {
    onPick(h);
    setRecent(pushRecent(h));
    close?.();
  };

  const chip = (h: string, label: string, light?: boolean) => {
    const on = value?.toUpperCase() === h.toUpperCase();
    return (
      <button
        key={h}
        title={label}
        aria-label={label}
        onClick={() => pick(h)}
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
    <>
      <div style={{ ...mono, color: 'var(--neutral-600)', padding: '2px 4px 8px' }}>{paletteLabel}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 2px' }}>
        {noneSwatch && (
          <button
            title={noneLabel}
            aria-label={noneLabel}
            onClick={() => { onPick(undefined); close?.(); }}
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
        {neutrals.map((s) => chip(s.hex, s.label, s.light))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, padding: '0 2px' }}>
        {ACCENT_SWATCHES.map((s) => chip(s.hex, s.label, false))}
      </div>
      {/* Colours this deck has actually used, most recent first. */}
      {recent.length > 0 && (
        <>
          <div style={{ ...mono, color: 'var(--neutral-600)', padding: '12px 4px 6px' }}>Recent</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 2px' }}>
            {recent.map((h) => chip(h, `#${h}`, false))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center', padding: '0 2px' }}>
        <span style={{ color: 'var(--neutral-600)', fontSize: 12 }}>#</span>
        <input
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const h = normalizeHex(hex);
            if (h) { pick(h); setHex(''); }
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
                if (h) pick(h);
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
          <Row label={noneLabel} onClick={() => { onPick(undefined); close?.(); }} />
        </div>
      )}
    </>
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
        <ColorPickerBody
          value={value} onDark={onDark} onPick={onPick}
          noneLabel={noneLabel} paletteLabel={paletteLabel} noneSwatch={noneSwatch}
          close={close}
        />
      )}
    </Menu>
  );
}

/**
 * Per-slide background: solid colour, gradient, an uploaded image, or removed
 * back to plain white. Only rendered by the caller when the active slide's
 * template supports a custom background (see `canCustomizeBackground` in
 * `slideBackground.ts`) - controls that cannot apply are absent, not disabled.
 */
const BACKGROUND_TABS = [
  { id: 'color' as const, label: 'Colour' },
  { id: 'gradient' as const, label: 'Gradient' },
  { id: 'image' as const, label: 'Image' },
];

function BackgroundMenu({
  background, onSetBackground,
}: {
  background?: SlideBackground;
  onSetBackground: (bg: SlideBackground | undefined) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const kind = background?.kind;
  const [tab, setTab] = useState<'color' | 'gradient' | 'image'>(
    kind === 'gradient' ? 'gradient' : kind === 'image' ? 'image' : 'color'
  );

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onSetBackground({ kind: 'image', imageUrl: dataUrl });
    } catch {
      /* ignore unreadable file */
    } finally {
      setUploading(false);
    }
  };

  return (
    <Menu
      title="Slide background"
      label="Background"
      width={240}
      active={!!background}
      icon={
        <span
          style={{
            width: 15, height: 15, flexShrink: 0, borderRadius: 2,
            border: '1px solid var(--neutral-300)',
            background:
              kind === 'color' ? `#${background?.color ?? 'FFFFFF'}`
              : kind === 'gradient' ? `linear-gradient(135deg, #${background?.gradientFrom ?? 'FFFFFF'}, #${background?.gradientTo ?? '10B981'})`
              : kind === 'image' && background?.imageUrl ? `center / cover url(${background.imageUrl})`
              : 'linear-gradient(135deg,#fff 50%,#10B981 50%)',
          }}
        />
      }
    >
      {() => (
        <>
          <div style={{ display: 'flex', gap: 4, padding: '0 0 8px' }}>
            {BACKGROUND_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  ...ctl, flex: 1, padding: '0 4px', fontSize: 11.5,
                  ...(tab === t.id ? ctlOn : { border: '1px solid var(--neutral-200)' }),
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'color' && (
            <ColorPickerBody
              paletteLabel="Background colour"
              value={background?.color}
              onPick={(hex) => onSetBackground(hex ? { kind: 'color', color: hex } : undefined)}
            />
          )}

          {tab === 'gradient' && (
            <>
              <div style={{ ...mono, color: 'var(--neutral-600)', padding: '2px 4px 6px' }}>Start</div>
              <ColorPickerBody
                value={background?.gradientFrom}
                onPick={(hex) =>
                  onSetBackground({
                    kind: 'gradient',
                    gradientFrom: hex ?? background?.gradientFrom ?? 'FFFFFF',
                    gradientTo: background?.gradientTo ?? '10B981',
                    gradientAngle: background?.gradientAngle,
                  })
                }
              />
              <div style={{ ...mono, color: 'var(--neutral-600)', padding: '12px 4px 6px' }}>End</div>
              <ColorPickerBody
                value={background?.gradientTo}
                onPick={(hex) =>
                  onSetBackground({
                    kind: 'gradient',
                    gradientFrom: background?.gradientFrom ?? 'FFFFFF',
                    gradientTo: hex ?? background?.gradientTo ?? '10B981',
                    gradientAngle: background?.gradientAngle,
                  })
                }
              />
            </>
          )}

          {tab === 'image' && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
              />
              <Row
                label={uploading ? 'Uploading…' : kind === 'image' ? 'Replace image' : 'Upload image'}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              />
            </>
          )}

          <div style={{ height: 1, background: 'var(--neutral-200)', margin: '10px 4px' }} />
          {kind !== 'none' && (
            <Row label="Remove background" onClick={() => onSetBackground({ kind: 'none' })} />
          )}
          {background && (
            <Row label="Reset to template default" onClick={() => onSetBackground(undefined)} />
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
  effectiveLineHeight?: number;
  effectiveTrackingEm?: number;
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

  /** Video-specific controls, when the selected shape is kind==='video'. */
  onPickVideo?: (id: string) => void;
  onPatchShape?: (patch: Partial<OverlayShape>) => void;

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
  onCopyShape?: () => void;
  onDuplicateShape?: () => void;

  /** Per-slide background override. Present only on templates that support it
   *  (see `canCustomizeBackground` in slideBackground.ts) - the control itself
   *  is absent, not disabled, everywhere else. */
  showBackgroundControl?: boolean;
  background?: SlideBackground;
  onSetBackground?: (bg: SlideBackground | undefined) => void;
}

export function EditToolbar({
  textStyle,
  effectiveSizePx,
  effectiveLineHeight,
  effectiveTrackingEm,
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
  onPickVideo,
  onPatchShape,
  importedShape,
  isImportedSelection,
  importedShapeGroupCount,
  onAlignShapes,
  onDeleteImportedShape,
  onSetImportedFill,
  onSetImportedLine,
  onCopyShape,
  onDuplicateShape,
  showBackgroundControl,
  background,
  onSetBackground,
}: EditToolbarProps) {
  // A pending shape/text-box deletion awaiting confirmation. Five delete
  // buttons in this bar share one modal - each just stashes its own label and
  // the underlying no-arg callback to run on confirm.
  const [pendingDelete, setPendingDelete] = useState<{ title: string; message: string; action: () => void } | null>(null);
  const bounds = selectedShape ? layerBounds(shapes, selectedShape.id) : null;
  const shown = textStyle?.sizePx ?? effectiveSizePx;
  /**
   * The typeface to name, by the same rule as the size.
   *
   * `fontName` is read off the DOM when the slot is selected, so it is the
   * *template's* face and never changes again while the selection is held. The
   * override is the newer fact. Without preferring it, picking a font applied to
   * the slide but left the toolbar and the menu's checkmark insisting on the old
   * one - which reads as the choice not having worked at all.
   */
  const shownFont = textStyle?.fontFamily ?? fontName;
  const grouped = selectedSlotCount > 1;
  const isFillable = selectedShape && (selectedShape.kind === 'rect' || selectedShape.kind === 'ellipse');
  /** The kinds PowerPoint can carry a rotation and a transparency on, which is
   *  also the set worth rotating: a panel, an ellipse, a photo, a caption. */
  const canTransform =
    !!selectedShape &&
    !!onPatchShape &&
    (selectedShape.kind === 'rect' ||
      selectedShape.kind === 'ellipse' ||
      selectedShape.kind === 'image' ||
      selectedShape.kind === 'text');
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
        maxWidth: 'var(--toolbar-max-w)',
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

      {/* Slide-level, not selection-scoped - shown regardless of what's
          selected below, unlike everything in the contextual middle. */}
      {showBackgroundControl && onSetBackground && (
        <>
          <BackgroundMenu background={background} onSetBackground={onSetBackground} />
          <Sep />
        </>
      )}

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
              // Wide enough for a search field, the category chips and a family
              // name with its role tag on one line.
              width={330}
              active={!!textStyle?.fontFamily}
              icon={
                <span
                  style={{
                    fontFamily: shownFont ? fontStack(shownFont) : 'var(--font-sans)',
                    fontSize: 12,
                    maxWidth: 116, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {shownFont ?? fieldLabel}
                </span>
              }
            >
              {(close) => (
                <FontPicker
                  current={shownFont}
                  hasOverride={!!textStyle?.fontFamily}
                  onPick={(family) => onPatch({ fontFamily: family })}
                  onReset={() => onPatch({ fontFamily: undefined })}
                  close={close}
                />
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

          <CaseMenu style={textStyle} onPatch={onPatch} />

          <SpacingMenu
            style={textStyle}
            effectiveLineHeight={effectiveLineHeight}
            effectiveTrackingEm={effectiveTrackingEm}
            onPatch={onPatch}
          />

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
                  <div style={{ ...mono, fontSize: 9, color: 'var(--neutral-600)', padding: '8px 6px 2px', letterSpacing: '0.08em', textTransform: 'none', lineHeight: 1.5 }}>
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

          {/* An inserted text box is a shape as well as text, so it gets the
              transform controls here - this branch is the only one it reaches.
              A template slot has no rotation of its own (it is positioned by its
              renderer), so `selectedShape` is undefined and this stays absent. */}
          {canTransform && (
            <>
              <Sep />
              <TransformMenu shape={selectedShape!} onPatchShape={onPatchShape!} />
            </>
          )}

          {isImportedSelection && (
            <button
              title="Delete this text box"
              aria-label="Delete text box"
              onClick={() => setPendingDelete({
                title: 'Delete this text box?',
                message: cannotBeUndone('This text box and everything typed in it will be removed from the slide.'),
                action: onDeleteImportedShape,
              })}
              style={{ ...ctl, padding: '0 7px', color: '#dc2626' }}>
              <TrashIcon size={13} />
            </button>
          )}

          {/* Formatting a table cell still needs the table's own delete
              button - the shape-controls branch below is skipped entirely
              while a cell is the text target. */}
          {selectedShape?.kind === 'table' && (
            <button
              title="Delete this table"
              aria-label="Delete table"
              onClick={() => setPendingDelete({
                title: 'Delete this table?',
                message: cannotBeUndone('This table, along with its rows and content, will be removed from the slide.'),
                action: onDeleteShape,
              })}
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

          {selectedShape.kind === 'image' && (
            <>
              {/* Fit or fill, and where the picture is anchored while it fills.
                  This is the difference between a portrait letterboxed in grey
                  and a portrait filling the frame with the face still in it. */}
              <Menu
                label={selectedShape.fit === 'cover' ? 'Fill' : 'Fit'}
                title="How the picture meets its box"
                width={216}
              >
                {(close) => (
                  <>
                    <Row
                      label="Fit inside the box"
                      active={selectedShape.fit !== 'cover'}
                      onClick={() => { onPatchShape?.({ fit: undefined, focal: undefined }); close(); }}
                    />
                    <Row
                      label="Fill the box, crop the rest"
                      active={selectedShape.fit === 'cover'}
                      onClick={() => { onPatchShape?.({ fit: 'cover' }); close(); }}
                    />
                    {selectedShape.fit === 'cover' && (
                      <div style={{ padding: '8px 4px 4px' }}>
                        <div style={{ ...mono, color: 'var(--neutral-600)', marginBottom: 6 }}>
                          Keep in frame
                        </div>
                        <FocalPad
                          focal={selectedShape.focal}
                          onPick={(focal) => onPatchShape?.({ focal })}
                        />
                      </div>
                    )}
                  </>
                )}
              </Menu>
              <AltTextField
                value={selectedShape.altText}
                onCommit={(text) => onPatchShape?.({ altText: text.trim() || undefined })}
              />
              <Sep />
            </>
          )}

          {selectedShape.kind === 'video' && (
            <>
              <button
                title="Choose the video: a link, or a file from disk"
                onClick={() => onPickVideo?.(selectedShape.id)}
                style={{ ...ctl, padding: '0 8px' }}
              >
                <VideoIcon size={14} />
                {selectedShape.videoUrl || selectedShape.videoAssetId ? 'Replace' : 'Add video'}
              </button>
              <span style={{ ...mono, fontSize: 9.5, color: 'var(--neutral-600)', maxWidth: 132, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedShape.videoName ?? sourceLabel(parseVideoSource(selectedShape.videoUrl))}
              </span>
              {([
                ['autoplay', 'Autoplay', 'Play as soon as the slide appears'],
                ['loop', 'Loop', 'Restart when it ends'],
                ['muted', 'Mute', 'Play without sound'],
              ] as const).map(([key, label, title]) => (
                <button
                  key={key}
                  title={title}
                  aria-pressed={!!selectedShape[key]}
                  onClick={() => onPatchShape?.({ [key]: selectedShape[key] ? undefined : true })}
                  style={{ ...ctl, padding: '0 8px', ...(selectedShape[key] ? ctlOn : {}) }}
                >
                  {label}
                </button>
              ))}
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

          {/* Rotation and opacity, for the kinds where they mean something. A
              rotated table or chart is exotic enough that offering it would cost
              every user width to serve almost none, and PowerPoint cannot carry
              either one on a table anyway - so the control is absent there
              rather than present and quietly lost on export. */}
          {canTransform && <TransformMenu shape={selectedShape} onPatchShape={onPatchShape!} />}

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
                <div style={{ ...mono, fontSize: 9, color: 'var(--neutral-600)', padding: '6px 6px 2px', letterSpacing: '0.08em', textTransform: 'none', lineHeight: 1.5 }}>
                  {bounds && `Layer ${bounds.index + 1} of ${bounds.total}`}
                  {selectedShape.behind ? ' · behind the slide’s own text' : ''}
                </div>
              </>
            )}
          </Menu>

          {onCopyShape && (
            <button
              title="Copy shape (⌘C)"
              aria-label="Copy shape"
              onClick={onCopyShape}
              style={{ ...ctl, padding: '0 8px', gap: 4 }}
            >
              <CopyIcon size={13} />
              Copy
            </button>
          )}

          {onDuplicateShape && (
            <button
              title="Duplicate shape (⌘D)"
              aria-label="Duplicate shape"
              onClick={onDuplicateShape}
              style={{ ...ctl, padding: '0 8px', gap: 4 }}
            >
              <DuplicateIcon size={13} />
              Duplicate
            </button>
          )}

          <button
            title="Delete this shape"
            aria-label="Delete shape"
            onClick={() => setPendingDelete({
              title: 'Delete this shape?',
              message: cannotBeUndone('This shape will be removed from the slide.'),
              action: onDeleteShape,
            })}
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
                <div style={{ ...mono, color: 'var(--neutral-600)', padding: '2px 4px 6px' }}>Horizontal</div>
                <Row label="Left" onClick={() => { onAlignShapes('left'); close(); }} />
                <Row label="Centre" onClick={() => { onAlignShapes('centerX'); close(); }} />
                <Row label="Right" onClick={() => { onAlignShapes('right'); close(); }} />
                <div style={{ height: 1, background: 'var(--neutral-200)', margin: '8px 4px' }} />
                <div style={{ ...mono, color: 'var(--neutral-600)', padding: '2px 4px 6px' }}>Vertical</div>
                <Row label="Top" onClick={() => { onAlignShapes('top'); close(); }} />
                <Row label="Middle" onClick={() => { onAlignShapes('centerY'); close(); }} />
                <Row label="Bottom" onClick={() => { onAlignShapes('bottom'); close(); }} />
              </>
            )}
          </Menu>

          <button
            title="Delete selected shapes"
            aria-label="Delete selected shapes"
            onClick={() => setPendingDelete({
              title: `Delete ${importedShapeGroupCount} shapes?`,
              message: cannotBeUndone(`These ${importedShapeGroupCount} shapes will be removed from the slide.`),
              action: onDeleteImportedShape,
            })}
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
              <span style={{ ...mono, fontSize: 10, color: 'var(--neutral-600)', minWidth: 14, textAlign: 'center' }}>
                {importedShape.line.widthPx}
              </span>
              <button title="Thicker stroke" aria-label="Thicker stroke"
                onClick={() => onSetImportedLine({ color: importedShape.line!.color, widthPx: Math.min(12, importedShape.line!.widthPx + 1) })}
                style={{ ...ctl, padding: '0 6px' }}>+</button>
            </span>
          )}

          <Sep />

          <button
            title="Delete this shape"
            aria-label="Delete shape"
            onClick={() => setPendingDelete({
              title: 'Delete this shape?',
              message: cannotBeUndone('This shape will be removed from the slide.'),
              action: onDeleteImportedShape,
            })}
            style={{ ...ctl, padding: '0 7px', color: '#dc2626' }}>
            <TrashIcon size={13} />
          </button>
        </>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}>
          Click any text to format it · shift-click to add more
        </span>
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        title={pendingDelete?.title ?? 'Delete this?'}
        message={pendingDelete?.message ?? ''}
        onConfirm={() => {
          pendingDelete?.action();
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
