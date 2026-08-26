import { describe, it, expect } from 'vitest';
import { addVariant, chooseVariant, tidyVariants, variantGroupOf, variantLabel } from './variants';
import type { Deck, SlideInstance } from './types';

const slide = (id: string, over: Partial<SlideInstance> = {}): SlideInstance => ({
  instanceId: id,
  templateId: 's4',
  group: 'Argument',
  title: 'The claim',
  hidden: false,
  content: { heading: 'Original' },
  ...over,
});

const deck = (slides: SlideInstance[]): Deck => ({ generated: false, slides });

describe('slide variants', () => {
  it('leaves the deck showing what it showed before', () => {
    const next = addVariant(deck([slide('a'), slide('b')]), 'a');
    expect(next.slides.map((s) => s.hidden)).toEqual([false, true, false]);
    expect(next.slides[0].instanceId).toBe('a');
  });

  it('puts the new version straight after the slide it came from', () => {
    const next = addVariant(deck([slide('a'), slide('b')]), 'a');
    expect(next.slides[1].variantGroup).toBe(next.slides[0].variantGroup);
    expect(next.slides[2].instanceId).toBe('b');
  });

  it('keeps the title, because these are two takes on one slide', () => {
    const next = addVariant(deck([slide('a')]), 'a');
    expect(next.slides[1].title).toBe('The claim');
  });

  it('gives the copy its own content, so editing one does not edit the other', () => {
    const next = addVariant(deck([slide('a')]), 'a');
    next.slides[1].content.heading = 'Rewritten';
    expect(next.slides[0].content.heading).toBe('Original');
  });

  it('groups a third version with the first two rather than between them', () => {
    let d = addVariant(deck([slide('a'), slide('z')]), 'a');
    d = addVariant(d, 'a');
    expect(d.slides.length).toBe(4);
    expect(d.slides[3].instanceId).toBe('z');
    expect(new Set(d.slides.slice(0, 3).map((s) => s.variantGroup)).size).toBe(1);
  });

  it('shows exactly one version when one is chosen', () => {
    let d = addVariant(deck([slide('a')]), 'a');
    d = addVariant(d, 'a');
    const third = d.slides[2].instanceId;
    d = chooseVariant(d, third);
    expect(d.slides.filter((s) => !s.hidden).map((s) => s.instanceId)).toEqual([third]);
  });

  it('labels the versions A and B in deck order', () => {
    const d = addVariant(deck([slide('a')]), 'a');
    expect(variantLabel(d.slides, 'a')).toBe('A');
    expect(variantLabel(d.slides, d.slides[1].instanceId)).toBe('B');
    expect(variantLabel(deck([slide('lone')]).slides, 'lone')).toBeNull();
  });

  it('reports a slide with no versions as having no group', () => {
    expect(variantGroupOf(deck([slide('a')]).slides, 'a')).toEqual([]);
  });

  it('turns the survivor back into an ordinary slide when its sibling is deleted', () => {
    const d = addVariant(deck([slide('a')]), 'a');
    const survivor = d.slides[1].instanceId;
    // Delete version A, exactly as the page's delete does.
    const tidied = tidyVariants({ ...d, slides: d.slides.filter((s) => s.instanceId !== 'a') });
    expect(tidied.slides).toHaveLength(1);
    expect(tidied.slides[0].instanceId).toBe(survivor);
    expect(tidied.slides[0].variantGroup).toBeUndefined();
    expect(tidied.slides[0].hidden).toBe(false);
  });

  it('never lets two versions be visible at once', () => {
    const d = addVariant(deck([slide('a')]), 'a');
    const both = { ...d, slides: d.slides.map((s) => ({ ...s, hidden: false })) };
    expect(tidyVariants(both).slides.map((s) => s.hidden)).toEqual([false, true]);
  });

  it('leaves a whole group hidden alone, since hiding the slide is a real thing to want', () => {
    const d = addVariant(deck([slide('a')]), 'a');
    const allHidden = { ...d, slides: d.slides.map((s) => ({ ...s, hidden: true })) };
    expect(tidyVariants(allHidden).slides.every((s) => s.hidden)).toBe(true);
  });

  it('is the same object for a deck with no variants at all', () => {
    const d = deck([slide('a'), slide('b')]);
    expect(tidyVariants(d)).toBe(d);
  });
});
