import React from 'react';
import {
  E,
  SlideRenderProps,
  Logo,
} from '../../generator/PresentationCanvas';
import {
  PhoneMockup,
  DualPhoneComposition,
  TriplePhoneComposition,
} from '../components/MobileMockup';

/**
 * PRODUCT SHOWCASE PRESENTATION SYSTEM
 * Characterized by:
 * - Dedicated smooth dark titanium background with subtle radial spotlight
 * - Zero default grid hairlines
 * - Replaceable PNG screen assets in all mobile mockups
 */

// 1. Product Showcase Cover
export function ProductShowcaseSlideCover({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const lines = content.headingLines ?? ['Next Generation', 'Mobile Experience.'];
  const leftScreen = content.screenAssets?.[0] || content.screenAsset;
  const rightScreen = content.screenAssets?.[1];

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(120% 100% at 80% 50%, #18181B 0%, #09090B 100%)',
        color: '#FFFFFF',
      }}
    >
      {/* Top HUD */}
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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#34D399' }}>
          <E
            slot="projectLabel"
            value={content.projectLabel ?? 'PRODUCT LAUNCH // V3.0'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
          />
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#A1A1AA' }}>
          <E
            slot="versionLabel"
            value={content.versionLabel ?? 'KEYNOTE 2026'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, versionLabel: v || undefined }))}
          />
        </span>
      </div>

      {/* Hero 2-Column Split: Headline Left, Dual Phone Right */}
      <div
        style={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
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
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              marginBottom: 32,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: '#6EE7B7' }}>
              <E
                slot="eyebrow"
                value={content.eyebrow ?? 'FLAGSHIP RELEASE'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
              />
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 0.96,
              letterSpacing: '-0.04em',
              color: '#FFFFFF',
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
                    <span style={{ color: '#34D399' }}>{line}</span>
                  ) : (
                    line
                  )}
                  {i < lines.length - 1 && <br />}
                </span>
              ))
            )}
          </h1>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 24, lineHeight: 1.6, color: '#A1A1AA', maxWidth: 640 }}>
            <E
              slot="tagline"
              value={content.tagline ?? 'Engineered for seamless mobile interactions, sub-second responses, and fluid user delight.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, tagline: v || undefined }))}
            />
          </p>
        </div>

        {/* Right Dual Phone Mockup with Replaceable PNG Assets */}
        <div className="flex items-center justify-center">
          <DualPhoneComposition
            leftScreen={leftScreen}
            rightScreen={rightScreen}
            editing={editing}
            onEditLeft={(src) =>
              onEdit((c) => {
                const assets = Array.isArray(c.screenAssets) ? [...c.screenAssets] : [];
                assets[0] = src;
                return { ...c, screenAssets: assets, screenAsset: src };
              })
            }
            onEditRight={(src) =>
              onEdit((c) => {
                const assets = Array.isArray(c.screenAssets) ? [...c.screenAssets] : [];
                assets[1] = src;
                return { ...c, screenAssets: assets };
              })
            }
          />
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, right: 80, zIndex: 20 }}>
        <Logo src={logoUrl} editing={editing} onChange={onLogoChange} scale={logoScale} onScaleChange={onLogoScaleChange} />
      </div>
    </div>
  );
}

// 2. Product Showcase Single Hero Screen
export function ProductShowcaseSlideHero({ content, num, editing, onEdit }: SlideRenderProps) {
  const heroScreen = content.screenAsset || content.screenAssets?.[0];

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(120% 100% at 75% 50%, #18181B 0%, #09090B 100%)',
        color: '#FFFFFF',
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
          color: '#A1A1AA',
          zIndex: 20,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Single Screen Hero'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#34D399' }}>{num}</span>
      </div>

      <div
        style={{
          padding: '140px 80px 80px',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: 80,
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#34D399', marginBottom: 24 }}>
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'IMMERSIVE INTERFACE'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
              marginBottom: 32,
              whiteSpace: 'pre-line',
            }}
          >
            <E
              slot="heading"
              value={content.heading ?? 'Fluid Interactions.\nZero Friction.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
            />
          </h2>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 24, lineHeight: 1.6, color: '#A1A1AA', marginBottom: 40 }}>
            <E
              slot="body"
              value={
                content.body ??
                'Every micro-animation and tactile haptic response was designed from the ground up to keep users in flow state.'
              }
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
          </p>

          <div style={{ display: 'flex', gap: 32, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#71717A', textTransform: 'uppercase' }}>FPS Lock</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: '#34D399' }}>120Hz</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#71717A', textTransform: 'uppercase' }}>Latency</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: '#34D399' }}>&lt; 16ms</div>
            </div>
          </div>
        </div>

        {/* Large Single Phone with Replaceable Screen Asset */}
        <div className="flex items-center justify-center">
          <PhoneMockup
            screenAsset={heroScreen}
            archetype="fintech"
            size="lg"
            device="dark"
            editing={editing}
            onReplaceScreen={(src) => onEdit((c) => ({ ...c, screenAsset: src }))}
          />
        </div>
      </div>
    </div>
  );
}

// 3. Product Showcase Trio Ecosystem
export function ProductShowcaseSlideTrio({ content, num, editing, onEdit }: SlideRenderProps) {
  const screens = (content.screenAssets as string[]) || [];

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(100% 100% at 50% 60%, #18181B 0%, #09090B 100%)',
        color: '#FFFFFF',
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
          color: '#A1A1AA',
          zIndex: 20,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Product Ecosystem'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#34D399' }}>{num}</span>
      </div>

      <div
        style={{
          padding: '140px 80px 80px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#34D399', marginBottom: 16 }}>
          <E
            slot="eyebrow"
            value={content.eyebrow ?? 'COMPLETE PRODUCT SUITE'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#FFFFFF',
            marginBottom: 36,
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Unified Across All Touchpoints.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>

        {/* Triple Phone Composition with Replaceable Screen Assets */}
        <TriplePhoneComposition
          screens={screens}
          editing={editing}
          onEditScreen={(idx, src) =>
            onEdit((c) => {
              const arr = Array.isArray(c.screenAssets) ? [...c.screenAssets] : [];
              arr[idx] = src;
              return { ...c, screenAssets: arr };
            })
          }
        />
      </div>
    </div>
  );
}

// 4. Product Showcase Closing
export function ProductShowcaseSlideClosing({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const contacts = content.contacts ?? ['appstore.com/wozku', 'product@wozku.io', 'San Francisco // Tokyo'];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#050507', color: '#FFFFFF' }}>
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
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#34D399', marginBottom: 28 }}>
          <E
            slot="eyebrow"
            value={content.eyebrow ?? 'AVAILABLE WORLDWIDE'}
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
            color: '#FFFFFF',
            marginBottom: 48,
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Experience the Future\nOf Mobile Today.'}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>

        <div style={{ display: 'flex', gap: 48, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '20px 40px' }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: '#E4E4E7' }}>{c}</span>
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
