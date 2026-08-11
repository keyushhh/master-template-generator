/**
 * Template switcher with an honest preview of what the switch will do.
 *
 * The preview is the point of this dialog. Switching is a one-field change and
 * nothing is ever deleted, but content that the destination template doesn't
 * read becomes invisible - and "invisible" and "gone" look the same on screen.
 * Showing carries / converts / parks up front is what makes that difference
 * legible, so the user can switch confidently instead of undoing to check.
 */

import { memo, useMemo, useState } from 'react';
import type { DocumentNode } from '../business-record/parser/ast';
import type { SlideInstance, SlideTemplateId } from '../deck/types';
import { SWITCHABLE, applySwitch, planSwitch } from '../deck/templateSwitch';
import { SlideStage } from './PresentationCanvas';

interface TemplateSwitchModalProps {
  open: boolean;
  slide: SlideInstance | undefined;
  onClose: () => void;
  onConfirm: (to: SlideTemplateId) => void;
  /** Passed through to the preview renderers so a card shows the same client
   *  logo the canvas does. */
  ast?: DocumentNode | null;
  logoUrl?: string;
}

/**
 * A card previewing one candidate layout.
 *
 * The preview is the *result of the switch*, not a stock picture of the
 * template: `applySwitch` is pure, so the card can run the real transform on
 * the real slide and render what the user would actually get. That closes the
 * gap this dialog's whole docstring is about - "carries / converts / parks" is
 * an accurate summary, but seeing your own words land in the new layout is what
 * makes the choice obvious.
 *
 * Memoised because 14 of these render at once and each one mounts a full slide
 * renderer; without it, hovering a card would re-render every sibling.
 */
const TemplateCard = memo(function TemplateCard({
  slide,
  templateId,
  title,
  current,
  active,
  ast,
  logoUrl,
  onPick,
}: {
  slide: SlideInstance;
  templateId: SlideTemplateId;
  title: string;
  current: boolean;
  active: boolean;
  ast?: DocumentNode | null;
  logoUrl?: string;
  onPick: () => void;
}) {
  // The switched slide is derived, never committed - nothing here touches the
  // deck until the user confirms.
  const preview = useMemo(
    () => (current ? slide : applySwitch(slide, templateId)),
    [slide, templateId, current]
  );

  return (
    <button
      onClick={onPick}
      disabled={current}
      title={current ? 'This is the current layout' : `Preview of “${slide.title}” as ${title}`}
      style={{
        display: 'flex', flexDirection: 'column', gap: 0,
        padding: 0, textAlign: 'left', cursor: current ? 'default' : 'pointer',
        background: '#fff',
        borderWidth: active ? 2 : 1,
        borderStyle: 'solid',
        borderColor: active ? 'var(--emerald-500)' : 'var(--neutral-200)',
        borderRadius: 'var(--radius-sharp)',
        // Padding compensates for the thicker active border so the card does
        // not shift its neighbours when it becomes selected.
        margin: active ? 0 : 1,
        opacity: current ? 0.55 : 1,
        transition: 'border-color .12s, box-shadow .12s',
        boxShadow: active ? '0 4px 14px -4px rgba(16,185,129,0.35)' : 'none',
      }}
    >
      <div style={{ width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', background: '#fff', position: 'relative' }}>
        {/* 232px is the card's rendered width; the stage scales the 1920px
            slide down by that ratio. A fixed number rather than a measured
            one keeps 14 previews from each running a ResizeObserver. */}
        <SlideStage slide={preview} ast={ast ?? null} num="00" scale={232 / 1920} logoUrl={logoUrl} />
      </div>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          padding: '7px 9px', borderTop: '1px solid var(--neutral-150, var(--neutral-200))',
          fontSize: 12, fontWeight: 700,
          color: current ? 'var(--neutral-400)' : active ? 'var(--emerald-700)' : 'var(--neutral-800)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {current && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>
            Current
          </span>
        )}
      </div>
    </button>
  );
});

export function TemplateSwitchModal({ open, slide, onClose, onConfirm, ast, logoUrl }: TemplateSwitchModalProps) {
  const [target, setTarget] = useState<SlideTemplateId | null>(null);
  /** Category filter. null means "All", which is the honest default - a user
   *  who doesn't know the categories yet shouldn't have to pick one to see
   *  anything. */
  const [category, setCategory] = useState<string | null>(null);

  if (!open || !slide) return null;

  const plan = target ? planSwitch(slide, target) : null;

  // An imported slide's content is positioned shapes with no template slots, so
  // there is nothing meaningful to map either way.
  const isImported = slide.templateId === 'imported';

  const categories = [...new Set(SWITCHABLE.map((t) => t.group))];
  const shown = category ? SWITCHABLE.filter((t) => t.group === category) : SWITCHABLE;

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '0.14em',
    color: 'var(--neutral-400)', marginBottom: 8,
  };

  return (
    <div
      onClick={onClose}
      className="wg-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="wg-modal"
        style={{
          width: 'min(1040px, 100%)', maxHeight: '88vh', overflow: 'auto',
          padding: 28,
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
              <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span>Choose a layout — each card is your own slide in that layout</span>
              </div>

              {/* Category filters. 14 previews is a lot to scan at once; these
                  narrow it without hiding anything behind a menu. */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {[null, ...categories].map((c) => {
                  const on = category === c;
                  return (
                    <button
                      key={c ?? '__all'}
                      onClick={() => setCategory(c)}
                      style={{
                        height: 26, padding: '0 11px',
                        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        cursor: 'pointer',
                        borderWidth: 1, borderStyle: 'solid',
                        borderColor: on ? 'var(--neutral-900)' : 'var(--neutral-200)',
                        background: on ? 'var(--neutral-900)' : '#fff',
                        color: on ? '#fff' : 'var(--neutral-500)',
                        borderRadius: 'var(--radius-sharp)',
                        transition: 'background .12s, color .12s, border-color .12s',
                      }}
                    >
                      {c ?? `All ${SWITCHABLE.length}`}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))',
                  gap: 12,
                }}
              >
                {shown.map((t) => (
                  <TemplateCard
                    key={t.id}
                    slide={slide}
                    templateId={t.id}
                    title={t.title}
                    current={t.id === slide.templateId}
                    active={t.id === target}
                    ast={ast}
                    logoUrl={logoUrl}
                    onPick={() => setTarget(t.id)}
                  />
                ))}
              </div>
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
