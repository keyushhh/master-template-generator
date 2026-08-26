import { describe, it, expect } from 'vitest';
import { seedValue, withCategory, withSeries } from './chartData';

const data = () => ({
  categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [{ name: 'Series 1', values: [30, 45, 60, 80] }],
});

describe('adding to a chart', () => {
  it('gives a new category a value you can actually see', () => {
    const next = withCategory(data());
    expect(next.categories).toHaveLength(5);
    expect(next.series[0].values[4]).toBeGreaterThan(0);
  });

  it('keeps every series the same length as the categories', () => {
    const next = withCategory({
      categories: ['A', 'B'],
      series: [{ name: 'One', values: [10, 20] }, { name: 'Two', values: [5, 6] }],
    });
    for (const s of next.series) expect(s.values).toHaveLength(next.categories.length);
  });

  it('starts a new category in the same range as the data beside it', () => {
    expect(withCategory(data()).series[0].values[4]).toBe(54);
  });

  it('gives a new series a value per category, shaped like its neighbours', () => {
    const next = withSeries(data());
    expect(next.series).toHaveLength(2);
    expect(next.series[1].values).toEqual([30, 45, 60, 80]);
  });

  it('does not touch the categories when adding a series', () => {
    expect(withSeries(data()).categories).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
  });

  it('picks a usable value for a chart that is all zeros', () => {
    const next = withCategory({ categories: ['A'], series: [{ name: 'One', values: [0] }] });
    expect(next.series[0].values[1]).toBe(50);
  });

  it('never seeds a zero, which is the bug this exists to prevent', () => {
    expect(seedValue([0, 0, 0])).toBeGreaterThan(0);
    expect(seedValue([])).toBeGreaterThan(0);
    expect(seedValue([0.2, 0.4])).toBeGreaterThan(0);
  });

  it('ignores the zeros when averaging, so one empty row does not halve the seed', () => {
    expect(seedValue([100, 0])).toBe(100);
  });
});
