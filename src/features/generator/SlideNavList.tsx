import { useEffect, useState } from 'react';
import type { SlideInstance } from '../deck/types';

interface SlideNavListProps {
  slides: SlideInstance[];
  onToggleHidden: (instanceId: string) => void;
  onDuplicate: (instanceId: string) => void;
  onDelete: (instanceId: string) => void;
  onRename: (instanceId: string, title: string) => void;
}

interface NavGroup {
  label: string;
  slides: SlideInstance[];
}

/** Group consecutive slides sharing the same group label. */
function groupSlides(slides: SlideInstance[]): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const slide of slides) {
    const last = groups[groups.length - 1];
    if (last && last.label === slide.group) {
      last.slides.push(slide);
    } else {
      groups.push({ label: slide.group, slides: [slide] });
    }
  }
  return groups;
}

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </>
      ) : (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function SlideNavList({ slides, onToggleHidden, onDuplicate, onDelete, onRename }: SlideNavListProps) {
  const [activeId, setActiveId] = useState<string>(slides[0]?.instanceId ?? '');
  // Double-click-to-rename state: which row is being renamed + its draft text.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue);
    }
    setRenamingId(null);
  };

  // Visible-slide numbering — must match the canvas footer numbering.
  const numbering = new Map<string, string>();
  let visibleIndex = 0;
  for (const slide of slides) {
    if (!slide.hidden) {
      visibleIndex += 1;
      numbering.set(slide.instanceId, String(visibleIndex).padStart(2, '0'));
    }
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: '-50% 0px -50% 0px',
        threshold: 0,
      }
    );

    slides.forEach((slide) => {
      const element = document.getElementById(slide.instanceId);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [slides]);

  const handleNavigate = (slide: SlideInstance) => {
    if (slide.hidden) return;
    const element = document.getElementById(slide.instanceId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col">
      <div className="px-1">
        {groupSlides(slides).map((group, index) => (
          <div
            key={`${group.label}-${index}`}
            style={{ marginTop: index === 0 ? 0 : 40 }}
          >
            {/* Group Label: 40px systematic spacer on groups after first */}
            <div className="px-3 mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 select-none">
              {group.label}
            </div>

            {/* Slide items with generous spacing rhythm */}
            <div className="space-y-[6px]">
              {group.slides.map((slide) => {
                const isActive = activeId === slide.instanceId && !slide.hidden;
                return (
                  <div
                    key={slide.instanceId}
                    className={`group/item relative flex items-center rounded-[var(--radius-sharp)] transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : slide.hidden
                          ? 'text-neutral-300 hover:bg-neutral-50'
                          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    <a
                      href={`#${slide.instanceId}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate(slide);
                      }}
                      className={`flex items-baseline gap-3 px-3 py-[9px] flex-1 min-w-0 ${
                        slide.hidden ? 'cursor-default pr-24' : 'cursor-pointer'
                      }`}
                    >
                      {/* Slide Number: fixed column alignment with min-width */}
                      <span
                        className={`font-mono text-[11px] tracking-[0.1em] min-w-[24px] ${
                          isActive
                            ? 'text-indigo-600 font-medium'
                            : slide.hidden
                              ? 'text-neutral-300'
                              : 'text-neutral-400'
                        }`}
                      >
                        {slide.hidden ? '—' : numbering.get(slide.instanceId)}
                      </span>
                      {/* Slide Title: clean weights, struck through when hidden.
                          Double-click to rename inline. */}
                      {renamingId === slide.instanceId ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          onClick={(e) => e.preventDefault()}
                          className="font-sans text-[13px] tracking-normal flex-1 min-w-0 bg-white border border-indigo-300 rounded-[var(--radius-sharp)] px-1 py-0 outline-none text-neutral-900"
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            setRenamingId(slide.instanceId);
                            setRenameValue(slide.title);
                          }}
                          title="Double-click to rename"
                          className={`font-sans text-[13px] tracking-normal truncate ${
                            slide.hidden ? 'line-through' : ''
                          }`}
                        >
                          {slide.title}
                        </span>
                      )}
                    </a>

                    {/* Hover actions: hide/show + duplicate. Absolutely
                        positioned so idle rows keep their full title width;
                        the background matches the row's hover state so icons
                        sit cleanly over long titles. The eye stays visible
                        while a slide is hidden so it can be restored. */}
                    <div
                      className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1 transition-opacity duration-150 ${
                        slide.hidden
                          ? 'opacity-100'
                          : `opacity-0 group-hover/item:opacity-100 ${
                              isActive ? 'bg-indigo-50' : 'bg-neutral-100'
                            }`
                      }`}
                    >
                      <button
                        type="button"
                        title={slide.hidden ? 'Show slide' : 'Hide slide'}
                        aria-label={slide.hidden ? 'Show slide' : 'Hide slide'}
                        onClick={() => onToggleHidden(slide.instanceId)}
                        className={`flex items-center justify-center w-6 h-6 rounded-[var(--radius-sharp)] cursor-pointer border-none bg-transparent transition-colors ${
                          slide.hidden
                            ? 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                            : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200'
                        }`}
                      >
                        <EyeIcon off={slide.hidden} />
                      </button>
                      <button
                        type="button"
                        title="Duplicate slide"
                        aria-label="Duplicate slide"
                        onClick={() => onDuplicate(slide.instanceId)}
                        className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-sharp)] cursor-pointer border-none bg-transparent text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200 transition-colors"
                      >
                        <PlusIcon />
                      </button>
                      <button
                        type="button"
                        title="Delete slide"
                        aria-label="Delete slide"
                        onClick={() => onDelete(slide.instanceId)}
                        className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-sharp)] cursor-pointer border-none bg-transparent text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
