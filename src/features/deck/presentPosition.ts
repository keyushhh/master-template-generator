/**
 * Where each deck was last left in present mode.
 *
 * Deliberately not on the deck. This is a reading position, not something about
 * the document: it should not travel with a duplicate, should not count as an
 * edit, and should not take up room in the ~5MB the decks themselves share. So
 * it lives in its own small key, as one number per deck.
 *
 * The library's Present button reads this, which is the case it exists for:
 * presenting from the library has no on-screen slide to start from, so without
 * it every presentation restarts at slide one. The studio does not need it -
 * there the slide you are looking at is the obvious place to begin.
 */

const KEY = 'wozku-present-position-v1';

/** How many decks' positions to keep. Older entries fall off rather than the
 *  map growing for every deck ever presented. */
const MAX_ENTRIES = 50;

type Positions = Record<string, number>;

function read(): Positions {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Positions;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The slide index to open this deck's presentation on, clamped to the deck as it
 * stands now.
 *
 * `slideCount` is required rather than optional because the stored index can
 * outlive the slides it pointed at: present to slide 12, delete half the deck,
 * and an unclamped index opens on nothing.
 */
export function getPresentPosition(deckId: string, slideCount: number): number {
  if (slideCount <= 0) return 0;
  const stored = read()[deckId];
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return 0;
  return Math.min(Math.max(0, Math.floor(stored)), slideCount - 1);
}

/** Records where a presentation is. Slide one is stored as an absence, so a deck
 *  presented from the start does not take up an entry. */
export function setPresentPosition(deckId: string, index: number): void {
  const positions = read();
  if (index <= 0) delete positions[deckId];
  else positions[deckId] = index;

  const ids = Object.keys(positions);
  if (ids.length > MAX_ENTRIES) {
    for (const id of ids.slice(0, ids.length - MAX_ENTRIES)) delete positions[id];
  }

  try {
    localStorage.setItem(KEY, JSON.stringify(positions));
  } catch {
    // A reading position is not worth surfacing a storage error for.
  }
}
