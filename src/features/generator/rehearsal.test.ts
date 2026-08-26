import { describe, it, expect } from 'vitest';
import { formatSeconds, paceReading, rehearsalRows, rehearsalSummary } from './rehearsal';
import type { SlideInstance } from '../deck/types';

const slide = (id: string, title: string): SlideInstance => ({
  instanceId: id,
  templateId: 's4',
  group: 'Argument',
  title,
  hidden: false,
  content: {},
});

const visible = [slide('a', 'Cover'), slide('b', 'The finding'), slide('c', 'Ask')];

describe('rehearsal timings', () => {
  it('lists the slowest slide first', () => {
    const rows = rehearsalRows(visible, { a: 30, b: 200, c: 40 });
    expect(rows.map((r) => r.title)).toEqual(['The finding', 'Ask', 'Cover']);
  });

  it('leaves out the slides the run never reached', () => {
    const rows = rehearsalRows(visible, { a: 30 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ n: 1, share: 1 });
  });

  it('flags a slide that took more than twice its fair share', () => {
    const rows = rehearsalRows(visible, { a: 10, b: 200, c: 10 });
    expect(rows.find((r) => r.title === 'The finding')?.overlong).toBe(true);
    expect(rows.find((r) => r.title === 'Cover')?.overlong).toBe(false);
  });

  it('keeps its numbering from the deck, not from the sorted list', () => {
    const rows = rehearsalRows(visible, { c: 90, a: 10 });
    expect(rows[0]).toMatchObject({ n: 3, title: 'Ask' });
  });
});

describe('pace against a target', () => {
  it('says nothing without a target', () => {
    expect(paceReading(600, null, 2, 10).state).toBe('none');
  });

  it('is on pace at the halfway point of a ten minute deck', () => {
    expect(paceReading(300, 10, 5, 10)).toMatchObject({ state: 'on', label: 'On pace' });
  });

  it('reports being behind, with how far', () => {
    const reading = paceReading(300, 10, 2, 10);
    expect(reading.state).toBe('behind');
    expect(reading.label).toBe('03:00 behind');
  });

  it('reports being ahead', () => {
    expect(paceReading(60, 10, 5, 10)).toMatchObject({ state: 'ahead', label: '04:00 ahead' });
  });

  it('says over rather than behind once the target has gone', () => {
    expect(paceReading(700, 10, 9, 10)).toMatchObject({ state: 'over', label: '01:40 over' });
  });

  it('tolerates half a minute either way on a short deck', () => {
    expect(paceReading(170, 5, 3, 5).state).toBe('on');
  });
});

describe('the run summary', () => {
  it('says nothing happened when the timer never ran', () => {
    const summary = rehearsalSummary(visible, {}, 10);
    expect(summary.slidesCovered).toBe(0);
    expect(summary.verdict).toContain('never ran');
  });

  it('names the slide that ate the overrun', () => {
    const summary = rehearsalSummary(visible, { a: 60, b: 600, c: 60 }, null);
    expect(summary.againstTarget).toBe(null);
    const withTarget = rehearsalSummary(visible, { a: 60, b: 600, c: 60 }, 10);
    expect(withTarget.againstTarget).toBe(120);
    expect(withTarget.verdict).toContain('slide 2');
  });

  it('says there is room to say more when a run came in short', () => {
    expect(rehearsalSummary(visible, { a: 30, b: 30 }, 10).verdict).toContain('room to say more');
  });

  it('calls a run inside a minute of target on target', () => {
    expect(rehearsalSummary(visible, { a: 300, b: 280 }, 10).verdict).toContain('On target');
  });

  it('formats hours only once there are any', () => {
    expect(formatSeconds(59)).toBe('00:59');
    expect(formatSeconds(600)).toBe('10:00');
    expect(formatSeconds(3725)).toBe('1:02:05');
  });
});
