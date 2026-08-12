import type { Deck } from './types';
import { createBlankSlide, createTemplateDeck } from './deckBuilder';

/**
 * What a new deck can start from.
 *
 * A registry rather than a hardcoded `createTemplateDeck()` at each call site,
 * because "which template" is about to stop being a rhetorical question. The
 * house master template is one starting point; a set per client, or per kind of
 * pitch, is the obvious next thing to want, and each one should be an entry in
 * this array and nothing else. The new-deck screen reads this list, so a new
 * starter appears in the UI the moment it appears here.
 *
 * Deliberately separate from the brand. A starter decides the *slides*; a brand
 * kit decides the *colour*, and every starter works with every kit because the
 * theme is applied at the slide root rather than baked into slide content.
 * Keeping them as two choices instead of one combined "template" is what stops
 * fourteen layouts times five clients becoming seventy templates to maintain.
 */
export interface DeckStarter {
  id: string;
  name: string;
  /** One line on what you get, in the terms of what is on the slides. */
  description: string;
  build: () => Deck;
}

export const DECK_STARTERS: DeckStarter[] = [
  {
    id: 'master',
    name: 'Master template',
    description:
      'All fourteen Wozku layouts, in order, empty. Cover, agenda, summary, metrics, roadmap, quote, close.',
    build: createTemplateDeck,
  },
  {
    id: 'blank',
    name: 'Blank deck',
    description:
      'One freeform slide. For a deck whose shape you do not know yet, or one you are rebuilding by hand.',
    build: () => ({ generated: false, slides: [createBlankSlide()] }),
  },
];

export function starterById(id: string): DeckStarter {
  return DECK_STARTERS.find((s) => s.id === id) ?? DECK_STARTERS[0];
}
