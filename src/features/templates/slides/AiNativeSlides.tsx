import React from 'react';
import {
  E,
  SlideRenderProps,
  Glow,
  Logo,
} from '../../generator/PresentationCanvas';

/**
 * AI-NATIVE PITCH DECK PRESENTATION SYSTEM
 * Characterized by:
 * - Cyber violet & neon status indicators
 * - Dark mode terminal architecture
 * - Glassmorphic telemetry panels
 * - 4-node agentic workflow pipeline diagrams
 * - Engineering metrics dashboards with live progress bars
 */

// 1. AI-Native Cover Slide
export function AiNativeSlideCover({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const lines = content.headingLines ?? ['AI Native™', 'Pitch Deck.'];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#0B071A', color: '#FFFFFF' }}>
      <Glow style={{ top: '20%', left: '50%', transform: 'translate(-50%, -50%)', width: 1000, height: 1000, background: 'radial-gradient(circle, rgba(124, 58, 237, 0.4) 0%, rgba(124,58,237,0) 70%)', opacity: 0.35 }} />

      {/* Top Futuristic HUD Bar */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 80,
          right: 80,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#A78BFA', boxShadow: '0 0 14px #8B5CF6' }} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#C4B5FD',
            }}
          >
            <E
              slot="projectLabel"
              value={content.projectLabel ?? 'FOUNDRY AGENTIC SYSTEMS'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, projectLabel: v || undefined }))}
            />
          </span>
        </div>

        <div
          style={{
            border: '1px solid rgba(139, 92, 246, 0.3)',
            background: 'rgba(255,255,255,0.04)',
            padding: '6px 18px',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.18em',
              color: '#A1A1AA',
            }}
          >
            <E
              slot="versionLabel"
              value={content.versionLabel ?? 'OCT 2026 // V1.0'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, versionLabel: v || undefined }))}
            />
          </span>
        </div>
      </div>

      {/* Centered Futuristic Hero Content */}
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 180px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 22px',
            background: 'rgba(124, 58, 237, 0.15)',
            border: '1px solid rgba(139, 92, 246, 0.5)',
            marginBottom: 36,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#C4B5FD',
            }}
          >
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'SERIES A DECK // OCTOBER 2026'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
            />
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 130,
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            color: '#FFFFFF',
            marginBottom: 36,
            maxWidth: 1500,
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
                  <span style={{ color: '#A78BFA', textShadow: '0 0 50px rgba(167,139,250,0.45)' }}>
                    {line}
                  </span>
                ) : (
                  line
                )}
                {i < lines.length - 1 && <br />}
              </span>
            ))
          )}
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 24,
            lineHeight: 1.6,
            color: '#A1A1AA',
            maxWidth: 880,
            margin: '0 auto',
          }}
        >
          <E
            slot="tagline"
            value={
              content.tagline ??
              'Autonomous intelligence pipelines for modern engineering organizations.'
            }
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, tagline: v || undefined }))}
          />
        </p>
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
          zIndex: 10,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.15em', color: '#71717A' }}>
          <E
            slot="confidentialLabel"
            value={content.confidentialLabel ?? 'PROPRIETARY AND CONFIDENTIAL'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, confidentialLabel: v }))}
          />
        </span>
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

// 2. AI-Native System Architecture / Table of Contents
export function AiNativeSlideOverview({ content, num, editing, onEdit }: SlideRenderProps) {
  const parts = content.parts ?? [
    { title: 'The Autonomous Shift', description: 'Replacing brittle mechanical scripts with self-healing LLM agent networks.' },
    { title: 'Foundry Engine Core', description: 'Distributed multi-agent pipeline with deterministic validation gates.' },
    { title: 'Enterprise Traction', description: '42 enterprise deployments with 10x developer output acceleration.' },
    { title: 'Deployment Roadmap', description: 'Scaling autonomous test suites and production code repair in Q4.' },
  ];

  const editPart = (i: number, patch: Partial<(typeof parts)[number]>) =>
    onEdit((c) => {
      const arr = (c.parts ?? parts).map((p, j) => (j === i ? { ...p, ...patch } : p));
      return { ...c, parts: arr };
    });

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#0B071A', color: '#FFFFFF' }}>
      <Glow style={{ top: -200, right: -200, width: 800, height: 800, background: 'radial-gradient(circle, rgba(124, 58, 237, 0.25) 0%, transparent 70%)' }} />

      {/* Top HUD */}
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
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'System Architecture & Agenda'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#A78BFA' }}>{num}</span>
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
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            marginBottom: 60,
            color: '#FFFFFF',
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'System Architecture & Objectives.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>

        {/* 4 Glass Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {parts.slice(0, 4).map((p, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                padding: '36px 40px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                backdropFilter: 'blur(10px)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#A78BFA',
                    background: 'rgba(124,58,237,0.2)',
                    padding: '4px 10px',
                    border: '1px solid rgba(167,139,250,0.3)',
                  }}
                >
                  NODE // 0{i + 1}
                </span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A78BFA' }} />
              </div>

              <h4
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  fontWeight: 600,
                  color: '#FFFFFF',
                }}
              >
                <E
                  slot={`parts.${i}.title`}
                  value={p.title}
                  editing={editing}
                  onCommit={(v) => editPart(i, { title: v || p.title })}
                />
              </h4>

              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 18, lineHeight: 1.6, color: '#A1A1AA' }}>
                <E
                  slot={`parts.${i}.description`}
                  value={p.description}
                  editing={editing}
                  multiline
                  onCommit={(v) => editPart(i, { description: v })}
                />
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 3. AI-Native Problem & Bottleneck Slide
export function AiNativeSlideProblem({ content, num, editing, onEdit }: SlideRenderProps) {
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#0B071A', color: '#FFFFFF' }}>
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
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Market Bottleneck'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#A78BFA' }}>{num}</span>
      </div>

      <div
        style={{
          padding: '160px 80px 80px',
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
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              marginBottom: 28,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: '#FCA5A5' }}>
              <E
                slot="eyebrow"
                value={content.eyebrow ?? 'DEVELOPER PRODUCTIVITY BOTTLENECK'}
                editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))}
              />
            </span>
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
              marginBottom: 32,
              whiteSpace: 'pre-line',
            }}
          >
            <E
              slot="heading"
              value={content.heading ?? 'Developers Spend 60%\nOn Routine Labor.'}
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
                'Modern engineering teams lose thousands of hours writing boilerplate, triaging alerts, and managing flaky tests. Our agentic pipelines execute workflows end-to-end.'
              }
              editing={editing}
              multiline
              onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))}
            />
          </p>
        </div>

        {/* Right Telemetry KPI Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            padding: '50px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            backdropFilter: 'blur(12px)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C4B5FD' }}>
            <E
              slot="metricLabel"
              value={content.metricLabel ?? 'Engineer Output Acceleration'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, metricLabel: v || undefined }))}
            />
          </span>

          <div style={{ fontFamily: 'var(--font-display)', fontSize: 92, fontWeight: 800, color: '#A78BFA', lineHeight: 1, letterSpacing: '-0.04em' }}>
            <E
              slot="metricText"
              value={content.metricText ?? '10x Speed'}
              editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, metricText: v || undefined }))}
            />
          </div>

          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', marginTop: 12 }}>
            <div style={{ width: '85%', height: '100%', background: 'linear-gradient(90deg, #7C3AED, #A78BFA)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// 4. AI-Native Telemetry & Live Metrics Dashboard
export function AiNativeSlideMetrics({ content, num, editing, onEdit }: SlideRenderProps) {
  const bars = content.bars ?? [
    { label: 'Synthetic Test Passing Rate', pct: 99.4, active: true },
    { label: 'Code Repair Success Rate', pct: 94.2, active: true },
    { label: 'Zero-Shot Patch Accuracy', pct: 88.7, active: false },
  ];

  const kpis = content.kpis ?? [
    { label: 'Avg PR Resolution', value: '42s' },
    { label: 'Cost Reduction', value: '78%' },
    { label: 'ARR Run Rate', value: '$8.4M' },
  ];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#0B071A', color: '#FFFFFF' }}>
      <Glow style={{ bottom: -200, left: -200, width: 800, height: 800, background: 'radial-gradient(circle, rgba(124, 58, 237, 0.3) 0%, transparent 70%)' }} />

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
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'System Telemetry & Accuracy'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#A78BFA' }}>{num}</span>
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
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            marginBottom: 48,
            color: '#FFFFFF',
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Deterministic Results at Scale.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>

        {/* 3 Telemetry Progress Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 48 }}>
          {bars.map((bar, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 15 }}>
                <span style={{ color: '#E4E4E7' }}>{bar.label}</span>
                <span style={{ color: '#A78BFA', fontWeight: 700 }}>{bar.pct}%</span>
              </div>
              <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 0 }}>
                <div
                  style={{
                    width: `${bar.pct}%`,
                    height: '100%',
                    background: bar.active ? 'linear-gradient(90deg, #7C3AED, #C4B5FD)' : '#52525B',
                    boxShadow: bar.active ? '0 0 12px rgba(124, 58, 237, 0.6)' : 'none',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* 3 KPI Console Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          {kpis.map((kpi, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A1A1AA' }}>
                {kpi.label}
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 700, color: '#A78BFA' }}>
                {kpi.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 5. AI-Native Multi-Agent Pipeline Slide
export function AiNativeSlidePipeline({ content, num, editing, onEdit }: SlideRenderProps) {
  const steps = content.steps ?? [
    { num: '01', title: 'Context Indexing', text: 'Vector AST graphs index codebase semantics and dependencies.' },
    { num: '02', title: 'Planner Reasoning', text: 'Reasoning model creates an isolated execution graph with assertions.' },
    { num: '03', title: 'Sandboxed VM', text: 'Tests run in micro-VM environments with instant rollback.' },
    { num: '04', title: 'Safe Merge', text: 'Verified PRs are committed directly to main with full audit logs.' },
  ];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#0B071A', color: '#FFFFFF' }}>
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
          zIndex: 10,
        }}
      >
        <span>
          <E
            slot="hudLabel"
            value={content.hudLabel ?? 'Execution Pipeline'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))}
          />
        </span>
        <span style={{ color: '#A78BFA' }}>{num}</span>
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
            fontWeight: 700,
            letterSpacing: '-0.03em',
            marginBottom: 60,
            color: '#FFFFFF',
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Autonomous Multi-Agent Loop.'}
            editing={editing}
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h2>

        {/* 4 Connected Pipeline Node Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20, position: 'relative' }}>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                position: 'relative',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: '#A78BFA' }}>
                {step.num}
              </div>

              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: '#FFFFFF' }}>
                {step.title}
              </h4>

              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 16, lineHeight: 1.6, color: '#A1A1AA' }}>
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 6. AI-Native Closing Slide
export function AiNativeSlideClosing({
  content,
  editing,
  onEdit,
  logoUrl,
  onLogoChange,
  logoScale,
  onLogoScaleChange,
}: SlideRenderProps) {
  const contacts = content.contacts ?? ['partners@foundry.ai', 'foundry.ai/deploy', 'San Francisco, CA'];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#05020D', color: '#FFFFFF' }}>
      <Glow style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 900, height: 900, background: 'radial-gradient(circle, rgba(124, 58, 237, 0.35) 0%, transparent 70%)' }} />

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
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 16px',
            background: 'rgba(124, 58, 237, 0.15)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            marginBottom: 32,
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C4B5FD' }}>
            <E
              slot="eyebrow"
              value={content.eyebrow ?? 'DEPLOYMENT CONSOLE'}
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
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            color: '#FFFFFF',
            marginBottom: 48,
            maxWidth: 1300,
          }}
        >
          <E
            slot="heading"
            value={content.heading ?? 'Deploy Autonomous Intelligence\nInto Your Stack.'}
            editing={editing}
            multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))}
          />
        </h1>

        <div style={{ display: 'flex', gap: 48, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '20px 40px' }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A78BFA' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: '#E4E4E7' }}>{c}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, right: 80, zIndex: 10 }}>
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
