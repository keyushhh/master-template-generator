import type { Deck } from './types';

/**
 * What changed between two deck snapshots, by slide.
 *
 * A version list that only says "12 slides" tells you nothing about why this
 * entry exists rather than the one above it. A full field-level diff is more
 * than the panel needs; matching slides by instanceId and comparing their
 * serialized content is enough to say added, removed or changed, which is
 * the question someone browsing history is actually asking.
 */

export interface DeckDiffSummary {
  added: string[];
  removed: string[];
  changed: string[];
  /** True when nothing but slide order moved. */
  reorderedOnly: boolean;
}

export function diffDecks(from: Deck, to: Deck): DeckDiffSummary {
  const fromById = new Map(from.slides.map((s) => [s.instanceId, s]));
  const toById = new Map(to.slides.map((s) => [s.instanceId, s]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const slide of to.slides) {
    const prior = fromById.get(slide.instanceId);
    if (!prior) {
      added.push(slide.title);
      continue;
    }
    if (
      prior.title !== slide.title ||
      JSON.stringify(prior.content) !== JSON.stringify(slide.content) ||
      prior.hidden !== slide.hidden
    ) {
      changed.push(slide.title);
    }
  }
  for (const slide of from.slides) {
    if (!toById.has(slide.instanceId)) removed.push(slide.title);
  }

  const orderChanged = from.slides.map((s) => s.instanceId).join() !== to.slides.map((s) => s.instanceId).join();

  return {
    added,
    removed,
    changed,
    reorderedOnly: added.length === 0 && removed.length === 0 && changed.length === 0 && orderChanged,
  };
}

/** One line for a version row: what moved between it and the version before it. */
export function diffSummaryText(diff: DeckDiffSummary): string | null {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`${diff.added.length} added`);
  if (diff.removed.length) parts.push(`${diff.removed.length} removed`);
  if (diff.changed.length) parts.push(`${diff.changed.length} changed`);
  if (parts.length) return parts.join(', ');
  if (diff.reorderedOnly) return 'Reordered';
  return null;
}
