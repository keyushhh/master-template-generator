import type { Deck, SlideInstance, SlideTransition } from './types';

/** The transitions on offer, with how long each runs and a line saying what it
 *  is for. Duration lives here rather than only in the stylesheet because the
 *  outgoing layer is torn down on a timer, and the two must agree. */
export const TRANSITIONS: { id: SlideTransition; label: string; note: string; ms: number }[] = [
  { id: 'none', label: 'Cut', note: 'No transition', ms: 0 },
  { id: 'fade', label: 'Fade', note: 'The house default', ms: 280 },
  { id: 'push', label: 'Push', note: 'Slides travel together', ms: 440 },
  { id: 'wipe', label: 'Wipe', note: 'An edge crosses the slide', ms: 460 },
  { id: 'rise', label: 'Rise', note: 'Lifts in, for type-led decks' , ms: 400 },
];

export const DEFAULT_TRANSITION: SlideTransition = 'fade';

export function transitionLabel(id: SlideTransition): string {
  return TRANSITIONS.find((t) => t.id === id)?.label ?? 'Fade';
}

export function transitionMs(id: SlideTransition): number {
  return TRANSITIONS.find((t) => t.id === id)?.ms ?? 0;
}

/** A slide's own transition wins, then the deck's, then the house default, so
 *  setting one slide never disturbs the rest and the deck stays the one place
 *  to change all of them at once. */
export function resolveTransition(slide: SlideInstance | undefined, deck: Deck): SlideTransition {
  return slide?.transition ?? deck.transition ?? DEFAULT_TRANSITION;
}

/** Somebody who has asked for less motion gets the cut, not a slower version of
 *  the same movement. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
