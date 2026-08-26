import type { DocumentNode } from './parser/ast';
import type { Deck, SlideContent, SlideInstance } from '../deck/types';

/**
 * A deck, written back out as the Business Record it could have come from.
 *
 * The compiler has only ever run one way: a record becomes a deck, and from
 * that moment the record is a historical document while the deck is the thing
 * people actually edit. Six edits later the two disagree and nobody can say
 * which is right.
 *
 * Running it backwards makes the record a view of the deck rather than its
 * ancestor. The headings written here are the keywords `classifySection` reads,
 * and the bullets are the typed-bullet grammar `deckBuilder` parses, so what
 * comes out of this file goes back through the front door.
 *
 * What it is not: a lossless serialisation. Formatting overrides, positions,
 * images, video and charts are deck-level things a Markdown record has no
 * grammar for, and inventing one would produce a document neither the parser
 * nor a human wanted. Use a backup file to move a deck; use this to hand
 * someone the argument the deck is making.
 */

/** Blank lines and trailing spaces out, one trailing newline in. */
function tidy(lines: string[]): string {
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '').trim()}\n`;
}

/** A bullet field: one line, no pipes of its own to confuse the split. */
function field(text: string | undefined): string {
  return (text ?? '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '/').trim();
}

/** A paragraph keeps its own line breaks: the parser joins them into one node. */
function paragraph(text: string | undefined): string[] {
  const value = (text ?? '').trim();
  return value ? [value, ''] : [];
}

function headingText(slide: SlideInstance): string {
  const c = slide.content;
  const fromLines = c.headingLines?.join(' ').trim();
  return field(fromLines || c.heading || slide.title || 'Untitled');
}

/** Text the user put on the slide by hand, which no template slot owns. */
function overlayText(content: SlideContent): string[] {
  const texts = (content.overlay ?? [])
    .filter((s) => s.kind === 'text' && s.text?.trim())
    .map((s) => s.text!.trim());
  return texts.flatMap((t) => paragraph(t));
}

/**
 * One section per slide, headed by the keyword that routes back to the same
 * slide type. A slide whose type has no keyword gets its own plain heading,
 * which the builder turns into an insight slide - the same thing it does with a
 * section it does not recognise coming the other way.
 */
function sectionFor(slide: SlideInstance): string[] {
  const c = slide.content;
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  switch (slide.templateId) {
    case 's2':
      push('## Agenda', '');
      for (const part of c.parts ?? []) {
        push(`- ${field(part.title)}${part.description ? `: ${field(part.description)}` : ''}`);
      }
      push('');
      break;

    case 's3':
      push('## Executive Summary', '');
      push(...paragraph(c.body));
      if (c.metricText) push(...paragraph(`${field(c.metricLabel)} ${field(c.metricText)}`.trim()));
      break;

    case 's4':
      push(`## Section: ${headingText(slide)}`, '');
      push(...paragraph(c.subtitle || c.body));
      break;

    case 's5':
      push('## Context', '');
      push(...paragraph(c.leftHeading));
      push(...paragraph(c.leftBody));
      push(...paragraph(c.rightHeading));
      push(...paragraph(c.rightBody));
      for (const attr of c.leftAttributes ?? []) push(`- ${field(attr)}`);
      if (c.leftAttributes?.length) push('');
      break;

    case 's6':
      push('## Key Metric', '');
      push(`- value: ${field(c.value)}`);
      if (c.unit) push(`- unit: ${field(c.unit)}`);
      push(`- title: ${field(c.stat || c.label || slide.title)}`, '');
      push(...paragraph(c.caption));
      break;

    case 's7':
      push('## Metrics', '');
      for (const bar of c.bars ?? []) {
        push(`- bar: ${field(bar.label)} | ${Math.round(bar.pct)}${bar.active ? ' | active' : ''}`);
      }
      for (const kpi of c.kpis ?? []) push(`- kpi: ${field(kpi.label)} | ${field(kpi.value)}`);
      push('');
      break;

    case 's8':
      push('## Comparison', '');
      for (const row of c.rows ?? []) {
        push(`- row: ${field(row.dim)} | ${field(row.cur)} | ${field(row.tgt)} | ${field(row.delta)}`);
      }
      push('');
      break;

    case 's9':
      push('## Roadmap', '');
      for (const phase of c.phases ?? []) {
        const detail = field(phase.description || phase.body || phase.timing);
        push(`- phase: ${field(phase.title)} | ${detail}${phase.completed ? ' | done' : ''}`);
      }
      push('');
      break;

    case 's11':
      push('## Process', '');
      for (const step of c.steps ?? []) {
        push(`- step: ${field(step.title)} | ${field(step.description || step.text)}`);
      }
      push('');
      break;

    case 's12':
      push('## Regions', '');
      for (const sector of c.sectors ?? []) push(`- sector: ${field(sector.label)} | ${field(sector.value)}`);
      push('');
      break;

    case 's13':
      push('## Quote', '');
      push(...paragraph(c.quote || c.body));
      if (c.author) push(`- author: ${field(c.author)}`);
      if (c.role) push(`- role: ${field(c.role)}`);
      push('');
      break;

    case 's14':
      push('## Closing', '');
      push(...paragraph(c.body));
      // s14 keeps its contact lines as one list, so they come back out as the
      // grammar's own contact bullets by looking at what each line is.
      for (const contact of c.contacts ?? []) {
        const value = field(contact);
        if (!value) continue;
        if (value.includes('@') && !value.startsWith('@')) push(`- email: ${value}`);
        else if (value.startsWith('@')) push(`- social: ${value}`);
        else push(`- web: ${value}`);
      }
      push('');
      break;

    default:
      // Every other slide type, including the bespoke templates and imported
      // slides: its own heading, its own words, and it comes back as a slide.
      push(`## ${field(slide.title) || headingText(slide)}`, '');
      if (c.heading || c.headingLines) push(...paragraph(headingText(slide)));
      push(...paragraph(c.subtitle));
      push(...paragraph(c.body));
      for (const attr of c.leftAttributes ?? []) push(`- ${field(attr)}`);
      break;
  }

  push(...overlayText(c));
  if (slide.notes?.trim()) push(...paragraph(`Speaker notes: ${slide.notes.trim()}`));
  return out;
}

/** The cover, which is frontmatter rather than a section. */
function frontmatter(deck: Deck, ast: DocumentNode | null, deckName: string): string[] {
  const cover = deck.slides.find((s) => s.templateId === 's1' && !s.hidden);
  const meta = ast?.metadata.values ?? {};
  const title = field(cover ? headingText(cover) : '') || field(meta.title) || field(deckName);
  const client = field(meta.client) || field(cover?.content.projectLabel) || field(deckName);
  const subtitle = field(cover?.content.eyebrow) || field(meta.subtitle);
  const tagline = field(cover?.content.tagline) || field(meta.tagline);

  const lines = ['---', 'version: 1.0', 'type: business-record', `client: ${client}`, `title: ${title}`];
  if (subtitle) lines.push(`subtitle: ${subtitle}`);
  if (tagline) lines.push(`tagline: ${tagline}`);
  lines.push('---', '');
  return lines;
}

/**
 * The record this deck would compile from.
 *
 * Hidden slides are left out, for the same reason every other export leaves
 * them out: they are not in the deck being presented. A variant that was not
 * chosen is hidden, so the record describes the version the room saw.
 */
export function deckToRecord(deck: Deck, ast: DocumentNode | null, deckName: string): string {
  const lines = frontmatter(deck, ast, deckName);
  for (const slide of deck.slides) {
    if (slide.hidden) continue;
    // The cover is the frontmatter; a second one would be a section.
    if (slide.templateId === 's1' && slide === deck.slides.find((s) => s.templateId === 's1' && !s.hidden)) continue;
    lines.push(...sectionFor(slide), '');
  }
  return tidy(lines);
}

/** `wozku-deck.md`, matching how the other exports name themselves. */
export function recordFileName(deckName: string): string {
  const base = deckName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'deck'}-business-record.md`;
}
