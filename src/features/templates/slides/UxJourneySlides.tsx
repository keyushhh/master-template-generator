import React from 'react';
import {
  E,
  SlideRenderProps,
  Logo,
} from '../../generator/PresentationCanvas';
import {
  PhoneMockup,
  PhoneWorkflowSequence,
} from '../components/MobileMockup';

/**
 * UX JOURNEY PRESENTATION SYSTEM
 * Characterized by:
 * - Clean deep slate/indigo background
 * - Multi-phone sequential workflow steps (01 -> 02 -> 03)
 * - Replaceable PNG screen assets
 */

// 1. UX Journey Cover
export function UxJourneySlideCover({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const lines = content.headingLines ?? ['User Journey', 'Architecture.'];
  const screen = content.screenAsset || content.screenAssets?.[0];

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(120% 100% at 80% 50%, #1E1B4B 0%, #0F172A 100%)',
        color: '#F8FAFC',
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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#818CF8' }}>
          <E
            slot="projectLabel"
            value={content.projectLabel ?? 'EXPERIENCE AUDIT // UX ROADMAP'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
          />
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#94A3B8' }}>
          <E
            slot="versionLabel"
            value={content.versionLabel ?? 'Q4 2026 // REDESIGN'}
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
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(129, 140, 248, 0.4)',
              marginBottom: 32,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: '#A5B4FC' }}>
              <E
                slot="eyebrow"
                value={content.eyebrow ?? 'END-TO-END PRODUCT FLOW'}
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
                    <span style={{ color: '#818CF8' }}>{line}</span>
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
              value={content.tagline ?? 'Visualizing step-by-step user onboarding, friction reduction, and conversion optimization.'}
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, tagline: v || undefined }))}
            />
          </p>
        </div>

        {/* Right Phone Mockup with Replaceable PNG */}
        <div className="flex items-center justify-center">
          <PhoneMockup
            screenAsset={screen}
            archetype="onboarding"
            size="lg"
            device="midnight"
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

// 2. UX Journey 3-Step Phone Workflow Sequence
export function UxJourneySlideFlow({ content, num, editing, onEdit }: SlideRenderProps) {
  const screens = (content.screenAssets as string[]) || [];

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(100% 100% at 50% 50%, #1E1B4B 0%, #0F172A 100%)',
        color: '#F8FAFC',
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
            value={content.hudLabel ?? 'Step-by-Step Workflow'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#818CF8' }}>{num}</span>
      </div>

      <div
        style={{
          padding: '130px 80px 60px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#818CF8', marginBottom: 12 }}>
          <E
            slot="eyebrow"
            value={content.eyebrow ?? '3-STEP USER WORKFLOW'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
          />
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 54,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#F8FAFC',
            marginBottom: 36,
            textAlign: 'center',
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'From Onboarding to Instant Conversion.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>

        {/* 3 Sequential Connected Phones with Replaceable PNGs */}
        <PhoneWorkflowSequence
          screens={screens}
          editing={editing}
          onEditScreen={(idx, src) =>
            onEdit((c) => {
              const arr = Array.isArray(c.screenAssets) ? [...c.screenAssets] : [];
              arr[idx] = src;
              return { ...c, screenAssets: arr };
            })
          }
          steps={[
            { stepNum: '01', label: 'Biometric Login', description: 'Face-ID authentication in under 200ms.', archetype: 'onboarding' },
            { stepNum: '02', label: 'Streamlined Cart', description: 'Real-time pricing and automated discounts.', archetype: 'e-commerce' },
            { stepNum: '03', label: '1-Tap Settlement', description: 'Zero-redirect instant confirmation.', archetype: 'checkout' },
          ]}
        />
      </div>
    </div>
  );
}

// 3. UX Journey Before / After Comparison
export function UxJourneySlideBeforeAfter({ content, num, editing, onEdit }: SlideRenderProps) {
  const leftScreen = content.screenAssets?.[0] || content.screenAsset;
  const rightScreen = content.screenAssets?.[1];

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(100% 100% at 50% 50%, #1E1B4B 0%, #0F172A 100%)',
        color: '#F8FAFC',
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
            value={content.hudLabel ?? 'UX Transformation'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#818CF8' }}>{num}</span>
      </div>

      <div
        style={{
          padding: '140px 80px 80px',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 60,
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Left: Legacy Experience */}
        <div className="flex items-center gap-8 p-6 bg-white/[0.02] border border-white/10">
          <PhoneMockup
            screenAsset={leftScreen}
            archetype="activity"
            size="sm"
            device="dark"
            editing={editing}
            onReplaceScreen={(src) =>
              onEdit((c) => {
                const arr = Array.isArray(c.screenAssets) ? [...c.screenAssets] : [];
                arr[0] = src;
                return { ...c, screenAssets: arr, screenAsset: src };
              })
            }
          />
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[11px] font-bold text-rose-400 uppercase tracking-widest">
              Legacy Journey
            </span>
            <h4 className="text-[22px] font-bold text-neutral-300">14 Form Fields & Multi-Page Handoff</h4>
            <p className="text-[14px] text-neutral-400 leading-relaxed">
              High drop-off rate, slow 8-second page loads, and confusing verification redirects.
            </p>
            <div className="text-[18px] font-extrabold text-rose-400 mt-2">68.8% Drop-off</div>
          </div>
        </div>

        {/* Right: Modern Native Flow */}
        <div className="flex items-center gap-8 p-6 bg-indigo-950/30 border border-indigo-500/40">
          <PhoneMockup
            screenAsset={rightScreen}
            archetype="checkout"
            size="sm"
            device="midnight"
            editing={editing}
            onReplaceScreen={(src) =>
              onEdit((c) => {
                const arr = Array.isArray(c.screenAssets) ? [...c.screenAssets] : [];
                arr[1] = src;
                return { ...c, screenAssets: arr };
              })
            }
          />
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[11px] font-bold text-indigo-400 uppercase tracking-widest">
              Redesigned Flow
            </span>
            <h4 className="text-[22px] font-bold text-white">1-Tap Biometric Confirmation</h4>
            <p className="text-[14px] text-neutral-300 leading-relaxed">
              Sub-second completion, zero-form entry, and persistent authenticated wallet token.
            </p>
            <div className="text-[18px] font-extrabold text-indigo-400 mt-2">94.2% Completion Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 4. UX Journey Closing
export function UxJourneySlideClosing({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const contacts = content.contacts ?? ['design-system@wozku.io', 'wozku.io/ux', 'San Francisco // London'];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#020617', color: '#F8FAFC' }}>
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
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#818CF8', marginBottom: 28 }}>
          <E
            slot="eyebrow"
            value={content.eyebrow ?? 'ROLLOUT ROADMAP'}
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
            color: '#F8FAFC',
            marginBottom: 48,
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Accelerate Your Product\nUser Journey.'}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>

        <div style={{ display: 'flex', gap: 48, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '20px 40px' }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#818CF8' }} />
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
