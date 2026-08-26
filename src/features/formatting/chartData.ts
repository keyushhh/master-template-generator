import type { OverlayChartSeries } from '../deck/types';

/**
 * Adding to a chart, in a way that shows on the chart.
 *
 * A new category used to arrive at zero. That is defensible as data and useless
 * as an interaction: the row appeared in the editor, the bar had no height, the
 * slice had no sweep, and the chart looked broken rather than empty. Nobody adds
 * a category in order to plot nothing, so a new one arrives at the same
 * magnitude as its neighbours and gets typed over.
 *
 * The pair is returned whole because categories and every series' values have to
 * stay the same length: a series one value short renders a gap that only shows
 * up as a missing bar.
 */

export interface ChartData {
  categories: string[];
  series: OverlayChartSeries[];
}

/** A starting value in the same range as the data already there. */
export function seedValue(values: number[]): number {
  const real = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!real.length) return 50;
  return Math.max(1, Math.round(real.reduce((a, b) => a + b, 0) / real.length));
}

export function withCategory({ categories, series }: ChartData): ChartData {
  return {
    categories: [...categories, `Category ${categories.length + 1}`],
    series: series.map((s) => ({ ...s, values: [...s.values, seedValue(s.values)] })),
  };
}

export function withSeries({ categories, series }: ChartData): ChartData {
  // Seeded per category rather than from one average, so a new series follows
  // the shape of the ones beside it instead of drawing a flat line across them.
  const values = categories.map((_, ci) => seedValue(series.map((s) => s.values[ci] ?? 0)));
  return { categories, series: [...series, { name: `Series ${series.length + 1}`, values }] };
}
