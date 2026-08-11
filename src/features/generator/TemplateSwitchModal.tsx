/**
 * Template switcher with an honest preview of what the switch will do.
 *
 * The preview is the point of this dialog. Switching is a one-field change and
 * nothing is ever deleted, but content that the destination template doesn't
 * read becomes invisible - and "invisible" and "gone" look the same on screen.
 * Showing carries / converts / parks up front is what makes that difference
 * legible, so the user can switch confidently instead of undoing to check.
 */

import { useState } from 'react';
import type { SlideInstance, SlideTemplateId } from '../deck/types';
import { SWITCHABLE, planSwitch } from '../deck/templateSwitch';

interface TemplateSwitchModalProps {
  open: boolean;
  slide: SlideInstance | undefined;
  onClose: () => void;
  onConfirm: (to: SlideTemplateId) => void;
}

export function TemplateSwitchModal({ open, slide, onClose, onConfirm }: TemplateSwitchModalProps) {
  const [target, setTarget] = useState<SlideTemplateId | null>(null);

  if (!open || !slide) return null;

  const plan = target ? planSwitch(slide, target) : null;

  // An imported slide's content is positioned shapes with no template slots, so
  // there is nothing meaningful to map either way.
  const isImported = slide.templateId === 'imported';

  const groups = SWITCHABLE.reduce<Record<string, typeof SWITCHABLE>>((acc, t) => {
    (acc[t.group] ??= []).push(t);
    return acc;
  }, {});

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '0.14em',
    color: 'var(--neutral-400)', marginBottom: 8,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(880px, 100%)', maxHeight: '86vh', overflow: 'auto',
          background: '#fff', boxShadow: 'var(--shadow-soft)',
          borderRadius: 'var(--radius-sharp)', padding: 28,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Change layout
            </h2>
            <p style={{ marginTop: 6, fontSize: 13, color: 'var(--neutral-500)' }}>
              “{slide.title}” — your words never change. Only the layout does.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: '1px solid var(--neutral-300)', background: '#fff',
              width: 32, height: 32, cursor: 'pointer',
              borderRadius: 'var(--radius-sharp)', fontSize: 18, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {isImported && (
          <div
            style={{
              marginTop: 18, padding: 14,
              background: '#FFFBEB', border: '1px solid #FDE68A',
              borderRadius: 'var(--radius-sharp)', fontSize: 13, lineHeight: 1.6,
            }}
          >
            This slide came from an uploaded <strong>.pptx</strong> and keeps its original layout as
            positioned shapes. Those don’t map onto template slots, so switching would leave the new
            template empty. Copy the text you want into a template slide instead.
          </div>
        )}

        {!isImported && (
          <>
            <div style={{ marginTop: 22 }}>
              <div style={sectionLabel}>Choose a layout</div>
              {Object.entries(groups).map(([group, items]) => (
                <div key={group} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--neutral-400)', marginBottom: 6 }}>{group}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {items.map((t) => {
                      const current = t.id === slide.templateId;
                      const active = t.id === target;
                      return (
                        <button
                          key={t.id}
                          disabled={current}
                          onClick={() => setTarget(t.id)}
                          title={current ? 'This is the current layout' : `Switch to ${t.title}`}
                          style={{
                            padding: '8px 14px', fontSize: 13, fontWeight: 600,
                            cursor: current ? 'default' : 'pointer',
                            borderWidth: 1, borderStyle: 'solid',
                            borderColor: active ? 'var(--emerald-500)' : 'var(--neutral-300)',
                            background: active ? 'var(--emerald-50)' : current ? 'var(--neutral-100)' : '#fff',
                            color: current ? 'var(--neutral-400)' : active ? 'var(--emerald-700)' : 'var(--neutral-900)',
                            borderRadius: 'var(--radius-sharp)',
                          }}
                        >
                          {t.title}
                          {current && <span style={{ marginLeft: 6, fontSize: 11 }}>(current)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {plan && (
              <div
                style={{
                  marginTop: 8, padding: 18,
                  background: 'var(--neutral-50)',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius-sharp)',
                }}
              >
                <div style={sectionLabel}>What happens to your content</div>

                {[
                  { key: 'carries', title: 'Carries over', items: plan.carries, dot: 'var(--emerald-500)' },
                  { key: 'converts', title: 'Converted', items: plan.converts, dot: '#3b82f6' },
                  { key: 'parks', title: 'Parked (restored if you switch back)', items: plan.parks, dot: 'var(--neutral-400)' },
                ].map((row) => (
                  <div key={row.key} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{row.title}</div>
                    {row.items.length ? (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                        {row.items.map((it) => (
                          <li key={it} style={{ fontSize: 13, color: 'var(--neutral-700)', display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: row.dot, flexShrink: 0 }} />
                            {it}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--neutral-400)' }}>Nothing</span>
                    )}
                  </div>
                ))}

                {plan.cappedNote && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#92400e', background: '#FFFBEB', border: '1px solid #FDE68A', padding: 10, borderRadius: 'var(--radius-sharp)' }}>
                    {plan.cappedNote}
                  </div>
                )}

                {plan.newTitle && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--neutral-500)' }}>
                    This slide will be renamed to “{plan.newTitle}” — it still has its default name.
                    Rename it yourself and future switches will keep your name.
                  </div>
                )}

                <div style={{ marginTop: 14, fontSize: 12, color: 'var(--neutral-500)' }}>
                  Your inserted shapes, text boxes, formatting and speaker notes are unaffected.
                </div>
              </div>
            )}

            <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  height: 38, padding: '0 18px', fontSize: 13, fontWeight: 700,
                  background: '#fff', border: '1px solid var(--neutral-300)',
                  cursor: 'pointer', borderRadius: 'var(--radius-sharp)',
                }}
              >
                Cancel
              </button>
              <button
                disabled={!target}
                onClick={() => { if (target) { onConfirm(target); setTarget(null); } }}
                style={{
                  height: 38, padding: '0 20px', fontSize: 13, fontWeight: 700,
                  background: target ? 'var(--neutral-900)' : 'var(--neutral-200)',
                  color: target ? '#fff' : 'var(--neutral-400)',
                  border: 'none', cursor: target ? 'pointer' : 'default',
                  borderRadius: 'var(--radius-sharp)',
                }}
              >
                Change layout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
