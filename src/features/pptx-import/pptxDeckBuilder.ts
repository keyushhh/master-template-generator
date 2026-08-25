import type { Deck, SlideInstance } from '../deck/types';
import { mintInstanceId } from '../deck/deckBuilder';
import { templateBaseFor } from '../templates/templateLook';
import { WOZKU_THEME, type DeckTheme } from '../theme/deckTheme';
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
// Choosing a template is a choice about the ground the deck sits on, so an
// imported slide takes the template's own background rather than a flat mirror
// of the source deck's. A slide whose ground stood apart from the rest of the
// deck (a divider) keeps its own, which is the only thing that ground carried.
function groundFor(slides: ImportedSlide[], templateBase: string): (base: string) => string {
  const counts = new Map<string, number>();
  for (const s of slides) counts.set(s.base, (counts.get(s.base) ?? 0) + 1);
  let dominant = '';
  let most = 0;
  counts.forEach((n, hex) => {
    if (n > most) {
      most = n;
      dominant = hex;
    }
  });
  return (base) => (base === dominant ? templateBase : base);
}

export function buildDeckFromImport(
  slides: ImportedSlide[],
  into?: { themeId?: string; presentationTemplateId?: string; theme?: DeckTheme }
): Deck {
  const ground = groundFor(slides, templateBaseFor(into?.presentationTemplateId, into?.theme ?? WOZKU_THEME));
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
        importedBase: ground(s.base),
      },
    })),
  };
}
