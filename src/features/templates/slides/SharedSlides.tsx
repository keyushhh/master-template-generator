import React from 'react';
import { E, SlideRenderProps } from '../../generator/PresentationCanvas';
import type { SlideContent } from '../../deck/types';
import { SHARED_LAYOUT_NAMES, SHARED_PALETTES, type SharedLayoutName, type SharedPalette } from '../sharedLayouts';

/**
 * SHARED TEMPLATE LAYOUTS
 *
 * The eight layouts every presentation template needs beyond its own cover,
 * hero and closing: agenda, statement, big stat, pillars, gauge, versus,
 * phases and quote. Each template registers them under its own id prefix with
 * its own palette, so a Product Showcase agenda is black and emerald while a
 * Wave agenda is off-white and teal, from one renderer.
 *
 * The content fields are deliberately the same ones the classic s2, s4, s6,
 * s7, s8, s9, s11 and s13 slides use, so the PowerPoint exporter already
 * knows how to build every one of them.
 */

const mono = 'var(--font-mono)';
const display = 'var(--font-display)';
const sans = 'var(--font-sans)';

function Frame({ p, children }: { p: SharedPalette; children: React.ReactNode }) {
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: p.bg, color: p.ink }}>
      {children}
    </div>
  );
}

function Hud({ p, label, num, editing, onEdit, fallback }: {
  p: SharedPalette;
  label: string | undefined;
  num: string;
  editing: boolean;
  onEdit: SlideRenderProps['onEdit'];
  fallback: string;
}) {
  return (
    <div
      style={{
        position: 'absolute', top: 60, left: 100, right: 100, zIndex: 10,
        display: 'flex', justifyContent: 'space-between',
        borderBottom: `1px solid ${p.line}`, paddingBottom: 20,
        fontFamily: mono, fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase', color: p.dim,
      }}
    >
      <span>
        <E slot="hudLabel" value={label ?? fallback} editing={editing}
          onCommit={(v) => onEdit((c) => ({ ...c, hudLabel: v || undefined }))} />
      </span>
      <span style={{ color: p.accent }}>{num}</span>
    </div>
  );
}

function Eyebrow({ p, value, editing, onEdit, fallback }: {
  p: SharedPalette;
  value: string | undefined;
  editing: boolean;
  onEdit: SlideRenderProps['onEdit'];
  fallback: string;
}) {
  return (
    <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: p.accent, marginBottom: 24 }}>
      <E slot="eyebrow" value={value ?? fallback} editing={editing}
        onCommit={(v) => onEdit((c) => ({ ...c, eyebrow: v || undefined }))} />
    </div>
  );
}

/** Patch one item of a content array, keeping the renderer's own fallback. */
function patchList<K extends 'parts' | 'steps' | 'rows' | 'phases' | 'bars' | 'kpis'>(
  onEdit: SlideRenderProps['onEdit'],
  key: K,
  current: NonNullable<SlideContent[K]>,
  i: number,
  patch: Record<string, unknown>
) {
  onEdit((c) => ({
    ...c,
    [key]: ((c[key] as unknown[] | undefined) ?? current).map((item, j) =>
      (j === i ? { ...(item as object), ...patch } : item)
    ),
  }) as SlideContent);
}

// 1. Agenda: numbered contents, two columns.
export function AgendaLayout({ content, num, editing, onEdit }: SlideRenderProps, p: SharedPalette) {
  const parts = content.parts ?? [
    { title: 'Where We Are', description: 'The state of play and what changed this quarter.' },
    { title: 'The Opportunity', description: 'The gap worth closing, sized and evidenced.' },
    { title: 'Our Approach', description: 'How the work is structured and sequenced.' },
    { title: 'Proof', description: 'Results to date, measured against the baseline.' },
    { title: 'The Plan', description: 'Phases, owners and the dates that matter.' },
    { title: 'What We Need', description: 'Decisions, resourcing and the next milestone.' },
  ];
  return (
    <Frame p={p}>
      <Hud p={p} label={content.hudLabel} num={num} editing={editing} onEdit={onEdit} fallback="Agenda" />
      <div style={{ padding: '170px 100px 90px', height: '100%', display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 90, alignItems: 'center', position: 'relative', zIndex: 10 }}>
        <div>
          <Eyebrow p={p} value={content.eyebrow} editing={editing} onEdit={onEdit} fallback="Contents" />
          <h2 style={{ fontFamily: display, fontSize: 84, fontWeight: 700, lineHeight: 0.98, letterSpacing: '-0.03em' }}>
            <E slot="heading" value={content.heading ?? 'What we will\ncover.'} editing={editing} multiline
              onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))} />
          </h2>
          <div style={{ width: 90, height: 3, background: p.accent, marginTop: 40 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 60, rowGap: 44 }}>
          {parts.slice(0, 6).map((part, i) => (
            <div key={i} style={{ borderTop: `1px solid ${p.line}`, paddingTop: 22 }}>
              <div style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.2em', color: p.accent, marginBottom: 14 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: display, fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 10 }}>
                <E slot={`parts.${i}.title`} value={part.title} editing={editing}
                  onCommit={(v) => patchList(onEdit, 'parts', parts, i, { title: v })} />
              </div>
              <div style={{ fontFamily: sans, fontSize: 19, lineHeight: 1.5, color: p.dim }}>
                <E slot={`parts.${i}.description`} value={part.description} editing={editing} multiline
                  onCommit={(v) => patchList(onEdit, 'parts', parts, i, { description: v })} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// 2. Statement: one line, centred, nothing else competing with it.
export function StatementLayout({ content, num, editing, onEdit }: SlideRenderProps, p: SharedPalette) {
  return (
    <Frame p={p}>
      <Hud p={p} label={content.hudLabel} num={num} editing={editing} onEdit={onEdit} fallback="Section Marker" />
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 200px', position: 'relative', zIndex: 10 }}>
        <Eyebrow p={p} value={content.eyebrow} editing={editing} onEdit={onEdit} fallback="Part 02" />
        <h2 style={{ fontFamily: display, fontSize: 116, fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.04em', maxWidth: 1420 }}>
          <E slot="heading" value={content.heading ?? 'The next decision is the one that compounds.'} editing={editing} multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))} />
        </h2>
        <div style={{ width: 120, height: 3, background: p.accent, margin: '48px 0 40px' }} />
        <p style={{ fontFamily: sans, fontSize: 24, lineHeight: 1.6, color: p.dim, maxWidth: 900 }}>
          <E slot="subtitle" value={content.subtitle ?? 'A short line of context so the statement lands with the evidence behind it.'} editing={editing} multiline
            onCommit={(v) => onEdit((c) => ({ ...c, subtitle: v || undefined }))} />
        </p>
      </div>
    </Frame>
  );
}

// 3. Big stat: one number carrying the slide.
export function StatLayout({ content, num, editing, onEdit }: SlideRenderProps, p: SharedPalette) {
  return (
    <Frame p={p}>
      <Hud p={p} label={content.hudLabel} num={num} editing={editing} onEdit={onEdit} fallback="Headline Metric" />
      <div style={{ padding: '190px 100px 90px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        <Eyebrow p={p} value={content.eyebrow} editing={editing} onEdit={onEdit} fallback="Performance Metric" />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
          <span style={{ fontFamily: display, fontSize: 320, fontWeight: 700, lineHeight: 0.82, letterSpacing: '-0.05em' }}>
            <E slot="value" value={content.value ?? '4.2'} editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, value: v || undefined }))} />
          </span>
          <span style={{ fontFamily: display, fontSize: 120, fontWeight: 700, color: p.accent, lineHeight: 1 }}>
            <E slot="unit" value={content.unit ?? 'x'} editing={editing}
              onCommit={(v) => onEdit((c) => ({ ...c, unit: v || undefined }))} />
          </span>
        </div>
        <h3 style={{ fontFamily: display, fontSize: 56, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 56, maxWidth: 1400 }}>
          <E slot="heading" value={content.heading ?? 'The number that changed the argument.'} editing={editing} multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))} />
        </h3>
        <p style={{ fontFamily: sans, fontSize: 22, lineHeight: 1.6, color: p.dim, marginTop: 28, maxWidth: 820, borderLeft: `2px solid ${p.accent}`, paddingLeft: 28 }}>
          <E slot="body" value={content.body ?? 'What produced it, over what period, and why it holds up under scrutiny.'} editing={editing} multiline
            onCommit={(v) => onEdit((c) => ({ ...c, body: v || undefined }))} />
        </p>
      </div>
    </Frame>
  );
}

// 4. Pillars: three cards, the shape most "what we do" slides want.
export function PillarsLayout({ content, num, editing, onEdit }: SlideRenderProps, p: SharedPalette) {
  const steps = content.steps ?? [
    { num: '01', title: 'Understand', description: 'Interviews, telemetry and the numbers already in the business.' },
    { num: '02', title: 'Build', description: 'Ship the smallest version that proves the idea in production.' },
    { num: '03', title: 'Scale', description: 'Repeat what worked, retire what did not, and instrument both.' },
  ];
  return (
    <Frame p={p}>
      <Hud p={p} label={content.hudLabel} num={num} editing={editing} onEdit={onEdit} fallback="How It Works" />
      <div style={{ padding: '175px 100px 90px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        <Eyebrow p={p} value={content.eyebrow} editing={editing} onEdit={onEdit} fallback="Three Pillars" />
        <h2 style={{ fontFamily: display, fontSize: 80, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 70 }}>
          <E slot="heading" value={content.heading ?? 'Built on three things.'} editing={editing} multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))} />
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40 }}>
          {steps.slice(0, 3).map((step, i) => (
            <div key={i} style={{ background: p.card, border: `1px solid ${p.line}`, borderTop: `3px solid ${p.accent}`, padding: '44px 40px', minHeight: 380 }}>
              <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.2em', color: p.accent, marginBottom: 32 }}>
                <E slot={`steps.${i}.num`} value={step.num ?? String(i + 1).padStart(2, '0')} editing={editing}
                  onCommit={(v) => patchList(onEdit, 'steps', steps, i, { num: v })} />
              </div>
              <div style={{ fontFamily: display, fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 20 }}>
                <E slot={`steps.${i}.title`} value={step.title} editing={editing}
                  onCommit={(v) => patchList(onEdit, 'steps', steps, i, { title: v })} />
              </div>
              <div style={{ fontFamily: sans, fontSize: 20, lineHeight: 1.6, color: p.dim }}>
                <E slot={`steps.${i}.description`} value={step.description ?? ''} editing={editing} multiline
                  onCommit={(v) => patchList(onEdit, 'steps', steps, i, { description: v })} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// 5. Gauge: progress bars over a KPI rail.
export function GaugeLayout({ content, num, editing, onEdit }: SlideRenderProps, p: SharedPalette) {
  const bars = content.bars ?? [
    { label: 'Adoption', pct: 82, active: true },
    { label: 'Retention', pct: 74, active: false },
    { label: 'Expansion', pct: 61, active: false },
  ];
  const kpis = content.kpis ?? [
    { label: 'Active Accounts', value: '12.4K' },
    { label: 'Net Revenue Retention', value: '128%' },
    { label: 'Payback Period', value: '9 mo' },
  ];
  return (
    <Frame p={p}>
      <Hud p={p} label={content.hudLabel} num={num} editing={editing} onEdit={onEdit} fallback="Metrics Dashboard" />
      <div style={{ padding: '175px 100px 90px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        <Eyebrow p={p} value={content.eyebrow} editing={editing} onEdit={onEdit} fallback="Performance" />
        <h2 style={{ fontFamily: display, fontSize: 76, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 60 }}>
          <E slot="heading" value={content.heading ?? 'The numbers, in order.'} editing={editing} multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))} />
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34, marginBottom: 76 }}>
          {bars.slice(0, 4).map((bar, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 15, letterSpacing: '0.08em', textTransform: 'uppercase', color: bar.active ? p.ink : p.dim, marginBottom: 12 }}>
                <span>
                  <E slot={`bars.${i}.label`} value={bar.label} editing={editing}
                    onCommit={(v) => patchList(onEdit, 'bars', bars, i, { label: v })} />
                </span>
                <span style={{ color: bar.active ? p.accent : p.dim }}>{bar.pct}%</span>
              </div>
              <div style={{ height: 10, background: p.card, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${Math.max(0, Math.min(100, bar.pct))}%`, background: bar.active ? p.accent : p.dim }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40, borderTop: `1px solid ${p.line}`, paddingTop: 40 }}>
          {kpis.slice(0, 3).map((kpi, i) => (
            <div key={i}>
              <div style={{ fontFamily: display, fontSize: 62, fontWeight: 700, letterSpacing: '-0.03em' }}>
                <E slot={`kpis.${i}.value`} value={kpi.value} editing={editing}
                  onCommit={(v) => patchList(onEdit, 'kpis', kpis, i, { value: v })} />
              </div>
              <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase', color: p.dim, marginTop: 10 }}>
                <E slot={`kpis.${i}.label`} value={kpi.label} editing={editing}
                  onCommit={(v) => patchList(onEdit, 'kpis', kpis, i, { label: v })} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// 6. Versus: the comparison table, four columns.
export function VersusLayout({ content, num, editing, onEdit }: SlideRenderProps, p: SharedPalette) {
  const rows = content.rows ?? [
    { dim: 'Time to first value', cur: '14 days', tgt: '2 days', delta: '-86%' },
    { dim: 'Support tickets / 100 users', cur: '38', tgt: '11', delta: '-71%' },
    { dim: 'Weekly active accounts', cur: '4.1K', tgt: '9.8K', delta: '+139%' },
    { dim: 'Gross margin', cur: '61%', tgt: '74%', delta: '+13 pts' },
  ];
  const head = ['Dimension', 'Today', 'Target', 'Delta'];
  return (
    <Frame p={p}>
      <Hud p={p} label={content.hudLabel} num={num} editing={editing} onEdit={onEdit} fallback="Comparative Framework" />
      <div style={{ padding: '175px 100px 90px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        <Eyebrow p={p} value={content.eyebrow} editing={editing} onEdit={onEdit} fallback="Before and After" />
        <h2 style={{ fontFamily: display, fontSize: 76, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 56 }}>
          <E slot="heading" value={content.heading ?? 'What changes, measured.'} editing={editing} multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))} />
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 0, fontFamily: mono, fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.dim, borderBottom: `2px solid ${p.accent}`, paddingBottom: 18 }}>
          {head.map((h) => <span key={h}>{h}</span>)}
        </div>
        {rows.slice(0, 5).map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center', borderBottom: `1px solid ${p.line}`, padding: '30px 0' }}>
            <span style={{ fontFamily: sans, fontSize: 26, fontWeight: 500 }}>
              <E slot={`rows.${i}.dim`} value={row.dim} editing={editing}
                onCommit={(v) => patchList(onEdit, 'rows', rows, i, { dim: v })} />
            </span>
            <span style={{ fontFamily: sans, fontSize: 26, color: p.dim }}>
              <E slot={`rows.${i}.cur`} value={row.cur} editing={editing}
                onCommit={(v) => patchList(onEdit, 'rows', rows, i, { cur: v })} />
            </span>
            <span style={{ fontFamily: sans, fontSize: 26 }}>
              <E slot={`rows.${i}.tgt`} value={row.tgt} editing={editing}
                onCommit={(v) => patchList(onEdit, 'rows', rows, i, { tgt: v })} />
            </span>
            <span style={{ fontFamily: mono, fontSize: 24, color: p.accent }}>
              <E slot={`rows.${i}.delta`} value={row.delta} editing={editing}
                onCommit={(v) => patchList(onEdit, 'rows', rows, i, { delta: v })} />
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// 7. Phases: the timeline, four steps left to right.
export function PhasesLayout({ content, num, editing, onEdit }: SlideRenderProps, p: SharedPalette) {
  const phases = content.phases ?? [
    { num: '01', title: 'Foundation', description: 'Instrumentation, baselines and the first integration.', timing: 'Q1', completed: true },
    { num: '02', title: 'Pilot', description: 'Two design partners in production, weekly review.', timing: 'Q2', completed: true },
    { num: '03', title: 'Scale', description: 'Self-serve onboarding and the first paid cohort.', timing: 'Q3' },
    { num: '04', title: 'Expand', description: 'Second market, partner channel, enterprise controls.', timing: 'Q4' },
  ];
  return (
    <Frame p={p}>
      <Hud p={p} label={content.hudLabel} num={num} editing={editing} onEdit={onEdit} fallback="Execution Timeline" />
      <div style={{ padding: '175px 100px 90px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        <Eyebrow p={p} value={content.eyebrow} editing={editing} onEdit={onEdit} fallback="Roadmap" />
        <h2 style={{ fontFamily: display, fontSize: 80, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 80 }}>
          <E slot="heading" value={content.heading ?? 'The path from here.'} editing={editing} multiline
            onCommit={(v) => onEdit((c) => ({ ...c, heading: v || undefined }))} />
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 36 }}>
          {phases.slice(0, 4).map((phase, i) => (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: phase.completed ? p.accent : 'transparent', border: `2px solid ${phase.completed ? p.accent : p.dim}` }} />
                <div style={{ flex: 1, height: 1, background: p.line }} />
              </div>
              <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.2em', color: p.accent, marginBottom: 14 }}>
                <E slot={`phases.${i}.timing`} value={phase.timing ?? phase.num ?? String(i + 1).padStart(2, '0')} editing={editing}
                  onCommit={(v) => patchList(onEdit, 'phases', phases, i, { timing: v })} />
              </div>
              <div style={{ fontFamily: display, fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 16 }}>
                <E slot={`phases.${i}.title`} value={phase.title} editing={editing}
                  onCommit={(v) => patchList(onEdit, 'phases', phases, i, { title: v })} />
              </div>
              <div style={{ fontFamily: sans, fontSize: 19, lineHeight: 1.55, color: p.dim }}>
                <E slot={`phases.${i}.description`} value={phase.description ?? ''} editing={editing} multiline
                  onCommit={(v) => patchList(onEdit, 'phases', phases, i, { description: v })} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// 8. Voice: one quote, credited.
export function VoiceLayout({ content, num, editing, onEdit }: SlideRenderProps, p: SharedPalette) {
  return (
    <Frame p={p}>
      <Hud p={p} label={content.eyebrow} num={num} editing={editing} onEdit={onEdit} fallback="Key Insight" />
      <div style={{ padding: '200px 140px 90px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        <div style={{ fontFamily: display, fontSize: 200, fontWeight: 700, color: p.accent, lineHeight: 0.5, height: 90 }}>&#8220;</div>
        <blockquote style={{ fontFamily: display, fontSize: 72, fontWeight: 600, lineHeight: 1.18, letterSpacing: '-0.03em', maxWidth: 1480, margin: 0 }}>
          <E slot="quote" value={content.quote ?? 'We stopped guessing the week we could finally see the whole funnel in one place.'} editing={editing} multiline
            onCommit={(v) => onEdit((c) => ({ ...c, quote: v || undefined }))} />
        </blockquote>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 64 }}>
          <div style={{ width: 60, height: 2, background: p.accent }} />
          <div>
            <div style={{ fontFamily: sans, fontSize: 26, fontWeight: 600 }}>
              <E slot="author" value={content.author ?? 'Author Name'} editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, author: v || undefined }))} />
            </div>
            <div style={{ fontFamily: mono, fontSize: 16, letterSpacing: '0.12em', textTransform: 'uppercase', color: p.dim, marginTop: 6 }}>
              <E slot="role" value={content.role ?? 'Title, Company'} editing={editing}
                onCommit={(v) => onEdit((c) => ({ ...c, role: v || undefined }))} />
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** Layout per shared id suffix, in the order `SHARED_LAYOUT_NAMES` lists. */
const LAYOUTS: Record<SharedLayoutName, (props: SlideRenderProps, p: SharedPalette) => React.ReactElement> = {
  agenda: AgendaLayout,
  statement: StatementLayout,
  stat: StatLayout,
  pillars: PillarsLayout,
  gauge: GaugeLayout,
  versus: VersusLayout,
  phases: PhasesLayout,
  voice: VoiceLayout,
};

/** `templateId` -> renderer, for every template/layout pair. */
export const SHARED_RENDERERS: Record<string, (props: SlideRenderProps) => React.ReactElement> =
  Object.fromEntries(
    Object.entries(SHARED_PALETTES).flatMap(([prefix, palette]) =>
      SHARED_LAYOUT_NAMES.map((name) => [
        `${prefix}_${name}`,
        (props: SlideRenderProps) => LAYOUTS[name](props, palette),
      ])
    )
  );
