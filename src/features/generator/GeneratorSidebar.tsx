import { useEffect, useRef, useState } from 'react';
import { SlideNavList } from './SlideNavList';
import { SourceMaterialModal } from './SourceMaterialModal';
// Sidebar for presenting the generated slides list and actions
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';
import logoBlack from '../../assets/Logo_Black_Transparent.png';

interface GeneratorSidebarProps {
  hasPresentation: boolean;
  /** Parsed document — carried into PDF export so the client logo renders. */
  ast: DocumentNode | null;
  deck: Deck;
  /** True once the committed deck was produced by Generate (guards regenerate). */
  deckGenerated: boolean;
  editing: boolean;
  dirty: boolean;
  onDocumentParsed: (ast: DocumentNode | null) => void;
  /** Import a source AND build the deck in one step (Import & Load in the modal). */
  onImport: (ast: DocumentNode) => void;
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
  ast,
  deck,
  deckGenerated,
  editing,
  dirty,
  onDocumentParsed,
  onImport,
  onGenerate,
  onToggleHidden,
  onDuplicate,
  onDelete,
  onRename,
}: GeneratorSidebarProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  // Export states
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [isExportingPPTX, setIsExportingPPTX] = useState(false);
  const [pptxProgress, setPptxProgress] = useState({ current: 0, total: 0 });
  const [linkCopied, setLinkCopied] = useState(false);

  // Derive visible slides for export
  const visibleSlideIds = deck.slides.filter((s) => !s.hidden).map((s) => s.instanceId);

  const handleExportPDF = async () => {
    if (visibleSlideIds.length === 0) return;
    setPdfError(false);
    setIsExportingPDF(true);
    try {
      const { exportToPDF } = await import('./exportHelper');
      const presentationTitle =
        deck.slides[0]?.content.heading || deck.slides[0]?.title || 'Presentation';
      await exportToPDF({ ast, deck }, presentationTitle);
    } catch (err) {
      console.error('PDF export error:', err);
      setPdfError(true);
      setTimeout(() => setPdfError(false), 4000);
    } finally {
      setIsExportingPDF(false);
    }
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
        {/* Single entry point — opens the 3-tab Source Material modal
            (Conversion Prompt · Paste · Upload). */}
        <button
          onClick={() => setSourceOpen(true)}
          className="w-full flex items-center justify-center gap-2 h-[44px] px-4 rounded-[var(--radius-sharp)] font-sans font-bold text-[14px] bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white transition-colors cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          Source Material
          {hasPresentation && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          )}
        </button>

        {/* CTA Actions container */}
        <div className="flex flex-col gap-2">
          {/* Generate Deck — "Import & Load" in the Source Material modal now builds
              the deck automatically, so this is only the fallback for a source that
              was loaded but not yet built. Once a deck exists it locks to a done
              state to prevent accidental re-generation (which would discard edits).
              To rebuild, use Reset then Source Material again. */}
          <button
            disabled={!hasPresentation || deckGenerated}
            onClick={() => hasPresentation && !deckGenerated && onGenerate()}
            className={`w-full flex items-center justify-center gap-2 h-[44px] px-4 rounded-[var(--radius-sharp)] font-sans font-bold text-[14px] transition-colors ${
              !hasPresentation
                ? 'border-none bg-neutral-200 text-neutral-400 cursor-not-allowed'
                : deckGenerated
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default'
                  : 'border-none bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white cursor-pointer'
            }`}
          >
            {deckGenerated && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            )}
            {deckGenerated ? 'Deck Generated' : 'Generate Deck'}
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
                {pdfError ? 'PDF export failed' : isExportingPDF ? 'Generating PDF…' : 'Export PDF'}
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

      <SourceMaterialModal
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onDocumentParsed={onDocumentParsed}
        onImport={onImport}
        hasSource={hasPresentation}
      />
    </aside>
  );
}
