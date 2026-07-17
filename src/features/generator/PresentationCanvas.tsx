import { useEffect, useRef } from 'react';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck, SlideContent } from '../deck/types';

interface PresentationCanvasProps {
  ast: DocumentNode | null;
  deck: Deck;
  /** Edit mode: text slots become contentEditable and commit via onEditSlide. */
  editing: boolean;
  onEditSlide: (instanceId: string, updater: (content: SlideContent) => SlideContent) => void;
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
}

/** Renders plain text normally; in edit mode becomes a contentEditable span
 *  that commits on blur. Committing an empty string signals "revert to the
 *  template placeholder" (callers map '' → undefined). */
function E({ value, editing, onCommit, multiline }: EditableProps) {
  if (!editing) return <>{value}</>;
  return (
    <span
      data-editable
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
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
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

/** Radial glow for light slides — uses accent colour.
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
          'radial-gradient(circle, color-mix(in srgb, var(--indigo-500) 8%, transparent) 0%, transparent 70%)',
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
        color: 'var(--indigo-600)',
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
          background: 'var(--indigo-500)',
          flexShrink: 0,
        }}
      />
      {children}
    </div>
  );
}

/** Oversized background numeral used by dark divider / monument slides. */
function GhostNumeral({ num, dark }: { num: string; dark?: boolean }) {
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
      }}
    >
      {num}
    </div>
  );
}

/** Client logo slot — sourced from the Business Record's optional `logo`
 *  frontmatter key (a URL). Renders a dashed placeholder mark when absent,
 *  matching the sidebar's upload-slot styling so it reads as swappable.
 */
function Logo({ ast, style }: { ast: DocumentNode | null; style?: React.CSSProperties }) {
  const src = ast?.metadata.values.logo;

  if (src) {
    return (
      <img
        src={src}
        alt="Client logo"
        style={{ height: 36, width: 'auto', objectFit: 'contain', zIndex: 10, ...style }}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 36,
        padding: '0 16px',
        border: '1px dashed rgba(140,140,150,0.4)',
        borderRadius: 'var(--radius-sharp)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: 'rgba(140,140,150,0.7)',
        zIndex: 10,
        ...style,
      }}
    >
      Client Logo
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual slide renderers
// ---------------------------------------------------------------------------

function SlideCover({ ast, content, editing, onEdit }: SlideRenderProps) {
  const lines = content.headingLines ?? ['Master Primary', 'Heading', 'Variable.'];
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
      {/* Shifted padding-top from 380px to 280px to prevent bottom edge vertical clipping of placeholder/footer text */}
      <div style={{ padding: '280px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>
          <E
            value={content.eyebrow ?? 'Presentation Subtitle'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 180,
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
        <div style={{ marginTop: 100, display: 'flex', alignItems: 'center', gap: 40 }}>
          <div style={{ width: 120, height: 1, background: 'var(--indigo-500)' }} />
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
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
        <Logo ast={ast} />
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
            <E
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
                  borderLeft: `2px solid ${i === 0 ? 'var(--indigo-500)' : 'var(--neutral-200)'}`,
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
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 100,
            fontWeight: 600,
            marginBottom: 80,
            color: 'var(--neutral-900)',
            whiteSpace: 'pre-line',
          }}
        >
          <E
            value={content.heading ?? 'Core Strategic\nObjective.'}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 120 }}>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line' }}>
            <E
              value={content.body ?? PLACEHOLDER}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
          </p>
          <div
            style={{
              background: 'var(--neutral-50)',
              border: '1px solid var(--neutral-200)',
              padding: 60,
            }}
          >
            <EditorialLabel>
              <E
                value={content.metricLabel ?? 'Variable Metric'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, metricLabel: v || undefined }))}
              />
            </EditorialLabel>
            <p style={{ color: 'var(--neutral-900)', fontSize: 32, fontWeight: 500, lineHeight: 1.5 }}>
              <E
                value={content.metricText ?? PLACEHOLDER}
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

function SlideSectionDivider({ ast, content, num, editing, onEdit }: SlideRenderProps) {
  return (
    <>
      {/* Clean, flat design layout for SlideSectionDivider — no shadows or glow blurs */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 80,
          zIndex: 10,
        }}
      >
        <Logo
          ast={ast}
          style={
            ast?.metadata.values.logo
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
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <EditorialLabel style={{ justifyContent: 'center' }}>
          <E
            value={content.eyebrow ?? 'Section Marker'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 240,
            fontWeight: 700,
            color: '#ffffff',
          }}
        >
          <E
            value={content.heading ?? 'Section Title.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.38em',
            textTransform: 'uppercase',
            marginTop: 40,
            fontSize: 20,
            maxWidth: 1400,
          }}
        >
          <E
            value={content.subtitle ?? PLACEHOLDER}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, subtitle: v || undefined }))}
          />
        </p>
      </div>
      <GhostNumeral num={num} dark />
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
            <E
              value={content.leftHeading ?? 'Current State\nEnvironment.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, leftHeading: v || undefined }))}
            />
          </h2>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)', marginBottom: 40, whiteSpace: 'pre-line' }}>
            <E
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
            <E
              value={content.rightHeading ?? 'Strategic Pivot\nTarget State.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, rightHeading: v || undefined }))}
            />
          </h2>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-900)', whiteSpace: 'pre-line' }}>
            <E
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
        <EditorialLabel>
          <E
            value={content.eyebrow ?? 'Performance Metric'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 420,
            fontWeight: 700,
            lineHeight: 0.8,
            letterSpacing: '-0.07em',
            display: 'flex',
            alignItems: 'baseline',
            color: 'var(--neutral-900)',
          }}
        >
          <E
            value={content.value ?? '000.0'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, value: v || undefined }))}
          />
          <span style={{ color: 'var(--indigo-500)', fontSize: '0.3em', marginLeft: 10 }}>
            <E
              value={content.unit ?? 'M'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, unit: v || undefined }))}
            />
          </span>
        </div>
        <h3
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 64,
            fontWeight: 600,
            marginTop: -20,
            color: 'var(--neutral-900)',
          }}
        >
          <E
            value={content.heading ?? 'Primary Performance Variable Title.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h3>
        <p style={{ marginTop: 60, maxWidth: 800, fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line' }}>
          <E
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
  { label: 'Metric Beta',  value: '00.0x' },
  { label: 'Metric Gamma', value: '-00%' },
];

function SlideMetricsDashboard({ content, num, editing, onEdit }: SlideRenderProps) {
  const bars = content.bars ?? DEFAULT_BARS;
  const kpis = content.kpis ?? DEFAULT_KPIS;
  const editBar = (i: number, label: string) =>
    onEdit((c) => {
      const arr = (c.bars ?? DEFAULT_BARS).map((b, j) => (j === i ? { ...b, label: label || b.label } : b));
      return { ...c, bars: arr };
    });
  const editKpi = (i: number, patch: Partial<(typeof kpis)[number]>) =>
    onEdit((c) => {
      const arr = (c.kpis ?? DEFAULT_KPIS).map((k, j) => (j === i ? { ...k, ...patch } : k));
      return { ...c, kpis: arr };
    });
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
                background: b.active ? 'var(--indigo-500)' : 'var(--neutral-200)',
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
                <E value={b.label} editing={editing} onCommit={(v) => editBar(i, v)} />
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            marginTop: 80,
            gap: 40,
          }}
        >
          {kpis.map((k, i) => (
            <div key={i}>
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
      </div>
    </>
  );
}

const DEFAULT_ROWS = [
  { dim: 'Dimension 01', cur: '00.0',  tgt: '00.0',  delta: '+00.0%' },
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
  const cellStyle: React.CSSProperties = {
    padding: '35px 0',
    borderBottom: '1px solid var(--neutral-200)',
    fontSize: 28,
    color: 'var(--neutral-900)',
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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Analysis Category', 'Current Variable', 'Target Variable', 'Performance Delta'].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '25px 0',
                      borderBottom: '2px solid var(--neutral-900)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      color: 'var(--neutral-500)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                    }}
                  >
                    {h}
                  </th>
                )
              )}
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
                <td style={{ ...cellStyle, color: 'var(--indigo-600)' }}>
                  <E value={r.delta} editing={editing} onCommit={(v) => editRow(i, { delta: v || r.delta })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const DEFAULT_PHASES = [
  { title: 'Initiation',   description: PLACEHOLDER, completed: true },
  { title: 'Integration',  description: PLACEHOLDER, completed: true },
  { title: 'Optimization', description: PLACEHOLDER, completed: false },
];

function SlideStrategicRoadmap({ content, num, editing, onEdit }: SlideRenderProps) {
  const phases = content.phases ?? DEFAULT_PHASES;
  const editPhase = (i: number, patch: Partial<(typeof phases)[number]>) =>
    onEdit((c) => {
      const arr = (c.phases ?? DEFAULT_PHASES).map((p, j) => (j === i ? { ...p, ...patch } : p));
      return { ...c, phases: arr };
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
        </EditorialLabel>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 100,
            fontWeight: 600,
            marginBottom: 120,
            color: 'var(--neutral-900)',
          }}
        >
          <E
            value={content.heading ?? 'Pathway to Execution.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>
        <div style={{ position: 'relative', paddingTop: 60 }}>
          {/* timeline rail */}
          <div
            style={{
              position: 'absolute',
              top: 12,
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
                <div
                  style={{
                    width: 24,
                    height: 24,
                    background: p.completed ? 'var(--indigo-500)' : 'var(--neutral-300)',
                    borderRadius: '50%',
                    position: 'relative',
                    zIndex: 2,
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
      </div>
    </>
  );
}

function SlideImageEditorial({ content, editing, onEdit }: SlideRenderProps) {
  return (
    <>
      <SlideGrid />
      <div style={{ display: 'flex', height: '100%', position: 'relative', zIndex: 10 }}>
        <div
          style={{
            flex: 1,
            padding: 140,
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
          </EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 100,
              fontWeight: 600,
              color: 'var(--neutral-900)',
            }}
          >
            <E
              value={content.heading ?? 'Primary Insight Statement.'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
            />
          </h2>
          <p style={{ marginTop: 40, fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line' }}>
            <E
              value={content.body ?? PLACEHOLDER}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
          </p>
        </div>
        <div
          style={{
            flex: 1.2,
            background: 'var(--neutral-100)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--neutral-400)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            Image Asset Placeholder
          </span>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, #fff 0%, transparent 20%)',
            }}
          />
        </div>
      </div>
    </>
  );
}

const DEFAULT_STEPS = [
  { title: 'Input',   description: PLACEHOLDER },
  { title: 'Process', description: PLACEHOLDER },
  { title: 'Output',  description: PLACEHOLDER },
];

function SlideProcessArchitecture({ content, num, editing, onEdit }: SlideRenderProps) {
  const steps = content.steps ?? DEFAULT_STEPS;
  const editStep = (i: number, patch: Partial<(typeof steps)[number]>) =>
    onEdit((c) => {
      const arr = (c.steps ?? DEFAULT_STEPS).map((s, j) => (j === i ? { ...s, ...patch } : s));
      return { ...c, steps: arr };
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
          <E
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
                border: `1px solid ${i === 1 ? 'var(--indigo-500)' : 'var(--neutral-200)'}`,
                padding: 40,
                marginTop: i * 40,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 48,
                  color: 'var(--indigo-500)',
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
    onEdit((c) => {
      const arr = (c.sectors ?? DEFAULT_SECTORS).map((s, j) => (j === i ? { ...s, ...patch } : s));
      return { ...c, sectors: arr };
    });
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
          padding: '160px 140px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 100,
            fontWeight: 600,
            marginBottom: 60,
            color: 'var(--neutral-900)',
          }}
        >
          <E
            value={content.heading ?? 'Regional Impact.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>
        <div
          style={{
            flex: 1,
            position: 'relative',
            background: 'var(--neutral-100)',
            border: '1px solid var(--neutral-200)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--neutral-400)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            Geographic Visualisation Placeholder
          </span>
          {/* accent hotspots */}
          {[{ top: '35%', left: '22%' }, { top: '45%', left: '62%' }].map((pos, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                ...pos,
                width: 20,
                height: 20,
                background: 'var(--indigo-500)',
                borderRadius: '50%',
                boxShadow: '0 0 40px var(--indigo-500)',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 100, marginTop: 40 }}>
          {sectors.map((s, i) => (
            <div key={i}>
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
                  fontSize: 24,
                  fontWeight: 600,
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
        </div>
      </div>
    </>
  );
}

// Quote slide: inherits DISPLAY_HEADING_BASE for large-scale typography alignment
function SlideFeaturedQuote({ content, editing, onEdit }: SlideRenderProps) {
  return (
    <>
      <SlideGrid />
      <Glow style={{ bottom: -500, left: -500 }} />
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 140px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <EditorialLabel>
          <E
            value={content.eyebrow ?? 'Key Insight'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 110,
            fontWeight: 700,
            marginBottom: 60,
            color: 'var(--neutral-900)',
          }}
        >
          "
          <E
            value={content.quote ?? PLACEHOLDER}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, quote: v || undefined }))}
          />
          "
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <div
            style={{
              width: 80,
              height: 80,
              background: 'var(--neutral-200)',
              borderRadius: '50%',
            }}
          />
          <div>
            <h4
              style={{
                ...DISPLAY_HEADING_BASE,
                fontSize: 28,
                fontWeight: 700,
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
function SlideExit({ ast, content, editing, onEdit }: SlideRenderProps) {
  const contacts = content.contacts && content.contacts.length ? content.contacts : DEFAULT_CONTACTS;
  const editContact = (i: number, v: string) =>
    onEdit((c) => {
      const base = c.contacts && c.contacts.length ? c.contacts : DEFAULT_CONTACTS;
      const arr = base.map((x, j) => (j === i ? v || x : x));
      return { ...c, contacts: arr };
    });
  return (
    <>
      {/* Clean, flat design layout for SlideExit — no shadows or glow blurs */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 80,
          zIndex: 10,
        }}
      >
        <Logo
          ast={ast}
          style={
            ast?.metadata.values.logo
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
          <E
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
          <E
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
            color: 'var(--indigo-400)',
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

// ---------------------------------------------------------------------------
// Slide type registry — maps template id → renderer
// ---------------------------------------------------------------------------
const SLIDE_RENDERERS: Record<string, (props: SlideRenderProps) => React.ReactElement> = {
  s1:  SlideCover,
  s2:  SlideIndex,
  s3:  SlideExecutiveSummary,
  s4:  SlideSectionDivider,
  s5:  SlideTwoColumnContext,
  s6:  SlideDataMonument,
  s7:  SlideMetricsDashboard,
  s8:  SlideComparativeTable,
  s9:  SlideStrategicRoadmap,
  s10: SlideImageEditorial,
  s11: SlideProcessArchitecture,
  s12: SlideGlobalMap,
  s13: SlideFeaturedQuote,
  s14: SlideExit,
};

const DARK_TEMPLATES = new Set(['s4', 's14']);

// ---------------------------------------------------------------------------
// PresentationCanvas
// ---------------------------------------------------------------------------
export function PresentationCanvas({ ast, deck, editing, onEditSlide }: PresentationCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  const visibleSlides = deck.slides.filter((s) => !s.hidden);

  /**
   * 16:9 scaling engine — mirrors the original HTML's scaleSlides() logic.
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

        return (
          <div
            key={slide.instanceId}
            id={slide.instanceId}
            data-slide
            className="page"
            style={{
              /* 1920 × 1080 base — scaled by the engine above */
              width: 1920,
              height: 1080,
              transformOrigin: 'top center',
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden',
              background: isDark ? '#000000' : 'var(--pure-white)',
              color: isDark ? '#ffffff' : 'var(--neutral-900)',
              // Standard design system shadow used for all slides instead of custom heavy shadow
              boxShadow: 'var(--shadow-soft)',
              // Subtle affordance that the slide is live for editing
              outline: editing ? '2px solid color-mix(in srgb, var(--indigo-500) 35%, transparent)' : 'none',
            }}
          >
            {Renderer && (
              <Renderer
                ast={ast}
                content={slide.content}
                num={num}
                editing={editing}
                onEdit={(updater) => onEditSlide(slide.instanceId, updater)}
              />
            )}

            {/* Footer row — preserved from original shell */}
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
