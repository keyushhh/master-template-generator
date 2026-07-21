import type { DocumentNode } from './parser/ast';
import type { CampaignType } from './sampleDecks';
import type { Deck } from '../deck/types';

/**
 * User-saved use cases: decks worth keeping around as a starting point for the
 * next similar campaign, so account managers stop hunting for a past deck.
 * Distinct from the multi-deck project store (deckStore.ts) - a project is a
 * deck someone is actively working on; a library entry is a reusable template.
 *
 * Layout in localStorage:
 *   wozku-use-case-library-v1 → LibraryEntry[]
 */
const KEY = 'wozku-use-case-library-v1';

export interface LibraryEntry {
  id: string;
  name: string;
  description: string;
  campaignType: CampaignType;
  savedAt: number;
  /** The built deck exactly as saved, edits included - loading it restores this
   *  deck directly rather than re-running the Business Record parser/builder. */
  deck: Deck;
  ast: DocumentNode | null;
}

function newId(): string {
  return `lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listLibraryEntries(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LibraryEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: LibraryEntry[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

/** Returns the new entry, or null if localStorage is full/unavailable. */
export function saveLibraryEntry(entry: {
  name: string;
  description: string;
  campaignType: CampaignType;
  deck: Deck;
  ast: DocumentNode | null;
}): LibraryEntry | null {
  const full: LibraryEntry = { ...entry, id: newId(), savedAt: Date.now() };
  const ok = persist([full, ...listLibraryEntries()]);
  return ok ? full : null;
}

export function deleteLibraryEntry(id: string): void {
  persist(listLibraryEntries().filter((e) => e.id !== id));
}
