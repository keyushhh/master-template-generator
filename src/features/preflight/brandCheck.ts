/**
 * Brand check: contrast and off-palette colour, surfaced before export.
 *
 * `deckTheme.ts` already computes WCAG contrast for the derived accent ramp -
 * that maths just never got shown to anyone. This reuses `contrastRatio`
 * against whatever an editor has actually typed into a slot, which is the one
 * place a hand-picked hex can drift from what the ramp would have chosen.
 */

import type { DeckTheme } from '../theme/deckTheme';
import { contrastRatio } from '../theme/deckTheme';
import { overlayOf } from '../formatting/overlayModel';
import type { SlideInstance } from '../deck/types';

/** WCAG AA for normal-size body text. */
const MIN_TEXT_CONTRAST = 4.5;

export interface BrandCheckIssue {
  instanceId: string;
  title: string;
  n: number;
  kind: 'contrast' | 'off-palette';
  detail: string;
}

/** Every hex the active theme actually uses, so a typed colour that matches
 *  none of them reads as "off palette" rather than "wrong" - a client's
 *  secondary colour picked by eye is a legitimate reason to type a hex, this
 *  just makes sure it was on purpose. */
function themePalette(theme: DeckTheme): Set<string> {
  return new Set(
    [
      theme.accent.base, theme.accent.bright, theme.accent.deep, theme.accent.tint,
      theme.ink.onLight, theme.ink.dimOnLight, theme.ink.mutedOnLight,
      theme.ink.onDark, theme.ink.dimOnDark, theme.ink.headingOnDark,
      theme.surface.light, theme.surface.dark,
      theme.rule.hairline, theme.rule.table,
      ...Object.values(theme.neutral),
    ].map((h) => h.toUpperCase())
  );
}

/** Checks one slide's user-inserted text and fill colours. Template-drawn
 *  content is out of scope here: it already comes from the theme by
 *  construction, so it can't be off-palette and its contrast is the
 *  template's own responsibility, not something an editor typed. */
function checkSlide(slide: SlideInstance, palette: Set<string>): BrandCheckIssue[] {
  const issues: BrandCheckIssue[] = [];
  const push = (kind: BrandCheckIssue['kind'], detail: string) =>
    issues.push({ instanceId: slide.instanceId, title: slide.title, n: 0, kind, detail });

  for (const shape of overlayOf(slide.content)) {
    const textColor = shape.kind === 'text' ? shape.style?.color : undefined;
    if (textColor) {
      if (!palette.has(textColor.toUpperCase())) {
        push('off-palette', `Text colour #${textColor} isn't in the brand palette`);
      }
      // Contrast only has a ground to check against when the box paints its
      // own fill; a transparent text box sits on whatever the template drew
      // underneath, which this check can't see and shouldn't guess at.
      if (shape.fill) {
        const ratio = contrastRatio(textColor, shape.fill);
        if (ratio < MIN_TEXT_CONTRAST) {
          push('contrast', `Text on its own fill is ${ratio.toFixed(1)}:1, below the ${MIN_TEXT_CONTRAST}:1 minimum`);
        }
      }
    }
    if (shape.fill && !palette.has(shape.fill.toUpperCase()) && shape.kind !== 'text') {
      push('off-palette', `Fill colour #${shape.fill} isn't in the brand palette`);
    }
  }

  if (slide.content.background?.kind === 'color' && slide.content.background.color) {
    const bg = slide.content.background.color;
    if (!palette.has(bg.toUpperCase())) {
      push('off-palette', `Background colour #${bg} isn't in the brand palette`);
    }
  }

  return issues;
}

/** One entry per slide with at least one issue, numbered and sorted the same
 *  way `placeholderReport` is, so the two checklists in the export sheet read
 *  consistently. */
export function brandCheckReport(slides: readonly SlideInstance[], theme: DeckTheme): BrandCheckIssue[] {
  const palette = themePalette(theme);
  return slides.flatMap((slide, i) =>
    checkSlide(slide, palette).map((issue) => ({ ...issue, n: i + 1 }))
  );
}
