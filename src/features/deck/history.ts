import type { Deck } from './types';

/**
 * Undo and redo, for the committed deck and for the edit-mode draft.
 *
 * Both reducers lived inside MasterTemplatePage, which meant the one piece of
 * state where a wrong answer silently destroys a user's work could not be
 * tested without mounting a 3,000-line page. They are pure functions of state
 * and action, so they belong here, next to the deck model they move.
 */

export const HISTORY_LIMIT = 50;

/** Smaller cap for what gets written to localStorage - each entry is a full
 *  deck snapshot (images included), so persisting all 50 would balloon
 *  storage fast. A reload only needs to recover a few recent steps. */
export const PERSISTED_HISTORY_LIMIT = 10;

export interface DeckHistory {
  past: Deck[];
  present: Deck;
  future: Deck[];
}

export type HistoryAction =
  | { type: 'commit'; deck: Deck }
  | { type: 'remote'; deck: Deck }
  | { type: 'set'; deck: Deck; past?: Deck[]; future?: Deck[] }
  | { type: 'undo' }
  | { type: 'redo' };

export function historyReducer(state: DeckHistory, action: HistoryAction): DeckHistory {
  switch (action.type) {
    case 'commit': {
      if (action.deck === state.present) return state;
      const past = [...state.past, state.present].slice(-HISTORY_LIMIT);
      return { past, present: action.deck, future: [] };
    }
    // Someone else's edit, arriving from another tab. It replaces what is on
    // screen but never enters this person's undo stack: Undo means "take back
    // what I did", and walking it back through a collaborator's edits would
    // silently overwrite their work.
    case 'remote':
      return { ...state, present: action.deck };
    case 'set':
      return { past: action.past ?? [], present: action.deck, future: action.future ?? [] };
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

/**
 * Undo/redo for the edit-mode draft.
 *
 * Edit mode forks the deck, and the committed history above cannot see inside
 * that fork - which is why Undo used to sit disabled for the whole editing
 * session, i.e. precisely when a user most wants it. The draft therefore carries
 * its own past/future, cleared whenever the fork opens or closes: undoing past
 * the moment you entered edit mode is what Discard is for.
 *
 * Every draft mutation goes through the `edit` action, so there is exactly one
 * place that can add a history entry. A mutation that returns the same object is
 * dropped rather than recorded, so a no-op edit can't leave a dead step the user
 * has to press Undo twice to get past.
 *
 * Deliberately not persisted: each entry is a whole deck snapshot, images
 * included, and the committed history already caps what it writes for that
 * reason. A reload keeps your unsaved draft and starts its undo stack fresh.
 */
export interface DraftHistory {
  past: Deck[];
  present: Deck | null;
  future: Deck[];
}

export type DraftAction =
  | { type: 'open'; deck: Deck | null }
  | { type: 'close' }
  | { type: 'edit'; fn: (prev: Deck) => Deck }
  | { type: 'remote'; deck: Deck }
  | { type: 'undo' }
  | { type: 'redo' };

export function draftReducer(state: DraftHistory, action: DraftAction): DraftHistory {
  switch (action.type) {
    case 'open':
      return { past: [], present: action.deck, future: [] };
    case 'close':
      return { past: [], present: null, future: [] };
    case 'remote':
      if (!state.present) return state;
      return { ...state, present: action.deck };
    case 'edit': {
      if (!state.present) return state;
      const next = action.fn(state.present);
      if (next === state.present) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    }
    case 'undo': {
      if (!state.present || state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      if (!state.present || state.future.length === 0) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}
