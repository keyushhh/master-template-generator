import { useState } from 'react';
import { SlideNavList } from './SlideNavList';
import { UploadPanel } from './UploadPanel';
import type { DocumentNode } from '../business-record/parser/ast';
import logoBlack from '../../assets/Logo_Black_Transparent.png';

interface GeneratorSidebarProps {
  hasPresentation: boolean;
  onDocumentParsed: (ast: DocumentNode | null) => void;
}

export function GeneratorSidebar({ hasPresentation, onDocumentParsed }: GeneratorSidebarProps) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <aside className="sidenav">
      <div className="sidenav-brand justify-center py-6">
        <img src={logoBlack} alt="Wozku" className="w-[120px]" />
      </div>
      <div className="sidenav-scroll">
        <SlideNavList />
      </div>
      
      <div className="sidenav-tools flex flex-col gap-2">
        <div className="flex flex-col gap-3">
          <div className="tools-label">Source Material</div>
          <UploadPanel onDocumentParsed={onDocumentParsed} />
        </div>
        
        <div className="flex flex-col gap-2">
          {/* Primary CTA */}
          <button
            className="w-full flex items-center justify-center gap-3 bg-neutral-900 hover:bg-indigo-700 text-white border-none h-[48px] px-4 rounded-none font-sans font-bold text-[14.5px] cursor-pointer transition-colors"
          >
            Generate Deck
          </button>

          {/* Share dropdown trigger */}
          <button
            disabled={!hasPresentation}
            onClick={() => hasPresentation && setShareOpen(o => !o)}
            className={`w-full flex items-center justify-center gap-2 h-[48px] px-4 text-[14.5px] rounded-none font-bold transition-colors ${hasPresentation ? 'text-neutral-900 bg-neutral-100 hover:bg-neutral-200 cursor-pointer' : 'text-neutral-400 bg-neutral-50 cursor-not-allowed opacity-60'}`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: shareOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* Dropdown items */}
          {shareOpen && (
            <div className="flex flex-col gap-1">
              <button className="w-full flex items-center gap-3 h-[44px] px-5 text-[13.5px] font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 cursor-pointer border-none transition-colors rounded-none">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export PDF
              </button>
              <button className="w-full flex items-center gap-3 h-[44px] px-5 text-[13.5px] font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 cursor-pointer border-none transition-colors rounded-none">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export PPTX
              </button>
              <button className="w-full flex items-center gap-3 h-[44px] px-5 text-[13.5px] font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 cursor-pointer border-none transition-colors rounded-none">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Copy Share Link
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
