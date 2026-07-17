import { useEffect, useState } from 'react';

export const SLIDES = [
  { id: 'cover', title: '01 Cover' },
  { id: 'summary', title: '02 Executive Summary' },
  { id: 'campaign', title: '03 Campaign Overview' },
  { id: 'metrics', title: '04 Key Metrics' },
  { id: 'advocates', title: '05 Advocates' },
  { id: 'results', title: '06 Results' },
  { id: 'roi', title: '07 ROI' },
  { id: 'closing', title: '08 Closing' },
];

export function SlideNavList() {
  const [activeId, setActiveId] = useState<string>('cover');

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
      <div className="px-4 py-3 mb-2 flex items-center gap-2 border-b border-neutral-150">
        <div className="font-display font-bold text-[14.5px] tracking-[0.01em] text-neutral-900">
          Presentation
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {SLIDES.map((slide) => {
          const isActive = activeId === slide.id;
          return (
            <a
              key={slide.id}
              href={`#${slide.id}`}
              onClick={(e) => handleClick(e, slide.id)}
              className={`flex items-baseline gap-2.5 px-2.5 py-2 rounded-[var(--radius-xs)] text-[13px] font-medium transition-colors cursor-pointer ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'}`}
            >
              <span className={`font-mono text-[11px] min-w-[16px] ${isActive ? 'text-indigo-600' : 'text-neutral-400'}`}>
                {slide.title.substring(0, 2)}
              </span>
              <span>{slide.title.substring(3)}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
