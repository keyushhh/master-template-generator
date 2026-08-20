import React from 'react';
import {
  E,
  SlideRenderProps,
  Glow,
  Logo,
} from '../../generator/PresentationCanvas';

/**
 * STARTUP PITCH DECK PRESENTATION SYSTEM
 * Characterized by:
 * - Electric orange high-contrast branding & Syne display typography
 * - Heavy monumental headlines, venture thesis framing
 * - 24% MoM growth telemetry & 3-phase Go-to-market roadmaps
 * - Competitive delta matrix comparisons
 */

// 1. Startup Cover Slide
export function StartupSlideCover({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const lines = content.headingLines ?? ['Venture Craft', 'Series Seed.'];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#09090B', color: '#FAFAFA' }}>
      <Glow style={{ top: -200, right: -100, width: 900, height: 900, background: 'radial-gradient(circle, rgba(234, 88, 12, 0.35) 0%, transparent 70%)' }} />

      <div style={{ position: 'absolute', top: 60, left: 80, right: 80, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
        <div style={{ borderLeft: '4px solid #EA580C', paddingLeft: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#FB923C', letterSpacing: '0.15em' }}>
            <E
              slot="projectLabel"
              value={content.projectLabel ?? 'VENTURE CRAFT SEED'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
            />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#A1A1AA', marginTop: 4 }}>
            <E
              slot="versionLabel"
              value={content.versionLabel ?? 'TARGET: $3.5M SEED ROUND'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, versionLabel: v || undefined }))}
            />
          </div>
        </div>
        <Logo src={logoUrl} editing={editing} onChange={onLogoChange} scale={logoScale} onScaleChange={onLogoScaleChange} />
      </div>

      <div style={{ padding: '0 80px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ background: '#EA580C', color: '#000000', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, padding: '5px 14px', letterSpacing: '0.12em' }}>
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'CONFIDENTIAL INVESTOR MEMORANDUM'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 150,
            fontWeight: 800,
            lineHeight: 0.9,
            letterSpacing: '-0.05em',
            color: '#FAFAFA',
            marginBottom: 48,
            textTransform: 'uppercase',
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
                  headingLines: v ? v.split('\n').map((l) => l.trim()).filter(Boolean) : undefined,
                }))
              }
            />
          ) : (
            lines.map((line, i) => (
              <span key={i}>
                {i === lines.length - 1 && lines.length > 1 ? (
                  <span style={{ color: '#EA580C' }}>{line}</span>
                ) : (
                  line
                )}
                {i < lines.length - 1 && <br />}
              </span>
            ))
          )}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 40, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 32, maxWidth: 1100 }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 500, color: '#D4D4D8', lineHeight: 1.45 }}>
            <E
              slot="tagline"
              value={content.tagline ?? 'Scaling next-generation commerce infrastructure for the modern internet.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, tagline: v || undefined }))}
            />
          </p>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 60, left: 80, right: 80, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#71717A' }}>
          <E
            slot="confidentialLabel"
            value={content.confidentialLabel ?? 'SERIES SEED // SAN FRANCISCO, CA'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, confidentialLabel: v }))}
          />
        </span>
      </div>
    </div>
  );
}

// 2. Startup Problem & Cart Abandonment Slide
export function StartupSlideProblem({ content, num, editing, onEdit }: SlideRenderProps) {
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#09090B', color: '#FAFAFA' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 80,
          right: 80,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#A1A1AA',
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'The Market Friction'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#FB923C' }}>{num}</span>
      </div>

      <div
        style={{
          padding: '160px 80px 80px',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1.3fr 0.7fr',
          gap: 80,
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', background: 'rgba(234, 88, 12, 0.2)', border: '1px solid #EA580C', padding: '4px 12px', marginBottom: 24 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#FB923C', letterSpacing: '0.15em' }}>
              <E
                slot="eyebrow"
                value={content.eyebrow ?? 'THE $48B LEAKAGE PROBLEM'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
              />
            </span>
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: '-0.04em',
              color: '#FAFAFA',
              marginBottom: 32,
              whiteSpace: 'pre-line',
            }}
          >
            <E
              slot="heading"
              value={content.heading ?? 'Checkout Friction\nCosts $48B Yearly.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
            />
          </h2>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 24, lineHeight: 1.6, color: '#A1A1AA' }}>
            <E
              slot="body"
              value={
                content.body ??
                'Legacy payment gateways require 14 separate form fields and redirect users through slow multi-step authentication gates. We condense everything into a single biometric tap.'
              }
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
          </p>
        </div>

        {/* Big Orange Stat Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '2px solid #EA580C',
            padding: '50px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#FB923C' }}>
            <E
              slot="metricLabel"
              value={content.metricLabel ?? 'Cart Abandonment Rate'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, metricLabel: v || undefined }))}
            />
          </span>

          <div style={{ fontFamily: 'var(--font-display)', fontSize: 96, fontWeight: 900, color: '#FAFAFA', lineHeight: 1, letterSpacing: '-0.05em' }}>
            <E
              slot="metricText"
              value={content.metricText ?? '68.8%'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, metricText: v || undefined }))}
            />
          </div>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#A1A1AA', marginTop: 12 }}>
            Average across top 100,000 mid-market eCommerce checkouts.
          </p>
        </div>
      </div>
    </div>
  );
}

// 3. Startup 24% MoM Traction Dashboard
export function StartupSlideTraction({ content, num, editing, onEdit }: SlideRenderProps) {
  const bars = content.bars ?? [
    { label: 'Gross Processing Volume (GPV)', pct: 96, active: true },
    { label: 'Net Revenue Retention (NRR)', pct: 92, active: true },
    { label: 'Gross Margin Expansion', pct: 84, active: false },
  ];

  const kpis = content.kpis ?? [
    { label: 'Current ARR', value: '$1.8M' },
    { label: 'MoM Expansion', value: '+24%' },
    { label: 'LTV / CAC Ratio', value: '5.8x' },
  ];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#09090B', color: '#FAFAFA' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 80,
          right: 80,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#A1A1AA',
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Financial Trajectory'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#FB923C' }}>{num}</span>
      </div>

      <div
        style={{
          padding: '150px 80px 80px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 68,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: 48,
            color: '#FAFAFA',
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Consistent 24% Monthly Expansion.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>

        {/* 3 Bold Progress Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 48 }}>
          {bars.map((bar, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 15 }}>
                <span style={{ color: '#FAFAFA', fontWeight: 600 }}>{bar.label}</span>
                <span style={{ color: '#FB923C', fontWeight: 700 }}>{bar.pct}%</span>
              </div>
              <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.06)' }}>
                <div
                  style={{
                    width: `${bar.pct}%`,
                    height: '100%',
                    background: bar.active ? '#EA580C' : '#52525B',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* 3 Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          {kpis.map((kpi, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(234, 88, 12, 0.4)',
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#FB923C' }}>
                {kpi.label}
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 800, color: '#FAFAFA' }}>
                {kpi.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 4. Startup 3-Phase GTM Roadmap
export function StartupSlideRoadmap({ content, num, editing, onEdit }: SlideRenderProps) {
  const phases = content.phases ?? [
    { num: '01', title: 'Shopify & WooCommerce App', timing: 'Q1-Q2 2026', body: 'Self-serve merchant onboarding targeting mid-market D2C brands.' },
    { num: '02', title: 'EU Cross-Border Banking', timing: 'Q3-Q4 2026', body: 'Obtaining European payment institution license for zero-FX transfers.' },
    { num: '03', title: 'Enterprise SDK Launch', timing: 'Q1 2027', body: 'Direct bespoke API integrations for top 500 global retailers.' },
  ];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#09090B', color: '#FAFAFA' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 80,
          right: 80,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#A1A1AA',
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Execution Roadmap'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#FB923C' }}>{num}</span>
      </div>

      <div
        style={{
          padding: '160px 80px 80px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: 60,
            color: '#FAFAFA',
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Go-to-Market Execution Plan.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>

        {/* 3 Step Milestone Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32 }}>
          {phases.map((ph, i) => (
            <div
              key={i}
              style={{
                borderTop: '3px solid #EA580C',
                background: 'rgba(255,255,255,0.02)',
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 900, color: '#EA580C' }}>
                  {ph.num}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#FB923C', background: 'rgba(234,88,12,0.15)', padding: '4px 10px' }}>
                  {ph.timing}
                </span>
              </div>

              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#FAFAFA' }}>
                {ph.title}
              </h4>

              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 18, lineHeight: 1.6, color: '#A1A1AA' }}>
                {ph.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
