import { FolderIcon } from '../ui/icons';
import type { FolderMeta } from '../deck/deckStore';

/**
 * A folder's colour as a hex.
 *
 * One table, because this mapping was written out inline in three places and a
 * fourth was about to be added. A folder that is orange in its own card and blue
 * on a search result is not a colour scheme, it is a bug nobody notices until
 * they are looking for a folder by colour.
 */
export function folderColorHex(color: string | undefined): string {
  switch (color) {
    case 'orange': return '#f97316';
    case 'amber': return '#f59e0b';
    case 'purple': return '#a855f7';
    case 'emerald': return '#10b981';
    case 'rose': return '#f43f5e';
    case 'indigo': return '#6366f1';
    case 'slate': return '#64748b';
    default: return '#3b82f6';
  }
}

/**
 * Marks a deck that lives in a folder.
 *
 * Only ever shown on a library search, and it is what makes that search honest.
 * Searching the library reaches filed decks as well as loose ones, so without
 * this a filed deck appears in the list it was filed out of with nothing to
 * explain why - which reads as filing having silently failed. With it, the result
 * says where the deck actually is.
 */
export function FolderChip({ folder }: { folder: FolderMeta }) {
  const color = folderColorHex(folder.color);
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 px-1.5 py-[1px] border max-w-[140px]"
      style={{ borderColor: `${color}55`, background: `${color}12`, color }}
      title={`In ${folder.name}`}
    >
      <span aria-hidden className="flex shrink-0">
        <FolderIcon size={9} />
      </span>
      <span className="truncate font-mono text-[9px] font-bold uppercase tracking-[0.06em]">
        {folder.name}
      </span>
    </span>
  );
}
