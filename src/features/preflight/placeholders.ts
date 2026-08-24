import type { SlideInstance } from '../deck/types';

/**
 * Which slides are still showing template placeholder copy.
 *
 * The failure this exists to prevent: a deck going to a client with
 * "Project Name Placeholder" on the cover, or with a body that reads
 * "Placeholder content for the Wozku Master Template." Nothing in the studio
 * said so, because a placeholder looks like typography rather than like a
 * mistake, and by slide nine nobody is reading the small labels any more.
 *
 * Unlike the fit check this needs no measurement. Every renderer draws its
 * placeholder through `content.field ?? <fallback>`, so `undefined` means
 * nobody has touched the field and the fallback is what is on screen. That is
 * an exact test, not a heuristic: there is no way to mistake typed copy for a
 * placeholder, and no way for a filled field to be reported as empty.
 *
 * Kept honest by `scripts/preflight-check.mjs`, which reads every
 * `content.x ??` in the renderers and fails if one is not accounted for here.
 * A new placeholder cannot be added without deciding which side of the line it
 * falls on.
 */

/**
 * Fallbacks that are house style rather than something left unfinished.
 *
 * `hudLabel` and `eyebrow` are the layout naming itself in the HUD rail
 * ("Agenda", "Executive Summary", "Metrics Dashboard"): correct as they stand,
 * and a deck that ships with them has shipped nothing wrong. Same for the
 * confidentiality line, which is the same on every deck we send, and for `unit`,
 * whose default "M" is a real unit.
 *
 * Listed rather than inferred, so the check script can tell a field that was
 * considered and waved through from one nobody has looked at.
 */
const HOUSE_DEFAULTS = new Set([
  'confidentialLabel',
  'hudLabel',
  'eyebrow',
  'unit',
  // Not copy at all: a layout discriminator, a background colour, a scale
  // factor and the imported shape list.
  'blankLayout',
  'importedBase',
  'avatarScale',
  'shapes',
]);

/**
 * Per layout, the fields whose absence means a placeholder is on screen.
 *
 * Derived from the renderers rather than invented: every entry is a real
 * `content.x ?? fallback` in that layout's render function, minus the house
 * defaults above.
 */
const PLACEHOLDER_FIELDS: Record<string, readonly string[]> = {
  s1: ['headingLines', 'projectLabel', 'tagline', 'versionLabel'],
  s2: ['heading', 'parts'],
  s3: ['body', 'heading', 'metricLabel', 'metricText'],
  // The one layout where the eyebrow is a placeholder and not a label: it reads
  // "Part 02", which is a section number nobody has set.
  s4: ['eyebrow', 'heading', 'subtitle'],
  s5: [
    'leftAttributes',
    'leftBody',
    'leftHeading',
    'leftLabel',
    'rightBody',
    'rightHeading',
    'rightLabel',
  ],
  s6: ['body', 'heading', 'value'],
  s7: ['bars', 'kpis'],
  s8: ['rows'],
  s9: ['heading', 'phases'],
  s10: ['body', 'heading'],
  s11: ['heading', 'steps'],
  s12: ['heading', 'sectors'],
  s13: ['author', 'quote', 'role'],
  s14: ['body', 'heading'],
  blank: ['body', 'heading', 'secondBody', 'secondHeading'],
  // An imported slide carries its own text from the source file. There is no
  // template placeholder behind it to leave showing.
  imported: [],
};

/** What to call each field in a warning. Generic per field rather than per
 *  layout: "Heading" on the roadmap slide is unambiguous once the slide is
 *  named next to it. */
const FIELD_LABELS: Record<string, string> = {
  author: 'Attribution',
  bars: 'Chart data',
  body: 'Body copy',
  // Only ever flagged on the section divider, where the fallback is "Part 02".
  eyebrow: 'Section number',
  heading: 'Heading',
  headingLines: 'Cover heading',
  kpis: 'KPI figures',
  leftAttributes: 'Comparison points',
  leftBody: 'Left body copy',
  leftHeading: 'Left heading',
  leftLabel: 'Left label',
  metricLabel: 'Metric label',
  metricText: 'Metric figure',
  parts: 'Agenda items',
  phases: 'Timeline phases',
  projectLabel: 'Project name',
  quote: 'Quote',
  rightBody: 'Right body copy',
  rightHeading: 'Right heading',
  rightLabel: 'Right label',
  role: 'Attribution title',
  rows: 'Table rows',
  secondBody: 'Second body copy',
  secondHeading: 'Second heading',
  sectors: 'Map figures',
  steps: 'Process steps',
  subtitle: 'Subtitle',
  tagline: 'Tagline',
  value: 'Headline figure',
  versionLabel: 'Version line',
};

/** Field names on this slide that nobody has filled in, as labels. */
export function placeholdersOn(slide: SlideInstance): string[] {
  const fields = PLACEHOLDER_FIELDS[slide.templateId] ?? [];
  const content = slide.content as unknown as Record<string, unknown>;
  return fields
    .filter((f) => content[f] === undefined)
    .map((f) => FIELD_LABELS[f] ?? f);
}

export interface PlaceholderSlide {
  instanceId: string;
  title: string;
  /** 1-based position among the slides going out. */
  n: number;
  /** Labels of the fields still showing a placeholder. */
  fields: string[];
  /** Fields this layout has that could hold a placeholder, filled or not. Lets
   *  a barely-started slide be told apart from one with a single gap left. */
  total: number;
}

/**
 * Every slide in the given set with placeholder copy still on it, most nearly
 * finished first.
 *
 * The order is the point. A deck at the start of its life is entirely
 * placeholder and the author knows it; sorting worst-first would just list the
 * slides they have not written yet. A slide with one field left is the one that
 * got missed, and that is the one worth surfacing.
 */
export function placeholderReport(slides: readonly SlideInstance[]): PlaceholderSlide[] {
  return slides
    .map((s, i) => ({
      instanceId: s.instanceId,
      title: s.title,
      n: i + 1,
      fields: placeholdersOn(s),
      total: (PLACEHOLDER_FIELDS[s.templateId] ?? []).length,
    }))
    .filter((s) => s.fields.length > 0)
    .sort((a, b) => a.fields.length - b.fields.length || a.n - b.n);
}
