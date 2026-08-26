import { describe, it, expect } from 'vitest';
import { planSwitch, applySwitch } from './templateSwitch';
import type { SlideInstance, SlideContent } from './types';

const slide = (templateId: string, content: SlideContent, titleCustomized?: boolean): SlideInstance => ({
  instanceId: 'x',
  templateId,
  group: 'Introduction',
  title: 'Whatever',
  hidden: false,
  titleCustomized,
  content,
});

describe('planSwitch', () => {
  it('reports the fields the destination will keep', () => {
    const plan = planSwitch(slide('s3', { heading: 'Hello', body: 'Copy' }), 's14');
    expect(plan.carries).toContain('Heading');
    expect(plan.carries).toContain('Body');
  });

  it('reports content the destination cannot draw as parked, not lost', () => {
    const plan = planSwitch(slide('s7', { bars: [{ label: 'A', pct: 50 }], heading: 'H' }), 's13');
    expect(plan.parks.join(' ')).toMatch(/bar/);
  });

  it('converts between lists of the same shape', () => {
    const plan = planSwitch(
      slide('s2', { parts: [{ title: 'One', description: 'a' }, { title: 'Two', description: 'b' }] }),
      's11'
    );
    expect(plan.converts.join(' ')).toMatch(/agenda parts.*process steps/);
  });

  it('warns when the destination shows fewer items than there are', () => {
    const parts = Array.from({ length: 7 }, (_, i) => ({ title: `P${i}`, description: 'x' }));
    const plan = planSwitch(slide('s11', { steps: parts }), 's2');
    expect(plan.cappedNote).toBeTruthy();
    expect(plan.cappedNote).toMatch(/reappear if you switch back/);
  });

  it('renames a slide whose title the user never touched, and leaves theirs alone', () => {
    expect(planSwitch(slide('s3', {}), 's13').newTitle).toBe('Featured Quote');
    expect(planSwitch(slide('s3', {}, true), 's13').newTitle).toBeUndefined();
  });

  it('treats overlay shapes, styles and notes as template-independent', () => {
    const plan = planSwitch(
      slide('s3', { heading: 'H', overlay: [{ id: 'o1', kind: 'rect', x: 0, y: 0, w: 10, h: 10 }], styles: { heading: { bold: true } } }),
      's13'
    );
    expect(plan.parks.join(' ')).not.toMatch(/shape|style/i);
  });

  // A shared layout reads the fields of the classic slide it exports as, so a
  // switch into one has to carry the same content a switch into that slide does.
  it('knows what the shared template layouts read', () => {
    const plan = planSwitch(slide('s7', { bars: [{ label: 'A', pct: 10 }], kpis: [{ label: 'K', value: '1' }] }), 'wave_gauge');
    expect(plan.parks.join(' ')).not.toMatch(/bar/);
  });
});

describe('applySwitch', () => {
  it('changes the template and keeps the parked content in place', () => {
    const before = slide('s7', { bars: [{ label: 'A', pct: 50 }], heading: 'Growth' });
    const after = applySwitch(before, 's13');
    expect(after.templateId).toBe('s13');
    expect(after.content.bars).toEqual(before.content.bars);
  });

  it('is lossless there and back', () => {
    const before = slide('s7', { bars: [{ label: 'A', pct: 50 }], kpis: [{ label: 'K', value: '1' }], heading: 'Growth' });
    const round = applySwitch(applySwitch(before, 's13'), 's7');
    expect(round.templateId).toBe('s7');
    expect(round.content.bars).toEqual(before.content.bars);
    expect(round.content.kpis).toEqual(before.content.kpis);
    expect(round.content.heading).toBe('Growth');
  });

  it('splits a heading into hero lines for a cover, and joins them coming back', () => {
    const toCover = applySwitch(slide('s3', { heading: 'Two\nLines' }), 's1');
    expect(toCover.content.headingLines).toEqual(['Two', 'Lines']);

    const fromCover = applySwitch(slide('s1', { headingLines: ['Two', 'Lines'] }), 's3');
    expect(fromCover.content.heading).toBe('Two\nLines');
  });

  it('copies a same-family list without emptying the original', () => {
    const before = slide('s2', { parts: [{ title: 'One', description: 'a' }] });
    const after = applySwitch(before, 's11');
    expect(after.content.steps).toEqual([{ title: 'One', description: 'a' }]);
    expect(after.content.parts).toEqual(before.content.parts);
  });

  it('does not overwrite a list the destination already has', () => {
    const before = slide('s2', {
      parts: [{ title: 'From parts', description: 'a' }],
      steps: [{ title: 'Existing step', description: 'b' }],
    });
    const after = applySwitch(before, 's11');
    expect(after.content.steps).toEqual([{ title: 'Existing step', description: 'b' }]);
  });
});
