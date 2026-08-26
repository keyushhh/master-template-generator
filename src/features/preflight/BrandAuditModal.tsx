import { useMemo, useRef } from 'react';
import { useFocusTrap } from '../a11y/useFocusTrap';
import type { Deck } from '../deck/types';
import type { DeckTheme } from '../theme/deckTheme';
import { auditDeck, type Drift, type DriftKind } from './brandAudit';

/**
 * One screen answering "is this deck still on brand?".
 *
 * The rails know what on brand means and never reported on it, so drift was
 * only ever found by clicking every slot. Each row here is one override that is
 * not a value the app offered, and the button next to it puts that one thing
 * back. Nothing is fixed without being asked: a client's own hex is a real
 * reason to be off palette, and a screen that quietly rewrote it would be worse
 * than one that never mentioned it.
 */

const KIND_LABEL: Record<DriftKind, string> = {
  size: 'Type size',
  leading: 'Leading',
  tracking: 'Tracking',
  font: 'Typeface',
  colour: 'Colour',
  position: 'Position',
};

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

export function BrandAuditModal({
  open,
  onClose,
  deck,
  theme,
  onSnap,
  onSnapAll,
  onJumpToSlide,
}: {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  theme: DeckTheme;
  onSnap: (drift: Drift) => void;
  onSnapAll: (drifts: Drift[]) => void;
  onJumpToSlide: (instanceId: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  const drifts = useMemo(() => (open ? auditDeck(deck, theme) : []), [open, deck, theme]);

  if (!open) return null;

  const counts = drifts.reduce<Record<string, number>>((acc, d) => {
    acc[d.kind] = (acc[d.kind] ?? 0) + 1;
    return acc;
  }, {});

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
        aria-label="Brand check"
        onClick={(e) => e.stopPropagation()}
        className="wg-modal"
        style={{ width: 'min(760px, 100%)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', padding: 28 }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              Brand check
            </h2>
            <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: 'var(--neutral-600)' }}>
              {drifts.length === 0
                ? 'Every size, colour and position in this deck is one the templates use.'
                : `${drifts.length} ${drifts.length === 1 ? 'thing has' : 'things have'} drifted off the deck’s own rails. Off brand on purpose is fine: nothing changes until you say so.`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: '1px solid var(--neutral-300)', background: '#fff',
              width: 32, height: 32, cursor: 'pointer', flexShrink: 0,
              borderRadius: 'var(--radius-sharp)', fontSize: 18, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {drifts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '18px 0 12px' }}>
            {Object.entries(counts).map(([kind, n]) => (
              <span
                key={kind}
                style={{
                  ...mono, padding: '3px 8px', color: 'var(--neutral-700)',
                  background: 'var(--neutral-100)', border: '1px solid var(--neutral-200)',
                }}
              >
                {`${n} ${KIND_LABEL[kind as DriftKind]}`}
              </span>
            ))}
            <button
              type="button"
              onClick={() => onSnapAll(drifts)}
              style={{
                marginLeft: 'auto', height: 32, padding: '0 14px',
                fontSize: 12.5, fontWeight: 700, color: '#fff',
                background: 'var(--neutral-900)', border: 'none', cursor: 'pointer',
              }}
            >
              Snap all back to brand
            </button>
          </div>
        )}

        <div style={{ overflowY: 'auto', borderTop: drifts.length ? '1px solid var(--neutral-200)' : 'none' }}>
          {drifts.map((drift) => (
            <div
              key={`${drift.instanceId}-${drift.slot}-${drift.kind}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 2px', borderBottom: '1px solid var(--neutral-200)',
              }}
            >
              <button
                type="button"
                onClick={() => { onJumpToSlide(drift.instanceId); onClose(); }}
                title="Go to this slide"
                style={{
                  ...mono, flexShrink: 0, width: 62, textAlign: 'left',
                  color: 'var(--neutral-600)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                }}
              >
                {`Slide ${drift.slideNumber}`}
              </button>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--neutral-900)' }}>
                  {drift.detail}
                </span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, color: 'var(--neutral-600)' }}>
                  {`${drift.slotLabel} · ${drift.slideTitle}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onSnap(drift)}
                style={{
                  flexShrink: 0, height: 30, padding: '0 12px',
                  fontSize: 12, fontWeight: 700, color: 'var(--neutral-900)',
                  background: '#fff', border: '1px solid var(--neutral-300)', cursor: 'pointer',
                }}
              >
                {drift.fix}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
