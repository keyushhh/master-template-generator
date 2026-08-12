import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FitStage } from '../features/generator/FitStage';
import { PresentMode } from '../features/generator/PresentMode';
import { DevPanel } from '../features/dev/DevPanel';
import { HelpMenu } from '../features/help/HelpMenu';
import { KeyboardShortcutsHelp } from '../features/generator/KeyboardShortcutsHelp';
import { hasModifier, MOD_KEY } from '../features/help/platform';
import { createTemplateDeck } from '../features/deck/deckBuilder';
import { NewDeckModal } from '../features/deck/NewDeckModal';
import type { Deck } from '../features/deck/types';
import {
  createProject,
  deleteProject,
  duplicateProject,
  listProjectSummaries,
  renameProject,
  setActiveId,
  type ProjectSummary,
} from '../features/deck/deckStore';
import { brandKitThemes, listBrandKits } from '../features/theme/brandKitStore';
import { css as themeCss, themeById, WOZKU_THEME, type DeckTheme } from '../features/theme/deckTheme';
import logoBlack from '../assets/Logo_Black_Transparent.png';
import {
  AddIcon,
  ArrowUpIcon,
  CopyIcon,
  CreateIcon,
  EllipsisIcon,
  GripIcon,
  ListIcon,
  PlayIcon,
  SearchIcon,
  SortIcon,
  TrashIcon,
} from '../features/ui/icons';
import { ScrollToTop } from '../features/ui/ScrollToTop';
import { DeckTable, type Sort, type SortKey } from '../features/library/DeckTable';
import { relativeTime } from '../features/library/relativeTime';
import { Pagination } from '../features/library/Pagination';

const VIEW_KEY = 'wozku-library-view-v1';

type View = 'list' | 'grid';

/**
 * Time buckets.
 *
 * The answer to "does the user scroll forever": a flat list of forty rows is a
 * wall whatever its density, but the same forty under Today / This week / This
 * month / Older is scannable, because recency is how anyone actually looks for a
 * deck they were working on. Empty buckets are dropped rather than shown blank.
 */
function groupByAge(items: ProjectSummary[]): { label: string; items: ProjectSummary[] }[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const buckets: { label: string; items: ProjectSummary[] }[] = [
    { label: 'Today', items: [] },
    { label: 'This week', items: [] },
    { label: 'This month', items: [] },
    { label: 'Older', items: [] },
  ];
  for (const p of items) {
    const age = now - p.updatedAt;
    if (age < DAY) buckets[0].items.push(p);
    else if (age < 7 * DAY) buckets[1].items.push(p);
    else if (age < 30 * DAY) buckets[2].items.push(p);
    else buckets[3].items.push(p);
  }
  return buckets.filter((b) => b.items.length > 0);
}

/** A mono, letter-spaced section label. The same device the slide templates use
 *  for their eyebrows, so the page is set in the deck system's own voice. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9.5px] font-bold tracking-[0.2em] uppercase text-neutral-400">
      {children}
    </span>
  );
}

/** Client chip: the deck's brand kit, as a swatch plus its name. */
function KitChip({ theme, muted }: { theme: DeckTheme; muted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span
        aria-hidden
        className="shrink-0 w-[9px] h-[9px] border border-black/10"
        style={{ background: themeCss(theme.accent.base) }}
      />
      <span className={`truncate text-[11.5px] ${muted ? 'text-neutral-500' : 'text-neutral-700 font-semibold'}`}>
        {theme.name}
      </span>
    </span>
  );
}

/** The per-deck action menu. Shared by hero, row and card so all three offer
 *  exactly the same three verbs. */
function DeckMenu({
  onRename,
  onDuplicate,
  onDelete,
}: {
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const row =
    'w-full flex items-center gap-2.5 px-3 py-[7px] text-[12.5px] font-medium transition-colors cursor-pointer';
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-[calc(100%+4px)] z-30 w-[168px] py-1 bg-white border border-neutral-200 text-left"
      style={{ boxShadow: '0 10px 30px -8px rgba(15,23,20,0.28)' }}
    >
      <button onClick={onRename} className={`${row} text-neutral-700 hover:bg-neutral-100`}>
        <CreateIcon size={15} />
        Rename
      </button>
      <button onClick={onDuplicate} className={`${row} text-neutral-700 hover:bg-neutral-100`}>
        <CopyIcon size={15} />
        Duplicate
      </button>
      <div className="my-1 h-px bg-neutral-200" />
      <button onClick={onDelete} className={`${row} text-red-600 hover:bg-red-50`}>
        <TrashIcon size={15} />
        Delete
      </button>
    </div>
  );
}

/** Grey blocks at the real dimensions of what is coming, so nothing jumps when
 *  the data lands. */
function LibrarySkeleton() {
  return (
    <div className="animate-pulse">
      <section className="flex flex-col lg:flex-row gap-10 lg:gap-14 pt-8 pb-14">
        <div className="w-full lg:w-[560px] shrink-0 aspect-[16/9] bg-white/70 border border-neutral-200" />
        <div className="flex flex-col gap-4 lg:pt-3 w-full max-w-[340px]">
          <div className="h-[10px] w-[130px] bg-neutral-200" />
          <div className="h-[30px] w-full bg-neutral-200" />
          <div className="h-[30px] w-[60%] bg-neutral-200" />
          <div className="h-[12px] w-[75%] bg-neutral-200 mt-1" />
          <div className="flex gap-2 mt-2">
            <div className="h-[42px] w-[130px] bg-neutral-200" />
            <div className="h-[42px] w-[104px] bg-neutral-200" />
          </div>
        </div>
      </section>
      <div className="h-[10px] w-[110px] bg-neutral-200 mb-4" />
      <div className="flex flex-col">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-2 py-2.5 border-t border-neutral-200">
            <div className="w-6 h-[10px] bg-neutral-200" />
            <div className="w-[104px] aspect-[16/9] bg-white/70 border border-neutral-200" />
            <div className="flex-1 h-[13px] bg-neutral-200" style={{ maxWidth: 120 + i * 40 }} />
            <div className="hidden sm:block w-[110px] h-[11px] bg-neutral-200" />
            <div className="w-[80px] h-[11px] bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The deck library.
 *
 * An earlier version was a single responsive card grid, which failed at both ends
 * of the range it had to cover: with three decks the page was ninety percent empty
 * desk, and at forty it was an undifferentiated wall of identical covers. A grid is
 * a layout for *many* things, so it cannot also be the layout for one.
 *
 * Three surfaces, each doing one job:
 *
 *  - **A hero** for the deck you were last in. Almost always the one you want, so
 *    it gets a large cover and both verbs that matter (open it, or just present
 *    it). One deck is enough to make the page feel deliberate.
 *  - **A paginated index** for everything else, as a table or a cover grid. Ten
 *    rows a page by default, so the library is a fixed amount of scrolling however
 *    many decks it holds. The grid additionally groups its page by Today / This
 *    week / This month / Older, since recency is how anyone hunts for work in
 *    progress; the table sorts instead, because that is what a table is for.
 *  - **A client filter**, taken from each deck's brand kit. Pitch and Slides make
 *    you file work into folders you maintain by hand; here the deck already knows
 *    whose it is.
 *
 * Drawn on the slides' own 120px hairline grid with the cover template's ambient
 * glow (see `.wg-library`), so the chrome is made of the same material as the work.
 */
export function HomePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>(() => listProjectSummaries());
  const [kits, setKits] = useState(() => listBrandKits());
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [kitFilter, setKitFilter] = useState<string | null>(null);
  const [view, setView] = useState<View>(
    () => (localStorage.getItem(VIEW_KEY) as View | null) ?? 'list'
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<Sort>({ key: 'updated', dir: 'desc' });
  /** Row selection, for the table's plural operations. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [presentId, setPresentId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  /** Cmd/Ctrl+K focuses search, and Escape leaves it. The modifier follows the
   *  platform (see `hasModifier`) rather than hardcoding one, so the hint printed
   *  in the field is always the key that actually works. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hasModifier(e) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        searchRef.current?.blur();
        return;
      }
      // '?' opens the shortcuts overlay, as it does in the studio - but not while
      // someone is typing a question mark into a field.
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '?' && !typing) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Storage unavailable; the choice just won't survive a reload.
    }
  }, [view]);

  const kitThemes = useMemo(() => brandKitThemes(kits), [kits]);
  /** The cover shown in the empty state. Memoised because `createTemplateDeck()`
   *  mints fresh instance ids, so calling it inline remounted the preview on
   *  every keystroke elsewhere on the page. */
  const sampleCover = useMemo(() => createTemplateDeck().slides[0], []);

  const reload = useCallback(() => {
    setProjects(listProjectSummaries());
    setKits(listBrandKits());
  }, []);

  const themeOf = useCallback(
    (p: ProjectSummary) => themeById(p.deck?.themeId, kitThemes),
    [kitThemes]
  );

  /** Make a deck active and go edit it. The studio reads the active id from the
   *  store on mount, so opening a deck is "select, then navigate". */
  const open = useCallback(
    (id: string) => {
      setActiveId(id);
      navigate('/studio');
    },
    [navigate]
  );

  /** Straight into the deck that was just created: the new-deck screen is where
   *  the decisions were made, so there is nothing left to do on the library. */
  const createDeck = (name: string, deck: Deck) => {
    const meta = createProject(name, { ast: null, deck });
    open(meta.id);
  };

  const commitRename = () => {
    if (renamingId && draftName.trim()) renameProject(renamingId, draftName);
    setRenamingId(null);
    reload();
  };

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const deleteMany = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => deleteProject(id));
      clearSelection();
      reload();
    },
    [clearSelection, reload]
  );

  const duplicateMany = useCallback(
    (ids: string[]) => {
      // Oldest first, so the copies end up in the same relative order as their
      // sources rather than reversed.
      [...ids].reverse().forEach((id) => duplicateProject(id));
      clearSelection();
      reload();
    },
    [clearSelection, reload]
  );

  /** Which clients actually have decks. Derived rather than listing every saved
   *  kit: a filter for a client with no work in the library is a dead control. */
  const kitsInUse = useMemo(() => {
    const seen = new Map<string, DeckTheme>();
    for (const p of projects) {
      const t = themeOf(p);
      if (!seen.has(t.id)) seen.set(t.id, t);
    }
    return [...seen.values()];
  }, [projects, themeOf]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (kitFilter && themeOf(p).id !== kitFilter) return false;
      return !q || p.name.toLowerCase().includes(q);
    });
  }, [projects, query, kitFilter, themeOf]);

  // Any change to what is being looked at collapses the index back to one page,
  // so a filter never lands you mid-way down someone else's list.
  useEffect(() => {
    setPage(1);
    // A selection refers to rows you can see. Re-filtering would otherwise leave
    // a bulk Delete pointed at decks that are no longer on screen.
    setSelected(new Set());
  }, [query, kitFilter]);

  // Re-sorting or resizing shuffles which decks are on which page, so page two of
  // the old order is meaningless in the new one.
  useEffect(() => setPage(1), [sort, pageSize, view]);


  /** The hero is the most recent deck *of what you are currently looking at*, so
   *  filtering to a client re-points it at that client's latest. */
  const hero = filtered[0] ?? null;
  const rest = filtered.slice(1);

  // Deleting the last rows of the last page would otherwise strand you on a page
  // that no longer exists.
  const pageCount = Math.max(1, Math.ceil(rest.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  /** Grid view keeps recency order, because it groups by age. */
  const groups = useMemo(
    () => groupByAge(rest.slice((page - 1) * pageSize, page * pageSize)),
    [rest, page, pageSize]
  );

  /** Table view sorts by whichever column you picked. Deliberately separate from
   *  the grid's ordering: a table's job is to be sorted, a grid's is to be
   *  grouped, and doing both at once produces headings that no longer describe
   *  what is under them. */
  const sortedShown = useMemo(() => {
    const slideCount = (p: ProjectSummary) =>
      p.deck?.slides.filter((s) => !s.hidden).length ?? 0;
    const arr = [...rest];
    arr.sort((a, b) => {
      let d = 0;
      if (sort.key === 'name') d = a.name.localeCompare(b.name);
      else if (sort.key === 'client') d = themeOf(a).name.localeCompare(themeOf(b).name);
      else if (sort.key === 'slides') d = slideCount(a) - slideCount(b);
      else d = a.updatedAt - b.updatedAt;
      // Ties fall back to recency, so equal rows keep a stable, meaningful order
      // instead of whatever the sort happened to leave behind.
      if (d === 0) d = a.updatedAt - b.updatedAt;
      return sort.dir === 'asc' ? d : -d;
    });
    return arr.slice((page - 1) * pageSize, page * pageSize);
  }, [rest, sort, themeOf, page, pageSize]);

  /** Text columns read better ascending on first click, numbers and dates
   *  descending: nobody sorting by "Edited" wants the oldest deck first. */
  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' || key === 'client' ? 'asc' : 'desc' }
    );

  const pendingDelete = projects.find((p) => p.id === pendingDeleteId) ?? null;
  const presenting = projects.find((p) => p.id === presentId) ?? null;
  const heroTheme = hero ? themeOf(hero) : WOZKU_THEME;
  const heroSlides = hero?.deck?.slides.filter((s) => !s.hidden) ?? [];

  /** The deck's own action menu, anchored. */
  const menuFor = (p: ProjectSummary) =>
    menuId === p.id ? (
      <DeckMenu
        onRename={() => { setMenuId(null); setRenamingId(p.id); setDraftName(p.name); }}
        onDuplicate={() => { duplicateProject(p.id); setMenuId(null); reload(); }}
        onDelete={() => { setMenuId(null); setPendingDeleteId(p.id); }}
      />
    ) : null;

  /** Name as static text, or as an input once it is being renamed. One helper so
   *  hero, row and card all rename identically. */
  const nameField = (p: ProjectSummary, className: string) =>
    renamingId === p.id ? (
      <input
        autoFocus
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={commitRename}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitRename();
          if (e.key === 'Escape') setRenamingId(null);
        }}
        className={`${className} w-full bg-white border border-emerald-400 px-1 -mx-1 outline-none`}
      />
    ) : (
      <span
        onDoubleClick={(e) => {
          e.stopPropagation();
          setRenamingId(p.id);
          setDraftName(p.name);
        }}
        title="Double-click to rename"
        className={`${className} block truncate`}
      >
        {p.name}
      </span>
    );

  return (
    <div className="wg-library min-h-screen" onClick={() => setMenuId(null)}>
      {/* ── Masthead ──────────────────────────────────────────────────────── */}
      <header className="relative z-10 border-b border-neutral-200/80 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-[1220px] px-8 h-[68px] grid grid-cols-[1fr_auto_1fr] items-center gap-5">
          <div className="flex items-center gap-5 min-w-0">
            <img src={logoBlack} alt="Wozku" className="w-[92px] h-auto select-none" draggable={false} />
            <span className="w-px h-6 bg-neutral-200 shrink-0" />
            <div className="flex items-baseline gap-2.5 min-w-0">
              <span className="text-[14px] font-bold text-neutral-900 whitespace-nowrap">Deck Library</span>
              <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                {String(projects.length).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Centred: search is the page's own control rather than an action, and
              a three-column grid keeps it centred whatever the ends weigh. */}
          <div className="justify-self-center">
            {projects.length > 0 && (
              <div className="group relative flex items-center w-[260px] sm:w-[320px] h-[34px] bg-white border border-neutral-200 focus-within:border-neutral-400 transition-colors">
                <span className="absolute left-2.5 text-neutral-400 group-focus-within:text-neutral-600 transition-colors pointer-events-none">
                  <SearchIcon size={14} />
                </span>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search decks"
                  spellCheck={false}
                  aria-keyshortcuts={`${MOD_KEY}+K`}
                  className="w-full h-full pl-8 pr-[52px] text-[12.5px] bg-transparent outline-none text-neutral-900 placeholder:text-neutral-400"
                />
                {/* The hint gets out of the way once the field is in use: a
                    shortcut for reaching a field you are already typing in is
                    noise, and it would sit under the text. */}
                {!query && (
                  <kbd className="absolute right-2 flex items-center gap-[3px] font-mono text-[10px] font-bold text-neutral-400 bg-neutral-100 border border-neutral-200 px-1.5 h-[19px] pointer-events-none select-none group-focus-within:opacity-0 transition-opacity">
                    <span className={MOD_KEY === '⌘' ? 'text-[12px] leading-none' : ''}>{MOD_KEY}</span>
                    <span>K</span>
                  </kbd>
                )}
              </div>
            )}
          </div>

          <div className="justify-self-end flex items-center gap-2">
            <HelpMenu onOpenShortcuts={() => setShortcutsOpen(true)} />
            <button
              onClick={() => setNewDeckOpen(true)}
              className="flex items-center gap-2 h-[34px] px-4 text-[12.5px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <AddIcon size={14} />
              New deck
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[1220px] px-8">
        {loading ? (
          <LibrarySkeleton />
        ) : projects.length === 0 ? (
          /* ── Empty. Sets out what the system is rather than apologising for
                being empty, and the master template is shown, not described. ── */
          <div className="flex flex-col lg:flex-row items-center gap-14 py-24">
            <div className="w-full max-w-[520px] shrink-0">
              <div className="wg-hero-cover bg-white">
                <FitStage slide={sampleCover} ast={null} num="01" theme={WOZKU_THEME} />
              </div>
            </div>
            <div className="flex flex-col gap-5 max-w-[400px]">
              <Eyebrow>The master template</Eyebrow>
              <h1
                className="text-[34px] leading-[1.08] font-bold tracking-[-0.02em] text-neutral-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Fourteen layouts.<br />One house system.
              </h1>
              <p className="text-[13.5px] leading-relaxed text-neutral-500">
                Every deck starts from the same set. Write a Business Record or drop in an
                existing <span className="font-mono text-[12.5px]">.pptx</span> and it comes
                back on brand, then set a client&rsquo;s colour for the whole deck at once.
              </p>
              <button
                onClick={() => setNewDeckOpen(true)}
                className="self-start flex items-center gap-2 h-[42px] px-5 text-[13px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <AddIcon size={15} />
                Start a deck
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Client filter ─────────────────────────────────────────────── */}
            {kitsInUse.length > 1 && (
              <div className="flex items-center gap-2 pt-7 flex-wrap">
                <Eyebrow>Client</Eyebrow>
                <span className="w-2" />
                <button
                  onClick={() => setKitFilter(null)}
                  className={`h-[27px] px-3 text-[11.5px] font-bold transition-colors cursor-pointer border ${
                    kitFilter === null
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white/70 text-neutral-600 border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  All
                </button>
                {kitsInUse.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setKitFilter(t.id)}
                    className={`flex items-center gap-1.5 h-[27px] px-3 text-[11.5px] font-bold transition-colors cursor-pointer border ${
                      kitFilter === t.id
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white/70 text-neutral-600 border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="w-[8px] h-[8px] border border-black/20"
                      style={{ background: themeCss(t.accent.base) }}
                    />
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="py-24 text-center flex flex-col items-center gap-3">
                <p className="text-[14px] font-bold text-neutral-800">
                  Nothing matches {query.trim() ? `“${query.trim()}”` : 'this client'}.
                </p>
                <button
                  onClick={() => { setQuery(''); setKitFilter(null); }}
                  className="h-[32px] px-3.5 text-[12px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:border-neutral-400 transition-colors cursor-pointer"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                {/* ── Hero ──────────────────────────────────────────────────── */}
                {hero && (
                  <section className="flex flex-col lg:flex-row gap-10 lg:gap-14 pt-8 pb-14">
                    <button
                      onClick={() => open(hero.id)}
                      className="wg-hero-cover w-full lg:w-[560px] shrink-0 bg-white cursor-pointer text-left"
                      aria-label={`Open ${hero.name}`}
                    >
                      {heroSlides[0] ?? hero.deck?.slides[0] ? (
                        <FitStage
                          slide={heroSlides[0] ?? hero.deck!.slides[0]}
                          ast={null}
                          num="01"
                          logoUrl={hero.deck?.logoUrl}
                          theme={heroTheme}
                        />
                      ) : (
                        <span className="flex items-center justify-center w-full aspect-[16/9] text-[12px] text-neutral-400">
                          Empty deck
                        </span>
                      )}
                    </button>

                    <div className="flex flex-col gap-5 min-w-0 lg:pt-3">
                      <Eyebrow>{kitFilter ? 'Latest for this client' : 'Pick up where you left off'}</Eyebrow>

                      <div
                        className="text-[30px] leading-[1.1] font-bold tracking-[-0.02em] text-neutral-900 break-words max-w-[420px]"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {nameField(hero, 'text-[30px] font-bold tracking-[-0.02em] text-neutral-900')}
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-[11.5px] text-neutral-500">
                        <KitChip theme={heroTheme} />
                        <span className="w-px h-3 bg-neutral-300" />
                        <span className="font-mono tabular-nums">
                          {String(heroSlides.length).padStart(2, '0')} slides
                        </span>
                        <span className="w-px h-3 bg-neutral-300" />
                        <span>Edited {relativeTime(hero.updatedAt)}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => open(hero.id)}
                          className="h-[42px] px-6 text-[13px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          Open deck
                        </button>
                        {heroSlides.length > 0 && (
                          <button
                            onClick={() => setPresentId(hero.id)}
                            title="Present without opening the editor"
                            className="flex items-center gap-2 h-[42px] px-5 text-[13px] font-bold text-neutral-800 bg-white border border-neutral-200 hover:border-neutral-400 transition-colors cursor-pointer"
                          >
                            <PlayIcon size={14} />
                            Present
                          </button>
                        )}
                        <span className="relative inline-flex">
                          <button
                            onClick={(e) => { e.stopPropagation(); setMenuId(menuId === hero.id ? null : hero.id); }}
                            aria-label={`Actions for ${hero.name}`}
                            className="w-[42px] h-[42px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 bg-white border border-neutral-200 hover:border-neutral-400 transition-colors cursor-pointer"
                          >
                            <EllipsisIcon size={16} />
                          </button>
                          {menuFor(hero)}
                        </span>
                      </div>
                    </div>
                  </section>
                )}

                {/* ── Index ─────────────────────────────────────────────────── */}
                {rest.length > 0 && (
                  <section className="pb-20">
                    <div className="flex items-center justify-between gap-4 pb-3">
                      <div className="flex items-baseline gap-3">
                        <Eyebrow>Everything else</Eyebrow>
                        <span className="font-mono text-[10.5px] text-neutral-400 tabular-nums">
                          {String(rest.length).padStart(2, '0')}
                        </span>
                      </div>

                      {/* Density is a real choice, not a preference: a list is for
                          finding a deck you can name, a grid for recognising one
                          you can only picture. */}
                      <div className="flex items-center border border-neutral-200 bg-white/70">
                        {[
                          { id: 'list' as View, label: 'List', icon: <ListIcon size={13} /> },
                          { id: 'grid' as View, label: 'Grid', icon: <GripIcon size={13} /> },
                        ].map((v) => (
                          <button
                            key={v.id}
                            onClick={() => setView(v.id)}
                            aria-pressed={view === v.id}
                            title={`${v.label} view`}
                            className={`flex items-center gap-1.5 h-[27px] px-2.5 text-[11px] font-bold transition-colors cursor-pointer ${
                              view === v.id
                                ? 'bg-neutral-900 text-white'
                                : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                          >
                            {v.icon}
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {view === 'list' ? (
                      <DeckTable
                        rows={sortedShown}
                        total={rest.length}
                        page={page}
                        pageSize={pageSize}
                        onPage={setPage}
                        onPageSize={setPageSize}
                        themeOf={themeOf}
                        sort={sort}
                        onSort={toggleSort}
                        selected={selected}
                        onToggleSelect={toggleSelect}
                        onToggleAll={() =>
                          setSelected((prev) =>
                            sortedShown.every((p) => prev.has(p.id))
                              ? new Set()
                              : new Set(sortedShown.map((p) => p.id))
                          )
                        }
                        onClearSelection={clearSelection}
                        onBulkDuplicate={() => duplicateMany([...selected])}
                        onBulkDelete={() => setBulkDeleteOpen(true)}
                        onOpen={open}
                        onPresent={setPresentId}
                        onDuplicate={(id) => { duplicateProject(id); reload(); }}
                        onDelete={setPendingDeleteId}
                        renderName={nameField}
                      />
                    ) : (
                      groups.map((group) => (
                        <div key={group.label} className="mb-7">
                          <div className="flex items-baseline gap-2.5 pb-2">
                            <span className="text-[11.5px] font-bold text-neutral-700">{group.label}</span>
                            <span className="font-mono text-[10px] text-neutral-400 tabular-nums">
                              {String(group.items.length).padStart(2, '0')}
                            </span>
                          </div>
                          <div
                            className="grid gap-x-5 gap-y-6"
                            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))' }}
                          >
                            {group.items.map((p) => {
                              const th = themeOf(p);
                              const visible = p.deck?.slides.filter((s) => !s.hidden) ?? [];
                              const cover = visible[0] ?? p.deck?.slides[0];
                              return (
                                <div key={p.id} className="group relative flex flex-col gap-2">
                                  <button
                                    onClick={() => open(p.id)}
                                    aria-label={`Open ${p.name}`}
                                    className="block w-full bg-white cursor-pointer transition-shadow duration-150 shadow-[0_0_0_1px_var(--neutral-200),0_1px_3px_rgba(15,23,20,0.06)] group-hover:shadow-[0_0_0_1px_var(--neutral-300),0_10px_26px_-10px_rgba(15,23,20,0.22)]"
                                  >
                                    {cover ? (
                                      <FitStage slide={cover} ast={null} num="01" logoUrl={p.deck?.logoUrl} theme={th} />
                                    ) : (
                                      <span className="block w-full aspect-[16/9]" />
                                    )}
                                  </button>
                                  <div className="flex items-start gap-2 min-w-0">
                                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                                      {nameField(p, 'text-[13px] font-bold text-neutral-900')}
                                      <span className="flex items-center gap-2 text-[11px] text-neutral-500 min-w-0">
                                        <KitChip theme={th} muted />
                                        <span className="w-px h-2.5 bg-neutral-300 shrink-0" />
                                        <span className="font-mono tabular-nums shrink-0">
                                          {String(visible.length).padStart(2, '0')}
                                        </span>
                                      </span>
                                    </div>
                                    <span className="relative shrink-0 inline-flex">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }}
                                        aria-label={`Actions for ${p.name}`}
                                        className={`w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200/70 transition-all cursor-pointer ${
                                          menuId === p.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                      >
                                        <EllipsisIcon size={15} />
                                      </button>
                                      {menuFor(p)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}

                    {/* Grid view only. The table draws its own pagination inside
                        its card footer, and this rendered unconditionally, so list
                        view was showing the control twice. */}
                    {view === 'grid' && rest.length > 0 && (
                      <div className="border border-neutral-200 bg-white/70 mt-1">
                        <Pagination
                          total={rest.length}
                          page={page}
                          pageSize={pageSize}
                          onPage={setPage}
                          onPageSize={setPageSize}
                        />
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Present straight from the library. Worth its own entry point: reaching a
          finished deck should not require passing through the editor. */}
      {presenting?.deck && (
        <PresentMode
          open
          onClose={() => setPresentId(null)}
          deck={presenting.deck}
          ast={null}
          theme={themeOf(presenting)}
        />
      )}

      {bulkDeleteOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
          onMouseDown={() => setBulkDeleteOpen(false)}
        >
          <div className="w-[380px] bg-white shadow-xl p-5" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-neutral-900">
              Delete {selected.size} deck{selected.size === 1 ? '' : 's'}?
            </h3>
            <p className="mt-1.5 text-[13px] text-neutral-500 leading-relaxed">
              This can&rsquo;t be undone. Every slide and edit in {selected.size === 1 ? 'it' : 'them'} is
              lost.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setBulkDeleteOpen(false)}
                className="h-8 px-3 text-[13px] font-bold text-neutral-700 border border-neutral-200 hover:bg-neutral-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteMany([...selected]); setBulkDeleteOpen(false); }}
                className="h-8 px-3 text-[13px] font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer"
              >
                Delete {selected.size}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deleting a deck is the one unrecoverable action here: the studio's undo
          stack lives inside a deck, so it cannot bring one back. */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
          onMouseDown={() => setPendingDeleteId(null)}
        >
          <div className="w-[380px] bg-white shadow-xl p-5" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-neutral-900">Delete &ldquo;{pendingDelete.name}&rdquo;?</h3>
            <p className="mt-1.5 text-[13px] text-neutral-500 leading-relaxed">
              This can&rsquo;t be undone. Every slide and edit in this deck is lost.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingDeleteId(null)}
                className="h-8 px-3 text-[13px] font-bold text-neutral-700 border border-neutral-200 hover:bg-neutral-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteProject(pendingDelete.id); setPendingDeleteId(null); reload(); }}
                className="h-8 px-3 text-[13px] font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer"
              >
                Delete deck
              </button>
            </div>
          </div>
        </div>
      )}

      <ScrollToTop />

      <KeyboardShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <NewDeckModal
        open={newDeckOpen}
        onClose={() => setNewDeckOpen(false)}
        onCreate={createDeck}
      />

      <DevPanel
        loading={loading}
        onSetLoading={setLoading}
        onDataChanged={reload}
        deckCount={projects.length}
      />
    </div>
  );
}
