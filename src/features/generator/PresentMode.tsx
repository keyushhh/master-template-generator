import { useCallback, useEffect, useState } from 'react';
import { SlideStage } from './PresentationCanvas';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';

interface PresentModeProps {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  ast: DocumentNode | null;
  /** Slide index (within visible slides) to open on. */
  startIndex?: number;
}

/**
 * Fullscreen slideshow. Renders one slide at a time, scaled to fit the viewport,
 * with keyboard (←/→/space/Esc) and on-screen navigation. Read-only.
 */
export function PresentMode({ open, onClose, deck, ast, startIndex = 0 }: PresentModeProps) {
  const visible = deck.slides.filter((s) => !s.hidden);
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(0.5);

  const clampedTotal = visible.length;
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, clampedTotal - 1)), [clampedTotal]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Reset to the requested slide each time we open.
  useEffect(() => {
    if (open) setIndex(Math.min(startIndex, Math.max(0, clampedTotal - 1)));
  }, [open, startIndex, clampedTotal]);

  // Fit the 1920×1080 slide to the viewport with a small margin.
  useEffect(() => {
    if (!open) return;
    const fit = () => {
      const s = Math.min((window.innerWidth * 0.94) / 1920, (window.innerHeight * 0.9) / 1080);
      setScale(s);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open]);

  // Keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, next, prev]);

  if (!open || clampedTotal === 0) return null;

  const slide = visible[Math.min(index, clampedTotal - 1)];
  const atStart = index === 0;
  const atEnd = index === clampedTotal - 1;

  const arrow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 48, height: 48, borderRadius: '50%', border: 'none',
    background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Exit present mode"
        style={{ position: 'absolute', top: 20, right: 24, ...arrow, width: 40, height: 40, background: 'rgba(255,255,255,0.10)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>

      {/* Slide (click right/left half to navigate) */}
      <div style={{ position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <SlideStage slide={slide} ast={ast} num={String(index + 1).padStart(2, '0')} scale={scale} logoUrl={deck.logoUrl} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          <div onClick={prev} style={{ flex: 1, cursor: atStart ? 'default' : 'w-resize' }} />
          <div onClick={next} style={{ flex: 1, cursor: atEnd ? 'default' : 'e-resize' }} />
        </div>
      </div>

      {/* Prev */}
      <button onClick={prev} disabled={atStart} aria-label="Previous slide" style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', ...arrow, opacity: atStart ? 0.3 : 1 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      {/* Next */}
      <button onClick={next} disabled={atEnd} aria-label="Next slide" style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', ...arrow, opacity: atEnd ? 0.3 : 1 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>

      {/* Counter */}
      <div style={{ position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.6)' }}>
        {index + 1} / {clampedTotal}
      </div>
    </div>
  );
}
