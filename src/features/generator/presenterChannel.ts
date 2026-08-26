import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';
import type { DeckTheme } from '../theme/deckTheme';

/**
 * What the presenting window and the audience window say to each other.
 *
 * One channel, named once. Present mode already used this channel to keep two
 * tabs of the same deck in step; the second-screen window speaks the same
 * language, with two additions: HELLO, which the audience window sends on open
 * to ask for the deck, and DECK, the answer. That handshake is why the second
 * screen works on a deck with unsaved edits: nothing is read from storage, the
 * presenting window sends what it is actually showing.
 */
export const PRESENTER_CHANNEL = 'wozku_presenter_channel';

export type PresenterMessage =
  | { type: 'HELLO' }
  | { type: 'DECK'; deck: Deck; ast?: DocumentNode | null; theme?: DeckTheme; index?: number; blank?: boolean }
  | { type: 'INDEX'; index: number }
  | { type: 'BLANK'; blank: boolean }
  | { type: 'PLAY'; autoPlay: boolean }
  /** The presenting window is closing, so the second screen stops claiming to be live. */
  | { type: 'BYE' };

/** Posts one message and closes: no channel is kept open for a single send. */
export function postPresenter(message: PresenterMessage): void {
  try {
    const channel = new BroadcastChannel(PRESENTER_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // No BroadcastChannel: the second screen simply never syncs.
  }
}
