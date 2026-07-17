import { useEffect, useRef } from 'react';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck, SlideContent } from '../deck/types';

interface PresentationCanvasProps {
  ast: DocumentNode | null;
  deck: Deck;
}

/** Props every slide renderer receives: parsed document (for the logo),
 *  the instance's content slots, and its visible slide number ("04"). */
interface SlideRenderProps {
  ast: DocumentNode | null;
  content: SlideContent;
  num: string;
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
function HudTop({ label, num }: { label: string; num: string }) {
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

function SlideCover({ ast, content }: SlideRenderProps) {
  const lines = content.headingLines ?? ['Master Primary', 'Heading', 'Variable.'];
  return (
    <>
      <SlideGrid />
      <Glow style={{ top: -300, right: -300 }} />
      <HudTop
        label={content.projectLabel ?? 'Project Name Placeholder'}
        num={content.versionLabel ?? 'YYYY // Version 0.0'}
      />
      {/* Shifted padding-top from 380px to 280px to prevent bottom edge vertical clipping of placeholder/footer text */}
      <div style={{ padding: '280px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>{content.eyebrow ?? 'Presentation Subtitle'}</EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 180,
            fontWeight: 700,
            color: 'var(--neutral-900)',
          }}
        >
          {lines.map((line, i) => (
            <span key={i}>
              {i === lines.length - 1 && lines.length > 1 ? (
                <span style={{ color: 'var(--neutral-300)' }}>{line}</span>
              ) : (
                line
              )}
              {i < lines.length - 1 && <br />}
            </span>
          ))}
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
            {content.tagline ?? PLACEHOLDER}
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

function SlideIndex({ content, num }: SlideRenderProps) {
  const parts = content.parts ?? DEFAULT_INDEX_PARTS;
  return (
    <>
      <SlideGrid />
      <HudTop label={content.hudLabel ?? 'Agenda'} num={num} />
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
            }}
          >
            Presentation
            <br />
            Structure.
          </h2>
        </div>
        <div style={{ flex: 1.5, paddingTop: 20 }}>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}
          >
            {parts.slice(0, 4).map((part, i) => (
              <div
                key={part.title}
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
                  {part.title}
                </h4>
                <p style={{ fontSize: 18, color: 'var(--neutral-500)', lineHeight: 1.5 }}>
                  {part.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function SlideExecutiveSummary({ content, num }: SlideRenderProps) {
  return (
    <>
      <SlideGrid />
      <HudTop label={content.hudLabel ?? 'Executive Summary'} num={num} />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 100,
            fontWeight: 600,
            marginBottom: 80,
            color: 'var(--neutral-900)',
          }}
        >
          {content.heading ?? (
            <>
              Core Strategic
              <br />
              Objective.
            </>
          )}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 120 }}>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line' }}>
            {content.body ?? PLACEHOLDER}
          </p>
          <div
            style={{
              background: 'var(--neutral-50)',
              border: '1px solid var(--neutral-200)',
              padding: 60,
            }}
          >
            <EditorialLabel>{content.metricLabel ?? 'Variable Metric'}</EditorialLabel>
            <p style={{ color: 'var(--neutral-900)', fontSize: 32, fontWeight: 500, lineHeight: 1.5 }}>
              {content.metricText ?? PLACEHOLDER}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function SlideSectionDivider({ ast, content, num }: SlideRenderProps) {
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
          {content.eyebrow ?? 'Section Marker'}
        </EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 240,
            fontWeight: 700,
            color: '#ffffff',
          }}
        >
          {content.heading ?? 'Section Title.'}
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
          {content.subtitle ?? PLACEHOLDER}
        </p>
      </div>
      <GhostNumeral num={num} dark />
    </>
  );
}

function SlideTwoColumnContext({ content, num }: SlideRenderProps) {
  const attributes = content.leftAttributes ?? [
    'Placeholder Attribute',
    'Placeholder Attribute',
    'Placeholder Attribute',
  ];
  return (
    <>
      <SlideGrid />
      <HudTop label={content.hudLabel ?? 'Strategic Context'} num={num} />
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
          <EditorialLabel>{content.leftLabel ?? 'Condition A'}</EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 72,
              fontWeight: 600,
              marginBottom: 40,
              color: 'var(--neutral-900)',
            }}
          >
            {content.leftHeading ?? (
              <>
                Current State
                <br />
                Environment.
              </>
            )}
          </h2>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)', marginBottom: 40 }}>
            {content.leftBody ?? PLACEHOLDER}
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
                [{String(i + 1).padStart(2, '0')}] {attr}
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
          <EditorialLabel>{content.rightLabel ?? 'Condition B'}</EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 72,
              fontWeight: 600,
              marginBottom: 40,
              color: 'var(--neutral-900)',
            }}
          >
            {content.rightHeading ?? (
              <>
                Strategic Pivot
                <br />
                Target State.
              </>
            )}
          </h2>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-900)' }}>
            {content.rightBody ?? PLACEHOLDER}
          </p>
        </div>
      </div>
    </>
  );
}

function SlideDataMonument({ content, num }: SlideRenderProps) {
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
        <EditorialLabel>{content.eyebrow ?? 'Performance Metric'}</EditorialLabel>
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
          {content.value ?? '000.0'}
          <span style={{ color: 'var(--indigo-500)', fontSize: '0.3em', marginLeft: 10 }}>
            {content.unit ?? 'M'}
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
          {content.heading ?? 'Primary Performance Variable Title.'}
        </h3>
        <p style={{ marginTop: 60, maxWidth: 800, fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)' }}>
          {content.body ?? PLACEHOLDER}
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

function SlideMetricsDashboard({ content, num }: SlideRenderProps) {
  const bars = content.bars ?? DEFAULT_BARS;
  const kpis = content.kpis ?? DEFAULT_KPIS;
  return (
    <>
      <SlideGrid />
      <HudTop label={content.hudLabel ?? 'Metrics Dashboard'} num={num} />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>{content.eyebrow ?? 'Temporal Performance'}</EditorialLabel>
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
          {bars.map((b) => (
            <div
              key={b.label}
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
                {b.label}
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
          {kpis.map((k) => (
            <div key={k.label}>
              <EditorialLabel style={{ fontSize: 10 }}>{k.label}</EditorialLabel>
              <h3
                style={{
                  ...DISPLAY_HEADING_BASE,
                  fontSize: 64,
                  fontWeight: 600,
                  color: 'var(--neutral-900)',
                }}
              >
                {k.value}
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

function SlideComparativeTable({ content, num }: SlideRenderProps) {
  const rows = content.rows ?? DEFAULT_ROWS;
  return (
    <>
      <SlideGrid />
      <HudTop label={content.hudLabel ?? 'Comparative Framework'} num={num} />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>{content.eyebrow ?? 'Benchmark Comparison'}</EditorialLabel>
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
            {rows.map((r) => (
              <tr key={r.dim}>
                <td style={{ padding: '35px 0', borderBottom: '1px solid var(--neutral-200)', fontSize: 28, color: 'var(--neutral-900)' }}>{r.dim}</td>
                <td style={{ padding: '35px 0', borderBottom: '1px solid var(--neutral-200)', fontSize: 28, color: 'var(--neutral-900)' }}>{r.cur}</td>
                <td style={{ padding: '35px 0', borderBottom: '1px solid var(--neutral-200)', fontSize: 28, color: 'var(--neutral-900)' }}>{r.tgt}</td>
                <td style={{ padding: '35px 0', borderBottom: '1px solid var(--neutral-200)', fontSize: 28, color: 'var(--indigo-600)' }}>{r.delta}</td>
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

function SlideStrategicRoadmap({ content, num }: SlideRenderProps) {
  const phases = content.phases ?? DEFAULT_PHASES;
  return (
    <>
      <SlideGrid />
      <HudTop label={content.hudLabel ?? 'Execution Timeline'} num={num} />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>{content.eyebrow ?? 'Milestone Projection'}</EditorialLabel>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 100,
            fontWeight: 600,
            marginBottom: 120,
            color: 'var(--neutral-900)',
          }}
        >
          {content.heading ?? 'Pathway to Execution.'}
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
                    {p.title}
                  </h4>
                  <p style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--neutral-500)' }}>
                    {p.description || PLACEHOLDER}
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

function SlideImageEditorial({ content }: SlideRenderProps) {
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
          <EditorialLabel>{content.eyebrow ?? 'Visual Narrative'}</EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 100,
              fontWeight: 600,
              color: 'var(--neutral-900)',
            }}
          >
            {content.heading ?? 'Primary Insight Statement.'}
          </h2>
          <p style={{ marginTop: 40, fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)', whiteSpace: 'pre-line' }}>
            {content.body ?? PLACEHOLDER}
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

function SlideProcessArchitecture({ content, num }: SlideRenderProps) {
  const steps = content.steps ?? DEFAULT_STEPS;
  return (
    <>
      <SlideGrid />
      <HudTop label={content.hudLabel ?? 'System Logic'} num={num} />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>{content.eyebrow ?? 'Architectural Protocol'}</EditorialLabel>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 100,
            fontWeight: 600,
            marginBottom: 80,
            color: 'var(--neutral-900)',
          }}
        >
          {content.heading ?? 'Operational Flow.'}
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
                {s.title}
              </h4>
              <p style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--neutral-500)' }}>
                {s.description || PLACEHOLDER}
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
function SlideGlobalMap({ content, num }: SlideRenderProps) {
  const sectors = content.sectors ?? DEFAULT_SECTORS;
  return (
    <>
      <SlideGrid />
      <HudTop label={content.hudLabel ?? 'Reach Distribution'} num={num} />
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
          {content.heading ?? 'Regional Impact.'}
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
          {sectors.map((s) => (
            <div key={s.label}>
              <EditorialLabel style={{ fontSize: 10 }}>{s.label}</EditorialLabel>
              <h4
                style={{
                  ...DISPLAY_HEADING_BASE,
                  fontSize: 24,
                  fontWeight: 600,
                  color: 'var(--neutral-900)',
                }}
              >
                {s.value}
              </h4>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Quote slide: inherits DISPLAY_HEADING_BASE for large-scale typography alignment
function SlideFeaturedQuote({ content }: SlideRenderProps) {
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
        <EditorialLabel>{content.eyebrow ?? 'Key Insight'}</EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 110,
            fontWeight: 700,
            marginBottom: 60,
            color: 'var(--neutral-900)',
          }}
        >
          "{content.quote ?? PLACEHOLDER}"
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
              {content.author ?? 'Author Name'}
            </h4>
            <p
              style={{
                fontSize: 18,
                fontFamily: 'var(--font-mono)',
                color: 'var(--neutral-500)',
              }}
            >
              {content.role ?? 'Author Title Placeholder'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

const DEFAULT_CONTACTS = ['email@placeholder.com', '@social_handle', 'www.domain.com'];

// Exit slide: inherits DISPLAY_HEADING_BASE for unified presentation style
function SlideExit({ ast, content }: SlideRenderProps) {
  const contacts = content.contacts && content.contacts.length ? content.contacts : DEFAULT_CONTACTS;
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
        <EditorialLabel>{content.eyebrow ?? 'Conclusion'}</EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 180,
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: 40,
          }}
        >
          {content.heading ?? 'Thank You.'}
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 32,
            maxWidth: 800,
            lineHeight: 1.5,
          }}
        >
          {content.body ?? PLACEHOLDER}
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
          {contacts.map((c) => (
            <span key={c}>{c}</span>
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
export function PresentationCanvas({ ast, deck }: PresentationCanvasProps) {
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
            }}
          >
            {Renderer && <Renderer ast={ast} content={slide.content} num={num} />}

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
