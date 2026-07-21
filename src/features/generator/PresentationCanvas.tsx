import { useEffect, useRef, useState } from 'react';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck, SlideContent, SlideInstance } from '../deck/types';
import { autoFitHeadingFontSize, autoFitBodyFontSize } from './autoFit';

interface PresentationCanvasProps {
  ast: DocumentNode | null;
  deck: Deck;
  /** Edit mode: text slots become contentEditable and commit via onEditSlide. */
  editing: boolean;
  onEditSlide: (instanceId: string, updater: (content: SlideContent) => SlideContent) => void;
  /** Set/clear the deck-level client logo (edit mode). */
  onLogoChange?: (dataUrl: string | undefined) => void;
  /** Enter edit mode (used so a click on an empty blank-slide field can jump
   *  straight into editing instead of requiring a separate "Edit Content" click). */
  onRequestEdit?: () => void;
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
  /** DOM id of this slide's wrapper - lets a renderer target its own fields. */
  instanceId?: string;
  /** Enter edit mode from a view-mode click (see SlideBlank). */
  onRequestEdit?: () => void;
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
}

/** Renders plain text normally; in edit mode becomes a contentEditable span
 *  that commits on blur. Committing an empty string signals "revert to the
 *  template placeholder" (callers map '' → undefined). */
function E({ value, editing, onCommit, multiline, dataField, onActivate }: EditableProps) {
  if (!editing) {
    if (!onActivate) return <>{value}</>;
    return (
      <span onClick={onActivate} style={{ cursor: 'text' }}>
        {value}
      </span>
    );
  }
  return (
    <span
      data-editable
      data-field={dataField}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      title="Press Esc to revert this field"
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
            onClick={onDeleteContainer}
            title="Remove this image area entirely"
            style={{ ...btn, background: 'rgba(220,38,38,0.92)', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete Container
          </button>
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
        fontSize: 12,
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

/** Editorial eyebrow label with leading rule (uses accent colour) */
function EditorialLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
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
}

/** Subtle edit-only warning that a text slot's font was auto-shrunk below its
 *  full size to keep from overflowing - a nudge toward more concise copy.
 *  Never renders in view mode, so it can't leak into an export screenshot. */
function FitHint({ editing, shrunk }: { editing: boolean; shrunk: boolean }) {
  if (!editing || !shrunk) return null;
  return (
    <span
      title="This text was auto-shrunk to fit its slot - consider trimming it for a cleaner slide"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        marginLeft: 14,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: '#b45309',
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: 'var(--radius-sharp)',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      Auto-fit
    </span>
  );
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

/** Client logo slot; deck-level `logoUrl` (seeded from the Business Record's
 *  optional `logo` frontmatter). In edit mode the slot becomes click-to-upload
 *  with a remove control, so users can set the brand logo without a URL. */
function Logo({
  src,
  editing,
  onChange,
  style,
}: {
  src?: string;
  editing?: boolean;
  onChange?: (dataUrl: string | undefined) => void;
  style?: React.CSSProperties;
}) {
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
    border: '1.5px dashed rgba(120,120,135,0.6)', borderRadius: 'var(--radius-sharp)',
    fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: 'rgba(90,90,105,0.9)', whiteSpace: 'nowrap',
  };

  if (!editing) {
    return src ? (
      <img src={src} alt="Client logo" style={{ height: 40, width: 'auto', objectFit: 'contain', zIndex: 10, ...style }} />
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
          ? <img src={src} alt="Client logo" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
          : <>{uploadIcon}Upload Logo</>}
      </div>
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

function SlideCover({ ast, content, editing, onEdit, logoUrl, onLogoChange }: SlideRenderProps) {
  const lines = content.headingLines ?? ['Master Primary', 'Heading.'];
  const HERO_MAX = 180;
  // Auto-fit the hero: shrink the font and tighten the top padding for longer
  // titles so the headline never overflows the fixed 1080px slide and keeps a
  // clean bottom gap. Short titles keep the full 180px display size.
  const heroFont = autoFitHeadingFontSize(lines.join('\n'), { min: 72, max: HERO_MAX, widthBudget: 1640, heightBudget: 620 });
  const heroTopPad = lines.length >= 4 ? 160 : lines.length === 3 ? 210 : 280;
  return (
    <>
      <SlideGrid />
      <Glow style={{ top: -300, right: -300 }} />
      <HudTop
        label={
          <E
            value={content.projectLabel ?? 'Project Name Placeholder'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
          />
        }
        num={
          <E
            value={content.versionLabel ?? 'YYYY // Version 0.0'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, versionLabel: v || undefined }))}
          />
        }
      />
      {/* Top padding adapts to the number of hero lines so long titles fit cleanly. */}
      <div style={{ padding: `${heroTopPad}px 140px`, position: 'relative', zIndex: 10 }}>
        <EditorialLabel>
          <E
            value={content.eyebrow ?? 'Presentation Subtitle'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
          <FitHint editing={editing} shrunk={heroFont < HERO_MAX} />
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
                  <span style={{ color: 'var(--neutral-300)' }}>{line}</span>
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
            <E
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
          fontSize: 11,
          color: 'var(--neutral-400)',
          zIndex: 10,
        }}
      >
        <span>PROPRIETARY AND CONFIDENTIAL</span>
        <Logo src={logoUrl} editing={editing} onChange={onLogoChange} />
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
          <E
            value={content.hudLabel ?? 'Agenda'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', display: 'flex', gap: 140, position: 'relative', zIndex: 10 }}>
        {(() => {
          const INDEX_HEADING_MAX = 100;
          const indexHeadingFont = autoFitHeadingFontSize(content.heading ?? 'Presentation\nStructure.', {
            min: 44,
            max: INDEX_HEADING_MAX,
            widthBudget: 560,
            heightBudget: 480,
          });
          return (
            <div style={{ flex: 1 }}>
              <EditorialLabel>
                Navigation
                <FitHint editing={editing} shrunk={indexHeadingFont < INDEX_HEADING_MAX} />
              </EditorialLabel>
              <h2
                style={{
                  ...DISPLAY_HEADING_BASE,
                  fontSize: indexHeadingFont,
                  fontWeight: 600,
                  marginBottom: 60,
                  color: 'var(--neutral-900)',
                  whiteSpace: 'pre-line',
                }}
              >
                <E
                  value={content.heading ?? 'Presentation\nStructure.'}
                  editing={editing}
                  multiline
                  onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
                />
              </h2>
            </div>
          );
        })()}
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
                    value={part.title}
                    editing={editing}
                    onCommit={(v) => editPart(i, { title: v || part.title })}
                  />
                </h4>
                <p style={{ fontSize: 18, color: 'var(--neutral-500)', lineHeight: 1.5 }}>
                  <E
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
  const HEADING_MAX = 100;
  const BODY_MAX = 32;
  const METRIC_MAX = 56;
  const headingText = content.heading ?? 'Core Strategic\nObjective.';
  const bodyText = content.body ?? PLACEHOLDER;
  const metricTextValue = content.metricText ?? '00.0%';
  const headingFont = autoFitHeadingFontSize(headingText, { min: 56, max: HEADING_MAX, widthBudget: 1640, heightBudget: 280 });
  const bodyFont = autoFitBodyFontSize(bodyText, { min: 20, max: BODY_MAX, widthBudget: 887, maxLines: 6 });
  const metricFont = autoFitHeadingFontSize(metricTextValue, { min: 32, max: METRIC_MAX, widthBudget: 633, heightBudget: 160 });
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E
            value={content.hudLabel ?? 'Executive Summary'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>
          <E
            value={content.eyebrow ?? 'Executive Summary'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
          <FitHint editing={editing} shrunk={headingFont < HEADING_MAX} />
        </EditorialLabel>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: headingFont,
            fontWeight: 600,
            marginBottom: 48,
            color: 'var(--neutral-900)',
            whiteSpace: 'pre-line',
          }}
        >
          <E
            value={headingText}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 120 }}>
          <p style={{ fontSize: bodyFont, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line' }}>
            <E
              value={bodyText}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
            <FitHint editing={editing} shrunk={bodyFont < BODY_MAX} />
          </p>
          <div
            style={{
              borderLeft: '1px solid var(--neutral-200)',
              paddingLeft: 66,
              alignSelf: 'center',
            }}
          >
            <EditorialLabel>
              <E
                value={content.metricLabel ?? 'Variable Metric'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, metricLabel: v || undefined }))}
              />
              <FitHint editing={editing} shrunk={metricFont < METRIC_MAX} />
            </EditorialLabel>
            <p
              style={{
                ...DISPLAY_HEADING_BASE,
                fontSize: metricFont,
                fontWeight: 700,
                lineHeight: 1.1,
                color: 'var(--neutral-900)',
                whiteSpace: 'pre-line',
                margin: '18px 0 24px',
              }}
            >
              <E
                value={metricTextValue}
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

function SlideSectionDivider({ ast, content, num, editing, onEdit, logoUrl, onLogoChange }: SlideRenderProps) {
  const HEADING_MAX = 180;
  const SUBTITLE_MAX = 30;
  const headingText = content.heading ?? 'Section Title.';
  const subtitleText = content.subtitle ?? PLACEHOLDER;
  const headingFont = autoFitHeadingFontSize(headingText, { min: 90, max: HEADING_MAX, widthBudget: 1620, heightBudget: 260 });
  const subtitleFont = autoFitBodyFontSize(subtitleText, { min: 18, max: SUBTITLE_MAX, widthBudget: 960, maxLines: 4 });
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
          fontSize: 15,
          letterSpacing: '0.2em',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        <E
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
        <EditorialLabel style={{ color: 'var(--emerald-500)' }}>
          <E
            value={content.eyebrow ?? 'Part 02'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
          <FitHint editing={editing} shrunk={headingFont < HEADING_MAX} />
        </EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: headingFont,
            fontWeight: 700,
            color: '#ffffff',
            margin: '42px 0 48px',
          }}
        >
          <E
            value={headingText}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: subtitleFont,
            lineHeight: 1.5,
            maxWidth: 960,
            margin: 0,
          }}
        >
          <E
            value={subtitleText}
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
  const COL_HEADING_MAX = 72;
  const COL_BODY_MAX = 32;
  const leftHeadingText = content.leftHeading ?? 'Current State\nEnvironment.';
  const leftBodyText = content.leftBody ?? PLACEHOLDER;
  const rightHeadingText = content.rightHeading ?? 'Strategic Pivot\nTarget State.';
  const rightBodyText = content.rightBody ?? PLACEHOLDER;
  const leftHeadingFont = autoFitHeadingFontSize(leftHeadingText, { min: 40, max: COL_HEADING_MAX, widthBudget: 680, heightBudget: 220 });
  const leftBodyFont = autoFitBodyFontSize(leftBodyText, { min: 18, max: COL_BODY_MAX, widthBudget: 680, maxLines: 5 });
  const rightHeadingFont = autoFitHeadingFontSize(rightHeadingText, { min: 40, max: COL_HEADING_MAX, widthBudget: 680, heightBudget: 220 });
  const rightBodyFont = autoFitBodyFontSize(rightBodyText, { min: 18, max: COL_BODY_MAX, widthBudget: 680, maxLines: 5 });
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E
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
          <EditorialLabel>
            <E
              value={content.leftLabel ?? 'Condition A'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, leftLabel: v || undefined }))}
            />
            <FitHint editing={editing} shrunk={leftHeadingFont < COL_HEADING_MAX} />
          </EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: leftHeadingFont,
              fontWeight: 600,
              marginBottom: 40,
              color: 'var(--neutral-900)',
              whiteSpace: 'pre-line',
            }}
          >
            <E
              value={leftHeadingText}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, leftHeading: v || undefined }))}
            />
          </h2>
          <p style={{ fontSize: leftBodyFont, lineHeight: 1.5, color: 'var(--neutral-500)', marginBottom: 40, whiteSpace: 'pre-line' }}>
            <E
              value={leftBodyText}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, leftBody: v || undefined }))}
            />
            <FitHint editing={editing} shrunk={leftBodyFont < COL_BODY_MAX} />
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
                <E value={attr} editing={editing} onCommit={(v) => editAttribute(i, v)} />
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
          <EditorialLabel>
            <E
              value={content.rightLabel ?? 'Condition B'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, rightLabel: v || undefined }))}
            />
            <FitHint editing={editing} shrunk={rightHeadingFont < COL_HEADING_MAX} />
          </EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: rightHeadingFont,
              fontWeight: 600,
              marginBottom: 40,
              color: 'var(--neutral-900)',
              whiteSpace: 'pre-line',
            }}
          >
            <E
              value={rightHeadingText}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, rightHeading: v || undefined }))}
            />
          </h2>
          <p style={{ fontSize: rightBodyFont, lineHeight: 1.5, color: 'var(--neutral-900)', whiteSpace: 'pre-line' }}>
            <E
              value={rightBodyText}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, rightBody: v || undefined }))}
            />
            <FitHint editing={editing} shrunk={rightBodyFont < COL_BODY_MAX} />
          </p>
        </div>
      </div>
    </>
  );
}

function SlideDataMonument({ content, num, editing, onEdit }: SlideRenderProps) {
  const VALUE_MAX = 420;
  const HEADING_MAX = 64;
  const BODY_MAX = 32;
  const valueText = content.value ?? '000.0';
  const headingText = content.heading ?? 'Primary Performance Variable Title.';
  const bodyText = content.body ?? PLACEHOLDER;
  const valueFont = autoFitHeadingFontSize(valueText, { min: 220, max: VALUE_MAX, widthBudget: 1500, heightBudget: 420, charWidthRatio: 0.62 });
  const headingFont = autoFitHeadingFontSize(headingText, { min: 32, max: HEADING_MAX, widthBudget: 1500, heightBudget: 100 });
  const bodyFont = autoFitBodyFontSize(bodyText, { min: 18, max: BODY_MAX, widthBudget: 800, maxLines: 5 });
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
        <div style={{ marginTop: -100 }}>
          <EditorialLabel>
            <E
              value={content.eyebrow ?? 'Performance Metric'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
            <FitHint editing={editing} shrunk={valueFont < VALUE_MAX || headingFont < HEADING_MAX} />
          </EditorialLabel>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: valueFont,
              fontWeight: 700,
              lineHeight: 0.8,
              letterSpacing: '-0.07em',
              display: 'flex',
              alignItems: 'baseline',
              color: 'var(--neutral-900)',
            }}
          >
            <E
              value={valueText}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, value: v || undefined }))}
            />
            <span style={{ color: 'var(--emerald-500)', fontSize: '0.3em', marginLeft: 10 }}>
              <E
                value={content.unit ?? 'M'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, unit: v || undefined }))}
              />
            </span>
          </div>
        </div>
        <h3
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: headingFont,
            fontWeight: 600,
            marginTop: 24,
            color: 'var(--neutral-900)',
          }}
        >
          <E
            value={headingText}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h3>
        <p style={{ marginTop: 40, maxWidth: 800, fontSize: bodyFont, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line' }}>
          <E
            value={bodyText}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
          />
          <FitHint editing={editing} shrunk={bodyFont < BODY_MAX} />
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

type MetricsChartType = 'bar' | 'donut' | 'line' | 'funnel';
const CHART_TYPES: { id: MetricsChartType; label: string }[] = [
  { id: 'bar', label: 'Bar' },
  { id: 'donut', label: 'Donut' },
  { id: 'line', label: 'Line' },
  { id: 'funnel', label: 'Funnel' },
];

/** Layout picker for the Metrics Dashboard's chart type - edit-mode only, same
 *  convention as BlankLayoutPicker. All four types read the same `bars` data. */
function ChartTypePicker({ value, onChange }: { value: MetricsChartType; onChange: (v: MetricsChartType) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
      {CHART_TYPES.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            height: 36,
            padding: '0 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            border: '1px solid',
            borderColor: value === t.id ? 'var(--emerald-500)' : 'var(--neutral-300)',
            background: value === t.id ? 'var(--emerald-500)' : '#ffffff',
            color: value === t.id ? '#ffffff' : 'var(--neutral-600)',
            cursor: 'pointer',
            borderRadius: 'var(--radius-sharp)',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** One highlighted bar reads emerald (the brand accent); the rest step through a
 *  light neutral ramp - same semantic the original bar chart used, generalized
 *  so all four chart types agree on "which one is the story." Brand-locked: no
 *  hue beyond the app's own emerald/neutral scale. */
const NEUTRAL_RAMP = ['var(--neutral-300)', 'var(--neutral-400)', 'var(--neutral-200)'];
function metricColor(bar: { active?: boolean }, i: number): string {
  return bar.active ? 'var(--emerald-500)' : NEUTRAL_RAMP[i % NEUTRAL_RAMP.length];
}

/** The original bar chart, unchanged - extracted so SlideMetricsDashboard can
 *  switch between chart components while keeping the same editable data. */
function BarsChart({ bars, editing, onEditLabel }: { bars: (typeof DEFAULT_BARS); editing: boolean; onEditLabel: (i: number, v: string) => void }) {
  return (
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
            background: metricColor(b, i),
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
            <E value={b.label} editing={editing} onCommit={(v) => onEditLabel(i, v)} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Percentage breakdown as an SVG donut - stroke-dasharray segments starting at
 *  12 o'clock, direct percent + label row beneath (a legend box isn't needed
 *  for a single data series per the dataviz skill's rule). */
function DonutChart({ bars, editing, onEditLabel }: { bars: (typeof DEFAULT_BARS); editing: boolean; onEditLabel: (i: number, v: string) => void }) {
  const total = bars.reduce((s, b) => s + Math.max(0, b.pct), 0) || 1;
  const r = 80;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 70, marginTop: 60 }}>
      <svg width={280} height={280} viewBox="0 0 200 200" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={100} cy={100} r={r} fill="none" stroke="var(--neutral-150, #eee)" strokeWidth={32} />
        {bars.map((b, i) => {
          const frac = Math.max(0, b.pct) / total;
          const dash = frac * circumference;
          const gap = circumference - dash;
          const offset = -cumulative * circumference;
          cumulative += frac;
          return (
            <circle
              key={i}
              cx={100}
              cy={100}
              r={r}
              fill="none"
              stroke={metricColor(b, i)}
              strokeWidth={32}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              strokeLinecap={bars.length > 1 ? 'butt' : 'round'}
            />
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: metricColor(b, i), flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--neutral-900)', fontWeight: 700, minWidth: 60 }}>
              {b.pct}%
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--neutral-500)' }}>
              <E value={b.label} editing={editing} onCommit={(v) => onEditLabel(i, v)} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Trend line - thin 2px emerald stroke, markers on each point, shared baseline
 *  with the bar chart so switching types doesn't reflow the slide. */
function LineChart({ bars, editing, onEditLabel }: { bars: (typeof DEFAULT_BARS); editing: boolean; onEditLabel: (i: number, v: string) => void }) {
  const W = 1640;
  const H = 350;
  const n = Math.max(bars.length, 1);
  const points = bars.map((b, i) => {
    const x = n === 1 ? W / 2 : (i / (n - 1)) * W;
    const y = H - (Math.max(0, Math.min(100, b.pct)) / 100) * H;
    return { x, y, b, i };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <div style={{ marginTop: 60, borderBottom: '2px solid var(--neutral-900)', paddingBottom: 0 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        <path d={path} fill="none" stroke="var(--emerald-500)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.i} cx={p.x} cy={p.y} r={p.b.active ? 9 : 6} fill={metricColor(p.b, p.i)} stroke="#fff" strokeWidth={2} />
        ))}
      </svg>
      <div style={{ display: 'flex', marginTop: 10 }}>
        {bars.map((b, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--neutral-500)',
            }}
          >
            <E value={b.label} editing={editing} onCommit={(v) => onEditLabel(i, v)} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Stages narrow top-to-bottom in authored order (order carries meaning - not
 *  re-sorted), each a full-width bar scaled to its own pct so the taper reads
 *  as a funnel rather than a bar chart lying on its side. */
function FunnelChart({ bars, editing, onEditLabel }: { bars: (typeof DEFAULT_BARS); editing: boolean; onEditLabel: (i: number, v: string) => void }) {
  const maxW = 1200;
  return (
    <div style={{ marginTop: 60, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      {bars.map((b, i) => {
        const w = Math.max(8, (Math.max(0, Math.min(100, b.pct)) / 100) * maxW);
        return <div key={i} style={{ width: w, height: 56, background: metricColor(b, i) }} />;
      })}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, width: maxW }}>
        {bars.map((b, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--neutral-500)' }}>
            <E value={b.label} editing={editing} onCommit={(v) => onEditLabel(i, v)} />
            <span style={{ color: 'var(--neutral-900)', fontWeight: 700 }}>{b.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const chartType = content.chartType ?? 'bar';
  const setChartType = (v: MetricsChartType) => onEdit((c) => ({ ...c, chartType: v }));
  const chartProps = { bars, editing, onEditLabel: editBar };
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E
            value={content.hudLabel ?? 'Metrics Dashboard'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>
          <E
            value={content.eyebrow ?? 'Temporal Performance'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        {editing && <ChartTypePicker value={chartType} onChange={setChartType} />}
        {chartType === 'donut' ? (
          <DonutChart {...chartProps} />
        ) : chartType === 'line' ? (
          <LineChart {...chartProps} />
        ) : chartType === 'funnel' ? (
          <FunnelChart {...chartProps} />
        ) : (
          <BarsChart {...chartProps} />
        )}
        {/* Per-bar edit controls (value, highlight, remove) - shared across all chart types, they all read the same `bars` data. */}
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
          <E
            value={content.hudLabel ?? 'Comparative Framework'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>
          <E
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
                  <E value={r.dim} editing={editing} onCommit={(v) => editRow(i, { dim: v || r.dim })} />
                </td>
                <td style={cellStyle}>
                  <E value={r.cur} editing={editing} onCommit={(v) => editRow(i, { cur: v || r.cur })} />
                </td>
                <td style={cellStyle}>
                  <E value={r.tgt} editing={editing} onCommit={(v) => editRow(i, { tgt: v || r.tgt })} />
                </td>
                <td style={{ ...cellStyle, color: 'var(--emerald-600)' }}>
                  <E value={r.delta} editing={editing} onCommit={(v) => editRow(i, { delta: v || r.delta })} />
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
  const ROADMAP_HEADING_MAX = 100;
  const roadmapHeadingText = content.heading ?? 'Pathway to Execution.';
  const roadmapHeadingFont = autoFitHeadingFontSize(roadmapHeadingText, {
    min: 56,
    max: ROADMAP_HEADING_MAX,
    widthBudget: 1640,
    heightBudget: 150,
  });
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E
            value={content.hudLabel ?? 'Execution Timeline'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>
          <E
            value={content.eyebrow ?? 'Milestone Projection'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
          <FitHint editing={editing} shrunk={roadmapHeadingFont < ROADMAP_HEADING_MAX} />
        </EditorialLabel>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: roadmapHeadingFont,
            fontWeight: 600,
            marginBottom: 90,
            color: 'var(--neutral-900)',
          }}
        >
          <E
            value={roadmapHeadingText}
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
                      value={p.title}
                      editing={editing}
                      onCommit={(v) => editPhase(i, { title: v || p.title })}
                    />
                  </h4>
                  <p style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--neutral-500)' }}>
                    <E
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
  const HEADING_MAX = 100;
  const BODY_MAX = 32;
  const headingText = content.heading ?? 'Primary Insight Statement.';
  const bodyText = content.body ?? PLACEHOLDER;
  const colWidthBudget = showImage ? 560 : 760;
  const headingFont = autoFitHeadingFontSize(headingText, { min: 44, max: HEADING_MAX, widthBudget: colWidthBudget, heightBudget: 180 });
  const bodyFont = autoFitBodyFontSize(bodyText, { min: 18, max: BODY_MAX, widthBudget: colWidthBudget, maxLines: 6 });
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
          <EditorialLabel>
            <E
              value={content.eyebrow ?? 'Visual Narrative'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
            <FitHint editing={editing} shrunk={headingFont < HEADING_MAX} />
          </EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: headingFont,
              fontWeight: 600,
              color: 'var(--neutral-900)',
            }}
          >
            <E
              value={headingText}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
            />
          </h2>
          <p style={{ marginTop: 40, fontSize: bodyFont, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line' }}>
            <E
              value={bodyText}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
            <FitHint editing={editing} shrunk={bodyFont < BODY_MAX} />
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
  const PROCESS_HEADING_MAX = 100;
  const processHeadingText = content.heading ?? 'Operational Flow.';
  const processHeadingFont = autoFitHeadingFontSize(processHeadingText, {
    min: 56,
    max: PROCESS_HEADING_MAX,
    widthBudget: 1640,
    heightBudget: 150,
  });
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E
            value={content.hudLabel ?? 'System Logic'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        }
        num={num}
      />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>
          <E
            value={content.eyebrow ?? 'Architectural Protocol'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
          <FitHint editing={editing} shrunk={processHeadingFont < PROCESS_HEADING_MAX} />
        </EditorialLabel>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: processHeadingFont,
            fontWeight: 600,
            marginBottom: 80,
            color: 'var(--neutral-900)',
          }}
        >
          <E
            value={processHeadingText}
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
                  value={s.title}
                  editing={editing}
                  onCommit={(v) => editStep(i, { title: v || s.title })}
                />
              </h4>
              <p style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--neutral-500)' }}>
                <E
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
  const MAP_HEADING_MAX = 100;
  const mapHeadingText = content.heading ?? 'Regional Impact.';
  const mapHeadingFont = autoFitHeadingFontSize(mapHeadingText, { min: 56, max: MAP_HEADING_MAX, widthBudget: 858, heightBudget: 150 });
  return (
    <>
      <SlideGrid />
      <HudTop
        label={
          <E
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
              fontSize: mapHeadingFont,
              fontWeight: 600,
              marginBottom: 45,
              color: 'var(--neutral-900)',
            }}
          >
            <E
              value={mapHeadingText}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
            />
            <FitHint editing={editing} shrunk={mapHeadingFont < MAP_HEADING_MAX} />
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
  const QUOTE_MAX = 84;
  const quoteText = content.quote ?? PLACEHOLDER;
  const quoteFont = autoFitBodyFontSize(quoteText, { min: 40, max: QUOTE_MAX, widthBudget: 1440, maxLines: 4, charWidthRatio: 0.56 });

  return (
    <>
      <SlideGrid />
      <Glow style={{ bottom: -500, left: -500 }} />
      <HudTop
        label={
          <E
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
            fontSize: quoteFont,
            fontWeight: 500,
            lineHeight: 1.12,
            letterSpacing: '-0.03em',
            margin: '0 0 72px',
            maxWidth: 1440,
            color: 'var(--neutral-900)',
          }}
        >
          <E
            value={quoteText}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, quote: v || undefined }))}
          />
          <FitHint editing={editing} shrunk={quoteFont < QUOTE_MAX} />
        </blockquote>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          {/* Circular avatar - static in view mode, uploadable in edit mode */}
          <div
            style={{ position: 'relative', flexShrink: 0, width: 84, height: 84 }}
          >
            {/* The circle itself */}
            <div
              onClick={() => editing && avatarInputRef.current?.click()}
              title={editing ? (avatarSrc ? 'Replace photo' : 'Upload author photo') : undefined}
              style={{
                width: 84,
                height: 84,
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
              <E
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
              <E
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
function SlideExit({ ast, content, editing, onEdit, logoUrl, onLogoChange }: SlideRenderProps) {
  const contacts = content.contacts && content.contacts.length ? content.contacts : DEFAULT_CONTACTS;
  const editContact = (i: number, v: string) =>
    onEdit((c) => {
      const base = c.contacts && c.contacts.length ? c.contacts : DEFAULT_CONTACTS;
      const arr = base.map((x, j) => (j === i ? v || x : x));
      return { ...c, contacts: arr };
    });
  const EXIT_HEADING_MAX = 180;
  const EXIT_BODY_MAX = 32;
  const exitHeadingText = content.heading ?? 'Thank You.';
  const exitBodyText = content.body ?? PLACEHOLDER;
  const exitHeadingFont = autoFitHeadingFontSize(exitHeadingText, { min: 90, max: EXIT_HEADING_MAX, widthBudget: 1500, heightBudget: 200 });
  const exitBodyFont = autoFitBodyFontSize(exitBodyText, { min: 18, max: EXIT_BODY_MAX, widthBudget: 800, maxLines: 5 });
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
        <EditorialLabel>
          <E
            value={content.eyebrow ?? 'Conclusion'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
          <FitHint editing={editing} shrunk={exitHeadingFont < EXIT_HEADING_MAX} />
        </EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: exitHeadingFont,
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: 40,
          }}
        >
          <E
            value={exitHeadingText}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: exitBodyFont,
            maxWidth: 800,
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
          }}
        >
          <E
            value={exitBodyText}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
          />
          <FitHint editing={editing} shrunk={exitBodyFont < EXIT_BODY_MAX} />
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
              <E value={c} editing={editing} onCommit={(v) => editContact(i, v)} />
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
            border: '1px solid',
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

type BlankField = 'eyebrow' | 'heading' | 'body';

/** Freeform user slide - editable eyebrow, heading, body, and an optional image,
 *  in one of three layouts the author can switch between while editing.
 *
 *  Clicking a field while still in view mode enters edit mode AND focuses
 *  that exact field in one step - no separate "Edit Content" click needed to
 *  start typing on a fresh blank slide. */
function SlideBlank({ content, num, editing, onEdit, instanceId, onRequestEdit }: SlideRenderProps) {
  const layout = content.blankLayout ?? 'standard';
  const setLayout = (v: 'standard' | 'two-column' | 'full-bleed') =>
    onEdit((c) => ({ ...c, blankLayout: v }));

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
    <EditorialLabel>
      <E
        value={content.eyebrow ?? 'Section'}
        editing={editing}
        dataField="eyebrow"
        onActivate={activate('eyebrow')}
        onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
      />
    </EditorialLabel>
  );
  const headingText = content.heading ?? 'Blank Slide.';
  const bodyText = content.body ?? 'Click to add your content…';
  const heading = (maxFontSize: number, widthBudget = 1200) => {
    const font = autoFitHeadingFontSize(headingText, { min: Math.round(maxFontSize * 0.55), max: maxFontSize, widthBudget, heightBudget: 220 });
    return (
      <h2 style={{ ...DISPLAY_HEADING_BASE, fontSize: font, fontWeight: 600, marginBottom: 40 }}>
        <E
          value={headingText}
          editing={editing}
          multiline
          dataField="heading"
          onActivate={activate('heading')}
          onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
        />
        <FitHint editing={editing} shrunk={font < maxFontSize} />
      </h2>
    );
  };
  const body = (maxWidth?: number) => {
    const BODY_MAX = 28;
    const font = autoFitBodyFontSize(bodyText, { min: 16, max: BODY_MAX, widthBudget: maxWidth ?? 790, maxLines: 6 });
    return (
      <p style={{ fontSize: font, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line', maxWidth }}>
        <E
          value={bodyText}
          editing={editing}
          multiline
          dataField="body"
          onActivate={activate('body')}
          onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
        />
        <FitHint editing={editing} shrunk={font < BODY_MAX} />
      </p>
    );
  };
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
  /** Two-column/full-bleed have no "optional" image slot - the layout IS the
   *  image area - so "deleting" it means dropping back to the Standard layout. */
  const dropToStandard = () => onEdit((c) => ({ ...c, blankLayout: 'standard', imageUrl: undefined }));
  const hudLabel = (
    <E
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
        <div style={{ position: 'absolute', top: 160, bottom: 0, left: 140, right: 0, zIndex: 10, display: 'flex' }}>
          <div style={{ flex: '0 0 50%', paddingRight: 60, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {eyebrow}
            {heading(64, 790)}
            {body()}
          </div>
          <div style={{ flex: '0 0 50%', paddingBottom: 160 }}>
            {image('Click to add an image', undefined, dropToStandard)}
          </div>
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
        {(content.imageUrl || editing) && !content.hideImage && (
          <div style={{ marginTop: 48, flex: 1, minHeight: 0 }}>
            {image('Click to add an image (optional)', undefined, () =>
              onEdit((c) => ({ ...c, hideImage: true, imageUrl: undefined }))
            )}
          </div>
        )}
        {content.hideImage && editing && (
          <div style={{ marginTop: 32 }}>
            <AddBtn label="Add image area back" onClick={() => onEdit((c) => ({ ...c, hideImage: false }))} />
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Slide type registry - maps template id → renderer
// ---------------------------------------------------------------------------
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
};

const DARK_TEMPLATES = new Set(['s4', 's14']);

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
}: {
  slide: SlideInstance;
  ast: DocumentNode | null;
  num: string;
  scale: number;
  logoUrl?: string;
}) {
  const Renderer = SLIDE_RENDERERS[slide.templateId];
  const isDark = DARK_TEMPLATES.has(slide.templateId);
  return (
    <div style={{ width: 1920 * scale, height: 1080 * scale, flexShrink: 0, overflow: 'hidden' }}>
      <div
        className="wg-doc"
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
          overflow: 'hidden',
          padding: 0,
          background: isDark ? '#000000' : 'var(--pure-white)',
          color: isDark ? '#ffffff' : 'var(--neutral-900)',
        }}
      >
        {Renderer && <Renderer ast={ast} content={slide.content} num={num} editing={false} onEdit={() => { }} logoUrl={logoUrl} />}
        <UniversalSlideOverlayImage
          templateId={slide.templateId}
          imageUrl={slide.content.imageUrl}
          editing={false}
          onRemove={() => {}}
        />
        <div className="footer-row" style={{ zIndex: 10 }}>
          <span>{slide.title}</span>
          <span>{num}</span>
        </div>
      </div>
    </div>
  );
}

function SlideImageToolbar({
  editing,
  isActiveEdit,
  num,
  imageUrl,
  onUpload,
  onRemove,
}: {
  editing: boolean;
  isActiveEdit: boolean;
  num: string;
  imageUrl?: string;
  onUpload: (dataUrl: string) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const dataUrl = await fileToDataUrl(file);
        onUpload(dataUrl);
      } catch (err) {
        console.error('Failed to load image file', err);
      }
    }
    e.target.value = '';
  };

  if (!editing) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 35,
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--emerald-500)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        opacity: isActiveEdit ? 1 : 0,
        pointerEvents: isActiveEdit ? 'auto' : 'none',
        transition: 'opacity .15s ease',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#fff',
        }}
      >
        Editing Slide {num}
      </span>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {imageUrl ? (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                padding: '6px 14px',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              🖼️ Replace Image
            </button>
            <button
              onClick={onRemove}
              style={{
                background: 'rgba(220, 38, 38, 0.9)',
                color: '#fff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ✕ Remove Image
            </button>
          </>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: '#ffffff',
              color: 'var(--emerald-700)',
              border: 'none',
              padding: '6px 16px',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            ➕ Add Image to Slide
          </button>
        )}
      </div>
    </div>
  );
}

function UniversalSlideOverlayImage({
  templateId,
  imageUrl,
  editing,
  onRemove,
}: {
  templateId: string;
  imageUrl?: string;
  editing: boolean;
  onRemove: () => void;
}) {
  // s10 (Editorial Image), s12 (Global Map), and blank handle their own primary image layouts.
  if (!imageUrl || ['s10', 's12', 'blank'].includes(templateId)) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 140,
        right: 120,
        width: 520,
        height: 700,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 24px 48px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.08)',
        zIndex: 15,
        background: '#000',
      }}
    >
      <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {editing && (
        <button
          onClick={onRemove}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'rgba(220, 38, 38, 0.92)',
            color: '#fff',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 6,
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 13,
            zIndex: 20,
          }}
        >
          Remove Image
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresentationCanvas
// ---------------------------------------------------------------------------
export function PresentationCanvas({ ast, deck, editing, onEditSlide, onLogoChange, onRequestEdit }: PresentationCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  // Which slide currently holds focus while editing - drives the "you're
  // editing this one" outline so all slides don't look identically active.
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setActiveSlideId(null);
  }, [editing]);

  const visibleSlides = deck.slides.filter((s) => !s.hidden);

  /**
   * 16:9 scaling engine - mirrors the original HTML's scaleSlides() logic.
   * Fits the 1920px-wide canvas to the available stage width, capped at 0.6
   * to preserve readability at typical viewport sizes.
   * Re-runs whenever the deck changes so new/duplicated slides get scaled.
   */
  useEffect(() => {
    const TARGET_W = 1920;
    const TARGET_H = 1080;

    function scaleSlides() {
      const stage = stageRef.current;
      if (!stage) return;
      const viewportWidth = stage.offsetWidth;
      let scale = (viewportWidth / TARGET_W) * 0.95;
      if (scale > 0.6) scale = 0.6;
      const slides = stage.querySelectorAll<HTMLElement>('[data-slide]');
      slides.forEach((el) => {
        el.style.transform = `scale(${scale})`;
        const scaledHeight = TARGET_H * scale;
        const marginAdjust = (TARGET_H - scaledHeight) * -1;
        el.style.marginBottom = `${marginAdjust + 100}px`;
      });
    }

    scaleSlides();
    const ro = new ResizeObserver(scaleSlides);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [deck]);

  return (
    <div
      ref={stageRef}
      className="book"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 120,
      }}
    >
      {visibleSlides.map((slide, i) => {
        const Renderer = SLIDE_RENDERERS[slide.templateId];
        const isDark = DARK_TEMPLATES.has(slide.templateId);
        const num = String(i + 1).padStart(2, '0');

        const isActiveEdit = editing && activeSlideId === slide.instanceId;

        return (
          <div
            key={slide.instanceId}
            id={slide.instanceId}
            data-slide
            className="page"
            onFocus={() => editing && setActiveSlideId(slide.instanceId)}
            style={{
              /* 1920 × 1080 base - scaled by the engine above */
              width: 1920,
              height: 1080,
              transformOrigin: 'top center',
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden',
              background: isDark ? '#000000' : 'var(--pure-white)',
              color: isDark ? '#ffffff' : 'var(--neutral-900)',
              boxShadow: isActiveEdit
                ? 'var(--shadow-soft), 0 0 0 4px color-mix(in srgb, var(--emerald-500) 18%, transparent)'
                : 'var(--shadow-soft)',
              outline: !editing
                ? 'none'
                : isActiveEdit
                  ? '2px solid var(--emerald-500)'
                  : '2px solid color-mix(in srgb, var(--emerald-500) 20%, transparent)',
              transition: 'outline-color .15s ease, box-shadow .15s ease',
            }}
          >
            <SlideImageToolbar
              editing={editing}
              isActiveEdit={isActiveEdit}
              num={num}
              imageUrl={slide.content.imageUrl}
              onUpload={(url) => onEditSlide(slide.instanceId, (c) => ({ ...c, imageUrl: url, hideImage: false }))}
              onRemove={() => onEditSlide(slide.instanceId, (c) => ({ ...c, imageUrl: undefined }))}
            />
            {Renderer && (
              <Renderer
                ast={ast}
                content={slide.content}
                num={num}
                editing={editing}
                onEdit={(updater) => onEditSlide(slide.instanceId, updater)}
                logoUrl={deck.logoUrl}
                onLogoChange={onLogoChange}
                instanceId={slide.instanceId}
                onRequestEdit={onRequestEdit}
              />
            )}
            <UniversalSlideOverlayImage
              templateId={slide.templateId}
              imageUrl={slide.content.imageUrl}
              editing={editing}
              onRemove={() => onEditSlide(slide.instanceId, (c) => ({ ...c, imageUrl: undefined }))}
            />

            {/* Footer row - preserved from original shell */}
            <div className="footer-row" style={{ zIndex: 10 }}>
              <span>{slide.title}</span>
              <span>
                {i + 1} / {visibleSlides.length}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
