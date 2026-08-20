import React from 'react';
import {
  E,
  SlideRenderProps,
  Logo,
} from '../../generator/PresentationCanvas';

/**
 * SWISS ENTERPRISE MINIMAL PRESENTATION SYSTEM
 * Characterized by:
 * - Stark white ground (#FFFFFF), deep charcoal ink (#18181B)
 * - Restrained typography and maximum content clarity
 */

// 1. Swiss Minimal Cover Slide
export function SwissSlideCover({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const lines = content.headingLines ?? ['Executive Board', 'Briefing.'];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#FFFFFF', color: '#0F172A' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #0F172A',
          paddingBottom: 20,
          zIndex: 10,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#0F172A' }}>
          <E
            slot="projectLabel"
            value={content.projectLabel ?? 'GOVERNANCE & AUDIT'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
          />
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#64748B' }}>
          <E
            slot="versionLabel"
            value={content.versionLabel ?? 'Q3 2026 // FINAL REPORT'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, versionLabel: v || undefined }))}
          />
        </span>
      </div>

      <div
        style={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1.3fr 0.7fr',
          padding: '140px 100px 80px',
          gap: 80,
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#2563EB', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 28 }}>
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'ANNUAL GENERAL MEETING // 2026'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 120,
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: '-0.04em',
              color: '#0F172A',
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
                    <span style={{ color: '#2563EB' }}>{line}</span>
                  ) : (
                    line
                  )}
                  {i < lines.length - 1 && <br />}
                </span>
              ))
            )}
          </h1>
        </div>

        <div style={{ borderLeft: '2px solid #E2E8F0', paddingLeft: 60, display: 'flex', flexDirection: 'column', gap: 32 }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 24, lineHeight: 1.6, color: '#475569' }}>
            <E
              slot="tagline"
              value={content.tagline ?? 'Comprehensive operational governance and strategic capital allocation report.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, tagline: v || undefined }))}
            />
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 30, height: 2, background: '#2563EB' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748B' }}>
              <E
                slot="confidentialLabel"
                value={content.confidentialLabel ?? 'CONFIDENTIAL // BOARD LEVEL'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, confidentialLabel: v }))}
              />
            </span>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, right: 100, zIndex: 10 }}>
        <Logo src={logoUrl} editing={editing} onChange={onLogoChange} scale={logoScale} onScaleChange={onLogoScaleChange} />
      </div>
    </div>
  );
}

// 2. Swiss Minimal P&L & Margin Expansion Slide
export function SwissSlideMetrics({ content, num, editing, onEdit }: SlideRenderProps) {
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#FFFFFF', color: '#0F172A' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '2px solid #0F172A',
          paddingBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#64748B',
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Financial Performance'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#2563EB', fontWeight: 700 }}>{num}</span>
      </div>

      <div
        style={{
          padding: '160px 100px 80px',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: 80,
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#2563EB', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'OPERATING MARGIN EXPANSION'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: '#0F172A',
              marginBottom: 32,
              whiteSpace: 'pre-line',
            }}
          >
            <E
              slot="heading"
              value={content.heading ?? 'Operating Margins\nExpanded +240bps.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
            />
          </h2>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 24, lineHeight: 1.6, color: '#475569' }}>
            <E
              slot="body"
              value={
                content.body ??
                'Disciplined cost rationalization and recurring enterprise contracts reinforced our balance sheet against macroeconomic volatility.'
              }
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
          </p>
        </div>

        {/* Structured Corporate Metric Box */}
        <div
          style={{
            border: '2px solid #0F172A',
            padding: '48px 40px',
            background: '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2563EB' }}>
            <E
              slot="metricLabel"
              value={content.metricLabel ?? 'EBITDA Margin'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, metricLabel: v || undefined }))}
            />
          </span>

          <div style={{ fontFamily: 'var(--font-display)', fontSize: 92, fontWeight: 800, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.04em' }}>
            <E
              slot="metricText"
              value={content.metricText ?? '34.2%'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, metricText: v || undefined }))}
            />
          </div>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#64748B', marginTop: 12 }}>
            +240bps YoY vs 31.8% benchmark target.
          </p>
        </div>
      </div>
    </div>
  );
}
