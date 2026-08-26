import { describe, it, expect } from 'vitest';
import { diffDecks, diffSummaryText } from './versionDiff';
import type { Deck, SlideInstance } from './types';

const slide = (id: string, title: string, hidden = false): SlideInstance => ({
  instanceId: id,
  templateId: 'agenda',
  group: 'Introduction',
  title,
  hidden,
  content: { styles: {} } as SlideInstance['content'],
});

const deck = (...slides: SlideInstance[]): Deck => ({ generated: false, slides, themeId: 'default' });

describe('diffDecks', () => {
  it('reports a slide present only in the newer deck as added', () => {
    const diff = diffDecks(deck(slide('a', 'Title')), deck(slide('a', 'Title'), slide('b', 'New slide')));
    expect(diff.added).toEqual(['New slide']);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it('reports a slide present only in the older deck as removed', () => {
    const diff = diffDecks(deck(slide('a', 'Title'), slide('b', 'Gone')), deck(slide('a', 'Title')));
    expect(diff.removed).toEqual(['Gone']);
  });

  it('reports a retitled slide as changed, keyed by its new title', () => {
    const diff = diffDecks(deck(slide('a', 'Old title')), deck(slide('a', 'New title')));
    expect(diff.changed).toEqual(['New title']);
  });

  it('reports a slide whose content changed, even with the same title', () => {
    const from = slide('a', 'Title');
    const to = { ...slide('a', 'Title'), content: { styles: { x: {} } } as SlideInstance['content'] };
    const diff = diffDecks(deck(from), deck(to));
    expect(diff.changed).toEqual(['Title']);
  });

  it('reports nothing when the decks are identical', () => {
    const s = slide('a', 'Title');
    const diff = diffDecks(deck(s), deck({ ...s }));
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.reorderedOnly).toBe(false);
  });

  it('flags a pure reorder distinctly from a content change', () => {
    const a = slide('a', 'A');
    const b = slide('b', 'B');
    const diff = diffDecks(deck(a, b), deck(b, a));
    expect(diff.added).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.reorderedOnly).toBe(true);
  });
});

describe('diffSummaryText', () => {
  it('joins non-empty categories', () => {
    expect(diffSummaryText({ added: ['x'], removed: [], changed: ['y', 'z'], reorderedOnly: false })).toBe(
      '1 added, 2 changed'
    );
  });

  it('names a pure reorder when nothing else moved', () => {
    expect(diffSummaryText({ added: [], removed: [], changed: [], reorderedOnly: true })).toBe('Reordered');
  });

  it('returns null when nothing changed at all', () => {
    expect(diffSummaryText({ added: [], removed: [], changed: [], reorderedOnly: false })).toBeNull();
  });
});
