import React from 'react';
import {
  E,
  SlideRenderProps,
  Logo,
} from '../../generator/PresentationCanvas';

/**
 * INVESTOR MEMORANDUM PRESENTATION SYSTEM
 * Characterized by:
 * - Deep midnight navy (#0A0F1D) + warm champagne gold (#D97706 / #FBBF24)
 * - Institutional deal terms, valuation matrices, and return scenarios
 * - Space Grotesk display typography and Space Mono numerals
 */

// 1. Investor Memo Cover
export function InvestorMemoSlideCover({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const lines = content.headingLines ?? ['Series A Syndicate', 'Memorandum.'];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#0A0F1D', color: '#F8FAFC' }}>

      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '2px solid rgba(217, 119, 6, 0.4)',
          paddingBottom: 24,
          zIndex: 20,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FBBF24' }}>
          <E
            slot="projectLabel"
            value={content.projectLabel ?? 'INVESTMENT MEMORANDUM // CONFIDENTIAL'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
          />
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#94A3B8' }}>
          <E
            slot="versionLabel"
            value={content.versionLabel ?? 'ROUND TARGET: $15,000,000'}
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
          padding: '140px 100px 80px',
          gap: 80,
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#F59E0B', marginBottom: 28 }}>
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'VENTURE SYNDICATE MEMO // 2026'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 104,
              fontWeight: 700,
              lineHeight: 0.96,
              letterSpacing: '-0.04em',
              color: '#F8FAFC',
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
                    <span style={{ color: '#FBBF24' }}>{line}</span>
                  ) : (
                    line
                  )}
                  {i < lines.length - 1 && <br />}
                </span>
              ))
            )}
          </h1>
        </div>

        <div style={{ borderLeft: '2px solid rgba(217, 119, 6, 0.3)', paddingLeft: 60, display: 'flex', flexDirection: 'column', gap: 32 }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 24, lineHeight: 1.6, color: '#CBD5E1' }}>
            <E
              slot="tagline"
              value={content.tagline ?? 'Institutional terms, capital allocation model, and venture growth trajectories.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, tagline: v || undefined }))}
            />
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 30, height: 2, background: '#FBBF24' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94A3B8' }}>
              <E
                slot="confidentialLabel"
                value={content.confidentialLabel ?? 'ACCREDITED INVESTORS ONLY'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, confidentialLabel: v }))}
              />
            </span>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, right: 100, zIndex: 20 }}>
        <Logo src={logoUrl} editing={editing} onChange={onLogoChange} scale={logoScale} onScaleChange={onLogoScaleChange} />
      </div>
    </div>
  );
}

// 2. Investor Memo Terms & Valuation
export function InvestorMemoSlideTerms({ content, num, editing, onEdit }: SlideRenderProps) {
  const rows = content.rows ?? [
    { dim: 'Target Round Size', cur: '$15.0M', tgt: 'Preferred Series A', delta: 'Lead Committed' },
    { dim: 'Pre-Money Valuation', cur: '$60.0M', tgt: '$75.0M Post-Money', delta: '20.0% Dilution' },
    { dim: 'ARR Run Rate', cur: '$4.2M', tgt: '$12.0M Q4 2027', delta: '+185% YoY' },
  ];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#0A0F1D', color: '#F8FAFC' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '2px solid rgba(217, 119, 6, 0.4)',
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
            value={content.hudLabel ?? 'Deal Architecture'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#FBBF24', fontWeight: 700 }}>{num}</span>
      </div>

      <div
        style={{
          padding: '150px 100px 80px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#F59E0B', marginBottom: 16 }}>
          <E
            slot="eyebrow"
            value={content.eyebrow ?? 'ROUND STRUCTURE'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#F8FAFC',
            marginBottom: 48,
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Syndicate Deal Terms & Allocation.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>

        {/* Structured Terms Table */}
        <div style={{ border: '1px solid rgba(217, 119, 6, 0.3)', background: 'rgba(255,255,255,0.02)' }}>
          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                padding: '24px 32px',
                borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                alignItems: 'center',
              }}
            >
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 600, color: '#FFFFFF' }}>
                {row.dim}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: '#FBBF24' }}>
                {row.cur}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: '#94A3B8' }}>
                {row.tgt}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#10B981', textAlign: 'right' }}>
                {row.delta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 3. Investor Memo Closing
export function InvestorMemoSlideClosing({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const contacts = content.contacts ?? ['partners@venturesyndicate.io', 'ir.venturesyndicate.io', 'San Francisco // New York'];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#050811', color: '#F8FAFC' }}>
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
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FBBF24', marginBottom: 28 }}>
          <E
            slot="eyebrow"
            value={content.eyebrow ?? 'SYNDICATE ADJOURNMENT'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            color: '#F8FAFC',
            marginBottom: 48,
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Join Us in Backing the Next\nCategory-Defining Leader.'}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>

        <div style={{ display: 'flex', gap: 48, border: '1px solid rgba(217, 119, 6, 0.3)', background: 'rgba(255,255,255,0.03)', padding: '20px 40px' }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FBBF24' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: '#E2E8F0' }}>{c}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, right: 100, zIndex: 20 }}>
        <Logo src={logoUrl} editing={editing} onChange={onLogoChange} scale={logoScale} onScaleChange={onLogoScaleChange} />
      </div>
    </div>
  );
}
