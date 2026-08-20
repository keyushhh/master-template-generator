import React from 'react';
import {
  E,
  EditorialLabel,
  SlideRenderProps,
  Logo,
  PLACEHOLDER,
} from '../../generator/PresentationCanvas';

/**
 * THE EDITORIAL PRESENTATION SYSTEM
 * Characterized by:
 * - High-contrast Playfair Display serif headlines with italic accents
 * - Magazine-grade asymmetric layouts and generous whitespace
 * - Refined hairline rules and warm editorial stone grounds
 * - Literary quote compositions and narrative storytelling
 */

// 1. Editorial Cover
export function EditorialSlideCover({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const lines = content.headingLines ?? ['The Editorial', 'Manifesto.'];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#FDFBF7' }}>
      {/* Top Editorial Header Strip */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--neutral-300)',
          paddingBottom: 24,
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--neutral-900)',
          }}
        >
          <E
            slot="projectLabel"
            value={content.projectLabel ?? 'STUDIO EDITORIAL // VOL. 01'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
          />
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            letterSpacing: '0.15em',
            color: 'var(--neutral-500)',
          }}
        >
          <E
            slot="versionLabel"
            value={content.versionLabel ?? 'AUTUMN 2026 // ISSUE N° 04'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, versionLabel: v || undefined }))}
          />
        </span>
      </div>

      {/* Asymmetric 2-Column Cover Layout */}
      <div
        style={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1.25fr 0.75fr',
          padding: '140px 100px 80px',
          gap: 90,
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--emerald-600)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              marginBottom: 28,
            }}
          >
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'PRESENTED BY STUDIO WOZKU // 2026'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 124,
              fontWeight: 500,
              lineHeight: 0.98,
              letterSpacing: '-0.03em',
              color: 'var(--neutral-900)',
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
                    <span style={{ fontStyle: 'italic', color: 'var(--emerald-600)' }}>{line}</span>
                  ) : (
                    line
                  )}
                  {i < lines.length - 1 && <br />}
                </span>
              ))
            )}
          </h1>
        </div>

        {/* Right Manifesto Sidebar */}
        <div
          style={{
            borderLeft: '1px solid var(--neutral-300)',
            paddingLeft: 60,
            display: 'flex',
            flexDirection: 'column',
            gap: 36,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 26,
              lineHeight: 1.65,
              color: 'var(--neutral-600)',
            }}
          >
            <E
              slot="tagline"
              value={
                content.tagline ??
                'Distinctive aesthetics and timeless editorial restraint for modern luxury brands.'
              }
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, tagline: v || undefined }))}
            />
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 50, height: 1, background: 'var(--emerald-600)' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: 'var(--neutral-500)',
              }}
            >
              <E
                slot="confidentialLabel"
                value={content.confidentialLabel ?? 'CONFIDENTIAL // PUBLICATION'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, confidentialLabel: v }))}
              />
            </span>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, right: 100, zIndex: 10 }}>
        <Logo
          src={logoUrl}
          editing={editing}
          onChange={onLogoChange}
          scale={logoScale}
          onScaleChange={onLogoScaleChange}
        />
      </div>
    </div>
  );
}

// 2. Editorial Executive Summary / Manifesto Spread
export function EditorialSlideExec({ content, num, editing, onEdit }: SlideRenderProps) {
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#FDFBF7' }}>
      {/* Top Strip */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--neutral-300)',
          paddingBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--neutral-500)',
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Executive Narrative'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span>{num}</span>
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
        <EditorialLabel slot="eyebrow">
          <E
            slot="eyebrow"
            value={content.eyebrow ?? 'Strategic Vision'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </EditorialLabel>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 92,
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: 50,
            color: 'var(--neutral-900)',
            whiteSpace: 'pre-line',
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Elegance Through\nRestraint.'}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 100, alignItems: 'center' }}>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 30,
              lineHeight: 1.65,
              color: 'var(--neutral-600)',
              whiteSpace: 'pre-line',
            }}
          >
            <E
              slot="body"
              value={
                content.body ??
                'In an era of hyper-accelerated digital noise, thoughtful high-contrast typography and intentional negative space build lasting brand equity.'
              }
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
          </p>

          <div
            style={{
              borderLeft: '1px solid var(--neutral-300)',
              paddingLeft: 60,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                color: 'var(--emerald-600)',
              }}
            >
              <E
                slot="metricLabel"
                value={content.metricLabel ?? 'Affinity Lift'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, metricLabel: v || undefined }))}
              />
            </span>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 88,
                fontWeight: 600,
                color: 'var(--neutral-900)',
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              <E
                slot="metricText"
                value={content.metricText ?? '+184%'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, metricText: v || undefined }))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. Editorial Two-Column Story / Narrative Comparison
export function EditorialSlideStory({ content, num, editing, onEdit }: SlideRenderProps) {
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#FDFBF7' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--neutral-300)',
          paddingBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--neutral-500)',
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Market Dynamics'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span>{num}</span>
      </div>

      <div
        style={{
          padding: '160px 100px 80px',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 90,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Left Column: Legacy Paradigm */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--neutral-300)', paddingRight: 60 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--neutral-400)',
              marginBottom: 20,
            }}
          >
            <E
              slot="leftLabel"
              value={content.leftLabel ?? 'Legacy Paradigm'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, leftLabel: v || undefined }))}
            />
          </span>

          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 52,
              fontWeight: 500,
              lineHeight: 1.1,
              color: 'var(--neutral-500)',
              marginBottom: 24,
              whiteSpace: 'pre-line',
            }}
          >
            <E
              slot="leftHeading"
              value={content.leftHeading ?? 'Generic Velocity\n& Volume.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, leftHeading: v || undefined }))}
            />
          </h3>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 22, lineHeight: 1.6, color: 'var(--neutral-500)', marginBottom: 36 }}>
            <E
              slot="leftBody"
              value={
                content.leftBody ??
                'Brands relying on template mass-production experience rapid commoditization and declining audience loyalty.'
              }
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, leftBody: v || undefined }))}
            />
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 'auto' }}>
            {(content.leftAttributes ?? ['Commoditized Aesthetics', 'Low Recall Rates', 'Friction at Scale']).map(
              (attr, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 6, height: 6, background: 'var(--neutral-400)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--neutral-500)' }}>
                    {attr}
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Right Column: Editorial Standard */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--emerald-600)',
              marginBottom: 20,
            }}
          >
            <E
              slot="rightLabel"
              value={content.rightLabel ?? 'Editorial Standard'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, rightLabel: v || undefined }))}
            />
          </span>

          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 52,
              fontWeight: 600,
              lineHeight: 1.1,
              color: 'var(--neutral-900)',
              marginBottom: 24,
              whiteSpace: 'pre-line',
            }}
          >
            <E
              slot="rightHeading"
              value={content.rightHeading ?? 'Curated Heritage\n& Craft.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, rightHeading: v || undefined }))}
            />
          </h3>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 22, lineHeight: 1.6, color: 'var(--neutral-700)' }}>
            <E
              slot="rightBody"
              value={
                content.rightBody ??
                'Art direction treated as an enduring asset. Every publication, pitch, and touchpoint reflects bespoke discipline.'
              }
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, rightBody: v || undefined }))}
            />
          </p>
        </div>
      </div>
    </div>
  );
}

// 4. Editorial Impact Metrics Monument
export function EditorialSlideMetrics({ content, num, editing, onEdit }: SlideRenderProps) {
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#FDFBF7' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--neutral-300)',
          paddingBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--neutral-500)',
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="eyebrow"
            value={content.eyebrow ?? 'Audience Perception'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </span>
        <span>{num}</span>
      </div>

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
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 220,
            fontWeight: 500,
            lineHeight: 0.9,
            letterSpacing: '-0.05em',
            color: 'var(--neutral-900)',
            marginBottom: 40,
          }}
        >
          <E
            slot="stat"
            value={content.stat ?? '+184%'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, stat: v || undefined }))}
          />
        </div>

        <div style={{ width: 80, height: 1, background: 'var(--emerald-600)', marginBottom: 36 }} />

        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 28,
            lineHeight: 1.6,
            color: 'var(--neutral-600)',
            maxWidth: 960,
          }}
        >
          <E
            slot="label"
            value={
              content.label ??
              'Lift in perceived brand prestige and organic engagement across Q3 editorial initiatives.'
            }
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, label: v || undefined }))}
          />
        </p>
      </div>
    </div>
  );
}

// 5. Editorial Literary Quote
export function EditorialSlideQuote({ content, num, editing, onEdit }: SlideRenderProps) {
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#FDFBF7' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--neutral-300)',
          paddingBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--neutral-500)',
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="eyebrow"
            value={content.eyebrow ?? 'Design Philosophy'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </span>
        <span>{num}</span>
      </div>

      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 160px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 220,
            lineHeight: 0.5,
            color: 'var(--emerald-600)',
            marginBottom: 20,
            opacity: 0.7,
          }}
        >
          “
        </div>

        <blockquote
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 68,
            fontStyle: 'italic',
            fontWeight: 400,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
            color: 'var(--neutral-900)',
            marginBottom: 50,
            maxWidth: 1400,
          }}
        >
          <E
            slot="quote"
            value={
              content.quote ??
              'Combining classical high-contrast serifs with modern architectural grid systems creates enduring presence.'
            }
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, quote: v || undefined }))}
          />
        </blockquote>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 40, height: 1, background: 'var(--emerald-600)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>
            <E
              slot="author"
              value={content.author ?? 'Wozku Editorial Atelier'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, author: v || undefined }))}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

// 6. Editorial Closing / Farewell Slide
export function EditorialSlideClosing({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const contacts = content.contacts ?? ['editorial@wozku.local', 'studio.wozku.com', '+1 (555) 019-2831'];

  const editContact = (i: number, v: string) =>
    onEdit((c) => {
      const base = c.contacts && c.contacts.length ? c.contacts : contacts;
      const arr = base.map((x, j) => (j === i ? v || x : x));
      return { ...c, contacts: arr };
    });

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#151311', color: '#FDFBF7' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          paddingBottom: 24,
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--emerald-400)',
          }}
        >
          <E
            slot="eyebrow"
            value={content.eyebrow ?? 'CONCLUSION // VOLUME 01'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </span>
      </div>

      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 120px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 110,
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: '#FDFBF7',
            marginBottom: 60,
            maxWidth: 1300,
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Let us build something\ntimeless together.'}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>

        <div style={{ display: 'flex', gap: 60, borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 40 }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--emerald-400)' }}>
                Direct {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>
                <E
                  slot={`contacts.${i}`}
                  value={c}
                  editing={editing}
                  onCommit={(v) => editContact(i, v)}
                />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, right: 100, zIndex: 10 }}>
        <Logo
          src={logoUrl}
          editing={editing}
          onChange={onLogoChange}
          scale={logoScale}
          onScaleChange={onLogoScaleChange}
        />
      </div>
    </div>
  );
}
