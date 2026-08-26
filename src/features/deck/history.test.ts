import { describe, it, expect } from 'vitest';
import {
  historyReducer,
  draftReducer,
  HISTORY_LIMIT,
  type DeckHistory,
  type DraftHistory,
} from './history';
import type { Deck } from './types';

/** A deck identified by one field, which is all these tests need to tell two apart. */
const deck = (name: string): Deck => ({ generated: false, slides: [], themeId: name });

const start = (present: Deck): DeckHistory => ({ past: [], present, future: [] });

describe('historyReducer', () => {
  it('records a commit and clears the redo stack', () => {
    let s = start(deck('a'));
    s = historyReducer(s, { type: 'commit', deck: deck('b') });
    s = historyReducer(s, { type: 'undo' });
    expect(s.future).toHaveLength(1);

    s = historyReducer(s, { type: 'commit', deck: deck('c') });
    expect(s.present.themeId).toBe('c');
    expect(s.future).toEqual([]);
  });

  it('ignores a commit of the object already on screen', () => {
    const present = deck('a');
    const s = historyReducer(start(present), { type: 'commit', deck: present });
    expect(s.past).toEqual([]);
  });

  it('walks back and forward over the same states', () => {
    let s = start(deck('a'));
    s = historyReducer(s, { type: 'commit', deck: deck('b') });
    s = historyReducer(s, { type: 'commit', deck: deck('c') });

    s = historyReducer(s, { type: 'undo' });
    expect(s.present.themeId).toBe('b');
    s = historyReducer(s, { type: 'undo' });
    expect(s.present.themeId).toBe('a');
    s = historyReducer(s, { type: 'redo' });
    expect(s.present.themeId).toBe('b');
    s = historyReducer(s, { type: 'redo' });
    expect(s.present.themeId).toBe('c');
  });

  it('does nothing at either end of the stack', () => {
    const s = start(deck('a'));
    expect(historyReducer(s, { type: 'undo' })).toBe(s);
    expect(historyReducer(s, { type: 'redo' })).toBe(s);
  });

  // The guarantee that makes multiplayer safe: Undo takes back my work, never
  // a collaborator's.
  it('keeps a remote edit out of my undo stack', () => {
    let s = start(deck('mine'));
    s = historyReducer(s, { type: 'remote', deck: deck('theirs') });
    expect(s.present.themeId).toBe('theirs');
    expect(s.past).toEqual([]);
    expect(historyReducer(s, { type: 'undo' })).toBe(s);
  });

  it('caps the past so long sessions cannot grow without bound', () => {
    let s = start(deck('0'));
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) {
      s = historyReducer(s, { type: 'commit', deck: deck(String(i)) });
    }
    expect(s.past).toHaveLength(HISTORY_LIMIT);
    // The oldest states fell off the back, not the newest.
    expect(s.past[s.past.length - 1].themeId).toBe(String(HISTORY_LIMIT + 19));
  });

  it('restores a persisted stack wholesale', () => {
    const s = historyReducer(start(deck('x')), {
      type: 'set',
      deck: deck('restored'),
      past: [deck('older')],
      future: [deck('newer')],
    });
    expect(s.present.themeId).toBe('restored');
    expect(s.past).toHaveLength(1);
    expect(s.future).toHaveLength(1);
  });
});

describe('draftReducer', () => {
  const open = (d: Deck): DraftHistory => draftReducer({ past: [], present: null, future: [] }, { type: 'open', deck: d });

  it('is inert until the fork is open', () => {
    const closed: DraftHistory = { past: [], present: null, future: [] };
    expect(draftReducer(closed, { type: 'edit', fn: () => deck('b') })).toBe(closed);
    expect(draftReducer(closed, { type: 'undo' })).toBe(closed);
  });

  it('records an edit that changes the deck', () => {
    let s = open(deck('a'));
    s = draftReducer(s, { type: 'edit', fn: (prev) => ({ ...prev, themeId: 'b' }) });
    expect(s.present?.themeId).toBe('b');
    expect(s.past).toHaveLength(1);
  });

  // A no-op edit used to leave a dead step, so Undo needed pressing twice.
  it('drops an edit that returns the same object', () => {
    const s = open(deck('a'));
    const after = draftReducer(s, { type: 'edit', fn: (prev) => prev });
    expect(after).toBe(s);
    expect(after.past).toEqual([]);
  });

  it('closing the fork clears the stack, so Undo cannot cross it', () => {
    let s = open(deck('a'));
    s = draftReducer(s, { type: 'edit', fn: (prev) => ({ ...prev, themeId: 'b' }) });
    s = draftReducer(s, { type: 'close' });
    expect(s).toEqual({ past: [], present: null, future: [] });
  });

  it('undoes and redoes inside the fork', () => {
    let s = open(deck('a'));
    s = draftReducer(s, { type: 'edit', fn: (prev) => ({ ...prev, themeId: 'b' }) });
    s = draftReducer(s, { type: 'undo' });
    expect(s.present?.themeId).toBe('a');
    s = draftReducer(s, { type: 'redo' });
    expect(s.present?.themeId).toBe('b');
  });
});
