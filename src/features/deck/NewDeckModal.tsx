import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { FitStage } from '../generator/FitStage';
import { themeById, type DeckTheme } from '../theme/deckTheme';
import { CheckIcon, ChevronBackIcon, ChevronForwardIcon, CloseIcon, SearchIcon, TrashIcon } from '../ui/icons';
import { ensureFonts } from '../fonts/loadFont';
import { deleteDeckTemplate, instantiateDeckTemplate, listDeckTemplates, type SavedDeckTemplate } from './deckTemplateStore';
import type { Deck } from './types';
import { ConfirmModal, cannotBeUndone } from '../ui/ConfirmModal';
import {
  PRESENTATION_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  type TemplateDefinition,
} from '../templates/presentationTemplates';

function TemplateCard({
  tmpl,
  isSelected,
  onSelect,
  onDelete,
}: {
  tmpl: TemplateDefinition & { isCustom?: boolean; savedId?: string };
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const deck = useMemo(() => tmpl.build(), [tmpl]);
  const theme: DeckTheme = useMemo(() => {
    const baseTheme = themeById(tmpl.defaultThemeId);
    return {
      ...baseTheme,
      fonts: {
        display: { family: tmpl.fonts.display, stack: `"${tmpl.fonts.display}", ${baseTheme.fonts.display.stack}` },
        sans: { family: tmpl.fonts.sans, stack: `"${tmpl.fonts.sans}", ${baseTheme.fonts.sans.stack}` },
        mono: { family: tmpl.fonts.mono || baseTheme.fonts.mono.family, stack: `"${tmpl.fonts.mono || baseTheme.fonts.mono.family}", ${baseTheme.fonts.mono.stack}` },
      },
    };
  }, [tmpl]);

  const firstSlide = deck.slides[0];

  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col bg-white rounded-none border transition-all cursor-pointer overflow-hidden ${
        isSelected
          ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
          : 'border-neutral-200 hover:border-neutral-400 hover:shadow-sm'
      }`}
    >
      {/* Visual Thumbnail Art - Exact Slide Cover rendered via FitStage */}
      <div className="relative aspect-[16/9] w-full overflow-hidden select-none bg-neutral-900 border-b border-neutral-200">
        {firstSlide && (
          <div className="absolute inset-0 pointer-events-none">
            <FitStage slide={firstSlide} ast={null} num="01" theme={theme} />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20 pointer-events-none">
          <span
            className="px-1.5 py-0.5 rounded-none text-[9px] font-bold tracking-wide uppercase font-mono shadow-sm"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: '#FFFFFF',
              backdropFilter: 'blur(4px)',
            }}
          >
            {tmpl.categoryLabel}
          </span>
          {tmpl.badge && (
            <span className="px-1.5 py-0.5 rounded-none text-[8.5px] font-bold uppercase tracking-wider bg-emerald-500 text-white shadow-sm">
              {tmpl.badge}
            </span>
          )}
        </div>

        {/* Selected Checkmark Badge */}
        {isSelected && (
          <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-none bg-emerald-500 text-white flex items-center justify-center shadow-lg z-20">
            <CheckIcon size={14} />
          </div>
        )}
      </div>

      {/* Card Info Footer */}
      <div className="p-3.5 flex flex-col gap-1 bg-white">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[13.5px] font-bold text-neutral-900 truncate">
            {tmpl.name}
          </h4>
          {tmpl.isCustom && tmpl.savedId && (
            <button
              aria-label={`Delete template "${tmpl.name}"`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-neutral-300 hover:text-rose-600 p-0.5 cursor-pointer"
            >
              <TrashIcon size={13} />
            </button>
          )}
        </div>
        <p className="text-[11.5px] text-neutral-500 line-clamp-2 leading-relaxed">
          {tmpl.description}
        </p>
      </div>
    </div>
  );
}

export function NewDeckModal({
  open,
  isSandboxMode,
  onClose,
  onCreate,
}: {
  open: boolean;
  isSandboxMode?: boolean;
  onClose: () => void;
  onCreate: (name: string, deck: Deck) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState<string>(PRESENTATION_TEMPLATES[0].id);
  const [savedTemplates, setSavedTemplates] = useState<SavedDeckTemplate[]>([]);
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<SavedDeckTemplate | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setSelectedCategory('all');
    setSearchQuery('');
    setActiveTemplateId(PRESENTATION_TEMPLATES[0].id);
    setSavedTemplates(listDeckTemplates());
  }, [open]);

  const removeTemplate = (savedId: string) => {
    deleteDeckTemplate(savedId);
    setSavedTemplates(listDeckTemplates());
    if (activeTemplateId === `custom:${savedId}`) {
      setActiveTemplateId(PRESENTATION_TEMPLATES[0].id);
    }
  };

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Combined built-in and user-saved templates
  const allTemplates: (TemplateDefinition & { isCustom?: boolean; savedId?: string })[] = useMemo(() => {
    const customList: (TemplateDefinition & { isCustom?: boolean; savedId?: string })[] = savedTemplates.map((t) => ({
      id: `custom:${t.id}`,
      savedId: t.id,
      isCustom: true,
      name: t.name,
      category: 'saved' as TemplateCategory,
      categoryLabel: 'Saved',
      author: 'You',
      description: t.description || `${t.slideCount} slides saved from a previous deck.`,
      slideCountText: `${t.slideCount} slides`,
      fonts: {
        display: 'Space Grotesk',
        sans: 'DM Sans',
        mono: 'JetBrains Mono',
      },
      preview: {
        accentColor: '10B981',
        bgGradient: 'linear-gradient(135deg, #18181B 0%, #27272A 100%)',
        titleColor: '#FFFFFF',
        tagBg: 'rgba(16, 185, 129, 0.25)',
        tagColor: '#6EE7B7',
        subtitle: 'Custom saved template structure.',
      },
      defaultAccent: '10B981',
      build: () => instantiateDeckTemplate(t),
    }));

    return [...PRESENTATION_TEMPLATES, ...customList];
  }, [savedTemplates]);

  const activeTemplate = useMemo(
    () => allTemplates.find((t) => t.id === activeTemplateId) ?? allTemplates[0],
    [allTemplates, activeTemplateId]
  );

  // Filter templates by category and query
  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((t) => {
      const matchCategory =
        selectedCategory === 'all'
          ? true
          : selectedCategory === 'saved'
          ? t.isCustom
          : t.category === selectedCategory;

      if (!matchCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.categoryLabel.toLowerCase().includes(q) ||
        t.author.toLowerCase().includes(q)
      );
    });
  }, [allTemplates, selectedCategory, searchQuery]);

  // Active theme calculation strictly from active template
  const theme: DeckTheme = useMemo(() => {
    const baseTheme = themeById(activeTemplate.defaultThemeId);
    return {
      ...baseTheme,
      fonts: {
        display: { family: activeTemplate.fonts.display, stack: `"${activeTemplate.fonts.display}", ${baseTheme.fonts.display.stack}` },
        sans: { family: activeTemplate.fonts.sans, stack: `"${activeTemplate.fonts.sans}", ${baseTheme.fonts.sans.stack}` },
        mono: { family: activeTemplate.fonts.mono || baseTheme.fonts.mono.family, stack: `"${activeTemplate.fonts.mono || baseTheme.fonts.mono.family}", ${baseTheme.fonts.mono.stack}` },
      },
    };
  }, [activeTemplate]);

  const previewDeck = useMemo(() => activeTemplate.build(), [activeTemplate]);
  const previewSlides = useMemo(() => previewDeck.slides.filter((s) => !s.hidden), [previewDeck]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewSlide = previewSlides[Math.min(previewIndex, previewSlides.length - 1)];

  // A different template starts at its own cover, not at slide 7 of the last one.
  useEffect(() => setPreviewIndex(0), [activeTemplate]);

  const stepPreview = (delta: number) => {
    if (previewSlides.length < 2) return;
    setPreviewIndex((i) => (i + delta + previewSlides.length) % previewSlides.length);
  };

  useEffect(() => {
    if (!open) return;
    const fonts = allTemplates.flatMap((t) => [
      t.fonts.display,
      t.fonts.sans,
      t.fonts.mono,
    ]).filter(Boolean) as string[];
    void ensureFonts(Array.from(new Set(fonts)));
  }, [open, allTemplates]);

  if (!open) return null;

  const create = (templateOverride?: TemplateDefinition) => {
    const target = templateOverride || activeTemplate;
    const deck = target.build();
    const finalThemeId = target.defaultThemeId || deck.themeId;
    onCreate(name.trim() || target.name, { ...deck, themeId: finalThemeId, presentationTemplateId: target.id });
    onClose();
  };

  return createPortal(
    <>
      <div
        className="wg-overlay fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-6 overflow-hidden bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-label="New deck template gallery"
          className="wg-modal flex flex-col w-full max-w-[1140px] h-[92vh] max-h-[860px] overflow-hidden my-auto bg-white rounded-none shadow-2xl border border-neutral-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-neutral-200 gap-3 shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-none border border-emerald-200/80">
                    {isSandboxMode ? 'Quick Sandbox' : 'Template Gallery'}
                  </span>
                  <span className="text-[11.5px] text-neutral-400 font-medium">
                    {allTemplates.length} styles available
                  </span>
                </div>
                <h2 className="text-[19px] font-bold text-neutral-900 tracking-tight mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                  {isSandboxMode ? 'Start an Emergency Sandbox Deck' : 'Choose a Presentation Template'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-[240px]">
                <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400 pointer-events-none">
                  <SearchIcon size={14} />
                </span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full h-[36px] pl-9 pr-3 text-[12.5px] bg-neutral-100/80 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-neutral-400 rounded-none outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-2.5 flex items-center text-neutral-400 hover:text-neutral-700 text-[14px] cursor-pointer"
                  >
                    &times;
                  </button>
                )}
              </div>

              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-none transition-colors cursor-pointer shrink-0"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-6 py-2.5 border-b border-neutral-150 bg-neutral-50/50 overflow-x-auto shrink-0 no-scrollbar">
            {TEMPLATE_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              const count =
                cat.id === 'all'
                  ? allTemplates.length
                  : cat.id === 'saved'
                  ? savedTemplates.length
                  : allTemplates.filter((t) => t.category === cat.id).length;

              if (cat.id === 'saved' && savedTemplates.length === 0) return null;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`h-[28px] px-3 text-[11.5px] font-bold rounded-none transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] font-mono px-1 rounded-none ${active ? 'bg-white/20 text-white' : 'text-neutral-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            <div className="flex-1 p-6 overflow-y-auto bg-neutral-100/50">
              {filteredTemplates.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-400">
                  <p className="text-[14px] font-medium text-neutral-600">No templates found</p>
                  <p className="text-[12px] mt-1">Try adjusting your search or category filter</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map((tmpl) => {
                    const isSelected = tmpl.id === activeTemplateId;
                    return (
                      <TemplateCard
                        key={tmpl.id}
                        tmpl={tmpl}
                        isSelected={isSelected}
                        onSelect={() => setActiveTemplateId(tmpl.id)}
                        onDelete={() => {
                          const saved = savedTemplates.find((t) => t.id === tmpl.savedId);
                          if (saved) setPendingDeleteTemplate(saved);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Drawer: Live Slide Preview & Options */}
            <div className="w-full md:w-[360px] shrink-0 border-t md:border-t-0 md:border-l border-neutral-200 bg-white p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="flex flex-col gap-1 pb-3 border-b border-neutral-200">
                <span className="font-mono text-[9px] font-bold tracking-[0.14em] uppercase text-neutral-400">
                  Selected Template
                </span>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[16px] font-bold text-neutral-900" style={{ fontFamily: `"${activeTemplate.fonts.display}", sans-serif` }}>
                    {activeTemplate.name}
                  </h3>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {activeTemplate.slideCountText}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
                  <span>Fonts: <strong className="text-neutral-700">{activeTemplate.fonts.display}</strong> + <strong className="text-neutral-700">{activeTemplate.fonts.sans}</strong></span>
                </div>
              </div>

              {/* Every slide in the template, steppable before committing to it */}
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[9px] font-bold tracking-[0.14em] uppercase text-neutral-400">
                  Preview
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stepPreview(-1)}
                    disabled={previewSlides.length < 2}
                    aria-label="Previous slide"
                    className="shrink-0 h-7 w-7 flex items-center justify-center border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-400 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-white"
                  >
                    <ChevronBackIcon size={13} />
                  </button>
                  <div
                    className="relative flex-1 min-w-0 rounded-none overflow-hidden border border-neutral-200 bg-neutral-50"
                    style={{ boxShadow: '0 4px 14px -4px rgba(0,0,0,0.1)' }}
                  >
                    {previewSlide && (
                      <FitStage
                        key={previewSlide.instanceId}
                        slide={previewSlide}
                        ast={null}
                        num={String(previewIndex + 1).padStart(2, '0')}
                        theme={theme}
                      />
                    )}
                    <span
                      aria-live="polite"
                      className="absolute bottom-1.5 right-1.5 px-2 py-[3px] rounded-full text-[10px] font-semibold text-white pointer-events-none"
                      style={{ background: 'rgba(0, 0, 0, 0.72)', backdropFilter: 'blur(4px)' }}
                    >
                      {previewIndex + 1} of {previewSlides.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => stepPreview(1)}
                    disabled={previewSlides.length < 2}
                    aria-label="Next slide"
                    className="shrink-0 h-7 w-7 flex items-center justify-center border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-400 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-white"
                  >
                    <ChevronForwardIcon size={13} />
                  </button>
                </div>
                <span className="text-[11px] text-neutral-500 truncate">
                  {previewSlide?.title}
                </span>
              </div>

              {/* Deck Name Input */}
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
                  Deck name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && create()}
                  placeholder={activeTemplate.name}
                  className="h-[38px] px-3 text-[13px] border border-neutral-200 focus:border-emerald-500 rounded-none outline-none text-neutral-900 bg-white"
                />
              </div>

              {/* Create Action Button */}
              <div className="mt-auto pt-4 border-t border-neutral-200 flex items-center gap-2">
                <button
                  onClick={() => create()}
                  className="flex-1 h-[42px] px-4 text-[13px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-none shadow-sm transition-all flex items-center justify-center cursor-pointer"
                >
                  <span>Create Deck with {activeTemplate.name}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingDeleteTemplate && (
        <ConfirmModal
          open={true}
          title={`Delete template "${pendingDeleteTemplate.name}"?`}
          message={cannotBeUndone('This template will be removed from your saved templates.')}
          onCancel={() => setPendingDeleteTemplate(null)}
          onConfirm={() => {
            removeTemplate(pendingDeleteTemplate.id);
            setPendingDeleteTemplate(null);
          }}
        />
      )}
    </>,
    document.body
  );
}
