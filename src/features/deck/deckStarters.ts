import type { Deck } from './types';
import { createBlankSlide, createTemplateDeck } from './deckBuilder';
import { PRESENTATION_TEMPLATES } from '../templates/presentationTemplates';

/**
 * What a new deck can start from.
 */
export interface DeckStarter {
  id: string;
  name: string;
  description: string;
  build: () => Deck;
}

export const DECK_STARTERS: DeckStarter[] = PRESENTATION_TEMPLATES.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  build: t.build,
}));

export function starterById(id: string): DeckStarter {
  return DECK_STARTERS.find((s) => s.id === id) ?? DECK_STARTERS[0];
}
