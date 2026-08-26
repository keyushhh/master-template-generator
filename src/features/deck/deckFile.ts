import type { Deck } from './types';
import type { StoredSession } from './deckStore';
import { SCHEMA_VERSION, migrate, versionOf, type VersionedSession } from './schema';

/**
 * A deck as a file, so work can leave the browser it was made in.
 *
 * Decks live in localStorage. That is fine until it is not: clearing site data,
 * a different browser, a different machine, or simply wanting a copy of the
 * thing you spent an afternoon on. Until now the only ways out were .pptx and
 * .pdf, and neither round-trips - a .pptx re-import comes back as imported
 * shapes, not as the template slides it was built from.
 *
 * This is the deck's own model, written out verbatim and read back verbatim, so
 * a deck exported today opens as the same deck tomorrow.
 *
 * Deliberately not a .pptx replacement and deliberately not an archive format:
 * uploaded video lives in IndexedDB and is referenced by id, so a deck carrying
 * video comes back with its video slots empty on another machine. The reader
 * says so rather than pretending.
 */

export const DECK_FILE_KIND = 'wozku.deck';
export const DECK_FILE_EXT = '.wozdeck.json';

export interface DeckFile {
  kind: typeof DECK_FILE_KIND;
  schemaVersion: number;
  /** ISO timestamp, for the reader to show rather than for the app to trust. */
  exportedAt: string;
  name: string;
  session: VersionedSession;
}

export function buildDeckFile(name: string, session: StoredSession, now: Date): DeckFile {
  return {
    kind: DECK_FILE_KIND,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    name,
    // History and the dirty flag are this browser's working state, not the
    // deck: a copy opened elsewhere should start with a clean undo stack.
    session: {
      ast: session.ast,
      deck: session.deck,
      baselineDeck: session.baselineDeck,
      schemaVersion: SCHEMA_VERSION,
    },
  };
}

export interface ReadResult {
  name: string;
  session: StoredSession;
  /** Things the reader wants the user told, rather than silently absorbed. */
  notes: string[];
}

/** A filename for a deck, as the exporter writes it. */
export function deckFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'deck'}${DECK_FILE_EXT}`;
}

/**
 * Reads a deck file. Throws with a sentence a user can act on, rather than a
 * parser error: "this is not a deck file" and "this deck was made in a newer
 * version" are different problems with different answers.
 */
export function readDeckFile(text: string): ReadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not readable as a deck. It may have been edited or truncated.');
  }

  const file = parsed as Partial<DeckFile>;
  if (!file || file.kind !== DECK_FILE_KIND) {
    throw new Error('That is not a Wozku deck file. Export one from a deck’s menu to get the right format.');
  }
  if (!file.session?.deck || !Array.isArray(file.session.deck.slides)) {
    throw new Error('That deck file has no slides in it.');
  }

  const notes: string[] = [];
  if (versionOf(file.session) > SCHEMA_VERSION) {
    throw new Error('That deck was saved by a newer version of Studio. Update this tab and try again.');
  }

  const { session, applied } = migrate(file.session);
  if (applied > 0) notes.push('This deck was saved by an older version and has been brought up to date.');

  const video = countVideoAssets(session.deck);
  if (video > 0) {
    notes.push(
      video === 1
        ? 'One uploaded video could not travel in the file, so its slot is empty. Add the video again on this machine.'
        : `${video} uploaded videos could not travel in the file, so their slots are empty. Add them again on this machine.`
    );
  }

  return { name: typeof file.name === 'string' && file.name.trim() ? file.name.trim() : 'Imported deck', session, notes };
}

/** Uploaded video bytes live in IndexedDB, keyed by id, so they never travel. */
function countVideoAssets(deck: Deck): number {
  let n = 0;
  for (const slide of deck.slides) {
    for (const shape of slide.content.overlay ?? []) {
      if (shape.kind === 'video' && shape.videoAssetId) n += 1;
    }
  }
  return n;
}
