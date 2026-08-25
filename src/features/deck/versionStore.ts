import type { Deck } from './types';

/**
 * Restorable snapshots of a deck, so a bad edit is recoverable after the undo
 * window has closed or after someone else made it.
 *
 * Undo history is per tab and per session; this outlives both, which is what
 * makes it useful once two people are editing the same deck.
 */

const PREFIX = 'wozku-versions-';

/** Enough to walk back through an afternoon without crowding out the decks
 *  themselves, which share the same few megabytes. */
const MAX_VERSIONS = 20;

export interface DeckVersion {
  id: string;
  deck: Deck;
  /** Who was signed in when this was taken. */
  authorId: string;
  at: number;
  /** Set on the snapshot written by a restore, so the list says what happened. */
  restoredFrom?: number;
}

function key(projectId: string): string {
  return `${PREFIX}${projectId}`;
}

/** Newest first. */
export function listVersions(projectId: string): DeckVersion[] {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeckVersion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(projectId: string, versions: DeckVersion[]): void {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(versions.slice(0, MAX_VERSIONS)));
  } catch {
    // A deck that cannot spare the room for history still has to keep editing.
  }
}

export function saveVersion(
  projectId: string,
  deck: Deck,
  authorId: string,
  restoredFrom?: number
): DeckVersion {
  const version: DeckVersion = {
    id: `v_${crypto.randomUUID()}`,
    deck,
    authorId,
    at: Date.now(),
    restoredFrom,
  };
  write(projectId, [version, ...listVersions(projectId)]);
  return version;
}

export function getVersion(projectId: string, versionId: string): DeckVersion | null {
  return listVersions(projectId).find((v) => v.id === versionId) ?? null;
}

export function deleteVersions(projectId: string): void {
  try {
    localStorage.removeItem(key(projectId));
  } catch {
    // ignore
  }
}

/**
 * Whether enough has changed to be worth another entry.
 *
 * One person editing for an hour should not produce sixty near-identical
 * snapshots, but a deck handed between two people should get a boundary at the
 * handover, which is the entry someone actually wants to go back to.
 */
const QUIET_PERIOD_MS = 60_000;

export function shouldSnapshot(projectId: string, authorId: string, now = Date.now()): boolean {
  const [latest] = listVersions(projectId);
  if (!latest) return true;
  if (latest.authorId !== authorId) return true;
  return now - latest.at >= QUIET_PERIOD_MS;
}
