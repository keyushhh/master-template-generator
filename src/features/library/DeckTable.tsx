import { useState } from 'react';
import { FitStage } from '../generator/FitStage';
import { FolderChip } from './FolderChip';
import { TextHitChip } from '../search/TextHitChip';
import type { DeckTextHit } from '../search/deckText';
import { css as themeCss, type DeckTheme } from '../theme/deckTheme';
import type { Deck } from '../deck/types';
import { hexIsDark, readableInk } from '../deck/slideBackground';
import type { ProjectSummary } from '../deck/deckStore';
import { relativeTime } from './relativeTime';
import { Pagination } from './Pagination';
import {
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  FolderIcon,
  FolderOpenIcon,
  PlayIcon,
  SortIcon,
  TrashIcon,
} from '../ui/icons';
import type { FolderMeta } from '../deck/deckStore';

export type SortKey = 'name' | 'client' | 'slides' | 'updated';
export type SortDir = 'asc' | 'desc';
export interface Sort {
  key: SortKey;
  dir: SortDir;
}

interface DeckTableProps {
  /** The current page's rows, already sorted and sliced by the page. */
  rows: ProjectSummary[];
  /** Rows in the filtered set across every page. */
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  themeOf: (p: ProjectSummary) => DeckTheme;
  sort: Sort;
  onSort: (key: SortKey) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onClearSelection: () => void;
  onBulkDuplicate: () => void;
  onBulkDelete: () => void;
  folders?: FolderMeta[];
  /** Mark rows that live in a folder. Set while searching the library, where the
   *  list reaches filed decks as well as loose ones. */
  showFolderOrigin?: boolean;
  /** Whether to show client brand column (defaults to false). */
  showClient?: boolean;
  onBulkMoveToFolder?: (folderId: string | null) => void;
  onMoveToFolder?: (projectId: string, folderId: string | null) => void;
  onOpen: (id: string) => void;
  onPresent: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Renders the deck name, as static text or as a rename input. Owned by the
   *  page because renaming state is shared with the hero and the grid. */
  renderName: (p: ProjectSummary, className: string) => React.ReactNode;
  /** Where this deck says the search query, when its name does not. */
  textHit?: (p: ProjectSummary) => DeckTextHit | null;
}

/** What this deck came from. Real metadata rather than a decorative second line:
 *  an imported .pptx behaves differently from a generated deck, and it is worth
 *  knowing which one you are about to open. */
function sourceLabel(deck: Deck | null): string {
  if (!deck) return 'Unavailable';
  if (deck.slides.some((s) => s.templateId === 'imported')) return 'Imported deck';
  if (deck.generated) return 'From Business Record';
  return 'Master template';
}

/** Square, sharp-cornered checkbox, matching the deck system rather than the OS. */
function Check({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`w-[17px] h-[17px] flex items-center justify-center border transition-colors cursor-pointer ${
        on
          ? 'bg-emerald-500 border-emerald-500 text-white'
          : 'bg-white border-neutral-300 hover:border-neutral-500 text-transparent'
      }`}
    >
      {indeterminate && !checked ? (
        <span className="block w-[7px] h-[1.5px] bg-white" />
      ) : (
        <CheckIcon size={11} />
      )}
    </button>
  );
}

/** A column head. Sortable ones carry a direction arrow; the arrow is always
 *  drawn, faint when that column is not the one in force, because a sort control
 *  nobody can see is a sort control nobody uses. */
function Th({
  label,
  col,
  sort,
  onSort,
  width,
  align = 'left',
}: {
  label?: string;
  col?: SortKey;
  sort?: Sort;
  onSort?: (key: SortKey) => void;
  width?: number;
  align?: 'left' | 'right';
}) {
  const base = 'h-[34px] border-b border-neutral-200 bg-neutral-50 px-3';
  if (!col || !sort || !onSort) {
    return <th style={width ? { width } : undefined} className={`${base} p-0`} />;
  }
  const active = sort.key === col;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      style={width ? { width } : undefined}
      className={`${base} p-0`}
    >
      <button
        onClick={() => onSort(col)}
        className={`w-full h-[34px] flex items-center gap-1.5 px-3 text-[11px] font-semibold transition-colors cursor-pointer ${
          align === 'right' ? 'justify-end' : 'justify-start'
        } ${active ? 'text-neutral-900' : 'text-neutral-600 hover:text-neutral-800'}`}
      >
        {label}
        <span
          aria-hidden
          style={{
            display: 'flex',
            opacity: active ? 1 : 0.4,
            transform: active && sort.dir === 'desc' ? 'rotate(180deg)' : 'none',
          }}
        >
          {active ? <ArrowUpIcon size={11} /> : <SortIcon size={11} />}
        </span>
      </button>
    </th>
  );
}

/** One hover action on a row. */
function RowAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={label}
      title={label}
      className={`w-[26px] h-[26px] flex items-center justify-center transition-colors cursor-pointer ${
        danger
          ? 'text-neutral-600 hover:text-red-600 hover:bg-red-50'
          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The deck library as a table.
 *
 * Two earlier attempts at this were a flex row per deck dressed to look like a
 * table. They both fell apart the moment a deck name ran long or a column was
 * empty, because nothing was actually sharing a column - each row measured
 * itself. This is a real `<table>`: the browser reconciles the column widths, so
 * every cell lines up by construction rather than by matching numbers by hand.
 *
 * Shaped like the CRM tables it is competing with, for good reasons rather than
 * imitation:
 *
 *  - **A bordered card**, so the table is one object on the page instead of rules
 *    floating on the background.
 *  - **A filled header row**, which is what separates "labels" from "data" without
 *    needing a heavier rule.
 *  - **Row selection with checkboxes**, because the useful operations here are
 *    plural: archiving a client's old decks is one gesture, not eleven.
 *  - **Explicit row actions** rather than a hidden overflow menu. There are only
 *    three verbs and they are all safe to show.
 *
 * Sharp corners throughout: `--radius-sharp` is 0 across this product, and a
 * rounded table would be the one soft thing in it.
 */
export function DeckTable({
  rows,
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
  themeOf,
  sort,
  onSort,
  selected,
  onToggleSelect,
  onToggleAll,
  onClearSelection,
  onBulkDuplicate,
  onBulkDelete,
  folders = [],
  showFolderOrigin = false,
  showClient = false,
  onBulkMoveToFolder,
  onMoveToFolder,
  onOpen,
  onPresent,
  onDuplicate,
  onDelete,
  renderName,
  textHit,
}: DeckTableProps) {
  const allShownSelected = rows.length > 0 && rows.every((p) => selected.has(p.id));
  const folderOf = (id: string | null | undefined) =>
    id ? folders.find((f) => f.id === id) : undefined;
  const someSelected = selected.size > 0;
  const [moveDropdownOpen, setMoveDropdownOpen] = useState(false);
  const [rowFolderMenuId, setRowFolderMenuId] = useState<string | null>(null);

  return (
    <div className="bg-white border border-neutral-200">
      {/* Selection bar replaces nothing: it appears above the header row, so the
          column labels never move while you are working down a list. */}
      {someSelected && (
        <div className="flex items-center gap-2 px-3 h-[42px] border-b border-emerald-200 bg-emerald-50">
          <span className="text-[12.5px] font-bold text-emerald-800 pr-1 tabular-nums">
            {selected.size} selected
          </span>
          <button
            onClick={onBulkDuplicate}
            className="flex items-center gap-1.5 h-[30px] px-2.5 text-[12px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:border-neutral-400 transition-colors cursor-pointer"
          >
            <CopyIcon size={13} />
            Duplicate
          </button>

          {/* Bulk Move to Folder Dropdown */}
          {onBulkMoveToFolder && (
            <div className="relative">
              <button
                onClick={() => setMoveDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 h-[30px] px-2.5 text-[12px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:border-neutral-400 transition-colors cursor-pointer"
              >
                <FolderIcon size={13} />
                Move to folder
                <span className="text-[10px] text-neutral-600 ml-0.5">▼</span>
              </button>

              {moveDropdownOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 top-[calc(100%+4px)] z-30 w-52 py-1 bg-white border border-neutral-200 rounded-[var(--radius-sharp)] shadow-xl text-left"
                >
                  <button
                    onClick={() => { setMoveDropdownOpen(false); onBulkMoveToFolder(null); }}
                    className="w-full px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-100 text-left"
                  >
                    Main Library (No Folder)
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
                        onClick={() => { setMoveDropdownOpen(false); onBulkMoveToFolder(f.id); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-neutral-800 hover:bg-neutral-100 text-left cursor-pointer"
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

          <button
            onClick={onBulkDelete}
            className="flex items-center gap-1.5 h-[30px] px-2.5 text-[12px] font-bold text-red-600 bg-white border border-neutral-200 hover:border-red-300 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <TrashIcon size={13} />
            Delete
          </button>
          <button
            onClick={onClearSelection}
            className="ml-auto h-[30px] px-2.5 text-[12px] font-bold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 40 }} className="h-[34px] border-b border-neutral-200 bg-neutral-50 px-0">
                <span className="flex items-center justify-center">
                  <Check
                    checked={allShownSelected}
                    indeterminate={someSelected && !allShownSelected}
                    onChange={onToggleAll}
                    label={allShownSelected ? 'Deselect all decks' : 'Select all decks'}
                  />
                </span>
              </th>
              <Th label="Deck" col="name" sort={sort} onSort={onSort} />
              {showClient && <Th label="Client" col="client" sort={sort} onSort={onSort} width={190} />}
              <Th label="Slides" col="slides" sort={sort} onSort={onSort} width={120} />
              <Th label="Edited" col="updated" sort={sort} onSort={onSort} width={160} />
              <Th width={116} />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const theme = themeOf(p);
              const visible = p.deck?.slides.filter((s) => !s.hidden) ?? [];
              const cover = visible[0] ?? p.deck?.slides[0];
              const isSelected = selected.has(p.id);
              return (
                <tr
                  key={p.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', p.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className={`group transition-colors ${
                    isSelected ? 'bg-emerald-50/50' : 'hover:bg-neutral-50'
                  }`}
                >
                  <td className="border-b border-neutral-200 px-0 align-middle">
                    <span className="flex items-center justify-center">
                      <Check
                        checked={isSelected}
                        onChange={() => onToggleSelect(p.id)}
                        label={`Select ${p.name}`}
                      />
                    </span>
                  </td>

                  {/* Deck: cover, name, and where the deck came from. */}
                  <td className="border-b border-neutral-200 px-3 py-2 align-middle max-w-0">
                    <div
                      onClick={() => onOpen(p.id)}
                      className="inline-flex items-center gap-2.5 max-w-full cursor-pointer group/name hover:opacity-85 transition-opacity"
                    >
                      <span
                        className="shrink-0 block w-[48px] bg-white"
                        style={{ boxShadow: '0 0 0 1px var(--neutral-200)' }}
                      >
                        {cover ? (
                          <FitStage slide={cover} ast={null} num="01" logoUrl={p.deck?.logoUrl} theme={theme} />
                        ) : (
                          <span className="block w-full aspect-[16/9]" />
                        )}
                      </span>
                      <span className="flex flex-col min-w-0 gap-[1px]">
                        {renderName(p, 'text-[12.5px] font-bold text-neutral-900 leading-[1.25]')}
                        <span className="flex items-center gap-1.5 min-w-0 leading-[1.25]">
                          <span className="text-[10.5px] text-neutral-600 truncate">
                            {sourceLabel(p.deck)}
                          </span>
                          {/* Beside the source line rather than in a column of its
                              own: it is present on a search and absent the rest of
                              the time, and a column that is empty in the normal
                              case costs width on every row forever. */}
                          {showFolderOrigin && p.folderId && folderOf(p.folderId) && (
                            <FolderChip folder={folderOf(p.folderId)!} />
                          )}
                          {textHit?.(p) && <TextHitChip hit={textHit(p)!} />}
                          {/* A sandbox deck lives outside the repository, so it
                              says so: it is not shared, and it goes when this
                              browser's storage does. */}
                          {p.isSandbox && (
                            <span className="shrink-0 px-1.5 py-[1px] font-mono text-[9px] font-bold tracking-[0.1em] uppercase text-amber-800 bg-amber-50 border border-amber-200">
                              Sandbox
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                  </td>

                  {/* Client, as a pill in the kit's own colour. */}
                  {showClient && (
                    <td className="border-b border-neutral-200 px-3 py-2 align-middle">
                      <span
                        className="inline-flex items-center gap-1.5 max-w-full px-2 py-[2px] text-[11px] font-semibold border"
                        style={{
                          color: themeCss(
                            readableInk(
                              theme.accent.tint,
                              hexIsDark(theme.accent.tint) ? theme.accent.bright : theme.accent.deep
                            )
                          ),
                          borderColor: themeCss(theme.accent.base) + '55',
                          background: themeCss(theme.accent.tint),
                        }}
                      >
                        <span
                          aria-hidden
                          className="shrink-0 w-[6px] h-[6px]"
                          style={{ background: themeCss(theme.accent.base) }}
                        />
                        <span className="truncate">{theme.name}</span>
                      </span>
                    </td>
                  )}

                  <td className="border-b border-neutral-200 px-3 py-2 align-middle text-left font-mono text-[11.5px] text-neutral-600 tabular-nums">
                    {String(visible.length).padStart(2, '0')}
                  </td>

                  <td className="border-b border-neutral-200 px-3 py-2 align-middle text-left text-[11.5px] text-neutral-600 whitespace-nowrap">
                    {relativeTime(p.updatedAt)}
                  </td>

                  <td className="border-b border-neutral-200 px-2 py-2 align-middle">
                    <span className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {onMoveToFolder && (
                        p.folderId ? (
                          <RowAction
                            label="Remove from folder"
                            onClick={() => onMoveToFolder(p.id, null)}
                          >
                            <FolderIcon size={14} />
                          </RowAction>
                        ) : (
                          <div className="relative">
                            <RowAction
                              label="Move to folder"
                              onClick={() => setRowFolderMenuId(rowFolderMenuId === p.id ? null : p.id)}
                            >
                              <FolderOpenIcon size={14} />
                            </RowAction>

                            {rowFolderMenuId === p.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-[calc(100%+4px)] z-40 w-48 py-1 bg-white border border-neutral-200 rounded-[var(--radius-sharp)] shadow-xl text-left"
                              >
                                <button
                                  onClick={() => { setRowFolderMenuId(null); onMoveToFolder(p.id, null); }}
                                  className="w-full px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-100 text-left cursor-pointer"
                                >
                                  Main Library (No Folder)
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
                                      onClick={() => { setRowFolderMenuId(null); onMoveToFolder(p.id, f.id); }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-neutral-800 hover:bg-neutral-100 text-left cursor-pointer"
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
                        )
                      )}
                      {visible.length > 0 && (
                        <RowAction label="Present" onClick={() => onPresent(p.id)}>
                          <PlayIcon size={14} />
                        </RowAction>
                      )}
                      <RowAction label="Duplicate" onClick={() => onDuplicate(p.id)}>
                        <CopyIcon size={14} />
                      </RowAction>
                      <RowAction label="Delete" danger onClick={() => onDelete(p.id)}>
                        <TrashIcon size={14} />
                      </RowAction>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-neutral-200">
        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPage={onPage}
          onPageSize={onPageSize}
        />
      </div>
    </div>
  );
}
