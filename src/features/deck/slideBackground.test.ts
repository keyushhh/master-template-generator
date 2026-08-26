import { describe, it, expect } from 'vitest';
import { canCustomizeBackground, contrastRatio, hexIsDark, importedInk, readableInk } from './slideBackground';

describe('hexIsDark', () => {
  it('reads the grounds the templates actually paint', () => {
    expect(hexIsDark('0B071A')).toBe(true); // AI-Native
    expect(hexIsDark('09090B')).toBe(true); // Startup
    expect(hexIsDark('F4FAF8')).toBe(false); // Wave
    expect(hexIsDark('FFFFFF')).toBe(false); // Swiss
  });

  it('accepts a leading hash and treats junk as light', () => {
    expect(hexIsDark('#0B071A')).toBe(true);
    expect(hexIsDark('not a colour')).toBe(false);
    expect(hexIsDark(undefined)).toBe(false);
  });
});

describe('contrastRatio', () => {
  it('agrees with the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 2);
    // The greys the app uses for small labels: neutral-400 fails AA, 500 passes.
    expect(contrastRatio('#a3a3a3', '#FFFFFF')).toBeLessThan(4.5);
    expect(contrastRatio('#737373', '#FFFFFF')).toBeGreaterThan(4.5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#FEDCBA')).toBeCloseTo(contrastRatio('#FEDCBA', '#123456'), 5);
  });
});

describe('readableInk', () => {
  it('leaves an accent alone when it already clears the threshold', () => {
    expect(readableInk('#FFFFFF', '#067A55')).toBe('067A55');
  });

  it('walks a pale accent darker until it is legible on white', () => {
    const ink = readableInk('#FFFFFF', '#6EE7B7');
    expect(contrastRatio(`#${ink}`, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('walks a deep accent lighter until it is legible on black', () => {
    const ink = readableInk('#0B071A', '#065F46');
    expect(contrastRatio(`#${ink}`, '#0B071A')).toBeGreaterThanOrEqual(4.5);
  });

  it('hands back a malformed colour rather than inventing one', () => {
    expect(readableInk('#FFFFFF', 'nope')).toBe('NOPE');
  });
});

describe('importedInk', () => {
  it('takes its ink from the card an imported run sits on, not the slide', () => {
    // Dark text on a light card, even though the slide behind it is dark.
    expect(importedInk('FFFFFF', '0B071A')).toBe('dark');
    // No card, so the slide decides.
    expect(importedInk(undefined, '0B071A')).toBe('light');
  });
});

describe('canCustomizeBackground', () => {
  it('allows a background override only where the renderer leaves the ground to the wrapper', () => {
    expect(canCustomizeBackground('s7')).toBe(true);
    expect(canCustomizeBackground('blank')).toBe(true);
    // A bespoke template paints its own ground, so an override would cover its content.
    expect(canCustomizeBackground('ai_native_metrics')).toBe(false);
    expect(canCustomizeBackground('wave_gauge')).toBe(false);
  });
});
