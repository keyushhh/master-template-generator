import type { Deck, SlideInstance } from '../deck/types';
import { mintInstanceId } from '../deck/deckBuilder';
import type { ImportedSlide } from './pptxParser';

/**
 * Turns parsed .pptx slides into a Deck the app can render, edit, reorder and
 * export like any other - the imported slides just carry positioned shapes
 * instead of template slots.
 *
 * `into` is the template the user is importing on top of. Without it the deck
 * came back with no theme and no template at all, so uploading a .pptx threw
 * away whichever template had been chosen and fell back to the house one: the
 * deck was still named after the template it no longer used.
 */
export function buildDeckFromImport(
  slides: ImportedSlide[],
  into?: { themeId?: string; presentationTemplateId?: string }
): Deck {
  return {
    generated: true,
    themeId: into?.themeId,
    presentationTemplateId: into?.presentationTemplateId,
    slides: slides.map<SlideInstance>((s, i) => ({
      instanceId: mintInstanceId('imported'),
      templateId: 'imported',
      group: 'Imported',
      title: s.title || `Slide ${i + 1}`,
      hidden: false,
      content: {
        shapes: s.shapes,
        importedBase: s.base,
      },
    })),
  };
}
