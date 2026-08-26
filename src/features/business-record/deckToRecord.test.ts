import { describe, it, expect } from 'vitest';
import { deckToRecord, recordFileName } from './deckToRecord';
import { validateBusinessRecord } from './parser/validator';
import { tokenize } from './parser/lexer';
import { parse } from './parser/parser';
import { buildDeckFromDocument } from '../deck/deckBuilder';
import type { Deck, SlideContent, SlideInstance, SlideTemplateId } from '../deck/types';

const slide = (templateId: SlideTemplateId, content: SlideContent, over: Partial<SlideInstance> = {}): SlideInstance => ({
  instanceId: `i-${templateId}-${Math.random().toString(36).slice(2, 6)}`,
  templateId,
  group: 'Argument',
  title: 'A slide',
  hidden: false,
  content,
  ...over,
});

/** A deck with one of every slide type the record grammar has a keyword for. */
function fullDeck(): Deck {
  return {
    generated: true,
    slides: [
      slide('s1', { headingLines: ['Retention', 'Rebuilt.'], eyebrow: 'Q3 review', tagline: 'One number moved.', projectLabel: 'Northwind' }, { title: 'Cover' }),
      slide('s3', { body: 'Churn was the whole story.\nThe fix was one screen.' }, { title: 'Executive Summary' }),
      slide('s4', { heading: 'Where the time went', subtitle: 'Four weeks of sessions' }, { title: 'Divider' }),
      slide('s5', { leftHeading: 'Today', leftBody: 'Six steps.', rightHeading: 'Proposed', rightBody: 'Two steps.', leftAttributes: ['61 sessions', '8s loads'] }),
      slide('s6', { value: '94', unit: '%', stat: 'Completion rate', caption: 'After the rebuild.' }),
      slide('s7', { bars: [{ label: 'Activation', pct: 62.4, active: true }, { label: 'Retention', pct: 41 }], kpis: [{ label: 'ARR', value: '£2.4M' }] }),
      slide('s8', { rows: [{ dim: 'Steps', cur: '6', tgt: '2', delta: 'Down 4' }] }),
      slide('s9', { phases: [{ title: 'Discovery', description: 'Two weeks', completed: true }, { title: 'Build', description: 'Six weeks' }] }),
      slide('s11', { steps: [{ title: 'Map', description: 'Every screen' }] }),
      slide('s12', { sectors: [{ label: 'EMEA', value: 'Live' }] }),
      slide('s13', { quote: 'We stopped losing people at step four.', author: 'Dana Reeve', role: 'VP Product, Northwind' }),
      slide('s14', { body: 'Next steps are yours.', contacts: ['hello@wozku.com', '@wozku', 'wozku.com'] }),
    ],
  };
}

describe('deck back to a Business Record', () => {
  it('writes a record the app itself accepts', () => {
    const record = deckToRecord(fullDeck(), null, 'Northwind Retention');
    const result = validateBusinessRecord(record, 'out.md');
    expect(result.errors.filter((e) => e.severity === 'error')).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it('goes back through the front door and rebuilds the same slide types', () => {
    const record = deckToRecord(fullDeck(), null, 'Northwind Retention');
    const ast = parse(tokenize(record));
    const rebuilt = buildDeckFromDocument(ast);
    const visible = rebuilt.slides.filter((s) => !s.hidden).map((s) => s.templateId);
    for (const expected of ['s1', 's3', 's5', 's6', 's7', 's8', 's9', 's11', 's12', 's13', 's14']) {
      expect(visible).toContain(expected);
    }
  });

  it('carries the numbers, not just the headings', () => {
    const record = deckToRecord(fullDeck(), null, 'Northwind');
    const ast = parse(tokenize(record));
    const rebuilt = buildDeckFromDocument(ast);
    const monument = rebuilt.slides.find((s) => s.templateId === 's6');
    expect(monument?.content.value).toBe('94');
    expect(monument?.content.unit).toBe('%');
    const metrics = rebuilt.slides.find((s) => s.templateId === 's7');
    expect(metrics?.content.bars?.[0]).toMatchObject({ label: 'Activation', active: true });
    expect(metrics?.content.kpis?.[0]).toMatchObject({ label: 'ARR', value: '£2.4M' });
    const table = rebuilt.slides.find((s) => s.templateId === 's8');
    expect(table?.content.rows?.[0]).toMatchObject({ dim: 'Steps', cur: '6', tgt: '2', delta: 'Down 4' });
    const quote = rebuilt.slides.find((s) => s.templateId === 's13');
    expect(quote?.content.author).toBe('Dana Reeve');
  });

  it('puts the cover in the frontmatter rather than in a section', () => {
    const record = deckToRecord(fullDeck(), null, 'Northwind');
    expect(record).toContain('title: Retention Rebuilt.');
    expect(record).toContain('client: Northwind');
    expect(record.match(/^## /gm)?.some((h) => h.includes('Cover'))).toBeFalsy();
  });

  it('leaves out the slides the deck itself leaves out', () => {
    const deck = fullDeck();
    deck.slides[10] = { ...deck.slides[10], hidden: true };
    const record = deckToRecord(deck, null, 'Northwind');
    expect(record).not.toContain('## Quote');
  });

  it('gives a slide type with no keyword its own heading', () => {
    const deck: Deck = {
      generated: false,
      slides: [slide('editorial_statement', { heading: 'The market moved' }, { title: 'Statement' })],
    };
    const record = deckToRecord(deck, null, 'Bespoke');
    expect(record).toContain('## Statement');
    expect(record).toContain('The market moved');
    expect(validateBusinessRecord(record, 'out.md').isValid).toBe(true);
  });

  it('keeps a pipe in someone else’s copy from breaking the bullet it sits in', () => {
    const deck: Deck = { generated: false, slides: [slide('s7', { kpis: [{ label: 'A | B', value: '1 | 2' }] })] };
    const ast = parse(tokenize(deckToRecord(deck, null, 'x')));
    const rebuilt = buildDeckFromDocument(ast);
    expect(rebuilt.slides.find((s) => s.templateId === 's7')?.content.kpis?.[0]).toMatchObject({ label: 'A / B', value: '1 / 2' });
  });

  it('carries speaker notes into the record as words rather than dropping them', () => {
    const deck: Deck = { generated: false, slides: [slide('s3', { body: 'Body' }, { notes: 'Pause here.' })] };
    expect(deckToRecord(deck, null, 'x')).toContain('Pause here.');
  });

  it('carries text boxes the user added by hand', () => {
    const deck: Deck = {
      generated: false,
      slides: [slide('s3', { body: 'Body', overlay: [{ id: 'o1', kind: 'text', x: 0, y: 0, w: 100, h: 40, text: 'Added by hand' }] })],
    };
    expect(deckToRecord(deck, null, 'x')).toContain('Added by hand');
  });

  it('names the file after the deck', () => {
    expect(recordFileName('UX Journey & Flow')).toBe('ux-journey-flow-business-record.md');
    expect(recordFileName('   ')).toBe('deck-business-record.md');
  });
});
