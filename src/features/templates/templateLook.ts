import { hexIsDark } from '../deck/slideBackground';

/**
 * The background each presentation template actually paints its slides.
 *
 * There was no single answer to "is this template dark?" before this, and the
 * two places that needed one disagreed. The document builders knew, as a hex
 * literal repeated inside each builder. The importer asked the *theme*, via
 * `styleSystem.isDarkSlideDefault`, which only two themes set.
 *
 * Product Showcase is the case that proves the theme cannot answer it: its
 * renderers paint `#09090B`, but it carries the light house theme, so the
 * importer read it as light and never re-lit a white PDF dropped onto it. The
 * deck came out white slides inside a black template.
 *
 * A template's look belongs to the template, not to its palette. Both sides now
 * read it from here.
 */
export const TEMPLATE_BASE: Record<string, string> = {
  default: 'FFFFFF',
  'blank-canvas': 'FFFFFF',
  'swiss-minimal': 'FFFFFF',
  wave: 'F4FAF8',
  editorial: 'FDFBF7',
  'mobile-editorial': 'F8F6F0',
  'product-showcase': '050507',
  'ux-journey': '020617',
  'product-data': '070A12',
  'investor-memorandum': '0A0F1D',
  'ai-native': '0B071A',
  'startup-bold': '09090B',
};

/** Whether this template paints dark slides. Undefined for a template we have
 *  no look for, so a caller can fall back rather than assume light. */
export function templateIsDark(presentationTemplateId?: string): boolean | undefined {
  if (!presentationTemplateId) return undefined;
  const base = TEMPLATE_BASE[presentationTemplateId];
  return base === undefined ? undefined : hexIsDark(base);
}
