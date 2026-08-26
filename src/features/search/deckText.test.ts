import { describe, it, expect } from 'vitest';
import { findDeckText, slideStrings } from './deckText';
import type { Deck, SlideInstance } from '../deck/types';

const slide = (over: Partial<SlideInstance> = {}): SlideInstance => ({
  instanceId: 's-1',
  templateId: 's1',
  group: 'Introduction',
  title: 'Cover',
  hidden: false,
  content: {},
  ...over,
});

const deck = (slides: SlideInstance[]): Deck => ({ generated: false, slides });

describe('slide text search', () => {
  it('finds a word in a content field', () => {
    const hit = findDeckText(deck([slide({ content: { heading: 'Retention is the story' } })]), 'retention');
    expect(hit?.slideNumber).toBe(1);
    expect(hit?.snippet).toBe('Retention is the story');
  });

  it('reads fields nobody listed here, so a new slot is searchable the day it lands', () => {
    const strings = slideStrings(slide({ content: { madeUpFutureSlot: 'churn' } as never }));
    expect(strings).toContain('churn');
  });

  it('reaches into overlay shapes and notes', () => {
    const d = deck([
      slide({ notes: 'Mention the pilot' }),
      slide({ content: { overlay: [{ id: 'o1', kind: 'text', x: 0, y: 0, w: 1, h: 1, text: 'Deep inside' }] } }),
    ]);
    expect(findDeckText(d, 'pilot')?.slideNumber).toBe(1);
    expect(findDeckText(d, 'deep inside')?.slideNumber).toBe(2);
  });

  it('reports the slide it found, not the first slide', () => {
    const d = deck([slide(), slide(), slide({ title: 'Pricing', content: { heading: 'What it costs' } })]);
    expect(findDeckText(d, 'costs')).toMatchObject({ slideNumber: 3, slideTitle: 'Pricing' });
  });

  it('never matches inside an image data URL', () => {
    const url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH';
    expect(findDeckText(deck([slide({ content: { imageUrl: url } })]), 'AAAA')).toBeNull();
  });

  it('ignores ids and colours, which are not things a deck says', () => {
    const d = deck([slide({ templateId: 's7', content: { accentColor: 'D97706' } as never })]);
    expect(findDeckText(d, 'D97706')).toBeNull();
    expect(findDeckText(d, 's7')).toBeNull();
  });

  it('shortens a long line around the match', () => {
    const long = `${'padding words '.repeat(20)}needle${' more words'.repeat(20)}`;
    const hit = findDeckText(deck([slide({ content: { body: long } })]), 'needle');
    expect(hit!.snippet.length).toBeLessThan(80);
    expect(hit!.snippet).toContain('needle');
    expect(hit!.snippet.startsWith('…')).toBe(true);
  });

  it('needs two characters, so a single keystroke does not match the whole library', () => {
    expect(findDeckText(deck([slide({ content: { heading: 'Anything' } })]), 'a')).toBeNull();
  });

  it('searches hidden slides too, and counts them in the number it reports', () => {
    const d = deck([slide({ hidden: true }), slide({ content: { heading: 'Visible thing' } })]);
    expect(findDeckText(d, 'visible thing')?.slideNumber).toBe(2);
  });
});
