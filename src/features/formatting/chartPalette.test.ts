import { describe, it, expect } from 'vitest';
import { chartColorsFor, themeChartPalette, withChartColor } from './chartPalette';
import { WOZKU_THEME, brandKitTheme } from '../theme/deckTheme';

const CLIENT = brandKitTheme({ id: 'k1', name: 'Northwind', accent: '2563EB' });

describe('chart palette', () => {
  it('starts from the deck’s accent, so a one-series chart is the accent', () => {
    expect(chartColorsFor(WOZKU_THEME, 1)[0]).toBe(WOZKU_THEME.accent.base.toUpperCase());
    expect(chartColorsFor(CLIENT, 1)[0]).toBe(CLIENT.accent.base.toUpperCase());
  });

  it('draws a client deck in the client’s colours, not Wozku’s', () => {
    const wozku = chartColorsFor(WOZKU_THEME, 5);
    const client = chartColorsFor(CLIENT, 5);
    expect(client[0]).not.toBe(wozku[0]);
    // The greyscale scaffolding is shared across kits, so only the accent steps
    // are expected to differ.
    expect(client).not.toEqual(wozku);
  });

  it('gives every index a colour, cycling past the end of the palette', () => {
    const colours = chartColorsFor(WOZKU_THEME, 7);
    expect(colours).toHaveLength(7);
    expect(colours[5]).toBe(colours[0]);
    expect(colours.every((c) => /^[0-9A-F]{6}$/.test(c))).toBe(true);
  });

  it('honours an override at one index and leaves the rest alone', () => {
    const colours = chartColorsFor(WOZKU_THEME, 3, ['', 'FF0000']);
    expect(colours[0]).toBe(themeChartPalette(WOZKU_THEME)[0]);
    expect(colours[1]).toBe('FF0000');
    expect(colours[2]).toBe(themeChartPalette(WOZKU_THEME)[2]);
  });

  it('ignores an override that is not a colour', () => {
    expect(chartColorsFor(WOZKU_THEME, 1, ['nonsense'])[0]).toBe(themeChartPalette(WOZKU_THEME)[0]);
  });

  it('accepts a hex with a hash, since that is what a user types', () => {
    expect(chartColorsFor(WOZKU_THEME, 1, ['#ff0000'])[0]).toBe('FF0000');
  });

  it('stores an override without disturbing its neighbours', () => {
    expect(withChartColor(undefined, 2, 'FF0000')).toEqual(['', '', 'FF0000']);
    expect(withChartColor(['AAAAAA'], 1, 'BBBBBB')).toEqual(['AAAAAA', 'BBBBBB']);
  });

  it('drops the array once nothing is overridden, rather than keeping empty noise', () => {
    expect(withChartColor(['FF0000'], 0, undefined)).toBeUndefined();
    expect(withChartColor(['', 'FF0000'], 1, undefined)).toBeUndefined();
    expect(withChartColor(['AAAAAA', 'FF0000'], 1, undefined)).toEqual(['AAAAAA']);
  });

  it('asks for no colours when there is nothing to draw', () => {
    expect(chartColorsFor(WOZKU_THEME, 0)).toEqual([]);
  });
});
