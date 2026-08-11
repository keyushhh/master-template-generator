import type { Deck, SlideInstance } from '../deck/types';
import { mintInstanceId } from '../deck/deckBuilder';
import type { ImportedSlide } from './pptxParser';

/**
 * Turns parsed .pptx slides into a Deck the app can render, edit, reorder and
 * export like any other - the imported slides just carry positioned shapes
 * instead of template slots.
 */
export function buildDeckFromImport(slides: ImportedSlide[]): Deck {
  return {
    generated: true,
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
