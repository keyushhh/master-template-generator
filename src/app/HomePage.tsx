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
import { MacFolderIcon } from '../features/deck/MacFolderIcon';
import { FolderModal } from '../features/deck/FolderModal';
import { DeleteFolderModal } from '../features/deck/DeleteFolderModal';
import { MoveDecksToFolderModal } from '../features/deck/MoveDecksToFolderModal';
import { ConfirmModal, cannotBeUndone } from '../features/ui/ConfirmModal';
import { exportFolderToZip } from '../features/export/folderExport';
import { useToast } from '../features/toast/Toast';
import type { Deck } from '../features/deck/types';
import {
  createFolder,
  createProject,
  deleteFolder,
  deleteProject,
  duplicateProject,
  listFolders,
  listProjectSummaries,
  moveProjectToFolder,
  moveProjectsToFolder,
  renameFolder,
  renameProject,
  setActiveId,
  updateFolderColor,
  type FolderColor,
  type FolderMeta,
  type ProjectSummary,
} from '../features/deck/deckStore';
import { brandKitThemes, listBrandKits } from '../features/theme/brandKitStore';
import { ensureFonts } from '../features/fonts/loadFont';
import { css as themeCss, themeById, WOZKU_THEME, type DeckTheme } from '../features/theme/deckTheme';
import logoBlack from '../assets/Logo_Black_Transparent.png';
import {
  AddIcon,
  ArrowBackNavIcon,
  ArrowForwardNavIcon,
  ArrowUpIcon,
  CopyIcon,
  CreateIcon,
  DownloadIcon,
  EllipsisIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderOpenOutlineIcon,
  GripIcon,
  TableIcon,
  PlayIcon,
  SearchIcon,
  SortIcon,
  ZoomInIcon,
  ZoomOutIcon,
  TrashIcon,
} from '../features/ui/icons';

const FOLDER_COLOR_HEX: Record<FolderColor, string> = {
  orange: '#f97316',
  amber: '#f59e0b',
  purple: '#a855f7',
  blue: '#3b82f6',
  emerald: '#10b981',
  rose: '#f43f5e',
  indigo: '#6366f1',
  slate: '#64748b',
};
import { ScrollToTop } from '../features/ui/ScrollToTop';
import { DeckTable, type Sort, type SortKey } from '../features/library/DeckTable';
import { relativeTime } from '../features/library/relativeTime';
import { Pagination } from '../features/library/Pagination';
import { FolderChip } from '../features/library/FolderChip';

const VIEW_KEY = 'wozku-library-view-v1';
const FOLDER_ZOOM_KEY = 'wozku-folder-zoom-v1';
const FOLDER_LIST_KEY = 'wozku-folder-listview-v1';
/**
 * Pixel width/height of a folder icon at each end of the pinch-zoom range, and
 * the default before anyone has touched it - the size the icon shipped at, so
 * zooming is additive rather than a reset.
 *
 * The floor isn't "as small as the icon can render" - it's the smallest size
 * the card around it still works at all: below it the name truncates to two
 * or three letters and there's nowhere left to put the "..." menu without it
 * sitting on top of the icon. Pinching past this floor switches to the list
 * instead of continuing to shrink into something unreadable.
 */
const FOLDER_ZOOM_MIN = 84;
/** The ceiling is sized to the shelf's own height cap: two rows at this icon
 *  size fill it right up to where scrolling would start anyway (see
 *  FOLDER_SHELF_MAX_HEIGHT), so zooming in never fights the shelf for room -
 *  the biggest a folder gets is the biggest that still shows two full rows. */
const FOLDER_ZOOM_MAX = 220;
const FOLDER_ZOOM_DEFAULT = 112;
/** Two rows at FOLDER_ZOOM_MAX, plus the shelf's own padding - past this the
 *  shelf scrolls internally instead of growing and pushing the decks below it
 *  further down every time a folder is added. */
const FOLDER_SHELF_MAX_HEIGHT = 760;

function readStoredFolderZoom(): number {
  const raw = Number(localStorage.getItem(FOLDER_ZOOM_KEY));
  if (Number.isFinite(raw) && raw >= FOLDER_ZOOM_MIN && raw <= FOLDER_ZOOM_MAX) return raw;
  return FOLDER_ZOOM_DEFAULT;
}

function readStoredFolderListView(): boolean {
  return localStorage.getItem(FOLDER_LIST_KEY) === '1';
}

/** 'table' was called 'list' while it really was one. It is a sortable,
 *  paginated table now, and the old name kept it sounding like the simpler
 *  thing. The stored value is migrated on read rather than left to mean two
 *  different words for the same view. */
type View = 'table' | 'grid';

/**
 * The saved preference, migrated.
 *
 * Anyone who used the library before this rename has `'list'` in storage. Left
 * alone it matches neither view, so the render would fall through to the grid -
 * the exact behaviour the rename was meant to fix, for every existing user. The
 * table is the default for a fresh browser too: it is the view that scales, and
 * it answers "which deck was that" in a way a wall of covers cannot.
 */
function readStoredView(): View {
  const raw = localStorage.getItem(VIEW_KEY);
  if (raw === 'grid') return 'grid';
  return 'table';
}

/**
 * Time buckets.
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9.5px] font-bold tracking-[0.2em] uppercase text-neutral-400">
      {children}
    </span>
  );
}

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

/** The per-deck action menu with Move to Folder submenu */
function DeckMenu({
  onRename,
  onDuplicate,
  onDelete,
  onMoveToFolder,
  folders = [],
  currentFolderId,
}: {
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  folders?: FolderMeta[];
  currentFolderId?: string | null;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const row =
    'w-full flex items-center gap-2.5 px-3 py-[7px] text-[12.5px] font-medium transition-colors cursor-pointer text-left';
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-[calc(100%+4px)] z-30 w-[184px] py-1 bg-white border border-neutral-200 text-left rounded-[var(--radius-sharp)] shadow-xl"
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
      
      {/* Move / Remove from folder */}
      {currentFolderId ? (
        <button
          onClick={() => { onMoveToFolder(null); }}
          className={`${row} text-neutral-700 hover:bg-neutral-100`}
        >
          <FolderIcon size={15} />
          Remove from folder
        </button>
      ) : (
        <div className="relative">
          <button
            onClick={() => setMoveOpen((v) => !v)}
            className={`${row} text-neutral-700 hover:bg-neutral-100 justify-between`}
          >
            <span className="flex items-center gap-2.5">
              <FolderIcon size={15} />
              Move to folder
            </span>
            <span className="text-[10px] text-neutral-400">▶</span>
          </button>

          {moveOpen && (
            <div className="absolute left-[calc(100%+4px)] top-0 w-[170px] py-1 bg-white border border-neutral-200 rounded-[var(--radius-sharp)] shadow-xl z-40">
              <button
                onClick={() => { onMoveToFolder(null); setMoveOpen(false); }}
                className={`${row} ${!currentFolderId ? 'font-bold text-emerald-700 bg-emerald-50' : 'text-neutral-700 hover:bg-neutral-100'}`}
              >
                Uncategorised
              </button>
              {folders.length > 0 && <div className="my-1 h-px bg-neutral-200" />}
              {folders.map((f) => {
                const iconColor =
                  f.color === 'orange'
                    ? '#f97316'
                    : f.color === 'amber'
                    ? '#f59e0b'
                    : f.color === 'purple'
                    ? '#a855f7'
                    : f.color === 'emerald'
                    ? '#10b981'
                    : f.color === 'rose'
                    ? '#f43f5e'
                    : f.color === 'indigo'
                    ? '#6366f1'
                    : f.color === 'slate'
                    ? '#64748b'
                    : '#3b82f6';
                return (
                  <button
                    key={f.id}
                    onClick={() => { onMoveToFolder(f.id); setMoveOpen(false); }}
                    className={`${row} ${currentFolderId === f.id ? 'font-bold text-emerald-700 bg-emerald-50' : 'text-neutral-700 hover:bg-neutral-100'}`}
                  >
                    <span style={{ color: iconColor }} className="shrink-0 flex items-center">
                      <FolderOpenIcon size={14} />
                    </span>
                    <span className="truncate">{f.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="my-1 h-px bg-neutral-200" />
      <button onClick={onDelete} className={`${row} text-red-600 hover:bg-red-50`}>
        <TrashIcon size={15} />
        Delete
      </button>
    </div>
  );
}

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

export function HomePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [projects, setProjects] = useState<ProjectSummary[]>(() => listProjectSummaries());
  const [folders, setFolders] = useState<FolderMeta[]>(() => listFolders());
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  
  /** Navigation history stack for folder navigation ← / → */
  const [navHistory, setNavHistory] = useState<Array<string | null>>([null]);
  const [navIndex, setNavIndex] = useState(0);

  const [kits, setKits] = useState(() => listBrandKits());
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [kitFilter, setKitFilter] = useState<string | null>(null);
  /**
   * The view the *library* is in. Not the view on screen: inside a folder the
   * grid is forced, and that is a consequence of where you are rather than a
   * preference you expressed.
   *
   * Keeping them separate is the fix for a real bug. Opening a folder used to
   * call `setView('grid')`, and every view change is persisted - so visiting one
   * folder silently overwrote the saved library preference, and coming back out
   * left the library in grid for good. The default was 'list' all along; nobody
   * ever got to see it twice.
   */
  const [homeView, setHomeView] = useState<View>(() => readStoredView());
  const [folderZoom, setFolderZoom] = useState<number>(() => readStoredFolderZoom());
  const [folderListView, setFolderListView] = useState<boolean>(() => readStoredFolderListView());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<Sort>({ key: 'updated', dir: 'desc' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<FolderMeta | null>(null);
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [moveDecksModalOpen, setMoveDecksModalOpen] = useState(false);
  const [presentId, setPresentId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [newDeckOpen, setNewDeckOpen] = useState(false);

  /**
   * Pull in the typefaces the brand kits use.
   *
   * Every cover on this page is drawn through its deck's kit theme, and a kit can
   * now name its own display, body and mono faces. Without this the library shows
   * covers in the fallback stack while the studio shows them correctly - the same
   * deck looking like two different decks depending on the screen.
   */
  useEffect(() => {
    void ensureFonts(
      kits.flatMap((k) => [k.fonts?.display, k.fonts?.sans, k.fonts?.mono])
    );
  }, [kits]);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderMeta | null>(null);
  const [folderHeaderMenuOpen, setFolderHeaderMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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

  /**
   * Every "..." menu on this page - a deck's, a folder card's, the folder
   * header's - closes on a click anywhere outside it.
   *
   * One listener rather than one per menu, because that's what "anywhere
   * outside" actually means: not "outside this specific menu's own box" (each
   * of those already stops its own clicks from bubbling here) but "outside
   * all of them, no matter which is open or where it lives on the page."
   * Setting a state that's already null/false is a no-op react bails out of,
   * so closing all three on every outside click costs nothing extra.
   */
  useEffect(() => {
    const onOutsideClick = () => {
      setMenuId(null);
      setFolderMenuId(null);
      setFolderHeaderMenuOpen(false);
    };
    document.addEventListener('click', onOutsideClick);
    return () => document.removeEventListener('click', onOutsideClick);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, homeView);
    } catch {}
  }, [homeView]);

  useEffect(() => {
    try {
      localStorage.setItem(FOLDER_ZOOM_KEY, String(folderZoom));
      localStorage.setItem(FOLDER_LIST_KEY, folderListView ? '1' : '0');
    } catch {}
  }, [folderZoom, folderListView]);

  /**
   * Move the shelf's size by `delta` px, in either direction.
   *
   * Shrinking past the floor doesn't clamp and stop - it hands off to the
   * list, which is the "smaller than the smallest icon" state rather than a
   * size at all. Growing back out of the list does the reverse: one more
   * zoom-in step past the floor, not a jump to some arbitrary icon size.
   * Sharing this between the wheel handler and the +/- buttons is what keeps
   * a pinch and a click agree on where that handoff happens.
   */
  const adjustFolderZoom = useCallback(
    (delta: number) => {
      if (delta < 0) {
        if (folderListView) return; // already past the floor - nothing smaller to hand off to
        const next = folderZoom + delta;
        if (next < FOLDER_ZOOM_MIN) {
          setFolderZoom(FOLDER_ZOOM_MIN);
          setFolderListView(true);
        } else {
          setFolderZoom(next);
        }
      } else if (folderListView) {
        setFolderListView(false);
        setFolderZoom(FOLDER_ZOOM_MIN);
      } else {
        setFolderZoom(Math.min(FOLDER_ZOOM_MAX, folderZoom + delta));
      }
    },
    [folderListView, folderZoom]
  );

  /**
   * Trackpad pinch, on the folder shelf only.
   *
   * A pinch reaches the browser as a `wheel` event with `ctrlKey` set - that's
   * the actual signal (there is no separate "pinch" DOM event), and it's also
   * what Ctrl+scroll sends, so this doubles as that for a mouse. Without
   * `preventDefault` the browser zooms the whole page instead, which is the
   * one thing pinching a folder should never do - but React's `onWheel` prop
   * is registered passive, so `preventDefault` inside it is silently ignored
   * and the page-zoom happens anyway. A real (non-passive) listener on the
   * shelf itself is the only way to actually stop it, and attaching it to the
   * shelf rather than the window is what keeps the effect scoped to it: pinch
   * anywhere else on the page and this listener never fires.
   */
  const folderShelfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = folderShelfRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      adjustFolderZoom(-e.deltaY * 0.6);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [activeFolderId === null && folders.length > 0, adjustFolderZoom]);

  const kitThemes = useMemo(() => brandKitThemes(kits), [kits]);
  const sampleCover = useMemo(() => createTemplateDeck().slides[0], []);

  const reload = useCallback(() => {
    const freshFolders = listFolders();
    setProjects(listProjectSummaries());
    setFolders(freshFolders);
    setKits(listBrandKits());
    // A folder that vanished out from under an open view (deleted elsewhere,
    // or wiped by the dev seeder) would otherwise leave the page "inside" an
    // id nothing matches - decks nowhere, no folder name to show, no way out
    // but the browser back button. Bounce to the root instead.
    setActiveFolderId((id) => {
      if (id && !freshFolders.some((f) => f.id === id)) {
        setNavHistory([null]);
        setNavIndex(0);
        return null;
      }
      return id;
    });
  }, []);

  const themeOf = useCallback(
    (p: ProjectSummary) => themeById(p.deck?.themeId, kitThemes),
    [kitThemes]
  );

  const open = useCallback(
    (id: string) => {
      setActiveId(id);
      navigate('/studio');
    },
    [navigate]
  );

  const createDeck = (name: string, deck: Deck) => {
    const meta = createProject(name, { ast: null, deck });
    if (activeFolderId) {
      moveProjectToFolder(meta.id, activeFolderId);
    }
    open(meta.id);
  };

  const commitRename = () => {
    if (renamingId && draftName.trim()) renameProject(renamingId, draftName);
    setRenamingId(null);
    reload();
  };

  const navigateToFolder = (folderId: string | null) => {
    const nextHistory = navHistory.slice(0, navIndex + 1);
    nextHistory.push(folderId);
    setNavHistory(nextHistory);
    setNavIndex(nextHistory.length - 1);
    setActiveFolderId(folderId);
  };

  const goBackNav = () => {
    if (navIndex > 0) {
      const prevIdx = navIndex - 1;
      setNavIndex(prevIdx);
      setActiveFolderId(navHistory[prevIdx]);
    }
  };

  const goForwardNav = () => {
    if (navIndex < navHistory.length - 1) {
      const nextIdx = navIndex + 1;
      setNavIndex(nextIdx);
      setActiveFolderId(navHistory[nextIdx]);
    }
  };

  const handleCreateOrUpdateFolder = (name: string, color: FolderColor) => {
    if (editingFolder) {
      renameFolder(editingFolder.id, name);
      updateFolderColor(editingFolder.id, color);
      showToast(`Updated folder "${name}"`, 'success');
    } else {
      const f = createFolder(name, color);
      showToast(`Created folder "${name}"`, 'success');
    }
    setEditingFolder(null);
    reload();
  };

  const handleDeleteFolder = (folder: FolderMeta) => {
    setDeletingFolder(folder);
  };

  const finishDeleteFolder = (folder: FolderMeta) => {
    setDeletingFolder(null);
    if (activeFolderId === folder.id) {
      navigateToFolder(null);
    } else {
      reload();
    }
  };

  const confirmDeleteFolderKeepDecks = () => {
    if (!deletingFolder) return;
    const folder = deletingFolder;
    deleteFolder(folder.id);
    finishDeleteFolder(folder);
    showToast(`Deleted folder "${folder.name}"`);
  };

  const confirmDeleteFolderWithDecks = () => {
    if (!deletingFolder) return;
    const folder = deletingFolder;
    const ids = projects.filter((p) => p.folderId === folder.id).map((p) => p.id);
    ids.forEach((id) => deleteProject(id));
    deleteFolder(folder.id);
    finishDeleteFolder(folder);
    showToast(`Deleted folder "${folder.name}" and ${ids.length} deck${ids.length === 1 ? '' : 's'}`);
  };

  const handleBulkMoveToFolder = (targetFolderId: string | null) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    moveProjectsToFolder(ids, targetFolderId);
    clearSelection();
    reload();
    const targetName = folders.find((f) => f.id === targetFolderId)?.name ?? 'Main Library';
    showToast(`Moved ${ids.length} deck${ids.length === 1 ? '' : 's'} to ${targetName}`);
  };

  const handleExportZip = async (folder: FolderMeta) => {
    showToast(`Preparing ZIP for "${folder.name}"...`, 'info');
    const success = await exportFolderToZip(folder.id, folder.name, (current, total, name) => {
      showToast(`Exporting ${name} (${current}/${total})...`, 'info');
    });
    if (success) {
      showToast(`Exported ${folder.name}.zip`, 'success');
    } else {
      showToast(`Folder has no valid slides to export`, 'error');
    }
  };

  const handleMoveProject = (projectId: string, folderId: string | null) => {
    moveProjectToFolder(projectId, folderId);
    setMenuId(null);
    reload();
    showToast(folderId ? 'Moved to folder' : 'Moved to Uncategorised', 'success');
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
      [...ids].reverse().forEach((id) => duplicateProject(id));
      clearSelection();
      reload();
    },
    [clearSelection, reload]
  );

  const kitsInUse = useMemo(() => {
    const seen = new Map<string, DeckTheme>();
    for (const p of projects) {
      const t = themeOf(p);
      if (!seen.has(t.id)) seen.set(t.id, t);
    }
    return [...seen.values()];
  }, [projects, themeOf]);

  const activeFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId) ?? null,
    [folders, activeFolderId]
  );

  /**
   * The decks this screen is about.
   *
   * Inside a folder: that folder's decks. On the library itself: the ones that are
   * in no folder at all.
   *
   * That second half is what makes a folder mean something. Before this, filing a
   * deck away left it sitting in the library list as well, so the list only ever
   * grew and moving a deck into a folder tidied nothing - it just added a second
   * place the same deck appeared. A deck is either filed or it is not, and the
   * library is the "not" pile.
   *
   * The hero reads from this list too, so it follows the same rule without a
   * second decision: the deck offered to resume is the most recent *uncategorised*
   * one, and a filed deck is reached through its folder.
   */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      const folder = p.folderId ?? null;
      if (activeFolderId !== null) {
        // Inside a folder the folder is the scope, search included. You opened it
        // to narrow things down; a search that then left it would undo that.
        if (folder !== activeFolderId) return false;
      } else if (folder !== null && !q) {
        // Browsing the library: filed decks are not here, they are in their
        // folder. Searching it: everything, filed or not - the whole point of a
        // search field is that you do not have to remember where you put it.
        return false;
      }
      if (kitFilter && themeOf(p).id !== kitFilter) return false;
      return !q || p.name.toLowerCase().includes(q);
    });
  }, [projects, query, kitFilter, themeOf, activeFolderId]);

  /** Folder name and colour by id, for marking search results that are filed. */
  const folderById = useMemo(
    () => new Map(folders.map((f) => [f.id, f])),
    [folders]
  );

  /** The one search field covers folders too, not just decks - a second box
   *  just for folders would be one more place to look, for a shelf that's
   *  right next to the decks the first box already searches. */
  const visibleFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, query]);

  /** True when the list on screen may contain decks from folders, so a result
   *  needs to say where it lives or it looks like filing did nothing. */
  const showFolderOrigin = activeFolderId === null && query.trim().length > 0;

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [query, kitFilter, activeFolderId]);

  useEffect(() => setPage(1), [sort, pageSize, homeView, activeFolderId]);

  const isFolderView = activeFolderId !== null;
  /**
   * What is actually on screen.
   *
   * A folder is always a grid: the table's columns are about locating a deck among
   * many (client, slides, edited), and a folder is already the answer to "which
   * ones". So there is no view control inside one, and the library's own
   * preference is left exactly as the user set it for when they come back out.
   */
  const view: View = isFolderView ? 'grid' : homeView;
  const hero = isFolderView ? null : (filtered[0] ?? null);
  const rest = isFolderView ? filtered : filtered.slice(1);

  const pageCount = Math.max(1, Math.ceil(rest.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const groups = useMemo(
    () => groupByAge(rest.slice((page - 1) * pageSize, page * pageSize)),
    [rest, page, pageSize]
  );

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
      if (d === 0) d = a.updatedAt - b.updatedAt;
      return sort.dir === 'asc' ? d : -d;
    });
    return arr.slice((page - 1) * pageSize, page * pageSize);
  }, [rest, sort, themeOf, page, pageSize]);

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

  const menuFor = (p: ProjectSummary) =>
    menuId === p.id ? (
      <DeckMenu
        onRename={() => { setMenuId(null); setRenamingId(p.id); setDraftName(p.name); }}
        onDuplicate={() => { duplicateProject(p.id); setMenuId(null); reload(); }}
        onDelete={() => { setMenuId(null); setPendingDeleteId(p.id); }}
        onMoveToFolder={(folderId) => handleMoveProject(p.id, folderId)}
        folders={folders}
        currentFolderId={p.folderId}
      />
    ) : null;

  /** The folder card's overflow menu - shared between the icon grid and the
   *  list fallback, so the two only ever have one set of actions to keep in sync. */
  const folderDropdown = (f: FolderMeta) => (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-[calc(100%+4px)] z-30 w-44 py-1 bg-white border border-neutral-200 rounded-[var(--radius-sharp)] shadow-xl text-left"
    >
      <button
        onClick={() => { setFolderMenuId(null); navigateToFolder(f.id); }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-100 text-left"
      >
        <FolderOpenOutlineIcon size={14} />
        Open Folder
      </button>
      <button
        onClick={() => { setFolderMenuId(null); void handleExportZip(f); }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-50 text-left"
      >
        <DownloadIcon size={14} />
        Export as ZIP (.zip)
      </button>
      <button
        onClick={() => { setFolderMenuId(null); setEditingFolder(f); setFolderModalOpen(true); }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-100 text-left"
      >
        <CreateIcon size={14} />
        Rename / Recolor
      </button>
      <div className="my-1 h-px bg-neutral-200" />
      <button
        onClick={() => { setFolderMenuId(null); handleDeleteFolder(f); }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] font-semibold text-rose-600 hover:bg-rose-50 text-left"
      >
        <TrashIcon size={14} />
        Delete Folder
      </button>
    </div>
  );

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
    <div className="min-h-screen bg-[var(--stage-bg)] text-neutral-900 selection:bg-emerald-500 selection:text-white pb-24">
      {/* ── App Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-[56px] max-w-[1220px] items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <img src={logoBlack} alt="Wozku Studio" className="h-6 w-auto" />
            <span className="font-mono text-[11px] font-bold tracking-[0.16em] uppercase text-neutral-400">
              Studio
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64 sm:w-72">
              <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400">
                <SearchIcon size={14} />
              </span>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={activeFolder ? `Search folder (${MOD_KEY}K)` : `Search decks (${MOD_KEY}K)`}
                className="w-full h-[34px] pl-9 pr-3 text-[12.5px] bg-neutral-100/70 border border-neutral-200 rounded-[var(--radius-sharp)] focus:bg-white focus:border-emerald-500 outline-none transition-colors"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute inset-y-0 right-2 flex items-center text-neutral-400 hover:text-neutral-700"
                >
                  &times;
                </button>
              )}
            </div>

            <HelpMenu onOpenShortcuts={() => setShortcutsOpen(true)} />

            <button
              onClick={() => { setEditingFolder(null); setFolderModalOpen(true); }}
              className="flex items-center gap-1.5 h-[34px] px-3.5 text-[12.5px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-[var(--radius-sharp)] transition-colors cursor-pointer whitespace-nowrap"
            >
              <FolderIcon size={14} />
              New Folder
            </button>

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

      <main className="relative z-[1] mx-auto max-w-[1220px] px-8 pt-6">
        {/* ── Active Folder Directory Banner & Navigation ── */}
        {activeFolder && (
          <div className="mb-8">
            <div className="flex items-center justify-between pb-4 pt-2 border-b border-neutral-200/60 mb-6">
              <div className="flex items-center gap-3">
                {/* Prominent Back Button */}
                <button
                  onClick={() => navigateToFolder(null)}
                  className="flex items-center gap-1.5 px-3 h-9 bg-white border border-neutral-200 hover:border-neutral-400 rounded-[var(--radius-sharp)] text-[12.5px] font-bold text-neutral-800 transition-all cursor-pointer"
                  title="Return to homepage"
                >
                  <ArrowBackNavIcon size={15} />
                  Back
                </button>

                {/* Interactive Breadcrumb */}
                <div className="flex items-center gap-2 px-3 h-9 bg-white border border-neutral-200 rounded-[var(--radius-sharp)]">
                  <button
                    onClick={() => navigateToFolder(null)}
                    className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                  >
                    Decks
                  </button>
                  <span className="text-[12px] text-neutral-300">/</span>
                  <span className="text-[13px] font-bold text-neutral-900">{activeFolder.name}</span>
                  <span className="text-[11px] font-mono font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-[var(--radius-sharp)]">
                    {filtered.length} {filtered.length === 1 ? 'Deck' : 'Decks'}
                  </span>
                </div>
              </div>

              {/* Folder Header Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMoveDecksModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 h-9 text-[12.5px] font-bold text-neutral-800 bg-white border border-neutral-200 hover:border-neutral-400 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
                >
                  <FolderIcon size={14} />
                  Add existing decks
                </button>

                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setFolderHeaderMenuOpen((v) => !v); }}
                    className={`w-9 h-9 flex items-center justify-center rounded-[var(--radius-sharp)] transition-colors cursor-pointer ${
                      folderHeaderMenuOpen
                        ? 'bg-emerald-100 border border-emerald-300 text-emerald-700'
                        : 'bg-white border border-neutral-200 hover:border-neutral-400 text-neutral-700'
                    }`}
                    title="Folder options"
                  >
                    <EllipsisIcon size={16} />
                  </button>

                  {folderHeaderMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-[calc(100%+4px)] z-40 w-48 py-1 bg-white border border-neutral-200 shadow-xl rounded-[var(--radius-sharp)] text-left"
                    >
                      <button
                        onClick={() => { setFolderHeaderMenuOpen(false); handleExportZip(activeFolder); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-100 text-left cursor-pointer transition-colors"
                      >
                        <DownloadIcon size={15} />
                        Export Folder (.zip)
                      </button>
                      <button
                        onClick={() => { setFolderHeaderMenuOpen(false); setEditingFolder(activeFolder); setFolderModalOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-100 text-left cursor-pointer transition-colors"
                      >
                        <CreateIcon size={15} />
                        Rename / Recolor
                      </button>
                      <div className="my-1 h-px bg-neutral-200" />
                      <button
                        onClick={() => { setFolderHeaderMenuOpen(false); handleDeleteFolder(activeFolder); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium text-rose-600 hover:bg-rose-50 text-left cursor-pointer transition-colors"
                      >
                        <TrashIcon size={15} />
                        Delete Folder
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Folder Directory Header (No white card container) */}
            <div className="flex items-center justify-between gap-6 py-2">
              <div className="flex items-center gap-4">
                <MacFolderIcon
                  color={activeFolder.color}
                  isEmpty={filtered.length === 0}
                  size="sm"
                />

                <div>
                  <h2 className="text-[22px] font-bold tracking-[-0.02em] text-neutral-900" style={{ fontFamily: 'var(--font-display)' }}>
                    {activeFolder.name}
                  </h2>
                  <p className="text-[12.5px] text-neutral-400 mt-0.5">
                    Folder Directory • Total {filtered.length} {filtered.length === 1 ? 'deck' : 'decks'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* ── Main Decks Area ───────────────────────────────────────────── */}
        {loading ? (
          <LibrarySkeleton />
        ) : projects.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col lg:flex-row items-center gap-14 py-20">
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
                back on brand.
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
            {/* Client Filter (Only show on root homepage, not inside folders) */}
            {activeFolderId === null && kitsInUse.length > 1 && (
              <div className="flex items-center gap-2 pt-2 flex-wrap mb-4">
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
              activeFolderId ? (
                <div className="py-20 flex flex-col items-center justify-center text-center max-w-[460px] mx-auto">
                  <div className="mb-6 scale-110">
                    <MacFolderIcon color={activeFolder?.color ?? 'blue'} isEmpty={true} size="lg" />
                  </div>
                  <h3 className="text-[20px] font-bold text-neutral-900 mb-2">
                    This folder is empty
                  </h3>
                  <p className="text-[13px] text-neutral-500 mb-8 leading-relaxed">
                    Decks you create or move into <span className="font-semibold text-neutral-800">"{activeFolder?.name}"</span> will appear here.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNewDeckOpen(true)}
                      className="flex items-center gap-2 h-[42px] px-6 text-[13px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
                    >
                      <AddIcon size={16} />
                      Create a deck in this folder
                    </button>
                    <button
                      onClick={() => setMoveDecksModalOpen(true)}
                      className="flex items-center gap-2 h-[42px] px-5 text-[13px] font-bold text-neutral-800 bg-white border border-neutral-200 hover:border-neutral-400 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
                    >
                      <FolderIcon size={15} />
                      Add existing decks
                    </button>
                  </div>
                  <p className="text-[11.5px] text-neutral-400 mt-6 font-medium">
                    Tip: You can also move existing decks into this folder using the <span className="font-semibold text-neutral-600">(•••)</span> context menu on any deck.
                  </p>
                </div>
              ) : (
                <div className="py-16 text-center flex flex-col items-center gap-3">
                  <p className="text-[14px] font-bold text-neutral-800">
                    {query.trim()
                      ? `Nothing matches “${query.trim()}”.`
                      : 'No decks found.'}
                  </p>
                  <button
                    onClick={() => { setQuery(''); setKitFilter(null); }}
                    className="h-[32px] px-3.5 text-[12px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:border-neutral-400 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
                  >
                    Clear filters
                  </button>
                </div>
              )
            ) : (
              <>
                {/* Hero Deck */}
                {hero && (
                  <section className="flex flex-col lg:flex-row gap-10 lg:gap-14 pt-2 pb-12">
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

                {/* ── High-Fidelity SVG Folders Section (below Hero deck, above Everything Else) ── */}
                {activeFolderId === null && visibleFolders.length > 0 && (
                  <section className="mb-10 pt-4 border-t border-neutral-200/60">
                    <div className="flex items-center justify-between mb-4">
                      <Eyebrow>Folders ({visibleFolders.length})</Eyebrow>
                      <div className="flex items-center gap-2">
                        {/* Pinch (Ctrl/Cmd+scroll on a trackpad reaches the DOM as a
                            wheel event with ctrlKey set) resizes the icons directly
                            on the shelf; these are the same control for anyone
                            without a trackpad, and the only way to discover it at all. */}
                        <div className="flex items-center h-8 border border-neutral-200 bg-white">
                          <button
                            onClick={() => adjustFolderZoom(-16)}
                            aria-label={folderListView ? 'Already at the smallest size (list)' : 'Smaller folder icons'}
                            title={folderListView ? 'Already at the smallest size' : 'Smaller folder icons'}
                            aria-pressed={folderListView}
                            className={`w-8 h-full flex items-center justify-center transition-colors cursor-pointer ${
                              folderListView ? 'text-emerald-700 bg-emerald-50' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                            }`}
                          >
                            <ZoomOutIcon size={13} />
                          </button>
                          <span className="w-px h-4 bg-neutral-200" />
                          <button
                            onClick={() => adjustFolderZoom(16)}
                            aria-label="Larger folder icons"
                            title="Larger folder icons"
                            className="w-8 h-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                          >
                            <ZoomInIcon size={13} />
                          </button>
                        </div>
                        <button
                          onClick={() => { setEditingFolder(null); setFolderModalOpen(true); }}
                          className="flex items-center gap-2 px-3.5 h-8 bg-white border border-neutral-200 hover:border-neutral-300 rounded-[var(--radius-sharp)] text-[12px] font-bold text-neutral-800 transition-all cursor-pointer"
                        >
                          <FolderIcon size={14} />
                          New Folder
                        </button>
                      </div>
                    </div>

                    {/* Capped rather than left to grow with the folder count: past a
                        couple of rows the shelf would start pushing the actual decks
                        further down the page every time someone made a new folder,
                        which is the one thing a shelf of folders should never do to
                        the thing it's sitting on top of. Scrolls internally instead. */}
                    <div
                      ref={folderShelfRef}
                      className="bg-white border border-neutral-200 rounded-[var(--radius-sharp)] p-5 overflow-y-auto"
                      style={{ maxHeight: FOLDER_SHELF_MAX_HEIGHT }}
                      onClick={() => setFolderMenuId(null)}
                    >
                    {folderListView ? (
                      <div className="flex flex-col">
                        <div className="grid grid-cols-[1fr_130px_90px_150px] items-center gap-3 px-2 pb-2 border-b border-neutral-200">
                          <span className="font-mono text-[9.5px] font-bold tracking-[0.14em] uppercase text-neutral-400">
                            Name
                          </span>
                          <span className="font-mono text-[9.5px] font-bold tracking-[0.14em] uppercase text-neutral-400">
                            Date created
                          </span>
                          <span className="font-mono text-[9.5px] font-bold tracking-[0.14em] uppercase text-neutral-400">
                            Decks
                          </span>
                          <span className="font-mono text-[9.5px] font-bold tracking-[0.14em] uppercase text-neutral-400">
                            Actions
                          </span>
                        </div>
                        <div className="flex flex-col divide-y divide-neutral-100">
                          {visibleFolders.map((f) => {
                            const deckCount = projects.filter((p) => p.folderId === f.id).length;
                            const isDragOver = dragOverFolderId === f.id;
                            const actionBtn =
                              'w-7 h-7 flex items-center justify-center rounded-[var(--radius-sharp)] transition-colors cursor-pointer';
                            return (
                              <div
                                key={f.id}
                                onClick={() => navigateToFolder(f.id)}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                  setDragOverFolderId(f.id);
                                }}
                                onDragLeave={() => setDragOverFolderId(null)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setDragOverFolderId(null);
                                  const deckId = e.dataTransfer.getData('text/plain');
                                  if (deckId) {
                                    moveProjectToFolder(deckId, f.id);
                                    reload();
                                    showToast(`Moved deck to "${f.name}"`);
                                  }
                                }}
                                className={`grid grid-cols-[1fr_130px_90px_150px] items-center gap-3 px-2 py-2 cursor-pointer transition-colors ${
                                  isDragOver ? 'bg-emerald-50' : 'hover:bg-neutral-50'
                                }`}
                              >
                                <span className="flex items-center gap-3 min-w-0">
                                  <MacFolderIcon color={f.color} isEmpty={deckCount === 0} sizePx={28} />
                                  <span className="truncate text-[13px] font-semibold text-neutral-900">
                                    {f.name}
                                  </span>
                                </span>
                                <span className="text-[12px] text-neutral-500">
                                  {relativeTime(f.createdAt)}
                                </span>
                                <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                                  {deckCount} {deckCount === 1 ? 'deck' : 'decks'}
                                </span>
                                <span className="flex items-center justify-start gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); navigateToFolder(f.id); }}
                                    title="Open Folder"
                                    aria-label={`Open folder "${f.name}"`}
                                    className={`${actionBtn} text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100`}
                                  >
                                    <FolderOpenOutlineIcon size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); void handleExportZip(f); }}
                                    title="Export as ZIP (.zip)"
                                    aria-label={`Export folder "${f.name}" as ZIP`}
                                    className={`${actionBtn} text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50`}
                                  >
                                    <DownloadIcon size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingFolder(f); setFolderModalOpen(true); }}
                                    title="Rename / Recolor"
                                    aria-label={`Rename folder "${f.name}"`}
                                    className={`${actionBtn} text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100`}
                                  >
                                    <CreateIcon size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f); }}
                                    title="Delete Folder"
                                    aria-label={`Delete folder "${f.name}"`}
                                    className={`${actionBtn} text-rose-500 hover:text-rose-700 hover:bg-rose-50`}
                                  >
                                    <TrashIcon size={14} />
                                  </button>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div
                        className="grid gap-4"
                        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${folderZoom}px, 1fr))` }}
                      >
                        {visibleFolders.map((f) => {
                          const deckCount = projects.filter((p) => p.folderId === f.id).length;
                          const isMenuOpen = folderMenuId === f.id;
                          const isHovered = hoveredFolderId === f.id;
                          const isDragOver = dragOverFolderId === f.id;
                          return (
                            <div
                              key={f.id}
                              onClick={() => navigateToFolder(f.id)}
                              onMouseEnter={() => setHoveredFolderId(f.id)}
                              onMouseLeave={() => setHoveredFolderId(null)}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                setDragOverFolderId(f.id);
                              }}
                              onDragLeave={() => setDragOverFolderId(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOverFolderId(null);
                                const deckId = e.dataTransfer.getData('text/plain');
                                if (deckId) {
                                  moveProjectToFolder(deckId, f.id);
                                  reload();
                                  showToast(`Moved deck to "${f.name}"`);
                                }
                              }}
                              className={`group relative flex flex-col items-center p-4 rounded-[var(--radius-sharp)] transition-all duration-200 cursor-pointer ${
                                isDragOver
                                  ? 'bg-emerald-50 border-2 border-emerald-500 scale-105 z-20'
                                  : 'border border-transparent'
                              }`}
                            >
                              {/* Header row, reserved regardless of icon size - the "..." lives
                                  here rather than absolutely pinned over the icon, so it can
                                  never end up sitting on top of it once the icon shrinks below
                                  the space that corner used to have free. */}
                              <div className="w-full h-6 flex justify-end mb-2">
                                <span className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFolderMenuId(isMenuOpen ? null : f.id);
                                    }}
                                    className={`w-6 h-6 flex items-center justify-center rounded-[var(--radius-sharp)] transition-colors ${
                                      isMenuOpen
                                        ? 'text-emerald-700 bg-emerald-100'
                                        : 'text-neutral-400 hover:text-neutral-900 bg-transparent hover:bg-neutral-100'
                                    }`}
                                  >
                                    <EllipsisIcon size={14} />
                                  </button>
                                  {isMenuOpen && folderDropdown(f)}
                                </span>
                              </div>

                              {/* SVG Animated Folder Icon with hover state & color swap */}
                              <div className="mb-3">
                                <MacFolderIcon
                                  color={f.color}
                                  isEmpty={deckCount === 0}
                                  isHovered={isHovered}
                                  sizePx={folderZoom}
                                />
                              </div>

                              {/* Folder Title & Count */}
                              <div className="text-center w-full min-w-0">
                                <h4 className="text-[14px] font-semibold text-neutral-900 truncate">
                                  {f.name}
                                </h4>
                                <p className="text-[12px] font-medium text-neutral-400">
                                  {deckCount} {deckCount === 1 ? 'deck' : 'decks'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    </div>
                  </section>
                )}

                {/* Every deck is filed. A state this screen could not reach until
                    filed decks stopped appearing here as well, and one worth
                    naming: folders above and nothing below reads like something
                    failed to load rather than like a tidy library. */}
                {!isFolderView && rest.length === 0 && !hero && folders.length > 0 && !query && (
                  <section className="pb-20">
                    <div className="flex items-baseline gap-3 pb-3">
                      <Eyebrow>Uncategorised</Eyebrow>
                      <span className="font-mono text-[10.5px] text-neutral-400 tabular-nums">00</span>
                    </div>
                    <div className="border border-neutral-200 bg-white/70 px-5 py-8 text-center">
                      <p className="text-[13px] font-bold text-neutral-700">
                        Every deck is in a folder
                      </p>
                      <p className="mt-1 text-[12px] text-neutral-500">
                        New decks land here until you file them.
                      </p>
                    </div>
                  </section>
                )}

                {/* Index / Directory Table */}
                {rest.length > 0 && (
                  <section className="pb-20">
                    {!isFolderView && (
                      <div className="flex items-center justify-between gap-4 pb-3">
                        <div className="flex items-baseline gap-3">
                          <Eyebrow>{showFolderOrigin ? 'Results' : 'Uncategorised'}</Eyebrow>
                          <span className="font-mono text-[10.5px] text-neutral-400 tabular-nums">
                            {String(rest.length).padStart(2, '0')}
                          </span>
                        </div>

                        <div className="flex items-center border border-neutral-200 bg-white/70">
                          {[
                            { id: 'table' as View, label: 'Table', icon: <TableIcon size={13} /> },
                            { id: 'grid' as View, label: 'Grid', icon: <GripIcon size={13} /> },
                          ].map((v) => (
                            <button
                              key={v.id}
                              onClick={() => setHomeView(v.id)}
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
                    )}

                    {!isFolderView && view === 'table' ? (
                      <DeckTable
                        rows={sortedShown}
                        showFolderOrigin={showFolderOrigin}
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
                        onToggleAll={() => {
                          if (selected.size === sortedShown.length) clearSelection();
                          else setSelected(new Set(sortedShown.map((r) => r.id)));
                        }}
                        onClearSelection={clearSelection}
                        onBulkDuplicate={() => duplicateMany(Array.from(selected))}
                        onBulkDelete={() => setBulkDeleteOpen(true)}
                        folders={folders}
                        onBulkMoveToFolder={handleBulkMoveToFolder}
                        onMoveToFolder={(projectId, targetFolderId) => {
                          moveProjectToFolder(projectId, targetFolderId);
                          reload();
                          const targetName = folders.find((f) => f.id === targetFolderId)?.name ?? 'Main Library';
                          showToast(`Moved deck to ${targetName}`);
                        }}
                        onOpen={open}
                        onPresent={(id) => setPresentId(id)}
                        onDuplicate={(id) => { duplicateProject(id); reload(); }}
                        onDelete={(id) => setPendingDeleteId(id)}
                        renderName={nameField}
                      />
                    ) : (
                      <div>
                        {groups.map((group) => (
                          <div key={group.label} className="mb-8">
                            <div className="pb-2 border-b border-neutral-200/80 mb-4">
                              <Eyebrow>{group.label}</Eyebrow>
                            </div>
                            <div className={`grid ${isFolderView ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'}`}>
                              {group.items.map((p) => {
                                const slides = p.deck?.slides.filter((s) => !s.hidden) ?? [];
                                const theme = themeOf(p);
                                return (
                                  <div
                                    key={p.id}
                                    onClick={() => open(p.id)}
                                    draggable={true}
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/plain', p.id);
                                      e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    className={`group relative bg-white border border-neutral-200 hover:border-neutral-400 ${isFolderView ? 'p-3' : 'p-4'} transition-all cursor-grab active:cursor-grabbing flex flex-col justify-between`}
                                  >
                                    <div>
                                      <div className="w-full aspect-[16/9] bg-neutral-100 mb-3 overflow-hidden border border-neutral-200">
                                        {slides[0] ? (
                                          <FitStage
                                            slide={slides[0]}
                                            ast={null}
                                            num="01"
                                            logoUrl={p.deck?.logoUrl}
                                            theme={theme}
                                          />
                                        ) : (
                                          <span className="flex items-center justify-center w-full h-full text-[11px] text-neutral-400">
                                            Empty deck
                                          </span>
                                        )}
                                      </div>
                                      <div className={`font-bold ${isFolderView ? 'text-[13.5px]' : 'text-[15px]'} text-neutral-900 mb-1`}>
                                        {nameField(p, `font-bold ${isFolderView ? 'text-[13.5px]' : 'text-[15px]'} text-neutral-900`)}
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-neutral-150 text-[11px] text-neutral-500">
                                      <span className="flex items-center gap-1.5 min-w-0">
                                        <KitChip theme={theme} />
                                        {/* Where the deck actually lives, on a
                                            library search that reached into
                                            folders. */}
                                        {showFolderOrigin && p.folderId && folderById.get(p.folderId) && (
                                          <FolderChip folder={folderById.get(p.folderId)!} />
                                        )}
                                      </span>
                                      <span className="relative">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }}
                                          className={`p-1 rounded-[var(--radius-sharp)] transition-colors ${
                                            menuId === p.id
                                              ? 'text-emerald-700 bg-emerald-100'
                                              : 'text-neutral-400 hover:text-neutral-700'
                                          }`}
                                        >
                                          <EllipsisIcon size={14} />
                                        </button>
                                        {menuFor(p)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

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

      {/* Modals */}
      <NewDeckModal
        open={newDeckOpen}
        onClose={() => setNewDeckOpen(false)}
        onCreate={createDeck}
      />

      {/* Folder Modal */}
      <FolderModal
        open={folderModalOpen}
        onClose={() => { setFolderModalOpen(false); setEditingFolder(null); }}
        folderToEdit={editingFolder}
        onSave={handleCreateOrUpdateFolder}
      />

      {/* Move Decks to Folder Modal */}
      {activeFolder && (
        <MoveDecksToFolderModal
          isOpen={moveDecksModalOpen}
          onClose={() => setMoveDecksModalOpen(false)}
          folder={activeFolder}
          allProjects={projects}
          onSuccess={() => reload()}
        />
      )}

      <DeleteFolderModal
        open={!!deletingFolder}
        folder={deletingFolder}
        deckCount={deletingFolder ? projects.filter((p) => p.folderId === deletingFolder.id).length : 0}
        onCancel={() => setDeletingFolder(null)}
        onKeepDecks={confirmDeleteFolderKeepDecks}
        onDeleteDecks={confirmDeleteFolderWithDecks}
      />

      <ConfirmModal
        open={!!pendingDelete}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        message={cannotBeUndone('All slides and edits in this deck will be lost.')}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) deleteMany([pendingDeleteId]);
          setPendingDeleteId(null);
        }}
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        title={`Delete ${selected.size} deck${selected.size === 1 ? '' : 's'}?`}
        message={cannotBeUndone('All slides and edits in these decks will be lost.')}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => {
          deleteMany(Array.from(selected));
          setBulkDeleteOpen(false);
        }}
      />

      <KeyboardShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {presenting && presenting.deck && (
        <PresentMode
          open={!!presenting}
          onClose={() => setPresentId(null)}
          deck={presenting.deck}
          ast={null}
          theme={themeOf(presenting)}
          startIndex={0}
        />
      )}

      <DevPanel loading={loading} onSetLoading={setLoading} onDataChanged={reload} deckCount={projects.length} />
      <ScrollToTop />
    </div>
  );
}
