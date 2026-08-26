import type { DeckTheme } from '../theme/deckTheme';

/**
 * The colours a chart cycles, and the one place that decides them.
 *
 * Chart colours were five hardcoded hexes: Wozku's emerald, Wozku's ink,
 * Wozku's mint. A deck on a client's brand kit therefore drew its charts in
 * somebody else's brand, which is the one thing the kit exists to prevent - and
 * nothing said so, because a chart in the wrong green still looks like a chart.
 *
 * The palette is derived from the deck's theme instead, in an order chosen so a
 * one-series chart is the accent (the thing being argued about) and a
 * five-series chart still separates cleanly. A per-index override rides on top
 * for the case the rails cannot cover: a series that has to be the colour the
 * client's own report uses.
 *
 * Both consumers - the SVG on the canvas and pptxgenjs on the way out - read
 * this function. That is deliberate: a chart whose colours differ between the
 * screen and the file is the export bug this repo is most careful about.
 */

/** Names shown against each swatch in the picker, in palette order. */
export const CHART_SLOT_LABELS = ['Accent', 'Ink', 'Accent wash', 'Muted', 'Accent bright'] as const;

/** Bare 6-digit hex, no '#'. */
function slots(theme: DeckTheme): string[] {
  return [
    theme.accent.base,
    // Ink rather than a second hue: two series read as "the one that matters and
    // the one it is measured against", which is what a two-series chart is.
    theme.styleSystem?.isDarkSlideDefault ? theme.ink.onDark : theme.ink.onLight,
    theme.accent.tint,
    theme.neutral.n500,
    theme.accent.bright,
  ].map((hex) => hex.replace('#', '').toUpperCase());
}

/** The deck's own chart palette, before any overrides. */
export function themeChartPalette(theme: DeckTheme): string[] {
  return slots(theme);
}

/**
 * The colour for every index a chart will draw, overrides applied.
 *
 * `count` is asked for explicitly so a six-series chart gets six colours rather
 * than running off the end of the palette: past the fifth it cycles, which is
 * the same thing the old hardcoded list did.
 */
export function chartColorsFor(theme: DeckTheme, count: number, override?: string[]): string[] {
  const palette = slots(theme);
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const own = override?.[i]?.replace('#', '').toUpperCase();
    return own && /^[0-9A-F]{6}$/.test(own) ? own : palette[i % palette.length];
  });
}

/** '#RRGGBB', for CSS. */
export function cssHex(hex: string): string {
  return `#${hex.replace('#', '')}`;
}

/**
 * Overrides with one index changed, trimmed so an all-default list is stored as
 * nothing at all.
 *
 * `undefined` at an index means "the deck's own colour", and a trailing run of
 * those is the same as an absent array - which matters because an empty
 * override left on the shape would survive into every export and backup as
 * noise nobody chose.
 */
export function withChartColor(
  override: string[] | undefined,
  index: number,
  hex: string | undefined
): string[] | undefined {
  const next = [...(override ?? [])];
  while (next.length <= index) next.push('');
  next[index] = hex ? hex.replace('#', '').toUpperCase() : '';
  while (next.length > 0 && !next[next.length - 1]) next.pop();
  return next.length ? next : undefined;
}
