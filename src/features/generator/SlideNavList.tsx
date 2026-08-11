import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SlideInstance } from '../deck/types';
import type { DocumentNode } from '../business-record/parser/ast';
import { SlideStage } from './PresentationCanvas';

interface SlideNavListProps {
  slides: SlideInstance[];
  /** Parsed document - the renderers need it to draw the client logo, so the
   *  thumbnail matches what the canvas and the export show. */
  ast: DocumentNode | null;
  /** Deck-level client logo, for the same reason. */
  logoUrl?: string;
  onToggleHidden: (instanceId: string) => void;
  onDuplicate: (instanceId: string) => void;
  /** Open the layout switcher for this slide. */
  onChangeLayout: (instanceId: string) => void;
  onDelete: (instanceId: string) => void;
  onRename: (instanceId: string, title: string) => void;
  /** Move `fromId` to sit just before `toId` in the deck order. */
  onReorder: (fromId: string, toId: string) => void;
  /** Insert a new blank slide immediately after the given instanceId. */
  onInsertAfter: (instanceId: string) => void;
  /** The slide on the stage. */
  currentId: string | null;
  onNavigate: (instanceId: string) => void;
}

/**
 * A live miniature of one slide.
 *
 * Renders the real slide through the same renderers the canvas and the exporter
 * use, rather than an approximated skeleton, so what the sidebar shows can
 * never drift from what the deck actually is - the whole point of a thumbnail
 * is that it is trustworthy at a glance.
 *
 * Memoised on the slide object: deck mutations map over `slides` and preserve
 * object identity for every slide they don't touch, so editing one slide
 * re-renders one miniature instead of all fourteen.
 */
const SlideThumb = memo(function SlideThumb({
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
  const ref = useRef<HTMLDivElement>(null);
  // Seeded near the real value so the first paint is already about right and
  // the miniature doesn't visibly snap into place on mount.
  const [scale, setScale] = useState(0.12);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setScale(w / 1920);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full h-full">
      <SlideStage slide={slide} ast={ast} num={num} scale={scale} logoUrl={logoUrl} />
    </div>
  );
});

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

function MoreIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="11" y1="10" x2="11" y2="20" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="12" height="12" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function InsertAfterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="3" x2="12" y2="15" /><polyline points="7 10 12 15 17 10" /><line x1="5" y1="20" x2="19" y2="20" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/** One row of a thumbnail's overflow menu. */
function MenuRow({ label, icon, onClick, danger }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-[7px] text-[12.5px] font-medium transition-colors cursor-pointer ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-neutral-700 hover:bg-neutral-100'
      }`}
    >
      <span className="shrink-0 flex items-center">{icon}</span>
      {label}
    </button>
  );
}

/** Six-dot grab affordance, matching the drag grip on the canvas. */
function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="3" r="1.2" /><circle cx="7.5" cy="3" r="1.2" />
      <circle cx="2.5" cy="8" r="1.2" /><circle cx="7.5" cy="8" r="1.2" />
      <circle cx="2.5" cy="13" r="1.2" /><circle cx="7.5" cy="13" r="1.2" />
    </svg>
  );
}

/**
 * Instant custom tooltip — replaces the native `title` attr which has a
 * ~500ms OS delay. Black sharp box, white mono text, appears above the target.
 */
/**
 * Instant tooltip, rendered into document.body.
 *
 * A portal rather than a child of the trigger because the rail clips overflow
 * on both axes: an in-flow tooltip gets cut off at the panel edge, and - since
 * absolutely positioned children still count toward a container's scrollable
 * width - a nowrap label was also what put a horizontal scrollbar on the rail.
 * Fixed coordinates measured from the trigger sidestep both.
 */
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setBox({ top: r.bottom + 6, left: r.left + r.width / 2 });
  };

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-center"
      onMouseEnter={show}
      onMouseLeave={() => setBox(null)}
    >
      {children}
      {box &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              top: box.top,
              left: box.left,
              transform: 'translateX(-50%)',
              zIndex: 400,
              padding: '3px 7px',
              background: 'var(--neutral-900)',
              color: '#fff',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {label}
          </div>,
          document.body
        )}
    </div>
  );
}

/** One micro-action in the card's hover pill. */
function CardAction({
  label,
  onClick,
  danger,
  accent,
  children,
}: {
  label: string;
  /** Receives the button's viewport rect so a caller can pin a portalled menu
   *  to it. */
  onClick: (rect: DOMRect) => void;
  danger?: boolean;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(e.currentTarget.getBoundingClientRect()); }}
        className={`flex items-center justify-center w-[22px] h-[22px] rounded-none cursor-pointer border-none bg-transparent transition-colors text-neutral-500 ${
          danger
            ? 'hover:text-red-600 hover:bg-red-50'
            : accent
              ? 'hover:text-emerald-600 hover:bg-emerald-50'
              : 'hover:text-neutral-900 hover:bg-neutral-200'
        }`}
      >
        {children}
      </button>
    </Tip>
  );
}

export function SlideNavList({ slides, ast, logoUrl, onToggleHidden, onDuplicate, onChangeLayout, onDelete, onRename, onReorder, onInsertAfter, currentId, onNavigate }: SlideNavListProps) {
  // Double-click-to-rename state: which row is being renamed + its draft text.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Drag-to-reorder state.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  /** The open overflow menu: which slide, and where to pin it. Coordinates are
   *  viewport-fixed because the menu is portalled out of the clipping rail. */
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    // Fixed coordinates stop matching the trigger as soon as anything scrolls,
    // so close rather than let the menu drift away from its thumbnail.
    const onMoved = () => setMenu(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMoved, true);
    window.addEventListener('resize', onMoved);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMoved, true);
      window.removeEventListener('resize', onMoved);
    };
  }, [menu]);

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue);
    }
    setRenamingId(null);
  };

  // Visible-slide numbering - must match the canvas footer numbering.
  const numbering = new Map<string, string>();
  let visibleIndex = 0;
  for (const slide of slides) {
    if (!slide.hidden) {
      visibleIndex += 1;
      numbering.set(slide.instanceId, String(visibleIndex).padStart(2, '0'));
    }
  }

  const handleNavigate = (slide: SlideInstance) => {
    if (slide.hidden) return;
    onNavigate(slide.instanceId);
  };

  return (
    <div className="flex flex-col">
      <div className="px-1">
        <div className="space-y-3">
          {slides.map((slide) => {
                const isActive = currentId === slide.instanceId && !slide.hidden;
                const isDropTarget = overId === slide.instanceId && dragId && dragId !== slide.instanceId;
                return (
                  <div
                    key={slide.instanceId}
                    draggable
                    onDragStart={(e) => {
                      setDragId(slide.instanceId);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragId && overId !== slide.instanceId) setOverId(slide.instanceId);
                    }}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId && dragId !== slide.instanceId) onReorder(dragId, slide.instanceId);
                      setDragId(null);
                      setOverId(null);
                    }}
                    onClick={() => handleNavigate(slide)}
                    className={`group/item relative flex gap-2 px-1 transition-opacity duration-150 ${
                      dragId === slide.instanceId ? 'opacity-40' : ''
                    } ${slide.hidden ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {/* Drop indicator - a full-width rule above the card the
                        dragged slide would land in front of. */}
                    {isDropTarget && (
                      <div className="absolute -top-1.5 left-1 right-1 h-0.5 bg-emerald-500 z-30" />
                    )}

                    {/* Accent edge: the clearest "you are here" marker, and it
                        costs no horizontal room the thumbnail needs. */}
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: -2, top: 2, bottom: 22, width: 2,
                        background: isActive ? 'var(--emerald-500)' : 'transparent',
                        transition: 'background .15s',
                      }}
                    />
                    <div className="flex flex-col items-center gap-1 pt-0.5 w-[22px] flex-shrink-0">
                      <span
                        className="font-mono text-[10.5px] tracking-[0.06em]"
                        style={{
                          color: isActive ? 'var(--emerald-600)' : 'var(--chrome-text-faint)',
                          fontWeight: isActive ? 700 : 400,
                        }}
                      >
                        {slide.hidden ? '–' : numbering.get(slide.instanceId)}
                      </span>
                      <span
                        className="opacity-0 group-hover/item:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                        style={{ color: 'var(--chrome-text-faint)' }}
                        title="Drag to reorder"
                      >
                        <GripIcon />
                      </span>
                    </div>

                    {/* Card: 16:9 miniature + title */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="relative w-full aspect-[16/9] transition-all duration-150"
                        style={{ background: '#fff' }}
                      >
                        <div
                          className="absolute inset-0 overflow-hidden"
                          style={{ opacity: slide.hidden ? 0.4 : 1 }}
                        >
                          <SlideThumb
                            slide={slide}
                            ast={ast}
                            num={numbering.get(slide.instanceId) ?? '--'}
                            logoUrl={logoUrl}
                          />
                        </div>

                        {/* The stroke has to be an overlay, not a border or an
                            inset shadow on the card: the miniature is an opaque
                            inset-0 child and paints straight over both. Drawn
                            inside the box so it can't clip on the rail edge. */}
                        <span
                          aria-hidden
                          style={{
                            position: 'absolute',
                            inset: 0,
                            border: isActive
                              ? '1.5px solid var(--emerald-500)'
                              : '1px solid var(--neutral-200)',
                            pointerEvents: 'none',
                            zIndex: 15,
                          }}
                        />

                        {slide.hidden && (
                          <div
                            className="absolute top-1.5 left-1.5 z-10"
                            style={{
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-sharp)',
                              background: 'rgba(23,23,23,0.82)',
                              color: '#fff',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 8.5,
                              fontWeight: 700,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                            }}
                          >
                            Hidden
                          </div>
                        )}

                        {/* Hover actions: the one you reach for most, plus a
                            menu. Five icons over every thumbnail was the
                            noisiest thing in the rail. */}
                        <div
                          className={`absolute top-1 right-1 z-20 flex items-center gap-px transition-opacity duration-150 ${
                            slide.hidden || menu?.id === slide.instanceId
                              ? 'opacity-100'
                              : 'opacity-0 group-hover/item:opacity-100'
                          }`}
                        >
                          <CardAction
                            label={slide.hidden ? 'Show slide' : 'Hide slide'}
                            onClick={() => onToggleHidden(slide.instanceId)}
                          >
                            <EyeIcon off={slide.hidden} />
                          </CardAction>
                          <CardAction
                            label="More actions"
                            onClick={(rect) =>
                              setMenu((m) =>
                                m?.id === slide.instanceId
                                  ? null
                                  : { id: slide.instanceId, x: rect.right, y: rect.bottom + 6 }
                              )
                            }
                          >
                            <MoreIcon />
                          </CardAction>
                        </div>
                      </div>

                      {/* Title, double-click to rename (unchanged behaviour). */}
                      {renamingId === slide.instanceId ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          className="mt-1.5 w-full font-sans text-[12px] bg-white border border-emerald-300 rounded-none px-1 py-0 outline-none text-neutral-900"
                        />
                      ) : (
                        <div
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setRenamingId(slide.instanceId);
                            setRenameValue(slide.title);
                          }}
                          title="Double-click to rename"
                          className={`mt-1.5 font-sans text-[12px] leading-tight truncate ${
                            slide.hidden ? 'line-through' : ''
                          }`}
                          style={{
                            color: isActive
                              ? 'var(--emerald-700)'
                              : slide.hidden
                                ? 'var(--chrome-text-faint)'
                                : 'var(--chrome-text-dim)',
                            fontWeight: isActive ? 600 : 400,
                          }}
                        >
                          {slide.title}
                        </div>
                      )}
                    </div>
                  </div>
                );
          })}
        </div>
      </div>

      {menu &&
        createPortal(
          <div
            ref={menuRef}
            className="w-[168px] py-1 bg-white border border-neutral-200"
            style={{
              position: 'fixed',
              top: menu.y,
              // Right-aligned to the trigger, then clamped so it can never hang
              // off the window edge.
              left: Math.max(8, Math.min(menu.x - 168, window.innerWidth - 176)),
              zIndex: 400,
              boxShadow: '0 10px 30px -8px rgba(15,23,20,0.28)',
            }}
          >
            <MenuRow icon={<LayoutIcon />} label="Change layout" onClick={() => { onChangeLayout(menu.id); setMenu(null); }} />
            <MenuRow icon={<CopyIcon />} label="Duplicate" onClick={() => { onDuplicate(menu.id); setMenu(null); }} />
            <MenuRow icon={<InsertAfterIcon />} label="Insert after" onClick={() => { onInsertAfter(menu.id); setMenu(null); }} />
            <MenuRow
              icon={<PencilIcon />}
              label="Rename"
              onClick={() => {
                setRenamingId(menu.id);
                setRenameValue(slides.find((sl) => sl.instanceId === menu.id)?.title ?? '');
                setMenu(null);
              }}
            />
            <div className="my-1 h-px bg-neutral-200" />
            <MenuRow icon={<TrashIcon />} label="Delete" danger onClick={() => { onDelete(menu.id); setMenu(null); }} />
          </div>,
          document.body
        )}
    </div>
  );
}
