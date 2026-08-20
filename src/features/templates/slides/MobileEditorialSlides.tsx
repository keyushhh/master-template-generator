import React from 'react';
import {
  E,
  EditorialLabel,
  SlideRenderProps,
  Logo,
} from '../../generator/PresentationCanvas';
import {
  PhoneMockup,
  DualPhoneComposition,
} from '../components/MobileMockup';

/**
 * MOBILE EDITORIAL PRESENTATION SYSTEM
 * Characterized by:
 * - Playfair Display editorial serifs + Plus Jakarta Sans
 * - Pure warm stone / oatmeal ground with zero grid hairlines
 * - Replaceable PNG screen assets
 */

// 1. Mobile Editorial Cover
export function MobileEditorialSlideCover({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const lines = content.headingLines ?? ['Atelier Mobile', 'Collection.'];
  const screen = content.screenAsset || content.screenAssets?.[0];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#F8F6F0', color: '#1C1917' }}>
      {/* Top Header */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E7E5E4',
          paddingBottom: 24,
          zIndex: 20,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1C1917' }}>
          <E
            slot="projectLabel"
            value={content.projectLabel ?? 'DIGITAL ATELIER // ISSUE N° 08'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
          />
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#78716C' }}>
          <E
            slot="versionLabel"
            value={content.versionLabel ?? 'AUTUMN // 2026'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, versionLabel: v || undefined }))}
          />
        </span>
      </div>

      <div
        style={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1.15fr 0.85fr',
          padding: '130px 100px 80px',
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#B45309', marginBottom: 28 }}>
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'BESPOKE DIGITAL CRAFTSMANSHIP'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 108,
              fontWeight: 500,
              lineHeight: 0.98,
              letterSpacing: '-0.03em',
              color: '#1C1917',
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
                    <span style={{ fontStyle: 'italic', color: '#B45309' }}>{line}</span>
                  ) : (
                    line
                  )}
                  {i < lines.length - 1 && <br />}
                </span>
              ))
            )}
          </h1>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 24, lineHeight: 1.65, color: '#57534E', maxWidth: 620 }}>
            <E
              slot="tagline"
              value={content.tagline ?? 'Translating haute-couture physical heritage into modern touch-driven digital experiences.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, tagline: v || undefined }))}
            />
          </p>
        </div>

        {/* Right Asymmetric Floating Phone with Replaceable PNG Asset */}
        <div className="flex items-center justify-center relative">
          <PhoneMockup
            screenAsset={screen}
            archetype="e-commerce"
            size="lg"
            rotation={-4}
            device="dark"
            editing={editing}
            onReplaceScreen={(src) => onEdit((c) => ({ ...c, screenAsset: src }))}
          />
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, right: 100, zIndex: 20 }}>
        <Logo src={logoUrl} editing={editing} onChange={onLogoChange} scale={logoScale} onScaleChange={onLogoScaleChange} />
      </div>
    </div>
  );
}

// 2. Mobile Editorial Asymmetric Narrative
export function MobileEditorialSlideAsymmetric({ content, num, editing, onEdit }: SlideRenderProps) {
  const leftScreen = content.screenAssets?.[0] || content.screenAsset;
  const rightScreen = content.screenAssets?.[1];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#F8F6F0', color: '#1C1917' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E7E5E4',
          paddingBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#78716C',
          zIndex: 20,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Curated Touchpoints'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span>{num}</span>
      </div>

      <div
        style={{
          padding: '140px 100px 80px',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 80,
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div>
          <EditorialLabel slot="eyebrow">
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'Physical & Digital Harmony'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </EditorialLabel>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 78,
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: '#1C1917',
              marginBottom: 36,
              whiteSpace: 'pre-line',
            }}
          >
            <E
              slot="heading"
              value={content.heading ?? 'Tactile Luxury\nIn Your Palm.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
            />
          </h2>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 24, lineHeight: 1.65, color: '#57534E' }}>
            <E
              slot="body"
              value={
                content.body ??
                'Every swipe, gesture, and animation breathes with the cadence of fine editorial design, elevating customer perception.'
              }
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
          </p>
        </div>

        {/* Dual Phone Composition with Replaceable Screen Assets */}
        <div className="flex items-center justify-center">
          <DualPhoneComposition
            leftScreen={leftScreen}
            rightScreen={rightScreen}
            editing={editing}
            onEditLeft={(src) =>
              onEdit((c) => {
                const arr = Array.isArray(c.screenAssets) ? [...c.screenAssets] : [];
                arr[0] = src;
                return { ...c, screenAssets: arr, screenAsset: src };
              })
            }
            onEditRight={(src) =>
              onEdit((c) => {
                const arr = Array.isArray(c.screenAssets) ? [...c.screenAssets] : [];
                arr[1] = src;
                return { ...c, screenAssets: arr };
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

// 3. Mobile Editorial Closing
export function MobileEditorialSlideClosing({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const contacts = content.contacts ?? ['atelier@wozku.luxury', 'atelier.wozku.com', 'Paris // Milan // New York'];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#1C1917', color: '#F8F6F0' }}>
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
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#F59E0B', marginBottom: 28 }}>
          <E
            slot="eyebrow"
            value={content.eyebrow ?? 'CONCLUSION // ATELIER EDITION'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 96,
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: '#F8F6F0',
            marginBottom: 48,
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Curating the Next Epoch\nof Digital Commerce.'}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>

        <div style={{ display: 'flex', gap: 48, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', padding: '20px 40px' }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>{c}</span>
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
