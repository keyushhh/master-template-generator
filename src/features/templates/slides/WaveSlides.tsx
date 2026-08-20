import React from 'react';
import {
  E,
  SlideRenderProps,
  Logo,
} from '../../generator/PresentationCanvas';

/**
 * THE WAVE ORGANIC PRESENTATION SYSTEM
 * Characterized by:
 * - Fluid pastel tones, soft teal accents & Plus Jakarta Sans typography
 * - Generous breathing room, sustainability & wellness frameworks
 * - Circular economy metrics and global community sourcing cards
 */

// 1. Wave Organic Cover Slide
export function WaveSlideCover({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const lines = content.headingLines ?? ['The Wave Organic', 'Impact Report.'];

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #E6F4F1 0%, #D2EBE4 45%, #B7E4D8 100%)',
        color: '#0F2D27',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(13, 148, 136, 0.25)',
          paddingBottom: 20,
          zIndex: 10,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#0F766E' }}>
          <E
            slot="projectLabel"
            value={content.projectLabel ?? 'PALOMA SUSTAINABILITY'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
          />
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#0D9488' }}>
          <E
            slot="versionLabel"
            value={content.versionLabel ?? 'IMPACT CYCLE 2026'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, versionLabel: v || undefined }))}
          />
        </span>
      </div>

      <div
        style={{
          padding: '140px 100px 80px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0D9488' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#0F766E' }}>
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'CIRCULAR DESIGN INITIATIVE'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 120,
            fontWeight: 700,
            lineHeight: 0.96,
            letterSpacing: '-0.03em',
            color: '#0F2D27',
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
                  <span style={{ color: '#0D9488' }}>{line}</span>
                ) : (
                  line
                )}
                {i < lines.length - 1 && <br />}
              </span>
            ))
          )}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 40, borderTop: '1px solid rgba(13, 148, 136, 0.25)', paddingTop: 32, maxWidth: 980 }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 24, lineHeight: 1.6, color: '#115E59' }}>
            <E
              slot="tagline"
              value={content.tagline ?? 'Restorative wellness and regenerative materials for a thriving future.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, tagline: v || undefined }))}
            />
          </p>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, right: 100, zIndex: 10 }}>
        <Logo src={logoUrl} editing={editing} onChange={onLogoChange} scale={logoScale} onScaleChange={onLogoScaleChange} />
      </div>
    </div>
  );
}

// 2. Wave Impact Metrics Slide (450K+ Trees, 1,200T CO2)
export function WaveSlideMetrics({ content, num, editing, onEdit }: SlideRenderProps) {
  const kpis = content.kpis ?? [
    { label: 'Trees Planted', value: '450K+' },
    { label: 'CO2 Offset', value: '1,200T' },
    { label: 'Community Trust', value: '4.9/5' },
  ];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#F4FAF8', color: '#0F2D27' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(13, 148, 136, 0.2)',
          paddingBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#0F766E',
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Ecological Balance'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#0D9488', fontWeight: 700 }}>{num}</span>
      </div>

      <div
        style={{
          padding: '160px 100px 80px',
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
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#0F2D27',
            marginBottom: 60,
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Measurable Ecological Harmony.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>

        {/* 3 Calm Organic Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32 }}>
          {kpis.map((kpi, i) => (
            <div
              key={i}
              style={{
                background: '#E6F7F4',
                border: '1px solid rgba(13, 148, 136, 0.25)',
                padding: '40px 32px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#0F766E' }}>
                {kpi.label}
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 800, color: '#0D9488' }}>
                {kpi.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
