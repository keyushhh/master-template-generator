import React from 'react';
import {
  E,
  SlideRenderProps,
  Logo,
} from '../../generator/PresentationCanvas';
import {
  PhoneMockup,
} from '../components/MobileMockup';

/**
 * PRODUCT DATA & SAAS PRESENTATION SYSTEM
 * Characterized by:
 * - Product mobile screenshots + analytical KPI cards + telemetry bars
 * - Deep navy/graphite backgrounds with cyan/electric blue accents
 * - Zero default grid hairlines
 * - Replaceable PNG screen assets
 */

// 1. Product Data Cover
export function ProductDataSlideCover({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const lines = content.headingLines ?? ['Product Intelligence', '& Performance.'];
  const screen = content.screenAsset || content.screenAssets?.[0];

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(120% 100% at 80% 50%, #0F172A 0%, #0B0F19 100%)',
        color: '#F1F5F9',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 80,
          right: 80,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 20,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#38BDF8' }}>
            <E
              slot="projectLabel"
              value={content.projectLabel ?? 'LIVE PRODUCT METRICS // 2026'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
            />
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#94A3B8' }}>
          <E
            slot="versionLabel"
            value={content.versionLabel ?? 'TELEMETRY V2.4'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, versionLabel: v || undefined }))}
          />
        </span>
      </div>

      <div
        style={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          padding: '120px 80px 80px',
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              marginBottom: 32,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: '#7DD3FC' }}>
              <E
                slot="eyebrow"
                value={content.eyebrow ?? 'ANALYTICAL BENCHMARK'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
              />
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 0.98,
              letterSpacing: '-0.04em',
              color: '#F1F5F9',
              marginBottom: 36,
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
                    <span style={{ color: '#38BDF8' }}>{line}</span>
                  ) : (
                    line
                  )}
                  {i < lines.length - 1 && <br />}
                </span>
              ))
            )}
          </h1>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 24, lineHeight: 1.6, color: '#94A3B8', maxWidth: 640 }}>
            <E
              slot="tagline"
              value={content.tagline ?? 'Real-time telemetry, user retention cohorts, and conversion funnel analytics.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, tagline: v || undefined }))}
            />
          </p>
        </div>

        {/* Right Phone with Live Analytics PNG Asset */}
        <div className="flex items-center justify-center">
          <PhoneMockup
            screenAsset={screen}
            archetype="activity"
            size="lg"
            device="dark"
            editing={editing}
            onReplaceScreen={(src) => onEdit((c) => ({ ...c, screenAsset: src }))}
          />
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, right: 80, zIndex: 20 }}>
        <Logo src={logoUrl} editing={editing} onChange={onLogoChange} scale={logoScale} onScaleChange={onLogoScaleChange} />
      </div>
    </div>
  );
}

// 2. Product Data Screen + KPI Dashboard
export function ProductDataSlideScreenKpi({ content, num, editing, onEdit }: SlideRenderProps) {
  const kpis = content.kpis ?? [
    { label: 'Active User Growth', value: '+42.8%' },
    { label: 'Avg Session Duration', value: '14m 20s' },
    { label: 'Net Revenue Retention', value: '138%' },
  ];
  const screen = content.screenAsset || content.screenAssets?.[0];

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(120% 100% at 25% 50%, #0F172A 0%, #0B0F19 100%)',
        color: '#F1F5F9',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 80,
          right: 80,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#94A3B8',
          zIndex: 20,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Product Telemetry'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#38BDF8' }}>{num}</span>
      </div>

      <div
        style={{
          padding: '140px 80px 80px',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '0.9fr 1.1fr',
          gap: 80,
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Left Phone Mockup with Replaceable PNG Asset */}
        <div className="flex items-center justify-center">
          <PhoneMockup
            screenAsset={screen}
            archetype="fintech"
            size="md"
            device="dark"
            editing={editing}
            onReplaceScreen={(src) => onEdit((c) => ({ ...c, screenAsset: src }))}
          />
        </div>

        {/* Right Structured Metrics & KPIs */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#38BDF8', marginBottom: 20 }}>
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'ENGAGEMENT ACCELERATION'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 68,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#F1F5F9',
              marginBottom: 40,
            }}
          >
            <E
              slot="heading"
              value={content.heading ?? 'Validated Retention Lift.'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
            />
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
            {kpis.map((kpi, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  padding: '20px 28px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                  {kpi.label}
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 800, color: '#38BDF8' }}>
                  {kpi.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. Product Data Closing
export function ProductDataSlideClosing({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const contacts = content.contacts ?? ['api.wozku.io/docs', 'metrics@wozku.io', '99.99% SLA Guaranteed'];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#070A12', color: '#F1F5F9' }}>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 160px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#38BDF8', marginBottom: 28 }}>
          <E
            slot="eyebrow"
            value={content.eyebrow ?? 'ENTERPRISE DEPLOYMENT'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            color: '#F1F5F9',
            marginBottom: 48,
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Scale With Enterprise\nProduct Intelligence.'}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>

        <div style={{ display: 'flex', gap: 48, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '20px 40px' }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38BDF8' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: '#E2E8F0' }}>{c}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, right: 80, zIndex: 10 }}>
        <Logo src={logoUrl} editing={editing} onChange={onLogoChange} scale={logoScale} onScaleChange={onLogoScaleChange} />
      </div>
    </div>
  );
}
