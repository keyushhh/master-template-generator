import { useEffect, useState } from 'react';

export interface SlideEntry {
  id: string;
  num: string;
  title: string;
}

export interface SlideGroup {
  label: string;
  slides: SlideEntry[];
}

/**
 * Canonical slide registry — 14 slides across 5 groups.
 * This is the single source of truth shared by SlideNavList and PresentationCanvas.
 */
export const SLIDE_GROUPS: SlideGroup[] = [
  {
    label: 'Introduction',
    slides: [
      { id: 's1',  num: '01', title: 'Cover' },
      { id: 's2',  num: '02', title: 'Index / Contents' },
      { id: 's3',  num: '03', title: 'Executive Summary' },
    ],
  },
  {
    label: 'Context',
    slides: [
      { id: 's4',  num: '04', title: 'Section Divider' },
      { id: 's5',  num: '05', title: 'Two-Column Context' },
      { id: 's6',  num: '06', title: 'Data Monument' },
    ],
  },
  {
    label: 'Performance',
    slides: [
      { id: 's7',  num: '07', title: 'Metrics Dashboard' },
      { id: 's8',  num: '08', title: 'Comparative Table' },
      { id: 's9',  num: '09', title: 'Strategic Roadmap' },
    ],
  },
  {
    label: 'Strategy',
    slides: [
      { id: 's10', num: '10', title: 'Image Editorial' },
      { id: 's11', num: '11', title: 'Process Architecture' },
      { id: 's12', num: '12', title: 'Global Reach Map' },
    ],
  },
  {
    label: 'Closing',
    slides: [
      { id: 's13', num: '13', title: 'Featured Quote' },
      { id: 's14', num: '14', title: 'Exit / Thank You' },
    ],
  },
];

/** Flat array derived from groups — used by the observer. */
export const SLIDES: SlideEntry[] = SLIDE_GROUPS.flatMap((g) => g.slides);

export function SlideNavList() {
  const [activeId, setActiveId] = useState<string>('s1');

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

    SLIDES.forEach((slide) => {
      const element = document.getElementById(slide.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col">
      {/* Reduced visual weight heading + divider rule */}
      <div 
        className="px-3 pb-2 flex items-center justify-between border-b border-neutral-150"
        style={{ marginBottom: 16 }}
      >
        <div className="font-sans font-semibold text-[11px] tracking-[0.1em] text-neutral-400 uppercase">
          Presentation
        </div>
      </div>

      <div className="px-1">
        {SLIDE_GROUPS.map((group, index) => (
          <div
            key={group.label}
            style={{ marginTop: index === 0 ? 0 : 40 }}
          >
            {/* Group Label: 40px systematic spacer on groups after first */}
            <div className="px-3 mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 select-none">
              {group.label}
            </div>

            {/* Slide items with generous spacing rhythm */}
            <div className="space-y-[6px]">
              {group.slides.map((slide) => {
                const isActive = activeId === slide.id;
                return (
                  <a
                    key={slide.id}
                    href={`#${slide.id}`}
                    onClick={(e) => handleClick(e, slide.id)}
                    className={`flex items-baseline gap-3 px-3 py-[9px] rounded-[var(--radius-sharp)] transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    {/* Slide Number: fixed column alignment with min-width */}
                    <span
                      className={`font-mono text-[11px] tracking-[0.1em] min-w-[24px] ${
                        isActive ? 'text-indigo-600 font-medium' : 'text-neutral-400'
                      }`}
                    >
                      {slide.num}
                    </span>
                    {/* Slide Title: clean weights */}
                    <span className="font-sans text-[13px] tracking-normal">
                      {slide.title}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
