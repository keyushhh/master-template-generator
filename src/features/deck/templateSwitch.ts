/**
 * Switching a slide from one template to another.
 *
 * The mechanic is trivial - SlideContent is a flat bag shared by every template
 * and each renderer reads only the fields it knows, so changing `templateId` is
 * the whole switch, and styling follows automatically because styling lives in
 * the renderer.
 *
 * The work is entirely about *content continuity*:
 *
 *  - Universal fields (heading, eyebrow, body, hudLabel) simply carry.
 *  - Several templates are the same structure wearing different clothes -
 *    parts/steps/phases are all lists of {title, description}, kpis/sectors are
 *    both lists of {label, value}. Those convert 1:1.
 *  - Everything else is *parked*: left in the bag, unread by the new renderer,
 *    and restored verbatim if the user switches back. Nothing is ever deleted.
 *    This is the same guarantee the .pptx import makes.
 *
 * The plan is computed before anything changes so the UI can show the user
 * exactly what will happen, which matters because "my bars disappeared" and "my
 * bars are parked" look identical on screen.
 */

import type { SlideContent, SlideInstance, SlideTemplateId } from './types';
import { TEMPLATE_SLIDES } from './deckBuilder';
import { SHARED_EXPORT_AS, SHARED_LAYOUT_NAMES, SHARED_PALETTES } from '../templates/sharedLayouts';

/** Fields nearly every template renders. */
const UNIVERSAL: (keyof SlideContent)[] = ['heading', 'eyebrow', 'body', 'hudLabel'];

/** Which SlideContent fields each template actually reads.
 *
 *  Hand-maintained against the renderers in PresentationCanvas.tsx. Being
 *  slightly conservative here is safe: a field wrongly listed as unused just
 *  gets reported as parked while still rendering, whereas the reverse would
 *  claim something carries when it doesn't. */
const TEMPLATE_FIELDS: Record<string, (keyof SlideContent)[]> = {
  s1: ['headingLines', 'projectLabel', 'versionLabel', 'tagline', 'eyebrow'],
  s2: ['heading', 'hudLabel', 'parts'],
  s3: ['heading', 'eyebrow', 'body', 'hudLabel', 'metricLabel', 'metricText'],
  s4: ['heading', 'eyebrow', 'hudLabel', 'subtitle'],
  s5: ['hudLabel', 'leftLabel', 'leftHeading', 'leftBody', 'leftAttributes', 'rightLabel', 'rightHeading', 'rightBody'],
  s6: ['heading', 'eyebrow', 'body', 'value', 'unit'],
  s7: ['heading', 'eyebrow', 'hudLabel', 'bars', 'kpis'],
  s8: ['heading', 'eyebrow', 'hudLabel', 'rows'],
  s9: ['heading', 'eyebrow', 'hudLabel', 'phases'],
  s10: ['heading', 'eyebrow', 'body', 'imageUrl', 'hideImage'],
  s11: ['heading', 'eyebrow', 'hudLabel', 'steps'],
  s12: ['heading', 'hudLabel', 'sectors', 'imageUrl', 'hideImage'],
  s13: ['eyebrow', 'quote', 'author', 'role', 'avatarUrl'],
  s14: ['heading', 'eyebrow', 'body', 'contacts'],
  blank: ['heading', 'eyebrow', 'body', 'hudLabel', 'imageUrl', 'hideImage', 'blankLayout'],
  imported: ['shapes', 'importedBase'],
};

// A shared layout reads exactly the fields of the classic slide it exports as.
for (const prefix of Object.keys(SHARED_PALETTES)) {
  for (const name of SHARED_LAYOUT_NAMES) {
    TEMPLATE_FIELDS[`${prefix}_${name}`] = TEMPLATE_FIELDS[SHARED_EXPORT_AS[name]];
  }
}

/** How many items each template renders from its list, where it caps. */
const LIST_CAPS: Record<string, number> = { s2: 4, s7: 3, s12: 3 };

const SHARED_CAPS: Partial<Record<(typeof SHARED_LAYOUT_NAMES)[number], number>> = {
  agenda: 6, gauge: 4, versus: 5, phases: 4, pillars: 3,
};
for (const prefix of Object.keys(SHARED_PALETTES)) {
  for (const [name, cap] of Object.entries(SHARED_CAPS)) LIST_CAPS[`${prefix}_${name}`] = cap;
}

/** Lists whose item shape is {title, description} - freely interchangeable. */
const TITLE_DESC_LISTS = ['parts', 'steps', 'phases'] as const;
/** Lists whose item shape is {label, value}. */
const LABEL_VALUE_LISTS = ['kpis', 'sectors'] as const;

type ListField = (typeof TITLE_DESC_LISTS)[number] | (typeof LABEL_VALUE_LISTS)[number];

/** The list field a template reads, if it reads one. */
function listFieldOf(template: string): ListField | undefined {
  const fields = TEMPLATE_FIELDS[template] ?? [];
  return ([...TITLE_DESC_LISTS, ...LABEL_VALUE_LISTS] as ListField[])
    .find((f) => fields.includes(f));
}

function sameFamily(a: ListField, b: ListField): boolean {
  const t = TITLE_DESC_LISTS as readonly string[];
  const l = LABEL_VALUE_LISTS as readonly string[];
  return (t.includes(a) && t.includes(b)) || (l.includes(a) && l.includes(b));
}

export interface SwitchPlan {
  from: SlideTemplateId;
  to: SlideTemplateId;
  /** Human names of fields that carry over untouched. */
  carries: string[];
  /** Human descriptions of conversions, e.g. "4 agenda parts → 4 process steps". */
  converts: string[];
  /** Human descriptions of what gets parked, e.g. "4 bars". */
  parks: string[];
  /** Set when the destination renders fewer list items than the source has. */
  cappedNote?: string;
  /** The new slide title, or undefined to keep the current one. */
  newTitle?: string;
}

const FIELD_NAMES: Record<string, string> = {
  heading: 'Heading', eyebrow: 'Eyebrow', body: 'Body', hudLabel: 'Header label',
  headingLines: 'Hero heading', projectLabel: 'Project label', versionLabel: 'Version label',
  tagline: 'Tagline', metricLabel: 'Metric label', metricText: 'Metric value',
  subtitle: 'Subtitle', leftLabel: 'Left label', leftHeading: 'Left heading',
  leftBody: 'Left body', leftAttributes: 'Attributes', rightLabel: 'Right label',
  rightHeading: 'Right heading', rightBody: 'Right body', value: 'Value', unit: 'Unit',
  quote: 'Quote', author: 'Author', role: 'Role', contacts: 'Contacts',
  parts: 'agenda parts', steps: 'process steps', phases: 'roadmap phases',
  kpis: 'KPIs', sectors: 'regions', bars: 'bars', rows: 'table rows',
  imageUrl: 'Image', avatarUrl: 'Headshot',
};

const name = (f: string) => FIELD_NAMES[f] ?? f;

/** Irregular singulars for the list nouns; everything else just loses its 's'. */
const SINGULARS: Record<string, string> = {
  'agenda parts': 'agenda part',
  'process steps': 'process step',
  'roadmap phases': 'roadmap phase',
  'table rows': 'table row',
  KPIs: 'KPI',
  regions: 'region',
  bars: 'bar',
  Contacts: 'contact',
  Attributes: 'attribute',
};

/** "2 bars" but "1 bar" - the counts are read aloud in the dialog, and a stray
 *  plural makes the whole panel look machine-generated. */
function counted(n: number, field: string): string {
  const plural = name(field);
  if (n !== 1) return `${n} ${plural}`;
  return `${n} ${SINGULARS[plural] ?? plural.replace(/s$/, '')}`;
}

/** True when a content field actually holds something. */
function has(content: SlideContent, field: keyof SlideContent): boolean {
  const v = content[field];
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

const templateTitle = (id: SlideTemplateId) =>
  TEMPLATE_SLIDES.find((t) => t.templateId === id)?.title;

const templateGroup = (id: SlideTemplateId) =>
  TEMPLATE_SLIDES.find((t) => t.templateId === id)?.group;

/**
 * Works out what switching would do, without doing it.
 *
 * Reported against fields that actually hold content - telling the user their
 * empty Subtitle will be parked is noise.
 */
export function planSwitch(slide: SlideInstance, to: SlideTemplateId): SwitchPlan {
  const from = slide.templateId;
  const c = slide.content;
  const toFields = TEMPLATE_FIELDS[to] ?? [];
  const fromList = listFieldOf(from);
  const toList = listFieldOf(to);

  const carries: string[] = [];
  const converts: string[] = [];
  const parks: string[] = [];
  let cappedNote: string | undefined;

  // Universal + directly-shared fields.
  for (const f of toFields) {
    if (UNIVERSAL.includes(f) && has(c, f)) carries.push(name(f));
  }

  // headingLines <-> heading: the cover stores its hero as lines, everything
  // else as a single string with newlines. Same content, different container.
  if (toFields.includes('headingLines') && !has(c, 'headingLines') && has(c, 'heading')) {
    converts.push('Heading → hero heading');
  } else if (!toFields.includes('headingLines') && has(c, 'headingLines') && toFields.includes('heading')) {
    converts.push('Hero heading → heading');
  }

  // Structurally identical lists.
  const listCount = (f: ListField) => (c[f] as unknown[] | undefined)?.length ?? 0;
  if (fromList && toList && fromList !== toList && sameFamily(fromList, toList) && listCount(fromList)) {
    const n = listCount(fromList);
    const cap = LIST_CAPS[to];
    const shown = cap ? Math.min(cap, n) : n;
    converts.push(`${counted(n, fromList)} → ${counted(shown, toList)}`);
    if (cap && n > cap) {
      const label = templateTitle(to) ?? to;
      cappedNote = `${label} shows only ${cap} items. The remaining ${n - cap} stay stored and reappear if you switch back.`;
    }
  } else if (toList && has(c, toList)) {
    carries.push(name(toList));
  }

  // Anything the destination doesn't read, and isn't being converted from.
  const converted = new Set<string>();
  if (fromList && toList && fromList !== toList && sameFamily(fromList, toList)) converted.add(fromList);
  if (toFields.includes('headingLines') && has(c, 'heading')) converted.add('heading');
  if (!toFields.includes('headingLines')) { /* headingLines handled below */ }

  const parkable = (Object.keys(c) as (keyof SlideContent)[]).filter((f) => {
    // Overlay shapes, styles and notes are template-independent - they always
    // survive, so they are never "parked".
    if (f === 'overlay' || f === 'styles' || f === 'shapes' || f === 'importedBase') return false;
    if (toFields.includes(f)) return false;
    if (converted.has(f)) return false;
    if (f === 'headingLines' && toFields.includes('heading')) return false;
    return has(c, f);
  });

  for (const f of parkable) {
    const v = c[f];
    parks.push(Array.isArray(v) ? counted(v.length, f) : name(f));
  }

  // Only rename a slide whose title the user never touched.
  const defaultTitle = templateTitle(to);
  const newTitle = !slide.titleCustomized && defaultTitle ? defaultTitle : undefined;

  return { from, to, carries, converts, parks, cappedNote, newTitle };
}

/**
 * Performs the switch. Parked fields are deliberately left in place rather than
 * stripped - that is what makes switching back lossless.
 */
export function applySwitch(slide: SlideInstance, to: SlideTemplateId): SlideInstance {
  const plan = planSwitch(slide, to);
  const c = { ...slide.content };
  const toFields = TEMPLATE_FIELDS[to] ?? [];
  const fromList = listFieldOf(slide.templateId);
  const toList = listFieldOf(to);

  // heading <-> headingLines
  if (toFields.includes('headingLines') && !c.headingLines?.length && c.heading) {
    c.headingLines = c.heading.split('\n').map((l) => l.trim()).filter(Boolean);
  } else if (!toFields.includes('headingLines') && toFields.includes('heading') && !c.heading && c.headingLines?.length) {
    c.heading = c.headingLines.join('\n');
  }

  // Same-family list conversion. The source list stays put as well, so
  // switching back finds it untouched.
  if (fromList && toList && fromList !== toList && sameFamily(fromList, toList)) {
    const src = c[fromList] as unknown[] | undefined;
    if (src?.length && !(c[toList] as unknown[] | undefined)?.length) {
      // Item shapes are identical within a family, so this is a straight copy.
      (c as Record<string, unknown>)[toList] = src.map((item) => ({ ...(item as object) }));
    }
  }

  const group = templateGroup(to);
  return {
    ...slide,
    templateId: to,
    content: c,
    title: plan.newTitle ?? slide.title,
    ...(group ? { group } : {}),
  };
}

/** Templates offered in the switcher, in deck order. `imported` is excluded:
 *  its content is positioned shapes with no slot equivalents, so switching into
 *  it would produce an empty slide and switching out of it would abandon the
 *  layout the user chose to keep. */
export const SWITCHABLE: { id: SlideTemplateId; title: string; group: string }[] = [
  ...TEMPLATE_SLIDES.map((t) => ({ id: t.templateId, title: t.title, group: t.group })),
  { id: 'blank' as SlideTemplateId, title: 'Blank / Freeform', group: 'Custom' },
];
