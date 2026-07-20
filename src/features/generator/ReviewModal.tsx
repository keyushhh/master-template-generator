import { useEffect, useRef, useState } from 'react';
import { SlideStage } from './PresentationCanvas';
import { analyzeCoverage } from '../deck/deckBuilder';
import { useToast } from '../toast/Toast';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck, SlideInstance } from '../deck/types';

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  ast: DocumentNode | null;
  /** Enter fullscreen present mode from the review screen. */
  onPresent: () => void;
  /** Drag-reorder: move the slide with `fromId` to the position of `toId`. */
  onReorder: (fromId: string, toId: string) => void;
  /** Show/hide a slide (hidden slides are excluded from export/present). */
  onToggleHidden: (instanceId: string) => void;
  /** Close the modal and scroll the main canvas to this slide. */
  onJumpTo: (instanceId: string) => void;
}

/**
 * Responsive wrapper around SlideStage that calculates the CSS transform scale
 * dynamically based on container width so slide thumbnails always fill 100% of
 * their 16:9 grid cards without empty side gaps or distortion across screen sizes.
 */
function ScaledSlideStage({
  slide,
  ast,
  num,
  logoUrl,
}: {
  slide: SlideInstance;
  ast: DocumentNode | null;
  num: string;
  logoUrl?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.16);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) setScale(width / 1920);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full aspect-[16/9] relative overflow-hidden bg-white">
      <SlideStage slide={slide} ast={ast} num={num} scale={scale} logoUrl={logoUrl} />
    </div>
  );
}

/**
 * Final review before exporting/sharing: a grid of every visible slide plus the
 * export actions. Gives the "check everything before it goes to the client" step
 * the team asked for. Export runs client-side (no server).
 */
export function ReviewModal({ open, onClose, deck, ast, onPresent, onReorder, onToggleHidden, onJumpTo }: ReviewModalProps) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<null | 'pdf' | 'pptx' | 'png'>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [linkCopied, setLinkCopied] = useState(false);
  // Native drag-reorder state (mirrors SlideNavList).
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  if (!open) return null;

  const visible = deck.slides.filter((s) => !s.hidden);
  const title = deck.slides[0]?.content.heading || deck.slides[0]?.title || 'Presentation';
  const visibleIds = visible.map((s) => s.instanceId);
  const coverage = ast ? analyzeCoverage(ast, deck) : null;
  const hasWarnings = !!coverage && (coverage.unmatchedBullets.length > 0 || coverage.insightSections.length > 0);

  const runExport = async (kind: 'pdf' | 'pptx' | 'png') => {
    if (busy || visibleIds.length === 0) return;
    setBusy(kind);
    setProgress({ current: 0, total: visibleIds.length });
    try {
      const mod = await import('./exportHelper');
      const onProgress = (current: number, total: number) => setProgress({ current, total });
      if (kind === 'pdf') await mod.exportToPDF(visibleIds, title, onProgress);
      else if (kind === 'png') await mod.exportSlidesAsPngZip(visibleIds, title, onProgress);
      else await mod.exportToPPTX(visible, title, deck.logoUrl, onProgress);
    } catch (err) {
      console.error(`${kind} export error:`, err);
      showToast(`${kind.toUpperCase()} export failed. Please try again.`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    const { copyShareLink } = await import('./exportHelper');
    if (await copyShareLink()) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const btnBase =
    'h-[38px] sm:h-[42px] px-3.5 sm:px-5 flex items-center gap-2 text-[12px] sm:text-[13px] font-bold rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto" onClick={() => !busy && onClose()}>
      <div className="flex flex-col w-full max-w-6xl max-h-[92vh] sm:max-h-[90vh] bg-white rounded-[var(--radius-sharp)] shadow-2xl overflow-hidden my-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 border-b border-neutral-150 shrink-0">
          <div className="flex flex-col gap-1">
            <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-400">Review &amp; Export</div>
            <h2 className="text-[16px] sm:text-[17px] font-bold text-neutral-900">
              {title} <span className="text-neutral-400 font-medium">· {visible.length} slide{visible.length === 1 ? '' : 's'}</span>
            </h2>
          </div>
          <button onClick={() => !busy && onClose()} aria-label="Close" className="shrink-0 w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-[var(--radius-sharp)] transition-colors cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Thumbnail grid */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 bg-neutral-50">
          {/* Deck check — coverage of the source content (what filled, what got dropped). */}
          {coverage && (
            <div className={`mb-4 sm:mb-5 border rounded-[var(--radius-sharp)] px-3.5 py-2.5 sm:px-4 sm:py-3 ${hasWarnings ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="flex items-center gap-2 text-[12px] sm:text-[12.5px] font-bold">
                {hasWarnings ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
                <span className={hasWarnings ? 'text-amber-800' : 'text-emerald-800'}>
                  Deck check — {coverage.filled} of {coverage.total} slides filled
                </span>
              </div>
              {hasWarnings && (
                <ul className="mt-2 flex flex-col gap-1 text-[11.5px] sm:text-[12px] text-amber-800/90 leading-relaxed list-disc pl-5">
                  {coverage.unmatchedBullets.map((b, i) => (
                    <li key={`u${i}`}>
                      In <span className="font-semibold">{b.section}</span>: <span className="font-mono text-[11px]">{b.text}</span> didn’t match a known type and won’t appear on a slide.
                    </li>
                  ))}
                  {coverage.insightSections.map((s, i) => (
                    <li key={`i${i}`}>
                      <span className="font-semibold">{s}</span> wasn’t a recognized section — rendered as an insight slide.
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {deck.slides.length === 0 ? (
            <div className="text-center text-[13px] text-neutral-500 py-16">No slides. Add slides to export.</div>
          ) : (
            <>
              <div className="mb-3 text-[11.5px] text-neutral-500">
                Drag to reorder. Toggle the eye to include or exclude a slide from export &amp; present.
              </div>
              <div className="grid gap-4 sm:gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {deck.slides.map((slide) => {
                  const pos = visibleIds.indexOf(slide.instanceId); // -1 if hidden
                  const num = pos === -1 ? '--' : String(pos + 1).padStart(2, '0');
                  const isDragging = dragId === slide.instanceId;
                  const isOver = overId === slide.instanceId && dragId !== slide.instanceId;
                  return (
                    <div
                      key={slide.instanceId}
                      draggable
                      onDragStart={() => setDragId(slide.instanceId)}
                      onDragEnter={() => setOverId(slide.instanceId)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragId && dragId !== slide.instanceId) onReorder(dragId, slide.instanceId);
                        setDragId(null);
                        setOverId(null);
                      }}
                      onDragEnd={() => { setDragId(null); setOverId(null); }}
                      onClick={() => {
                        // Only jump when not finishing a drag.
                        if (!dragId) onJumpTo(slide.instanceId);
                      }}
                      title={slide.hidden ? undefined : 'Click to jump to this slide'}
                      className={`flex flex-col gap-2 transition-opacity ${isDragging ? 'opacity-40 cursor-grabbing' : slide.hidden ? 'cursor-grab' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`relative border bg-white overflow-hidden shadow-sm transition-all rounded-[var(--radius-sharp)] ${
                          isOver ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-neutral-200 hover:border-neutral-400'
                        } ${slide.hidden ? 'opacity-45' : ''}`}
                      >
                        <ScaledSlideStage slide={slide} ast={ast} num={num} logoUrl={deck.logoUrl} />
                        {/* Include/exclude toggle */}
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleHidden(slide.instanceId); }}
                          title={slide.hidden ? 'Include in export' : 'Exclude from export'}
                          aria-label={slide.hidden ? 'Include slide' : 'Exclude slide'}
                          className={`absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-[var(--radius-sharp)] shadow-sm transition-colors cursor-pointer ${
                            slide.hidden ? 'bg-white/90 text-neutral-400 hover:text-neutral-700' : 'bg-neutral-900/85 text-white hover:bg-neutral-900'
                          }`}
                        >
                          {slide.hidden ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          )}
                        </button>
                        {slide.hidden && (
                          <span className="absolute bottom-2 left-2 z-10 font-mono text-[9px] font-bold uppercase tracking-[0.1em] bg-neutral-900/80 text-white px-1.5 py-0.5 rounded-[var(--radius-sharp)]">Hidden</span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2 text-[11px] text-neutral-500">
                        <span className="font-mono text-neutral-400">{num}</span>
                        <span className="truncate">{slide.title}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6 sm:py-4 border-t border-neutral-150 shrink-0 bg-white">
          <div className="text-[12px] text-neutral-500 min-h-[18px]">
            {busy ? `Exporting ${busy.toUpperCase()} - slide ${progress.current} of ${progress.total}…` : 'Everything look right? Export or present.'}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button onClick={onPresent} disabled={!!busy || visible.length === 0} aria-label="Start presenting" className={`${btnBase} text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Present
            </button>
            <button onClick={copyLink} disabled={!!busy} className={`${btnBase} text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200`}>
              {linkCopied ? 'Link Copied!' : 'Copy Link'}
            </button>
            <button onClick={() => runExport('png')} disabled={!!busy || visible.length === 0} className={`${btnBase} text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200`}>
              Download PNGs
            </button>
            <button onClick={() => runExport('pdf')} disabled={!!busy || visible.length === 0} className={`${btnBase} text-white bg-neutral-800 hover:bg-neutral-700`}>
              Export PDF
            </button>
            <button onClick={() => runExport('pptx')} disabled={!!busy || visible.length === 0} className={`${btnBase} text-white bg-neutral-900 hover:bg-neutral-800`}>
              Export PPTX
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
