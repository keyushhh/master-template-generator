import { useEffect, useMemo, useRef, useState } from 'react';
import type { SlideInstance } from '../deck/types';
import { CloseIcon, SearchIcon } from '../ui/icons';
import { useFocusTrap } from '../a11y/useFocusTrap';

interface FindMatch {
  slideId: string;
  slideIndex: number;
  slideTitle: string;
  location: string;
  text: string;
}

interface FindReplaceModalProps {
  open: boolean;
  onClose: () => void;
  slides: SlideInstance[];
  activeSlideId: string;
  onJumpToSlide: (slideId: string) => void;
  onReplaceAll: (findText: string, replaceText: string, caseSensitive: boolean) => void;
  onReplaceCurrent: (slideId: string, findText: string, replaceText: string, caseSensitive: boolean) => void;
}

/**
 * Extracts searchable text items from a slide's content and overlay shapes.
 */
function extractSlideMatches(slide: SlideInstance, query: string, caseSensitive: boolean): FindMatch[] {
  if (!query) return [];
  const matches: FindMatch[] = [];
  const q = caseSensitive ? query : query.toLowerCase();

  const check = (text: string | undefined, location: string) => {
    if (!text) return;
    const target = caseSensitive ? text : text.toLowerCase();
    if (target.includes(q)) {
      matches.push({
        slideId: slide.instanceId,
        slideIndex: 0,
        slideTitle: slide.title || slide.content.heading || slide.content.eyebrow || 'Untitled Slide',
        location,
        text,
      });
    }
  };

  check(slide.content.heading, 'Heading');
  check(slide.content.eyebrow, 'Eyebrow');
  check(slide.content.body, 'Body');
  check(slide.content.subtitle, 'Subtitle');
  check(slide.content.quote, 'Quote');
  check(slide.content.author, 'Author');
  check(slide.content.role, 'Role');
  check(slide.content.leftHeading, 'Left Heading');
  check(slide.content.leftBody, 'Left Body');
  check(slide.content.rightHeading, 'Right Heading');
  check(slide.content.rightBody, 'Right Body');
  check(slide.content.secondHeading, 'Second Heading');
  check(slide.content.secondBody, 'Second Body');
  check(slide.content.metricLabel, 'Metric Label');
  check(slide.content.metricText, 'Metric Text');
  check(slide.content.tagline, 'Tagline');
  check(slide.content.projectLabel, 'Project Label');
  check(slide.content.confidentialLabel, 'Confidential Label');
  check(slide.content.value, 'Value');
  check(slide.content.unit, 'Unit');

  if (slide.content.parts) {
    slide.content.parts.forEach((p, i) => {
      check(p.title, `Part Title ${i + 1}`);
      check(p.description, `Part Description ${i + 1}`);
    });
  }

  if (slide.content.bars) {
    slide.content.bars.forEach((b, i) => {
      check(b.label, `Bar Label ${i + 1}`);
      check(String(b.pct), `Bar Percentage ${i + 1}`);
    });
  }

  if (slide.content.kpis) {
    slide.content.kpis.forEach((k, i) => {
      check(k.label, `KPI Label ${i + 1}`);
      check(k.value, `KPI Value ${i + 1}`);
    });
  }

  if (slide.content.phases) {
    slide.content.phases.forEach((p, i) => {
      check(p.title, `Phase ${i + 1} Title`);
      check(p.description, `Phase ${i + 1} Description`);
    });
  }

  if (slide.content.steps) {
    slide.content.steps.forEach((st, i) => {
      check(st.title, `Step ${i + 1} Title`);
      check(st.description, `Step ${i + 1} Description`);
    });
  }

  if (slide.content.overlay) {
    slide.content.overlay.forEach((s) => {
      if (s.kind === 'text') {
        check(s.text, 'Text Box');
      } else if (s.kind === 'table' && s.rows) {
        s.rows.forEach((r, ri) => {
          r.cells.forEach((c, ci) => check(c.text, `Table R${ri + 1}C${ci + 1}`));
        });
      }
    });
  }

  return matches;
}

export function FindReplaceModal({
  open,
  onClose,
  slides,
  activeSlideId,
  onJumpToSlide,
  onReplaceAll,
  onReplaceCurrent,
}: FindReplaceModalProps) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef, open);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => findInputRef.current?.focus(), 50);
    }
  }, [open]);

  // Find all matches across deck
  const allMatches = useMemo(() => {
    if (!findText.trim()) return [];
    return slides.flatMap((slide, idx) => {
      const ms = extractSlideMatches(slide, findText, caseSensitive);
      return ms.map((m) => ({ ...m, slideIndex: idx + 1 }));
    });
  }, [slides, findText, caseSensitive]);

  // Keep active index in bounds
  useEffect(() => {
    if (activeMatchIndex >= allMatches.length) {
      setActiveMatchIndex(Math.max(0, allMatches.length - 1));
    }
  }, [allMatches.length, activeMatchIndex]);

  const currentMatch = allMatches[activeMatchIndex] || null;

  // Jump to match slide when index changes
  useEffect(() => {
    if (currentMatch) {
      onJumpToSlide(currentMatch.slideId);
    }
  }, [currentMatch, onJumpToSlide]);

  if (!open) return null;

  const handleNext = () => {
    if (allMatches.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % allMatches.length);
  };

  const handlePrev = () => {
    if (allMatches.length === 0) return;
    setActiveMatchIndex((prev) => (prev - 1 + allMatches.length) % allMatches.length);
  };

  const handleReplace = () => {
    if (!currentMatch) return;
    onReplaceCurrent(currentMatch.slideId, findText, replaceText, caseSensitive);
  };

  const handleReplaceAllClick = () => {
    if (!findText.trim()) return;
    onReplaceAll(findText, replaceText, caseSensitive);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-20 bg-neutral-900/60 backdrop-blur-xs">
      <div
        ref={containerRef}
        className="w-full max-w-[540px] bg-white border border-neutral-200 shadow-2xl rounded-[var(--radius-sharp)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 bg-neutral-50">
          <div className="flex items-center gap-2">
            <SearchIcon size={16} />
            <h2
              className="text-[16px] font-bold text-neutral-900 tracking-[-0.01em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Find and Replace
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Find and Replace"
            className="p-1 text-neutral-400 hover:text-neutral-800 transition-colors cursor-pointer"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Inputs */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-neutral-600">Find</label>
            <div className="relative flex items-center">
              <input
                ref={findInputRef}
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="Search across all slides..."
                className="w-full h-9 pl-3 pr-16 bg-neutral-50 border border-neutral-200 rounded-[var(--radius-sharp)] text-[13px] text-neutral-900 focus:bg-white focus:border-neutral-900 outline-none"
              />
              <button
                type="button"
                onClick={() => setCaseSensitive(!caseSensitive)}
                title="Match case"
                className={`absolute right-2.5 px-1.5 py-0.5 text-[11px] font-mono font-bold rounded border transition-colors cursor-pointer ${
                  caseSensitive
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                    : 'bg-white border-neutral-200 text-neutral-400 hover:text-neutral-700'
                }`}
              >
                Aa
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-neutral-600">Replace with</label>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replacement text..."
              className="w-full h-9 px-3 bg-neutral-50 border border-neutral-200 rounded-[var(--radius-sharp)] text-[13px] text-neutral-900 focus:bg-white focus:border-neutral-900 outline-none"
            />
          </div>

          {/* Status & Navigation */}
          {findText.trim() && (
            <div className="flex items-center justify-between text-[12px] text-neutral-500 pt-1">
              <span>
                {allMatches.length === 0
                  ? 'No matches found'
                  : `Match ${activeMatchIndex + 1} of ${allMatches.length}`}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={allMatches.length === 0}
                  className="px-2 py-1 text-[11px] font-bold bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 text-neutral-700 rounded transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={allMatches.length === 0}
                  className="px-2 py-1 text-[11px] font-bold bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 text-neutral-700 rounded transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Matches List Preview */}
          {allMatches.length > 0 && (
            <div className="max-h-[140px] overflow-y-auto border border-neutral-200 bg-neutral-50 rounded-[var(--radius-sharp)] divide-y divide-neutral-200">
              {allMatches.map((m, idx) => (
                <div
                  key={`${m.slideId}_${idx}`}
                  onClick={() => {
                    setActiveMatchIndex(idx);
                    onJumpToSlide(m.slideId);
                  }}
                  className={`px-3 py-2 text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                    idx === activeMatchIndex ? 'bg-emerald-50 text-emerald-950 font-medium' : 'hover:bg-neutral-100 text-neutral-700'
                  }`}
                >
                  <span className="truncate max-w-[360px]">
                    <strong className="font-mono text-[11px] text-neutral-500 mr-2">Slide {m.slideIndex}</strong>
                    <span className="text-neutral-400 mr-1">({m.location}):</span>
                    <span>{m.text}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={handleReplace}
              disabled={allMatches.length === 0}
              className="px-3.5 h-8 text-[12.5px] font-bold text-neutral-800 bg-white border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleReplaceAllClick}
              disabled={allMatches.length === 0}
              className="px-4 h-8 text-[12.5px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
            >
              Replace All ({allMatches.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
