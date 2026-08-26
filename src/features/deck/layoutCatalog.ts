import { PRESENTATION_TEMPLATES } from '../templates/presentationTemplates';
import { createBlankSlide, mintInstanceId } from './deckBuilder';
import type { SlideContent, SlideInstance, SlideTemplateId } from './types';

/**
 * Every slide type a deck can add, and what it arrives filled with.
 *
 * "Add slide" used to produce one blank. That is the right answer for a
 * freeform slide and the wrong one for everything else: the deck already has
 * nine to fourteen layouts written in its own voice, and getting at any of them
 * meant adding a blank and then switching its layout.
 *
 * The catalogue is derived from the template's own deck rather than listed by
 * hand, so it cannot drift: whatever a template ships is exactly what you can
 * add to it, with the same written content the template's gallery preview
 * shows. A deck with no template of its own is on the classic house set, which
 * is what `createTemplateDeck` builds.
 */

export interface LayoutOption {
  templateId: SlideTemplateId;
  /** The name this layout goes by in the slide list. */
  title: string;
  group: string;
  /** The template's own content for this layout, so the new slide arrives written. */
  content: SlideContent;
}

export function layoutsForTemplate(presentationTemplateId: string | undefined): LayoutOption[] {
  const template =
    PRESENTATION_TEMPLATES.find((t) => t.id === presentationTemplateId) ??
    PRESENTATION_TEMPLATES.find((t) => t.id === 'default')!;

  const seen = new Set<string>();
  const options: LayoutOption[] = [];

  for (const slide of template.build().slides) {
    if (seen.has(slide.templateId)) continue;
    seen.add(slide.templateId);
    options.push({
      templateId: slide.templateId,
      title: slide.title,
      group: slide.group,
      content: slide.content,
    });
  }

  // Always available, and last: a slide with no layout at all is the escape
  // hatch rather than the default.
  options.push({ templateId: 'blank', title: 'Blank slide', group: 'Custom', content: {} });
  return options;
}

/** A new slide of the chosen layout, carrying that layout's written content. */
export function slideFromLayout(option: LayoutOption): SlideInstance {
  if (option.templateId === 'blank') return createBlankSlide();
  return {
    instanceId: mintInstanceId(option.templateId),
    templateId: option.templateId,
    group: option.group,
    title: option.title,
    hidden: false,
    // A copy, not the catalogue's own object: two slides added from the same
    // layout must not share content, or editing one would edit both.
    content: structuredClone(option.content),
  };
}
