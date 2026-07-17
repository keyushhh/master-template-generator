import { useEffect, useRef, useState } from 'react';
import { SlideNavList } from './SlideNavList';
import { UploadPanel } from './UploadPanel';
// Sidebar for presenting the generated slides list and actions
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';
import logoBlack from '../../assets/Logo_Black_Transparent.png';

interface GeneratorSidebarProps {
  hasPresentation: boolean;
  deck: Deck;
  /** True once the committed deck was produced by Generate (guards regenerate). */
  deckGenerated: boolean;
  editing: boolean;
  dirty: boolean;
  onDocumentParsed: (ast: DocumentNode | null) => void;
  onGenerate: () => void;
  onToggleHidden: (instanceId: string) => void;
  onDuplicate: (instanceId: string) => void;
  onDelete: (instanceId: string) => void;
  onRename: (instanceId: string, title: string) => void;
}

/** Two-step confirm state that disarms itself after a short pause. */
function useArmedConfirm(timeoutMs = 3000): [boolean, (armed: boolean) => void] {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (armed) {
      timer.current = window.setTimeout(() => setArmed(false), timeoutMs);
    }
    return () => window.clearTimeout(timer.current);
  }, [armed, timeoutMs]);
  return [armed, setArmed];
}

export function GeneratorSidebar({
  hasPresentation,
  deck,
  deckGenerated,
  editing,
  dirty,
  onDocumentParsed,
  onGenerate,
  onToggleHidden,
  onDuplicate,
  onDelete,
  onRename,
}: GeneratorSidebarProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [generateArmed, setGenerateArmed] = useArmedConfirm();

  // Export states
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingPPTX, setIsExportingPPTX] = useState(false);
  const [pptxProgress, setPptxProgress] = useState({ current: 0, total: 0 });
  const [linkCopied, setLinkCopied] = useState(false);

  // Derive visible slides for export
  const visibleSlideIds = deck.slides.filter((s) => !s.hidden).map((s) => s.instanceId);

  // Regenerating replaces an existing generated deck (and any edits) — require
  // a second confirming click in that case. A pristine template deck is safe.
  const generateNeedsConfirm = deckGenerated || dirty || editing;

  const handleGenerateClick = () => {
    if (!hasPresentation) return;
    if (generateNeedsConfirm && !generateArmed) {
      setGenerateArmed(true);
      return;
    }
    setGenerateArmed(false);
    onGenerate();
  };

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    setTimeout(() => {
      window.print();
      setIsExportingPDF(false);
    }, 150);
  };

  const handleExportPPTX = async () => {
    if (visibleSlideIds.length === 0) return;
    setIsExportingPPTX(true);
    setPptxProgress({ current: 0, total: visibleSlideIds.length });
    try {
      const { exportToPPTX } = await import('./exportHelper');
      const presentationTitle = deck.slides[0]?.content.heading || deck.slides[0]?.title || 'Presentation';
      await exportToPPTX(visibleSlideIds, presentationTitle, (current, total) => {
        setPptxProgress({ current, total });
      });
    } catch (err) {
      console.error('PPTX export error:', err);
    } finally {
      setIsExportingPPTX(false);
    }
  };

  const handleCopyLink = async () => {
    const { copyShareLink } = await import('./exportHelper');
    const ok = await copyShareLink();
    if (ok) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };


  return (
    <aside className="sidenav">
      {/* Sidenav Brand container with token-aligned visual spacing */}
      <div className="sidenav-brand flex items-center justify-start pl-[28px] py-6 border-b border-neutral-150">
        <img src={logoBlack} alt="Wozku" className="w-[110px] h-auto" />
      </div>

      {/* Scrollable Navigation section */}
      <div className="sidenav-scroll flex-1 overflow-y-auto px-3 py-4">
        <SlideNavList
          slides={deck.slides}
          onToggleHidden={onToggleHidden}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onRename={onRename}
        />
      </div>

      {/* Tools Section at the bottom with premium vertical layout rhythm */}
      <div className="sidenav-tools flex flex-col gap-5 p-4 border-t border-neutral-150 bg-neutral-50/50">
        {/* Source Material label and dropzone container */}
        <div className="flex flex-col gap-2.5">
          <div className="tools-label font-mono text-[10px] font-semibold tracking-[0.1em] text-neutral-400 select-none">
            Source Material
          </div>
          <UploadPanel onDocumentParsed={onDocumentParsed} />
        </div>

        {/* CTA Actions container */}
        <div className="flex flex-col gap-2">
          {/* Primary CTA: Generate Deck — enabled once a Business Record parses.
              Regeneration over an existing deck requires a confirming click. */}
          <button
            disabled={!hasPresentation}
            onClick={handleGenerateClick}
            className={`w-full flex items-center justify-center gap-2.5 border-none h-[44px] px-4 rounded-[var(--radius-sharp)] font-sans font-bold text-[14px] transition-colors ${
              !hasPresentation
                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                : generateArmed
                  ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                  : 'bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white cursor-pointer'
            }`}
          >
            {generateArmed ? 'Replace Current Deck?' : 'Generate Deck'}
          </button>

          {/* Share dropdown trigger */}
          <button
            disabled={!hasPresentation}
            onClick={() => hasPresentation && setShareOpen(o => !o)}
            className={`w-full flex items-center justify-center gap-2 h-[44px] px-4 text-[14px] rounded-[var(--radius-sharp)] font-bold transition-all ${
              hasPresentation
                ? 'text-neutral-900 bg-neutral-100 hover:bg-neutral-200 cursor-pointer border border-neutral-200'
                : 'text-neutral-400 bg-neutral-50 cursor-not-allowed opacity-60 border border-neutral-150'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: shareOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* Dropdown items for Share CTA */}
          {shareOpen && (
            <div className="flex flex-col gap-1 mt-1">
              <button
                disabled={isExportingPDF || isExportingPPTX}
                onClick={handleExportPDF}
                className="w-full flex items-center gap-2.5 h-[40px] px-3.5 text-[13px] font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-[var(--radius-sharp)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {isExportingPDF ? 'Preparing PDF…' : 'Export PDF'}
              </button>
              <button
                disabled={isExportingPDF || isExportingPPTX}
                onClick={handleExportPPTX}
                className="w-full flex items-center gap-2.5 h-[40px] px-3.5 text-[13px] font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-[var(--radius-sharp)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {isExportingPPTX
                  ? `Exporting (${pptxProgress.current}/${pptxProgress.total})…`
                  : 'Export PPTX'}
              </button>
              <button
                disabled={isExportingPDF || isExportingPPTX}
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2.5 h-[40px] px-3.5 text-[13px] font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-[var(--radius-sharp)]"
              >
                {linkCopied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="green" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                )}
                {linkCopied ? 'Link Copied!' : 'Copy Share Link'}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
