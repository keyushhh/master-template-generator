import { useState, useMemo } from 'react';
import type { ProjectSummary, FolderMeta } from './deckStore';
import { moveProjectsToFolder } from './deckStore';
import { AddIcon, CheckIcon, FolderIcon, SearchIcon } from '../ui/icons';
import { FitStage } from '../generator/FitStage';
import { brandKitThemes, listBrandKits } from '../theme/brandKitStore';
import { themeById } from '../theme/deckTheme';

interface MoveDecksToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: FolderMeta;
  allProjects: ProjectSummary[];
  onSuccess: () => void;
}

export function MoveDecksToFolderModal({
  isOpen,
  onClose,
  folder,
  allProjects,
  onSuccess,
}: MoveDecksToFolderModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    allProjects.filter((p) => p.folderId === folder.id).forEach((p) => initial.add(p.id));
    return initial;
  });

  const brandKits = useMemo(() => listBrandKits(), []);
  const kitThemes = useMemo(() => brandKitThemes(brandKits), [brandKits]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allProjects;
    return allProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProjects, query]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    const currentInFolder = new Set(allProjects.filter((p) => p.folderId === folder.id).map((p) => p.id));
    const toAdd = Array.from(selectedIds).filter((id) => !currentInFolder.has(id));
    const toRemove = Array.from(currentInFolder).filter((id) => !selectedIds.has(id));

    if (toAdd.length > 0) {
      moveProjectsToFolder(toAdd, folder.id);
    }
    if (toRemove.length > 0) {
      moveProjectsToFolder(toRemove, null);
    }

    onSuccess();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] bg-white border border-neutral-200 rounded-[var(--radius-sharp)] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <FolderIcon size={18} />
            <h3 className="text-[15px] font-bold text-neutral-900">
              Add decks to "{folder.name}"
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-neutral-200 bg-white">
          <div className="relative w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search decks to add..."
              className="w-full h-9 pl-9 pr-3 text-[13px] bg-neutral-100/70 border border-neutral-200 rounded-[var(--radius-sharp)] focus:bg-white focus:border-neutral-900 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Deck List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[240px]">
          {filteredProjects.length === 0 ? (
            <div className="py-10 text-center text-[13px] font-semibold text-neutral-600">
              No decks found matching "{query}"
            </div>
          ) : (
            filteredProjects.map((p) => {
              const isChecked = selectedIds.has(p.id);
              const isAlreadyIn = p.folderId === folder.id;
              // Resolved the same way every other thumbnail resolves it. This
              // used to hand a raw BrandKit to a prop expecting a DeckTheme, and
              // fell back to the first kit in the list - so a deck on the house
              // look was drawn in whichever client happened to be created first.
              const theme = themeById(p.deck?.themeId, kitThemes);
              const cover = p.deck?.slides.find((s) => !s.hidden) ?? p.deck?.slides[0];

              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`flex items-center justify-between p-3 border rounded-[var(--radius-sharp)] transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-emerald-50/60 border-emerald-300'
                      : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-4 h-4 shrink-0 flex items-center justify-center border rounded-none transition-colors ${
                        isChecked
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-neutral-300'
                      }`}
                    >
                      {isChecked && <CheckIcon size={11} />}
                    </div>

                    {/* Cover Thumbnail */}
                    <span
                      className="shrink-0 block w-[54px] bg-white border border-neutral-200 overflow-hidden"
                      style={{ boxShadow: '0 0 0 1px var(--neutral-200)' }}
                    >
                      {cover ? (
                        <FitStage slide={cover} ast={null} num="01" logoUrl={p.deck?.logoUrl} theme={theme} />
                      ) : (
                        <span className="block w-full aspect-[16/9] bg-neutral-100" />
                      )}
                    </span>

                    <div className="min-w-0">
                      <h4 className="text-[13px] font-bold text-neutral-900 truncate">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-neutral-600 truncate">
                        {p.deck?.slides.length ?? 0} slides • {isAlreadyIn ? 'Currently in this folder' : p.folderId ? 'In another folder' : 'Main library'}
                      </p>
                    </div>
                  </div>

                  {isAlreadyIn && (
                    <span className="shrink-0 ml-2 text-[10.5px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-[var(--radius-sharp)]">
                      In folder
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-neutral-200 bg-neutral-50/50">
          <span className="text-[12px] font-semibold text-neutral-600">
            {selectedIds.size} {selectedIds.size === 1 ? 'deck' : 'decks'} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-9 px-4 text-[12.5px] font-semibold text-neutral-700 hover:bg-neutral-100 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 h-9 px-5 text-[12.5px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
            >
              <AddIcon size={14} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
