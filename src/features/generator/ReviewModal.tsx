import { useEffect, useRef, useState } from 'react';
import { SlideStage } from './PresentationCanvas';
import { SaveToLibraryModal } from './SaveToLibraryModal';
import { analyzeCoverage, analyzeContentChecklist } from '../deck/deckBuilder';
import { useToast } from '../toast/Toast';
import { useFocusTrap } from '../a11y/useFocusTrap';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck, SlideInstance } from '../deck/types';
import type { CampaignType } from '../business-record/sampleDecks';

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  ast: DocumentNode | null;
  /** Enter fullscreen present mode from the review screen. */
  onPresent: () => void;
  /** Drag-reorder: move the slide with `fromId` to the position of `toId`. */
  onReorder: (fromId: string, toId: string) => void;
  /** Show/hide a slide (hidden slides are excluded from export/present). Also the
   *  action a card click toggles - "selected" in this grid IS "included in export". */
  onToggleHidden: (instanceId: string) => void;
  /** Delete one or more slides. Called with a single id from each card's delete icon. */
  onBulkDelete: (instanceIds: string[]) => void;
  /** Close the modal and scroll the main canvas to this slide. */
  onJumpTo: (instanceId: string) => void;
  /** Save the current deck into the use case library (Source Material's Samples tab). */
  onSaveToLibrary: (name: string, description: string, campaignType: CampaignType) => void;
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
export function ReviewModal({
  open,
  onClose,
  deck,
  ast,
  onPresent,
  onReorder,
  onToggleHidden,
  onBulkDelete,
  onJumpTo,
  onSaveToLibrary,
}: ReviewModalProps) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<null | 'pdf' | 'pptx' | 'png'>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [linkCopied, setLinkCopied] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  // Native drag-reorder state (mirrors SlideNavList).
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  // Close the export format menu on an outside click.
  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [exportMenuOpen]);

  if (!open) return null;

  const deleteSlide = (instanceId: string) => {
    if (!window.confirm('Delete this slide? This can be undone with Cmd/Ctrl+Z.')) return;
    onBulkDelete([instanceId]);
  };

  const visible = deck.slides.filter((s) => !s.hidden);
  const title = deck.slides[0]?.content.heading || deck.slides[0]?.title || 'Presentation';
  const visibleIds = visible.map((s) => s.instanceId);
  const coverage = ast ? analyzeCoverage(ast, deck) : null;
  const hasWarnings = !!coverage && (coverage.unmatchedBullets.length > 0 || coverage.insightSections.length > 0);
  const contentChecklist = analyzeContentChecklist(deck);

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
      <div ref={panelRef} className="flex flex-col w-full max-w-6xl max-h-[92vh] sm:max-h-[90vh] bg-white rounded-[var(--radius-sharp)] shadow-2xl overflow-hidden my-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 border-b border-neutral-150 shrink-0">
          <div className="flex flex-col gap-1">
            <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-400">Review &amp; Export</div>
            <h2 className="text-[16px] sm:text-[17px] font-bold text-neutral-900">
              {title} <span className="text-neutral-400 font-medium">· {visible.length} slide{visible.length === 1 ? '' : 's'}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSaveOpen(true)}
              disabled={!!busy || deck.slides.length === 0}
              className="h-[34px] px-3.5 flex items-center gap-1.5 text-[12.5px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
              Save Deck
            </button>
            <button onClick={() => !busy && onClose()} aria-label="Close" className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-[var(--radius-sharp)] transition-colors cursor-pointer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        {/* Thumbnail grid */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 bg-neutral-50">
          {/* Deck check; coverage of the source content (what filled, what got dropped). */}
          {coverage && (
            <div className={`mb-4 sm:mb-5 border rounded-[var(--radius-sharp)] px-3.5 py-2.5 sm:px-4 sm:py-3 ${hasWarnings ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="flex items-center gap-2 text-[12px] sm:text-[12.5px] font-bold">
                {hasWarnings ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
                <span className={hasWarnings ? 'text-amber-800' : 'text-emerald-800'}>
                  Deck check; {coverage.filled} of {coverage.total} slides filled
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
                      <span className="font-semibold">{s}</span> wasn’t a recognized section; rendered as an insight slide.
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Content check - derived from what's actually in the deck (no self-report
              checkboxes; see memory `no-honor-system-ui` for why that shape got reverted). */}
          {deck.slides.length > 0 && (() => {
            const items = [
              { ok: contentChecklist.hasMetrics, label: contentChecklist.hasMetrics ? 'Metrics / ROI data included' : 'No metrics or ROI data in this deck' },
              { ok: contentChecklist.hasVisualProof, label: contentChecklist.hasVisualProof ? 'Visual proof (image) included' : 'No visual/image slide in this deck' },
            ];
            const allOk = items.every((i) => i.ok);
            return (
              <div className={`mb-4 sm:mb-5 border rounded-[var(--radius-sharp)] px-3.5 py-2.5 sm:px-4 sm:py-3 ${allOk ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
                <div className="flex items-center gap-2 text-[12px] sm:text-[12.5px] font-bold mb-1.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={allOk ? '#059669' : '#d97706'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span className={allOk ? 'text-emerald-800' : 'text-amber-800'}>Content check</span>
                </div>
                <ul className="flex flex-col gap-1 text-[11.5px] sm:text-[12px] pl-[23px]">
                  {items.map((it, i) => (
                    <li key={i} className={it.ok ? 'text-emerald-800/90' : 'text-amber-800/90'}>
                      {it.ok ? '✓' : '·'} {it.label}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {deck.slides.length === 0 ? (
            <div className="text-center text-[13px] text-neutral-500 py-16">No slides. Add slides to export.</div>
          ) : (
            <>
              <div className="mb-3 text-[11.5px] text-neutral-500">
                Drag to reorder. Click a slide to include or exclude it from the export; double-click to jump to it.
              </div>
              <div className="grid gap-4 sm:gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {deck.slides.map((slide) => {
                  const pos = visibleIds.indexOf(slide.instanceId); // -1 if hidden
                  const num = pos === -1 ? '--' : String(pos + 1).padStart(2, '0');
                  const isDragging = dragId === slide.instanceId;
                  const isOver = overId === slide.instanceId && dragId !== slide.instanceId;
                  // "Selected" IS "included in export" - this grid has no separate
                  // multi-select concept anymore. Mirrors the coverage banner's X of Y.
                  const isSelected = !slide.hidden;
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
                        // Only toggle when not finishing a drag.
                        if (!dragId) onToggleHidden(slide.instanceId);
                      }}
                      onDoubleClick={() => onJumpTo(slide.instanceId)}
                      title={isSelected ? 'Click to exclude from export - double-click to jump to it' : 'Click to include in export - double-click to jump to it'}
                      className={`flex flex-col gap-2 transition-opacity ${isDragging ? 'opacity-40 cursor-grabbing' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`relative overflow-hidden shadow-sm transition-all rounded-[var(--radius-sharp)] border-2 ${
                          isOver
                            ? 'border-emerald-500 ring-2 ring-emerald-300'
                            : isSelected
                              ? 'border-emerald-500'
                              : 'border-neutral-300'
                        }`}
                      >
                        <ScaledSlideStage slide={slide} ast={ast} num={num} logoUrl={deck.logoUrl} />
                        {/* Permanent accent wash - selected (included) reads emerald, unselected (excluded) reads a muted gray-green, both visible without hovering. */}
                        <div
                          className={`absolute inset-0 z-[8] pointer-events-none transition-colors ${
                            isSelected ? 'bg-emerald-500/10' : 'bg-neutral-500/15'
                          }`}
                        />
                        {/* Persistent selection badge - no hover needed to see state. */}
                        <div
                          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-[25px] h-[25px] flex items-center justify-center rounded-full border-2 shadow-sm ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'bg-white/90 border-neutral-300 text-neutral-300'
                          }`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                        {/* Delete - the only remaining per-card destructive action now that
                            selection no longer doubles as a multi-select for bulk delete. */}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSlide(slide.instanceId); }}
                          title="Delete slide"
                          aria-label="Delete slide"
                          className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-[var(--radius-sharp)] shadow-sm transition-colors cursor-pointer bg-neutral-900/85 text-white hover:bg-red-600"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                        {!isSelected && (
                          <span className="absolute bottom-2 left-2 z-10 font-mono text-[9px] font-bold tracking-[0.1em] bg-neutral-900/80 text-white px-1.5 py-0.5 rounded-[var(--radius-sharp)]">EXCLUDED</span>
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
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={!!busy || visible.length === 0}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                className={`${btnBase} text-white bg-neutral-900 hover:bg-neutral-800`}
              >
                {busy ? `Exporting ${busy.toUpperCase()}…` : 'Export'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {exportMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-44 py-1.5 bg-white border border-neutral-200 rounded-[var(--radius-sharp)] shadow-lg z-10">
                  {(['pptx', 'pdf', 'png'] as const).map((kind) => (
                    <button
                      key={kind}
                      onClick={() => { setExportMenuOpen(false); runExport(kind); }}
                      className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                    >
                      {kind === 'png' ? 'Download PNGs' : `Export ${kind.toUpperCase()}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <SaveToLibraryModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        suggestedName={title}
        onSave={(name, description, campaignType) => {
          onSaveToLibrary(name, description, campaignType);
          showToast(`Saved "${name}" to the use case library.`, 'success');
        }}
      />
    </div>
  );
}
