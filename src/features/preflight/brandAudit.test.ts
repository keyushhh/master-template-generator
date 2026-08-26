import { describe, it, expect } from 'vitest';
import { auditDeck, snapAll, snapDrift } from './brandAudit';
import { WOZKU_THEME } from '../theme/deckTheme';
import type { Deck, SlideInstance } from '../deck/types';

const slide = (over: Partial<SlideInstance> = {}): SlideInstance => ({
  instanceId: 's-1',
  templateId: 's4',
  group: 'Argument',
  title: 'The claim',
  hidden: false,
  content: {},
  ...over,
});

const deck = (slides: SlideInstance[]): Deck => ({ generated: false, slides });
const audit = (d: Deck) => auditDeck(d, WOZKU_THEME);

describe('off-brand audit', () => {
  it('says nothing about a deck nobody has overridden', () => {
    expect(audit(deck([slide(), slide()]))).toEqual([]);
  });

  it('says nothing when every override is a value the app offered', () => {
    const d = deck([slide({ content: { styles: { heading: { sizePx: 80, lineHeight: 1.15, letterSpacing: -0.02, fontFamily: 'Space Grotesk', color: '10B981' } } } })]);
    expect(audit(d)).toEqual([]);
  });

  it('catches a type size typed between two steps, and offers the nearer one', () => {
    const d = deck([slide({ content: { styles: { heading: { sizePx: 77 } } } })]);
    const [drift] = audit(d);
    expect(drift).toMatchObject({ kind: 'size', slotLabel: 'Heading', fix: 'Use 80px' });
    expect(snapDrift(d, drift).slides[0].content.styles!.heading.sizePx).toBe(80);
  });

  it('catches leading and tracking off the rails', () => {
    const d = deck([slide({ content: { styles: { body: { lineHeight: 1.33, letterSpacing: 0.07 } } } })]);
    expect(audit(d).map((x) => x.kind).sort()).toEqual(['leading', 'tracking']);
    const snapped = snapAll(d, audit(d));
    expect(snapped.slides[0].content.styles!.body).toMatchObject({ lineHeight: 1.4, letterSpacing: 0.08 });
  });

  it('drops a font and a colour override rather than guessing a nearest one', () => {
    const d = deck([slide({ content: { styles: { heading: { fontFamily: 'Comic Sans MS', color: 'FF00AA', bold: true } } } })]);
    const drifts = audit(d);
    expect(drifts.map((x) => x.kind).sort()).toEqual(['colour', 'font']);
    const style = snapAll(d, drifts).slides[0].content.styles!.heading;
    expect(style.fontFamily).toBeUndefined();
    expect(style.color).toBeUndefined();
    // Everything else the user chose stays chosen.
    expect(style.bold).toBe(true);
  });

  it('removes the override entirely when snapping leaves nothing behind', () => {
    const d = deck([slide({ content: { styles: { heading: { color: 'FF00AA' } } } })]);
    const snapped = snapDrift(d, audit(d)[0]);
    expect(snapped.slides[0].content.styles!.heading).toBeUndefined();
  });

  it('flags a slot nudged off the grid and puts it back where the template had it', () => {
    const d = deck([slide({ content: { offsets: { heading: { dx: 37, dy: 0 } } } })]);
    const [drift] = audit(d);
    expect(drift.kind).toBe('position');
    expect(snapDrift(d, drift).slides[0].content.offsets!.heading).toBeUndefined();
  });

  it('leaves a slot nudged a whole grid step alone', () => {
    expect(audit(deck([slide({ content: { offsets: { heading: { dx: 120, dy: -240 } } } })]))).toEqual([]);
  });

  it('flags a shape off the grid and snaps it to the nearest line', () => {
    const d = deck([slide({ content: { overlay: [{ id: 'o1', kind: 'rect', x: 131, y: 240, w: 240, h: 120 }] } })]);
    const [drift] = audit(d);
    expect(drift.kind).toBe('position');
    expect(snapDrift(d, drift).slides[0].content.overlay![0]).toMatchObject({ x: 120, y: 240 });
  });

  it('flags a shape fill nobody offered, and clears it', () => {
    const d = deck([slide({ content: { overlay: [{ id: 'o1', kind: 'rect', x: 120, y: 240, w: 240, h: 120, fill: '123456' }] } })]);
    const drifts = audit(d).filter((x) => x.kind === 'colour');
    expect(drifts).toHaveLength(1);
    expect(snapDrift(d, drifts[0]).slides[0].content.overlay![0].fill).toBeUndefined();
  });

  it('reports where in the deck each drift is, hidden slides counted', () => {
    const d = deck([
      slide({ instanceId: 'a', hidden: true }),
      slide({ instanceId: 'b', title: 'Metrics', content: { styles: { 'bars.0.label': { sizePx: 13 } } } }),
    ]);
    expect(audit(d)[0]).toMatchObject({ slideNumber: 2, slideTitle: 'Metrics', slotLabel: 'Label' });
  });

  it('leaves the deck alone when a drift names a slide that is no longer there', () => {
    const d = deck([slide({ content: { styles: { heading: { sizePx: 77 } } } })]);
    const drift = { ...audit(d)[0], instanceId: 'gone' };
    expect(snapDrift(d, drift).slides[0].content.styles!.heading.sizePx).toBe(77);
  });
});
