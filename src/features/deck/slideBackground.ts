import type { CSSProperties } from 'react';
import type { SlideBackground, SlideTemplateId } from './types';

/** Slide types that render as a bare fragment relying entirely on the shared
 *  canvas wrapper for their background (see PresentationCanvas.tsx's slide
 *  root render), rather than painting their own opaque background like every
 *  bespoke template (Editorial, Wave, Swiss, ...) does. A custom background
 *  override only composites correctly on these - elsewhere it would paint
 *  over the template's own content, not just its background. */
export const BACKGROUND_CUSTOMIZABLE_TEMPLATE_IDS: ReadonlySet<SlideTemplateId> = new Set([
  's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13', 's14',
  'blank', 'imported',
]);

export function canCustomizeBackground(templateId: SlideTemplateId): boolean {
  return BACKGROUND_CUSTOMIZABLE_TEMPLATE_IDS.has(templateId);
}

/** Whether text on this background has to be light. Lives here rather than in
 *  the canvas so the deck builders pick the same ink the renderer will. */
export function hexIsDark(base?: string): boolean {
  if (!base) return false;
  const h = base.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

/** Ink for imported text with no colour of its own: taken from the card it sits
 *  on when it has one, else from the slide. Shared so the canvas and the .pptx
 *  exporter cannot disagree about whether a run is readable. */
export function importedInk(shapeFill: string | undefined, slideBase: string | undefined): 'light' | 'dark' {
  return hexIsDark(shapeFill ?? slideBase) ? 'light' : 'dark';
}

/** WCAG relative luminance. Gamma-corrected, unlike the quick average
 *  `hexIsDark` uses, because a contrast ratio is only meaningful with it. */
function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast ratio between two colours, 1 (identical) to 21 (black/white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The brand ink, taken far enough to actually be read against `bg`.
 *
 * A four-step accent ramp is a design, not a contrast guarantee: an accent pale
 * enough to work as a wash leaves its own deep step short of legible on it, and
 * a kit whose tint is dark leaves every step short. Rather than pick a
 * different colour, this walks the chosen one toward black or white (whichever
 * direction the background is not) until it clears the threshold, so the chip
 * keeps the brand's hue and stops being decorative-only.
 *
 * 4.5:1 is the WCAG AA floor for text at normal size.
 */
export function readableInk(bg: string, preferred: string, min = 4.5): string {
  const clean = preferred.replace('#', '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(clean)) return clean;
  const toward = hexIsDark(bg) ? 255 : 0;
  const rgb = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));

  let out = clean;
  for (let step = 0; step <= 20; step++) {
    if (contrastRatio(out, bg) >= min) return out;
    const t = (step + 1) / 20;
    out = rgb
      .map((v) => Math.round(v + (toward - v) * t).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return out;
}

/** CSS for a custom slide background override. Returns undefined when there's
 *  nothing to override, so the caller falls through to the template default. */
export function backgroundCssFor(bg: SlideBackground | undefined): CSSProperties | undefined {
  if (!bg) return undefined;
  switch (bg.kind) {
    case 'color':
      return { backgroundColor: `#${bg.color ?? 'FFFFFF'}` };
    case 'gradient':
      return {
        backgroundImage: `linear-gradient(${bg.gradientAngle ?? 135}deg, #${bg.gradientFrom ?? 'FFFFFF'}, #${bg.gradientTo ?? '10B981'})`,
      };
    case 'image':
      return bg.imageUrl
        ? { backgroundImage: `url(${bg.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { backgroundColor: '#FFFFFF' };
    case 'none':
      return { backgroundColor: '#FFFFFF' };
    default:
      return undefined;
  }
}
