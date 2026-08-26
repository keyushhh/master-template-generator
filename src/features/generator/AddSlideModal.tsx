import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentNode } from '../business-record/parser/ast';
import type { DeckTheme } from '../theme/deckTheme';
import { layoutsForTemplate, slideFromLayout, type LayoutOption } from '../deck/layoutCatalog';
import type { SlideInstance } from '../deck/types';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { SlideStage } from './PresentationCanvas';

/**
 * Which slide to add.
 *
 * "Add slide" produced a blank, so every written layout the deck already owns
 * was two steps away: add a blank, then change its layout. This shows the
 * deck's own layouts as what they are - finished slides in the deck's palette
 * and voice - and adds the one you pick, filled in.
 *
 * The previews are the real renderers at thumbnail scale, so a card is the
 * slide you are about to get rather than a picture of one.
 */

const CARD_W = 232;

const LayoutCard = memo(function LayoutCard({
  option,
  ast,
  logoUrl,
  theme,
  onPick,
}: {
  option: LayoutOption;
  ast: DocumentNode | null;
  logoUrl?: string;
  theme?: DeckTheme;
  onPick: () => void;
}) {
  // Minted once per card, so hovering a sibling cannot remount this preview.
  const preview = useMemo<SlideInstance>(() => slideFromLayout(option), [option]);

  return (
    <button
      type="button"
      onClick={onPick}
      title={`Add a ${option.title} slide`}
      style={{
        display: 'flex', flexDirection: 'column', padding: 0, textAlign: 'left',
        cursor: 'pointer', background: '#fff',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-sharp)',
        transition: 'border-color .12s, box-shadow .12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--emerald-500)';
        e.currentTarget.style.boxShadow = '0 4px 14px -4px rgba(16,185,129,0.35)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--neutral-200)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <span style={{ width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', background: '#fff', position: 'relative', display: 'block' }}>
        <SlideStage slide={preview} ast={ast} num="00" scale={CARD_W / 1920} logoUrl={logoUrl} theme={theme} />
      </span>
      <span
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          padding: '7px 9px', borderTop: '1px solid var(--neutral-200)',
          fontSize: 12, fontWeight: 700, color: 'var(--neutral-800)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.title}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--neutral-600)', flexShrink: 0 }}>
          {option.group}
        </span>
      </span>
    </button>
  );
});

export function AddSlideModal({
  open,
  onClose,
  onAdd,
  presentationTemplateId,
  ast,
  logoUrl,
  theme,
  /** Where the slide lands, for the sentence under the heading. */
  positionLabel,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (slide: SlideInstance) => void;
  presentationTemplateId?: string;
  ast: DocumentNode | null;
  logoUrl?: string;
  theme?: DeckTheme;
  positionLabel: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  const [group, setGroup] = useState<string | null>(null);

  const options = useMemo(() => layoutsForTemplate(presentationTemplateId), [presentationTemplateId]);
  const groups = useMemo(() => [...new Set(options.map((o) => o.group))], [options]);

  useEffect(() => {
    if (open) setGroup(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const shown = group ? options.filter((o) => o.group === group) : options;

  return (
    <div
      onClick={onClose}
      className="wg-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add a slide"
        onClick={(e) => e.stopPropagation()}
        className="wg-modal"
        style={{ width: 'min(1040px, 100%)', maxHeight: '88vh', overflow: 'auto', padding: 28 }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              Add a slide
            </h2>
            <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: 'var(--neutral-600)' }}>
              {positionLabel}. Every layout arrives written in this deck’s own voice, ready to edit.
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '20px 0 14px' }}>
          {[null, ...groups].map((g) => {
            const on = group === g;
            return (
              <button
                key={g ?? '__all'}
                onClick={() => setGroup(g)}
                style={{
                  height: 26, padding: '0 11px',
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                  border: `1px solid ${on ? 'var(--neutral-900)' : 'var(--neutral-200)'}`,
                  background: on ? 'var(--neutral-900)' : '#fff',
                  color: on ? '#fff' : 'var(--neutral-600)',
                  borderRadius: 'var(--radius-sharp)',
                }}
              >
                {g ?? `All ${options.length}`}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_W}px, 1fr))`, gap: 12 }}>
          {shown.map((option) => (
            <LayoutCard
              key={option.templateId}
              option={option}
              ast={ast}
              logoUrl={logoUrl}
              theme={theme}
              onPick={() => {
                onAdd(slideFromLayout(option));
                onClose();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
