import { mintInstanceId } from './deckBuilder';
import type { Deck, SlideInstance } from './types';

/**
 * Two versions of one slide, one of them shown.
 *
 * A variant is not a new kind of object: it is an ordinary slide that shares a
 * `variantGroup` with its siblings, of which at most one is visible. That is
 * the whole feature, and it is why it costs nothing everywhere else - present
 * mode, export, numbering and the preflight already skip hidden slides, so the
 * version you did not pick is absent from all of them without any of them
 * learning the word "variant".
 *
 * Keeping both in the deck rather than parking one off to the side is the
 * point: the version you rejected for this client is the one the next client
 * wants, and a copy in a duplicate deck goes stale the moment either is edited.
 */

/** Members of a slide's variant group in deck order, or [] if it has none. */
export function variantGroupOf(slides: SlideInstance[], instanceId: string): SlideInstance[] {
  const slide = slides.find((s) => s.instanceId === instanceId);
  if (!slide?.variantGroup) return [];
  return slides.filter((s) => s.variantGroup === slide.variantGroup);
}

/** A, B, C… for a member's place in its group, or null when it has no group. */
export function variantLabel(slides: SlideInstance[], instanceId: string): string | null {
  const group = variantGroupOf(slides, instanceId);
  if (group.length < 2) return null;
  const at = group.findIndex((s) => s.instanceId === instanceId);
  return String.fromCharCode(65 + at);
}

/**
 * A second version of a slide, sitting right after it and not yet chosen.
 *
 * The copy keeps the title: these are two takes on the same slide, and naming
 * one "(Copy)" would make the rail read as a deck with a mistake in it. Use
 * Duplicate for a genuinely separate slide.
 */
export function addVariant(deck: Deck, instanceId: string): Deck {
  const index = deck.slides.findIndex((s) => s.instanceId === instanceId);
  if (index === -1) return deck;
  const source = deck.slides[index];
  const group = source.variantGroup ?? `v-${Math.random().toString(36).slice(2, 9)}`;

  const slides = deck.slides.map((s) => (s.instanceId === instanceId ? { ...s, variantGroup: group } : s));
  const copy: SlideInstance = {
    ...structuredClone(source),
    instanceId: mintInstanceId(source.templateId),
    variantGroup: group,
    // Unchosen: the deck still shows the version it showed a moment ago.
    hidden: true,
  };
  // After the last member, so a third version lands beside the other two rather
  // than between them.
  let last = index;
  for (let i = index + 1; i < slides.length; i++) if (slides[i].variantGroup === group) last = i;
  slides.splice(last + 1, 0, copy);
  return { ...deck, slides };
}

/** Shows this version of its slide and puts the others away. */
export function chooseVariant(deck: Deck, instanceId: string): Deck {
  const slide = deck.slides.find((s) => s.instanceId === instanceId);
  if (!slide?.variantGroup) return deck;
  return {
    ...deck,
    slides: deck.slides.map((s) =>
      s.variantGroup === slide.variantGroup ? { ...s, hidden: s.instanceId !== instanceId } : s
    ),
  };
}

/**
 * Keeps the invariant after any edit: a group of one is not a group.
 *
 * Deleting one of two versions must leave an ordinary slide behind, not a
 * lone member that still calls itself version A of a set that no longer
 * exists. Cheap enough to run on every deck mutation, and a no-op on the decks
 * that have no variants, which is all of them until someone makes one.
 */
export function tidyVariants(deck: Deck): Deck {
  if (!deck.slides.some((s) => s.variantGroup)) return deck;
  const counts = new Map<string, number>();
  for (const s of deck.slides) {
    if (s.variantGroup) counts.set(s.variantGroup, (counts.get(s.variantGroup) ?? 0) + 1);
  }

  let changed = false;
  const seenVisible = new Set<string>();
  const slides = deck.slides.map((s) => {
    if (!s.variantGroup) return s;
    if ((counts.get(s.variantGroup) ?? 0) < 2) {
      changed = true;
      // The survivor comes back into the deck: it was only hidden because
      // another version was chosen, and that version is gone.
      const { variantGroup: _drop, ...rest } = s;
      return { ...rest, hidden: false };
    }
    if (!s.hidden) {
      if (seenVisible.has(s.variantGroup)) {
        changed = true;
        return { ...s, hidden: true };
      }
      seenVisible.add(s.variantGroup);
    }
    return s;
  });
  return changed ? { ...deck, slides } : deck;
}
