import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SlideInstance } from '../deck/types';
import type { DocumentNode } from '../business-record/parser/ast';
import { SlideStage } from './PresentationCanvas';
import { CopyIcon, CreateIcon, EllipsisIcon, EyeIcon, EyeOffIcon, GripIcon, LayersIcon, TrashIcon } from '../ui/icons';
import type { DeckTheme } from '../theme/deckTheme';

interface SlideNavListProps {
  slides: SlideInstance[];
  /** Parsed document - the renderers need it to draw the client logo, so the
   *  thumbnail matches what the canvas and the export show. */
  ast: DocumentNode | null;
  /** Deck-level client logo, for the same reason. */
  logoUrl?: string;
  /** The deck's theme, so a rail thumbnail matches the stage. */
  theme?: DeckTheme;
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
  theme,
}: {
  slide: SlideInstance;
  ast: DocumentNode | null;
  num: string;
  logoUrl?: string;
  theme?: DeckTheme;
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
      <SlideStage slide={slide} ast={ast} num={num} scale={scale} logoUrl={logoUrl} theme={theme} />
    </div>
  );
});

function InsertAfterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="3" x2="12" y2="15" /><polyline points="7 10 12 15 17 10" /><line x1="5" y1="20" x2="19" y2="20" />
    </svg>
  );
}

/** Space between the overflow menu and its trigger button. */
const MENU_GAP = 6;
/** Smallest gap the overflow menu keeps from the window edge. */
const MENU_EDGE_GAP = 8;

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

/**
 * Instant custom tooltip, replacing the native `title` attr which has a
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

export function SlideNavList({ slides, ast, logoUrl, theme, onToggleHidden, onDuplicate, onChangeLayout, onDelete, onRename, onReorder, onInsertAfter, currentId, onNavigate }: SlideNavListProps) {
  // Double-click-to-rename state: which row is being renamed + its draft text.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Drag-to-reorder state.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  /** The open overflow menu: which slide, and the trigger's viewport rect edges
   *  to pin it against. Coordinates are viewport-fixed because the menu is
   *  portalled out of the clipping rail. Both `top` and `bottom` are kept (not
   *  just one anchor point) so the menu can open upwards when the trigger sits
   *  too near the bottom of the window for it to fit below. */
  const [menu, setMenu] = useState<{ id: string; x: number; top: number; bottom: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Measured menu height, 0 until it has been laid out once. Needed to decide
   *  whether the menu fits below its trigger, and the reason the menu is hidden
   *  for its first layout pass rather than positioned from a guessed height. */
  const [menuHeight, setMenuHeight] = useState(0);

  useLayoutEffect(() => {
    if (!menu) {
      setMenuHeight(0);
      return;
    }
    // Runs before paint, so the measured position is the first one drawn - the
    // menu never visibly jumps from "below" to "above".
    setMenuHeight(menuRef.current?.offsetHeight ?? 0);
  }, [menu]);

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
                    /* Lets the rail measure which thumbnails are on screen, so
                       "Add slide" can drop the new slide where the user is
                       looking instead of always at the end. */
                    data-slide-row={slide.instanceId}
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
                        <GripIcon size={14} />
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
                            theme={theme}
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
                            {slide.hidden ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                          </CardAction>
                          <CardAction
                            label="More actions"
                            onClick={(rect) =>
                              setMenu((m) =>
                                m?.id === slide.instanceId
                                  ? null
                                  : { id: slide.instanceId, x: rect.right, top: rect.top, bottom: rect.bottom }
                              )
                            }
                          >
                            <EllipsisIcon size={14} />
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
              // Below the trigger by preference, above it when the window has no
              // room below - which is every menu opened on the last thumbnail,
              // where the rail's own scroll has the trigger sitting near the
              // bottom edge. Clamped to the viewport as a final guard so a menu
              // that fits in neither direction is still fully on screen.
              top: Math.max(
                MENU_EDGE_GAP,
                Math.min(
                  menuHeight && menu.bottom + MENU_GAP + menuHeight > window.innerHeight - MENU_EDGE_GAP
                    ? menu.top - MENU_GAP - menuHeight
                    : menu.bottom + MENU_GAP,
                  window.innerHeight - MENU_EDGE_GAP - menuHeight
                )
              ),
              // Right-aligned to the trigger, then clamped so it can never hang
              // off the window edge.
              left: Math.max(8, Math.min(menu.x - 168, window.innerWidth - 176)),
              // A menu taller than the window scrolls internally rather than
              // spilling past both edges.
              maxHeight: window.innerHeight - MENU_EDGE_GAP * 2,
              overflowY: 'auto',
              // Hidden only for the single pre-measurement layout pass.
              visibility: menuHeight ? 'visible' : 'hidden',
              zIndex: 400,
              boxShadow: '0 10px 30px -8px rgba(15,23,20,0.28)',
            }}
          >
            <MenuRow icon={<LayersIcon size={15} />} label="Change layout" onClick={() => { onChangeLayout(menu.id); setMenu(null); }} />
            <MenuRow icon={<CopyIcon size={15} />} label="Duplicate" onClick={() => { onDuplicate(menu.id); setMenu(null); }} />
            <MenuRow icon={<InsertAfterIcon />} label="Insert after" onClick={() => { onInsertAfter(menu.id); setMenu(null); }} />
            <MenuRow
              icon={<CreateIcon size={15} />}
              label="Rename"
              onClick={() => {
                setRenamingId(menu.id);
                setRenameValue(slides.find((sl) => sl.instanceId === menu.id)?.title ?? '');
                setMenu(null);
              }}
            />
            <div className="my-1 h-px bg-neutral-200" />
            <MenuRow icon={<TrashIcon size={15} />} label="Delete" danger onClick={() => { onDelete(menu.id); setMenu(null); }} />
          </div>,
          document.body
        )}
    </div>
  );
}
