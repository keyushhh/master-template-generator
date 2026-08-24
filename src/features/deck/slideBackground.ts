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
