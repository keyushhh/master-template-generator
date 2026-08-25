import { useEffect, useRef, useState } from 'react';
import {
  listFolders,
  createFolder,
  moveProjectToFolder,
  type FolderColor,
  type FolderMeta,
  type ProjectMeta,
} from '../deck/deckStore';
import {
  AddIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  CopyIcon,
  CreateIcon,
  DownloadIcon,
  FolderIcon,
  HistoryIcon,
  LightningIcon,
  RefreshIcon,
  ShareIcon,
  TrashIcon,
} from '../ui/icons';

const FOLDER_COLORS: { id: FolderColor; name: string; bg: string }[] = [
  { id: 'orange', name: 'Orange', bg: '#f97316' },
  { id: 'amber', name: 'Amber', bg: '#f59e0b' },
  { id: 'purple', name: 'Purple', bg: '#a855f7' },
  { id: 'blue', name: 'Blue', bg: '#3b82f6' },
  { id: 'emerald', name: 'Emerald', bg: '#10b981' },
  { id: 'rose', name: 'Rose', bg: '#f43f5e' },
  { id: 'indigo', name: 'Indigo', bg: '#6366f1' },
  { id: 'slate', name: 'Slate', bg: '#64748b' },
];

function KbdBadge({ shortcut }: { shortcut: string }) {
  if (shortcut === '⇧⌘E') {
    return (
      <span className="font-mono text-[11px] text-neutral-400 font-medium inline-flex items-center gap-[1.5px] select-none">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        <span className="text-[12px] leading-none -mt-[0.5px]">⌘</span>
        <span className="text-[11px] leading-none font-sans font-bold">E</span>
      </span>
    );
  }
  return <span className="font-mono text-[10.5px] text-neutral-400">{shortcut}</span>;
}

interface FileMenuProps {
  projects: ProjectMeta[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate?: () => void;
  onOpenHistory?: () => void;
  onOpenActivity?: () => void;
  onOpenShare?: () => void;
  onOpenExport?: () => void;
  onReset?: () => void;
  canReset?: boolean;
  onTriggerRenameActive?: () => void;
  isEditMode?: boolean;
  isDirty?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  variant?: 'sidebar' | 'header';
}

export function DeckSwitcher({
  projects,
  activeId,
  onNew,
  onRename,
  onDelete,
  onDuplicate,
  onOpenHistory,
  onOpenActivity,
  onOpenShare,
  onOpenExport,
  onReset,
  canReset = false,
  onTriggerRenameActive,
  isEditMode = false,
  isDirty = false,
  onSave,
  onDiscard,
  variant = 'header',
}: FileMenuProps) {
  const [open, setOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState<FolderColor>('blue');
  const [folders, setFolders] = useState<FolderMeta[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const pendingDelete = projects.find((p) => p.id === pendingDeleteId) ?? null;
  const active = projects.find((p) => p.id === activeId) ?? null;

  // Sync folders list when opening move modal
  useEffect(() => {
    if (moveModalOpen) {
      const currentFolders = listFolders();
      setFolders(currentFolders);
      if (currentFolders.length === 0) {
        setCreatingFolder(true);
      } else {
        setCreatingFolder(false);
      }
      setNewFolderName('');
      setNewFolderColor('blue');
      setTimeout(() => folderInputRef.current?.focus(), 80);
    }
  }, [moveModalOpen]);

  // Close File Menu on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleMoveToExistingFolder = (folderId: string | null) => {
    if (!activeId) return;
    moveProjectToFolder(activeId, folderId);
    setMoveModalOpen(false);
  };

  const handleCreateAndMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId) return;
    const clean = newFolderName.trim() || 'New Folder';
    const folder = createFolder(clean, newFolderColor);
    moveProjectToFolder(activeId, folder.id);
    setMoveModalOpen(false);
  };

  const isHeader = variant === 'header';

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      {isHeader ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="File menu & options"
          aria-label="File menu"
          aria-expanded={open}
          className={`flex items-center justify-center w-[22px] h-[22px] rounded-none transition-colors cursor-pointer ${
            open
              ? 'bg-neutral-200 text-neutral-900'
              : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <span
            style={{
              display: 'flex',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform .15s',
            }}
          >
            <ChevronDownIcon size={13} />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 h-[36px] px-3 rounded-none border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors cursor-pointer text-left"
        >
          <span className="truncate text-[13px] font-bold text-neutral-800">
            {active?.name ?? 'Untitled deck'}
          </span>
          <span
            style={{
              display: 'flex',
              color: '#9ca3af',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform .15s',
            }}
          >
            <ChevronDownIcon size={14} />
          </span>
        </button>
      )}

      {/* Figma-Style Categorized File Menu Dropdown */}
      {open && (
        <div
          className="absolute top-[calc(100%+6px)] left-0 z-[200] w-[260px] bg-white border border-neutral-200/90 rounded-none shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {/* ── Category 1: Document Actions ── */}
          <button
            type="button"
            onClick={() => {
              onNew();
              setOpen(false);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
          >
            <span className="flex items-center gap-2.5">
              <AddIcon size={14} />
              <span>New deck</span>
            </span>
            <span className="font-mono text-[10.5px] text-neutral-400">⌘N</span>
          </button>

          {onDuplicate && (
            <button
              type="button"
              onClick={() => {
                onDuplicate();
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center gap-2.5">
                <CopyIcon size={14} />
                <span>Duplicate deck</span>
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onTriggerRenameActive?.();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
          >
            <span className="flex items-center gap-2.5">
              <CreateIcon size={14} />
              <span>Rename</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setMoveModalOpen(true);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
          >
            <span className="flex items-center gap-2.5">
              <FolderIcon size={14} />
              <span>Move to folder...</span>
            </span>
          </button>

          {/* ── Category 2: Changes & History ── */}
          <div className="my-1.5 border-t border-neutral-150" />

          {/* Edit Mode Save / Discard */}
          {isEditMode && (
            <>
              {onSave && (
                <button
                  type="button"
                  onClick={() => {
                    onSave();
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-bold transition-colors cursor-pointer text-left ${
                    isDirty
                      ? 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/80'
                      : 'text-neutral-800 hover:bg-neutral-100'
                  }`}
                >
                  <span>Save changes</span>
                  <span className="font-mono text-[10.5px] text-neutral-400">⌘S</span>
                </button>
              )}
              {onDiscard && (
                <button
                  type="button"
                  onClick={() => {
                    onDiscard();
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
                >
                  <span>Discard edits</span>
                </button>
              )}
            </>
          )}

          {onOpenHistory && (
            <button
              type="button"
              onClick={() => {
                onOpenHistory();
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center gap-2.5">
                <HistoryIcon size={14} />
                <span>Show version history</span>
              </span>
            </button>
          )}

          {onOpenActivity && (
            <button
              type="button"
              onClick={() => {
                onOpenActivity();
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center gap-2.5">
                <LightningIcon size={14} />
                <span>Deck activity stream</span>
              </span>
            </button>
          )}

          {/* ── Category 3: Export & Sharing ── */}
          <div className="my-1.5 border-t border-neutral-150" />

          {onOpenExport && (
            <button
              type="button"
              onClick={() => {
                onOpenExport();
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center gap-2.5">
                <DownloadIcon size={14} />
                <span>Export deck...</span>
              </span>
              <KbdBadge shortcut="⇧⌘E" />
            </button>
          )}

          {onOpenShare && (
            <button
              type="button"
              onClick={() => {
                onOpenShare();
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center gap-2.5">
                <ShareIcon size={14} />
                <span>Share & permissions...</span>
              </span>
            </button>
          )}

          {/* ── Category 4: Maintenance & Danger ── */}
          <div className="my-1.5 border-t border-neutral-150" />

          {onReset && (
            <button
              type="button"
              disabled={!canReset}
              onClick={() => {
                onReset();
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium transition-colors text-left ${
                canReset
                  ? 'text-neutral-800 hover:bg-neutral-100 cursor-pointer'
                  : 'text-neutral-400 opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <RefreshIcon size={14} />
                <span>Reset to baseline</span>
              </span>
            </button>
          )}

          {active && (
            <button
              type="button"
              onClick={() => {
                setPendingDeleteId(active.id);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center gap-2.5">
                <TrashIcon size={14} />
                <span>Delete deck...</span>
              </span>
            </button>
          )}
        </div>
      )}

      {/* Move to Folder Modal */}
      {moveModalOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 animate-in fade-in duration-100 p-4"
          onMouseDown={() => setMoveModalOpen(false)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] bg-white rounded-none border border-neutral-300 shadow-2xl p-5"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-150">
              <div>
                <h3 className="text-[14px] font-bold text-neutral-900">Move to Folder</h3>
                <p className="text-[11.5px] text-neutral-500 truncate max-w-[300px]">
                  {active?.name ?? 'Untitled deck'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-900 rounded-none cursor-pointer"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            {/* Modal Content */}
            {!creatingFolder ? (
              <div className="py-3">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Select destination
                </div>
                <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1">
                  {/* Root / Uncategorized Option */}
                  <button
                    type="button"
                    onClick={() => handleMoveToExistingFolder(null)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-[12.5px] rounded-none border transition-colors cursor-pointer ${
                      !active?.folderId
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                        : 'border-neutral-200 hover:bg-neutral-50 text-neutral-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FolderIcon size={14} />
                      <span>Main Library (No Folder)</span>
                    </span>
                    {!active?.folderId && (
                      <span className="text-emerald-600">
                        <CheckIcon size={14} />
                      </span>
                    )}
                  </button>

                  {/* Folders List */}
                  {folders.map((f) => {
                    const isSelected = active?.folderId === f.id;
                    const colorMeta =
                      FOLDER_COLORS.find((c) => c.id === f.color) ?? FOLDER_COLORS[0];
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleMoveToExistingFolder(f.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-[12.5px] rounded-none border transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                            : 'border-neutral-200 hover:bg-neutral-50 text-neutral-800'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-none shrink-0"
                            style={{ backgroundColor: colorMeta.bg }}
                          />
                          <span className="truncate">{f.name}</span>
                        </span>
                        {isSelected && (
                          <span className="text-emerald-600 shrink-0">
                            <CheckIcon size={14} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-150 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setCreatingFolder(true)}
                    className="flex items-center gap-1.5 text-[12px] font-bold text-neutral-800 hover:text-neutral-950 cursor-pointer"
                  >
                    <AddIcon size={13} />
                    <span>New folder</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveModalOpen(false)}
                    className="h-8 px-4 text-[12px] font-bold text-neutral-700 rounded-none border border-neutral-300 hover:bg-neutral-100 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateAndMove} className="py-3 space-y-4">
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Folder Name
                  </label>
                  <input
                    ref={folderInputRef}
                    required
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g. Q3 Strategy, Pitch Decks"
                    className="w-full h-9 px-3 text-[13px] border border-neutral-300 rounded-none outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Color Accent
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {FOLDER_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNewFolderColor(c.id)}
                        className={`w-7 h-7 rounded-none flex items-center justify-center border transition-all cursor-pointer ${
                          newFolderColor === c.id
                            ? 'border-neutral-900 scale-110 shadow-xs'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.bg }}
                        title={c.name}
                      >
                        {newFolderColor === c.id && (
                          <span className="text-white">
                            <CheckIcon size={12} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-150 flex justify-end gap-2">
                  {folders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCreatingFolder(false)}
                      className="h-8 px-3.5 text-[12px] font-bold text-neutral-700 rounded-none border border-neutral-300 hover:bg-neutral-100 cursor-pointer"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="submit"
                    className="h-8 px-4 text-[12px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-none cursor-pointer"
                  >
                    Create & Move
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deck Deletion */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 animate-in fade-in duration-100"
          onMouseDown={() => setPendingDeleteId(null)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-[360px] bg-white rounded-none border border-neutral-300 shadow-2xl p-5"
          >
            <h3 className="text-[14.5px] font-bold text-neutral-900">
              Delete "{pendingDelete.name}"?
            </h3>
            <p className="mt-2 text-[12.5px] text-neutral-600 leading-relaxed">
              This action cannot be undone. All slides, notes, and collaborator history in this deck will be permanently deleted.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="h-8 px-3.5 text-[12px] font-bold text-neutral-700 rounded-none border border-neutral-300 hover:bg-neutral-100 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(pendingDelete.id);
                  setPendingDeleteId(null);
                }}
                className="h-8 px-3.5 text-[12px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-none border border-red-700 cursor-pointer transition-colors"
              >
                Delete Deck
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
