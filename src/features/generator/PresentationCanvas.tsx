import { useEffect, useRef } from 'react';
import type { DocumentNode } from '../business-record/parser/ast';
import { SLIDES, SLIDE_GROUPS } from './SlideNavList';

interface PresentationCanvasProps {
  ast: DocumentNode | null;
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

function SlideCover({ ast }: { ast: DocumentNode | null }) {
  return (
    <>
      <SlideGrid />
      <Glow style={{ top: -300, right: -300 }} />
      <HudTop label="Project Name Placeholder" num="YYYY // Version 0.0" />
      {/* Shifted padding-top from 380px to 280px to prevent bottom edge vertical clipping of placeholder/footer text */}
      <div style={{ padding: '280px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>Presentation Subtitle</EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 180,
            fontWeight: 700,
            color: 'var(--neutral-900)',
          }}
        >
          Master Primary
          <br />
          Heading
          <br />
          <span style={{ color: 'var(--neutral-300)' }}>Variable.</span>
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
            {PLACEHOLDER}
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

function SlideIndex() {
  return (
    <>
      <SlideGrid />
      <HudTop label="Agenda" num="02" />
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
            {SLIDE_GROUPS.slice(0, 4).map((group, i) => (
              <div
                key={group.label}
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
                  {group.label}
                </h4>
                <p style={{ fontSize: 18, color: 'var(--neutral-500)', lineHeight: 1.5 }}>
                  {PLACEHOLDER}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function SlideExecutiveSummary() {
  return (
    <>
      <SlideGrid />
      <HudTop label="Executive Summary" num="03" />
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
          Core Strategic
          <br />
          Objective.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 120 }}>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)' }}>
            {PLACEHOLDER}
          </p>
          <div
            style={{
              background: 'var(--neutral-50)',
              border: '1px solid var(--neutral-200)',
              padding: 60,
            }}
          >
            <EditorialLabel>Variable Metric</EditorialLabel>
            <p style={{ color: 'var(--neutral-900)', fontSize: 32, fontWeight: 500, lineHeight: 1.5 }}>
              {PLACEHOLDER}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function SlideSectionDivider({ ast }: { ast: DocumentNode | null }) {
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
        <EditorialLabel style={{ justifyContent: 'center' }}>Section Marker</EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 240,
            fontWeight: 700,
            color: '#ffffff',
          }}
        >
          Section Title.
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.38em',
            textTransform: 'uppercase',
            marginTop: 40,
            fontSize: 20,
          }}
        >
          {PLACEHOLDER}
        </p>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 600,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.02)',
          position: 'absolute',
          bottom: -100,
          right: -50,
          lineHeight: 1,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        04
      </div>
    </>
  );
}

function SlideTwoColumnContext() {
  return (
    <>
      <SlideGrid />
      <HudTop label="Strategic Context" num="05" />
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
          <EditorialLabel>Condition A</EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 72,
              fontWeight: 600,
              marginBottom: 40,
              color: 'var(--neutral-900)',
            }}
          >
            Current State
            <br />
            Environment.
          </h2>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)', marginBottom: 40 }}>
            {PLACEHOLDER}
          </p>
          <ul
            style={{
              listStyle: 'none',
              fontSize: 20,
              fontFamily: 'var(--font-mono)',
              color: 'var(--neutral-400)',
            }}
          >
            {['[01]', '[02]', '[03]'].map((tag) => (
              <li key={tag} style={{ marginBottom: 10 }}>
                {tag} Placeholder Attribute
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
          <EditorialLabel>Condition B</EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 72,
              fontWeight: 600,
              marginBottom: 40,
              color: 'var(--neutral-900)',
            }}
          >
            Strategic Pivot
            <br />
            Target State.
          </h2>
          <p style={{ fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-900)' }}>
            {PLACEHOLDER}
          </p>
        </div>
      </div>
    </>
  );
}

function SlideDataMonument() {
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
        <EditorialLabel>Performance Metric</EditorialLabel>
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
          000.0
          <span style={{ color: 'var(--indigo-500)', fontSize: '0.3em', marginLeft: 10 }}>M</span>
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
          Primary Performance Variable Title.
        </h3>
        <p style={{ marginTop: 60, maxWidth: 800, fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)' }}>
          {PLACEHOLDER}
        </p>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 600,
          fontWeight: 700,
          color: 'rgba(0,0,0,0.02)',
          position: 'absolute',
          bottom: -100,
          right: -50,
          lineHeight: 1,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        06
      </div>
    </>
  );
}

function SlideMetricsDashboard() {
  const bars = [
    { label: 'P1', pct: 30 },
    { label: 'P2', pct: 45 },
    { label: 'P3', pct: 70 },
    { label: 'P4', pct: 95, active: true },
  ];
  const kpis = [
    { label: 'Metric Alpha', val: '00.0%' },
    { label: 'Metric Beta',  val: '00.0x' },
    { label: 'Metric Gamma', val: '-00%' },
  ];
  return (
    <>
      <SlideGrid />
      <HudTop label="Metrics Dashboard" num="07" />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>Temporal Performance</EditorialLabel>
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
                {k.val}
              </h3>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SlideComparativeTable() {
  const rows = [
    { dim: 'Dimension 01', cur: '00.0',  tgt: '00.0',  delta: '+00.0%' },
    { dim: 'Dimension 02', cur: '0.00%', tgt: '0.00%', delta: '+00.0%' },
    { dim: 'Dimension 03', cur: '0,000', tgt: '0,000', delta: '+00.0%' },
    { dim: 'Dimension 04', cur: 'XXX.X', tgt: 'XXX.X', delta: '+00.0%' },
  ];
  return (
    <>
      <SlideGrid />
      <HudTop label="Comparative Framework" num="08" />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>Benchmark Comparison</EditorialLabel>
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

function SlideStrategicRoadmap() {
  const phases = [
    { num: '01', label: 'Phase 01', title: 'Initiation', completed: true },
    { num: '02', label: 'Phase 02', title: 'Integration', completed: true },
    { num: '03', label: 'Phase 03', title: 'Optimization', completed: false },
  ];
  return (
    <>
      <SlideGrid />
      <HudTop label="Execution Timeline" num="09" />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>Milestone Projection</EditorialLabel>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 100,
            fontWeight: 600,
            marginBottom: 120,
            color: 'var(--neutral-900)',
          }}
        >
          Pathway to Execution.
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
            {phases.map((p) => (
              <div key={p.num} style={{ width: 320, position: 'relative' }}>
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
                  <EditorialLabel style={{ fontSize: 12 }}>{p.label}</EditorialLabel>
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
                    {PLACEHOLDER}
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

function SlideImageEditorial() {
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
          <EditorialLabel>Visual Narrative</EditorialLabel>
          <h2
            style={{
              ...DISPLAY_HEADING_BASE,
              fontSize: 100,
              fontWeight: 600,
              color: 'var(--neutral-900)',
            }}
          >
            Primary Insight Statement.
          </h2>
          <p style={{ marginTop: 40, fontSize: 32, lineHeight: 1.5, color: 'var(--neutral-500)' }}>
            {PLACEHOLDER}
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

function SlideProcessArchitecture() {
  const steps = [
    { num: '01', title: 'Input',   offset: 0 },
    { num: '02', title: 'Process', offset: 40 },
    { num: '03', title: 'Output',  offset: 80 },
  ];
  return (
    <>
      <SlideGrid />
      <HudTop label="System Logic" num="11" />
      <div style={{ padding: '160px 140px', position: 'relative', zIndex: 10 }}>
        <EditorialLabel>Architectural Protocol</EditorialLabel>
        <h2
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 100,
            fontWeight: 600,
            marginBottom: 80,
            color: 'var(--neutral-900)',
          }}
        >
          Operational Flow.
        </h2>
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
          {steps.map((s) => (
            <div
              key={s.num}
              style={{
                flex: 1,
                border: `1px solid ${s.num === '02' ? 'var(--indigo-500)' : 'var(--neutral-200)'}`,
                padding: 40,
                marginTop: s.offset,
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
                {s.num}
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
                {PLACEHOLDER}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Map slide: inherits DISPLAY_HEADING_BASE for visual alignment
function SlideGlobalMap() {
  const sectors = ['Sector A', 'Sector B', 'Sector C'];
  return (
    <>
      <SlideGrid />
      <HudTop label="Reach Distribution" num="12" />
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
          Regional Impact.
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
            <div key={s}>
              <EditorialLabel style={{ fontSize: 10 }}>{s}</EditorialLabel>
              <h4
                style={{
                  ...DISPLAY_HEADING_BASE,
                  fontSize: 24,
                  fontWeight: 600,
                  color: 'var(--neutral-900)',
                }}
              >
                0.0M Metric
              </h4>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Quote slide: inherits DISPLAY_HEADING_BASE for large-scale typography alignment
function SlideFeaturedQuote() {
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
        <EditorialLabel>Key Insight</EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 110,
            fontWeight: 700,
            marginBottom: 60,
            color: 'var(--neutral-900)',
          }}
        >
          "{PLACEHOLDER}"
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
              Author Name
            </h4>
            <p
              style={{
                fontSize: 18,
                fontFamily: 'var(--font-mono)',
                color: 'var(--neutral-500)',
              }}
            >
              Author Title Placeholder
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// Exit slide: inherits DISPLAY_HEADING_BASE for unified presentation style
function SlideExit({ ast }: { ast: DocumentNode | null }) {
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
        <EditorialLabel>Conclusion</EditorialLabel>
        <h1
          style={{
            ...DISPLAY_HEADING_BASE,
            fontSize: 180,
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: 40,
          }}
        >
          Thank You.
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 32,
            maxWidth: 800,
            lineHeight: 1.5,
          }}
        >
          {PLACEHOLDER}
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
          <span>email@placeholder.com</span>
          <span>@social_handle</span>
          <span>www.domain.com</span>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Slide type registry — maps slide id → renderer
// ---------------------------------------------------------------------------
const SLIDE_RENDERERS: Record<string, (props: { ast: DocumentNode | null }) => React.ReactElement> = {
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

// ---------------------------------------------------------------------------
// PresentationCanvas
// ---------------------------------------------------------------------------
export function PresentationCanvas({ ast }: PresentationCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  /**
   * 16:9 scaling engine — mirrors the original HTML's scaleSlides() logic.
   * Fits the 1920px-wide canvas to the available stage width, capped at 0.6
   * to preserve readability at typical viewport sizes.
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
  }, []);

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
      {SLIDES.map((slide, i) => {
        const Renderer = SLIDE_RENDERERS[slide.id];
        const isDark = slide.id === 's4' || slide.id === 's14';

        return (
          <div
            key={slide.id}
            id={slide.id}
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
            {Renderer && <Renderer ast={ast} />}

            {/* Footer row — preserved from original shell */}
            <div className="footer-row" style={{ zIndex: 10 }}>
              <span>{slide.title}</span>
              <span>
                {i + 1} / {SLIDES.length}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
