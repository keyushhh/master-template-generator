import { describe, it, expect } from 'vitest';
import { proposeAccent, saturationLightness } from './logoPalette';

/** The canvas half needs a browser; this is the judgement half, which is where
 *  the decisions are. */
describe('accent proposed from a logo', () => {
  it('passes over the white a logo mostly is', () => {
    expect(proposeAccent([
      { hex: 'FFFFFF', share: 0.72 },
      { hex: '1D4ED8', share: 0.2 },
    ])).toBe('1D4ED8');
  });

  it('passes over near-black and grey, which cannot carry an accent', () => {
    expect(proposeAccent([
      { hex: '111111', share: 0.5 },
      { hex: '808080', share: 0.3 },
      { hex: 'D9480F', share: 0.2 },
    ])).toBe('D9480F');
  });

  it('takes the biggest usable colour, not the most saturated one', () => {
    expect(proposeAccent([
      { hex: '2563EB', share: 0.4 },
      { hex: 'FF0000', share: 0.1 },
    ])).toBe('2563EB');
  });

  it('rejects a colour too pale to hold white text', () => {
    expect(proposeAccent([{ hex: 'F3E8FF', share: 0.9 }, { hex: '7C3AED', share: 0.1 }])).toBe('7C3AED');
  });

  it('falls back to any colour at all rather than nothing, when a mark is black and white', () => {
    expect(proposeAccent([{ hex: 'FFFFFF', share: 0.9 }, { hex: '000000', share: 0.1 }])).toBeUndefined();
    expect(proposeAccent([{ hex: 'FFFFFF', share: 0.9 }, { hex: '222222', share: 0.1 }])).toBe('222222');
  });

  it('says nothing about an image with no colours in it', () => {
    expect(proposeAccent([])).toBeUndefined();
  });

  it('reads saturation and lightness the way the picker does', () => {
    expect(saturationLightness(255, 255, 255)).toMatchObject({ s: 0, l: 1 });
    expect(saturationLightness(0, 0, 0)).toMatchObject({ s: 0, l: 0 });
    const emerald = saturationLightness(16, 185, 129);
    expect(emerald.s).toBeGreaterThan(0.7);
    expect(emerald.l).toBeGreaterThan(0.3);
    expect(emerald.l).toBeLessThan(0.5);
  });
});
