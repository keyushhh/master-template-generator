/**
 * Business Record → Deck, one mapping per presentation template, keyed into
 * `DOCUMENT_TEMPLATE_BUILDERS` by `PRESENTATION_TEMPLATES` id. Generating from
 * a document keeps the template the user actually picked - its fonts, colors,
 * and slide layouts - rather than falling back to the classic Wozku Master.
 * Each template has a fixed, small set of its own slide kinds. A section that
 * matches one fills it; everything left over goes through `overflowSlidesFor`,
 * which picks the layout matching that section's shape, so a long document is
 * not silently truncated to the template's slide count and not every slide is
 * forced into the same layout.
 *
 * Mockup/screenshot slots (`screenAsset`/`screenAssets`) are left unset on
 * the template's own slides - the template's stock placeholder image renders
 * instead, and the user can replace or remove it after generating.
 */
import type { DocumentNode, SectionNode } from '../business-record/parser/ast';
import type { Deck, SlideInstance, SlideContent, SlotStyle, ComparisonRow, RoadmapPhase, ProcessStep, MetricBar, Kpi, IndexPart } from './types';
import { hexIsDark } from './slideBackground';
import {
  bucketSections,
  buildDeckFromDocument,
  classifySection,
  makeSlideInstance,
  paragraphsOf,
  bulletsOf,
  keyValueBullets,
  prefixedPipeBullets,
  unsupportedOf,
  parseMarkdownTable,
  pipeTableFrom,
  parseBlockquote,
  parseImageAlt,
  fitHeadingPx,
  fitBodyPx,
  estimateTextHeight,
  TEXT_ONLY_TEXT_W,
  TEXT_ONLY_TEXT_H,
  chunk,
  ensurePeriod,
  splitTitleLines,
} from './deckBuilder';

/** Templates with no fixed slide structure a document's sections could land
 *  on at all (a single freeform blank slide) - everything else gets a real
 *  Business-Record mapping below instead of falling back to Classic. */
export const NO_DOCUMENT_MAPPING_TEMPLATE_IDS = new Set(['blank-canvas']);

function buildCover(ast: DocumentNode, preambleTagline: string | undefined) {
  const meta = ast.metadata.values;
  return {
    projectLabel: meta.client,
    versionLabel: meta.date,
    eyebrow: meta.subtitle,
    headingLines: meta.title ? splitTitleLines(meta.title) : undefined,
    tagline: meta.tagline ?? preambleTagline,
  };
}

function buildContext(take: ReturnType<typeof bucketSections>) {
  const context = take('context')[0];
  if (!context) return null;
  const paras = paragraphsOf(context);
  return {
    leftBody: paras[0],
    rightBody: paras[1] ?? paras[0],
    leftAttributes: bulletsOf(context).slice(0, 3),
  };
}

function buildComparison(take: ReturnType<typeof bucketSections>) {
  const comparison = take('comparison')[0];
  if (!comparison) return null;
  const rows: ComparisonRow[] = prefixedPipeBullets(comparison, 'row').map((p) => ({
    dim: p[0] ?? '',
    cur: p[1] ?? '',
    tgt: p[2] ?? '',
    delta: p[3] ?? '',
  }));
  return { rows: rows.length ? rows : undefined };
}

function buildRoadmap(take: ReturnType<typeof bucketSections>) {
  const roadmap = take('roadmap')[0];
  if (!roadmap) return null;
  const phases: RoadmapPhase[] = prefixedPipeBullets(roadmap, 'phase').map((p) => ({
    title: p[0] ?? '',
    description: p[1] ?? '',
    completed: (p[2] ?? '').toLowerCase() === 'done',
  }));
  return { heading: paragraphsOf(roadmap)[0], phases: phases.length ? phases : undefined };
}

function buildClosing(take: ReturnType<typeof bucketSections>) {
  const closing = take('closing')[0];
  if (!closing) return null;
  const { kv, rest } = keyValueBullets(closing);
  return {
    body: [paragraphsOf(closing)[0], ...rest].filter(Boolean).join('\n'),
    heading: paragraphsOf(closing)[0] ? undefined : ensurePeriod(closing.heading.text),
    contacts: [kv.email, kv.social, kv.web].filter((c): c is string => !!c) || undefined,
  };
}

/** A single big stat (Data Monument-style) or, failing that, the executive
 *  summary's proof point - whichever the document actually has. */
function buildHeroStat(take: ReturnType<typeof bucketSections>) {
  const monument = take('monument')[0];
  if (monument) {
    const { kv } = keyValueBullets(monument);
    return {
      heading: kv.title ? ensurePeriod(kv.title) : ensurePeriod(monument.heading.text),
      body: paragraphsOf(monument)[0],
      metricLabel: kv.unit ?? 'Metric',
      metricText: kv.value,
    };
  }
  const summary = take('summary')[0];
  if (summary) {
    return {
      heading: ensurePeriod(summary.heading.text),
      body: paragraphsOf(summary).join('\n\n'),
      metricLabel: 'Proof Point',
      metricText: bulletsOf(summary)[0],
    };
  }
  return null;
}

/** Every document section a builder didn't route into one of its template's
 *  named slots (preamble and closing excluded - the cover and closing slide
 *  already speak for those, and a section with no content of its own would
 *  only render as placeholder text). A document with more sections than the
 *  template has fixed slide kinds for used to just drop the rest. */
function leftoverSections(ast: DocumentNode, consumed: Set<SectionNode>): SectionNode[] {
  return ast.sections.filter((s) => {
    if (consumed.has(s)) return false;
    const kind = classifySection(s);
    if (kind === 'preamble' || kind === 'closing') return false;
    return (
      paragraphsOf(s).length > 0 ||
      bulletsOf(s).length > 0 ||
      unsupportedOf(s, 'table').length > 0 ||
      unsupportedOf(s, 'blockquote').length > 0 ||
      unsupportedOf(s, 'image').length > 0
    );
  });
}

/** The background a template's own slides paint themselves. Overflow slides
 *  use it to stay readable: a generated table is built as an `imported` slide,
 *  which paints its own background, and a prose slide on a dark template needs
 *  its ink flipped because the classic layouts follow the deck theme. */
interface TemplateLook {
  base: string;
}

/** Geometry for a generated table, in the 1920x1080 design space. */
const TABLE_X = 160;
const TABLE_Y = 300;
const TABLE_W = 1600;
const TABLE_ROW_H = 64;

/** A markdown table becomes an `imported` slide carrying a real table shape.
 *  The classic table layout (s8) draws exactly four columns under four fixed
 *  headings, so anything else would lose columns and mislabel the rest. */
function tableSlide(section: SectionNode, cells: string[][], look: TemplateLook, title: string): SlideInstance | null {
  if (cells.length < 2) return null;

  const columns = Math.max(...cells.map((r) => r.length));
  const colWidthsPx = Array.from({ length: columns }, () => Math.round(TABLE_W / columns));
  const ink = hexIsDark(look.base) ? 'F8FAFC' : '0F172A';

  return makeSlideInstance('imported', 'Performance', title, {
    importedBase: look.base,
    shapes: [
      {
        id: `table-${section.heading.text.slice(0, 24) || 'x'}`,
        kind: 'table',
        x: TABLE_X,
        y: TABLE_Y,
        w: TABLE_W,
        h: cells.length * TABLE_ROW_H,
        colWidthsPx,
        rows: cells.map((row, r) => ({
          heightPx: TABLE_ROW_H,
          cells: Array.from({ length: columns }, (_, c) => ({
            paragraphs: [{ runs: [{ text: row[c] ?? '', bold: r === 0, color: ink, sizePx: 20 }] }],
          })),
        })),
      },
      {
        id: `table-title-${section.heading.text.slice(0, 18) || 'x'}`,
        kind: 'rect',
        x: TABLE_X,
        y: 140,
        w: TABLE_W,
        h: 120,
        paragraphs: [{ runs: [{ text: title, bold: true, color: ink, sizePx: 48 }] }],
      },
    ],
  });
}

/**
 * One leftover section becomes one or more slides, each using whichever
 * layout matches the shape of that piece of content: a real table for a
 * markdown table, a dashboard for `bar:`/`kpi:` bullets, a roadmap for
 * `phase:`, a pull quote for a blockquote, an image slide for an image, and
 * prose otherwise. The classic s1-s14 layouts render inside any deck, take
 * their colours and fonts from the deck's theme, and each has its own
 * PowerPoint builder, so this needs no new components on either side.
 *
 * A structured layout is only ever chosen when the section actually carries
 * that data: every one of them falls back to placeholder rows, bars and steps
 * when its field is unset, which is exactly the stale template junk this is
 * meant to avoid. Where a layout draws two lists and the section fills only
 * one, the other is set to an empty array rather than left undefined, for the
 * same reason.
 */
function overflowSlidesFor(section: SectionNode, look: TemplateLook): SlideInstance[] {
  const title = section.heading.text.trim() || 'Additional Content';
  const heading = ensurePeriod(title);
  // A table written without leading pipes reaches us as an ordinary paragraph,
  // so those are pulled out here rather than being rendered as body text.
  const allParas = paragraphsOf(section);
  const paras = allParas.filter((p) => !pipeTableFrom(p));
  const { kv, rest } = keyValueBullets(section);
  const make = (templateId: string, group: string, content: SlideContent) =>
    makeSlideInstance(templateId, group, title, content);

  const out: SlideInstance[] = [];

  // Tables, blockquotes and images are their own slides, so a section that
  // mixes prose with a table produces both rather than losing one of them.
  const tables = [
    ...unsupportedOf(section, 'table').map(parseMarkdownTable),
    ...allParas.map(pipeTableFrom).filter((t): t is string[][] => !!t),
  ];
  for (const cells of tables) {
    const slide = tableSlide(section, cells, look, title);
    if (slide) out.push(slide);
  }

  for (const raw of unsupportedOf(section, 'blockquote')) {
    const quote = parseBlockquote(raw);
    if (quote) out.push(make('s13', 'Closing', { quote, author: kv.author, role: kv.role }));
  }

  for (const raw of unsupportedOf(section, 'image')) {
    // The source is a path or URL a deck cannot store, so the slide gets an
    // empty image slot with the alt text beside it for the user to fill.
    out.push(make('s10', 'Strategy', { eyebrow: 'Image', heading, body: parseImageAlt(raw) || undefined }));
  }

  const rows = prefixedPipeBullets(section, 'row');
  if (rows.length) {
    out.push(
      make('s8', 'Performance', {
        heading,
        rows: rows.map((p) => ({ dim: p[0] ?? '', cur: p[1] ?? '', tgt: p[2] ?? '', delta: p[3] ?? '' })),
      })
    );
    return out;
  }

  const bars = prefixedPipeBullets(section, 'bar');
  const kpis = prefixedPipeBullets(section, 'kpi');
  if (bars.length || kpis.length) {
    out.push(
      make('s7', 'Performance', {
        heading,
        bars: bars.map((p) => ({ label: p[0] ?? '', pct: Math.max(0, Math.min(100, parseFloat(p[1] ?? '0') || 0)), active: (p[2] ?? '').toLowerCase() === 'active' })),
        kpis: kpis.map((p) => ({ label: p[0] ?? '', value: p[1] ?? '' })),
      })
    );
    return out;
  }

  const phases = prefixedPipeBullets(section, 'phase');
  if (phases.length) {
    out.push(
      make('s9', 'Performance', {
        heading: paras[0] ?? heading,
        phases: phases.map((p) => ({ title: p[0] ?? '', description: p[1] ?? '', completed: (p[2] ?? '').toLowerCase() === 'done' })),
      })
    );
    return out;
  }

  const steps = prefixedPipeBullets(section, 'step');
  if (steps.length) {
    out.push(
      make('s11', 'Strategy', {
        heading: paras[0] ?? heading,
        steps: steps.map((p) => ({ title: p[0] ?? '', description: p[1] ?? '' })),
      })
    );
    return out;
  }

  const sectors = prefixedPipeBullets(section, 'sector');
  if (sectors.length) {
    out.push(
      make('s12', 'Strategy', {
        heading: paras[0] ?? heading,
        hideImage: true,
        sectors: sectors.slice(0, 3).map((p) => ({ label: p[0] ?? '', value: p[1] ?? '' })),
      })
    );
    return out;
  }

  if (kv.value) {
    out.push(make('s6', 'Context', { value: kv.value, unit: kv.unit, heading, body: paras[0] }));
    return out;
  }

  if (paras[0] && (kv.author || classifySection(section) === 'quote')) {
    out.push(make('s13', 'Closing', { quote: paras[0], author: kv.author, role: kv.role }));
    return out;
  }

  // A list of `key: value` bullets and nothing else reads as an agenda.
  const kvKeys = Object.keys(kv);
  if (!paras.length && kvKeys.length >= 3 && !rest.length) {
    out.push(make('s2', 'Introduction', { parts: kvKeys.slice(0, 4).map((k) => ({ title: k, description: kv[k] })) }));
    return out;
  }

  const body = [...paras, ...rest].filter(Boolean).join('\n\n');
  // A section whose prose already became a quote or an image slide has nothing
  // left to say on a slide of its own.
  if (!body && out.length) return out;
  out.push(...proseSlides(title, heading, body, look));
  return out;
}

/** The eyebrow above the heading, and the gap between heading and body. */
const PROSE_EYEBROW_H = 60;
const PROSE_GAP = 40;
/** Below this, body text stops being comfortable from the back of a room, so a
 *  section longer than one slide is continued on the next rather than shrunk
 *  further or left to spill off the bottom. Two readable slides beat one
 *  crammed one. */
const PROSE_MIN_BODY_PX = 24;
const PROSE_LINE_HEIGHT = 1.5;

const proseFits = (text: string, sizePx: number, budget: number) =>
  estimateTextHeight(text, sizePx, TEXT_ONLY_TEXT_W, PROSE_LINE_HEIGHT) <= budget;

/** One paragraph too tall for a slide on its own, broken between sentences.
 *  Never mid-sentence: the words have to stay exactly as they were written. */
function splitParagraph(para: string, sizePx: number, budget: number): string[] {
  const sentences = para.match(/[^.!?]+[.!?]*\s*/g) ?? [para];
  const out: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const next = current + sentence;
    if (current && !proseFits(next, sizePx, budget)) {
      out.push(current.trim());
      current = sentence;
    } else {
      current = next;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Split body text into pieces that each fit the box, measured the same way
 *  the size was chosen, breaking on paragraphs wherever possible. */
function splitProse(body: string, sizePx: number, budget: number): string[] {
  if (proseFits(body, sizePx, budget)) return [body];

  const out: string[] = [];
  let current = '';
  for (const para of body.split('\n\n')) {
    const pieces = proseFits(para, sizePx, budget) ? [para] : splitParagraph(para, sizePx, budget);
    for (const piece of pieces) {
      if (current && !proseFits(`${current}\n\n${piece}`, sizePx, budget)) {
        out.push(current);
        current = piece;
      } else {
        current = current ? `${current}\n\n${piece}` : piece;
      }
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * The classic text layouts size their heading for a few words, so a document
 * heading long enough to wrap arrived clipped and stayed that way until
 * someone opened the slide and pressed Fit it.
 *
 * Heading and body are sized against one shared height budget rather than
 * independently: a heading that takes three lines leaves less room for the
 * body, and sizing either on its own is what let both overflow at once. When
 * even the smallest readable body size will not fit, the section continues on
 * another slide, because past that point the editor's own Fit it gives up too
 * ("resizing cannot fix this, the text needs shortening").
 */
function proseSlides(title: string, heading: string, body: string, look: TemplateLook): SlideInstance[] {
  const headingPx = fitHeadingPx(heading, { widthPx: TEXT_ONLY_TEXT_W, maxPx: 100, minPx: 40, maxLines: 2 });
  const headingLines = Math.max(1, Math.ceil((heading.length * headingPx * 0.5) / TEXT_ONLY_TEXT_W));
  const bodyBudget = Math.max(
    200,
    TEXT_ONLY_TEXT_H - PROSE_EYEBROW_H - headingLines * headingPx * 1.05 - PROSE_GAP
  );

  const bodyPx = fitBodyPx(body, {
    widthPx: TEXT_ONLY_TEXT_W,
    heightPx: bodyBudget,
    maxPx: 32,
    minPx: PROSE_MIN_BODY_PX,
    lineHeight: PROSE_LINE_HEIGHT,
  });
  const pieces = splitProse(body, bodyPx, bodyBudget);

  return pieces.map((piece, i) => {
    const styles: Record<string, SlotStyle> = {
      heading: { sizePx: headingPx },
      body: { sizePx: bodyPx },
    };
    const content: SlideContent = {
      eyebrow: 'Insight',
      heading,
      body: piece,
      hideImage: true,
      styles,
    };
    // s10 takes its ink from the deck theme, so on a template that paints
    // itself dark while carrying the light house theme it would be black on
    // black.
    if (hexIsDark(look.base)) {
      content.background = { kind: 'color', color: look.base };
      styles.heading.color = 'FFFFFF';
      styles.body.color = 'D4D4D8';
    }
    return makeSlideInstance('s10', 'Strategy', i === 0 ? title : `${title} (${i + 1})`, content);
  });
}

function overflowSlides(sections: SectionNode[], look: TemplateLook): SlideInstance[] {
  return sections.flatMap((s) => overflowSlidesFor(s, look));
}

export function buildSwissDeck(ast: DocumentNode): Deck {
  const take = bucketSections(ast);
  const preamble = take('preamble')[0];
  const monumentOrSummary = take('monument')[0] ?? take('summary')[0];
  const hero = buildHeroStat(take);
  const contextSection = take('context')[0];
  const context = buildContext(take);
  const comparisonSection = take('comparison')[0];
  const comparison = buildComparison(take);
  const roadmapSection = take('roadmap')[0];
  const roadmap = buildRoadmap(take);
  const closing = buildClosing(take);

  const consumed = new Set([preamble, monumentOrSummary, contextSection, comparisonSection, roadmapSection].filter((s): s is SectionNode => !!s));
  const overflow = overflowSlides(leftoverSections(ast, consumed), { base: 'FFFFFF' });

  return {
    generated: true,
    themeId: 'template_swiss_minimal',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'swiss-minimal',
    slides: [
      makeSlideInstance('swiss_cover', 'Introduction', 'Cover', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('swiss_metrics', 'Introduction', 'Financial Performance', hero ?? {}, !hero),
      makeSlideInstance('s5', 'Context', 'Key Findings & Capital', context ?? {}, !context),
      ...overflow,
      makeSlideInstance('s8', 'Performance', 'Variance Analysis', comparison ?? {}, !comparison),
      makeSlideInstance('s9', 'Performance', 'Governance Schedule', roadmap ?? {}, !roadmap),
      makeSlideInstance('s14', 'Closing', 'Governance Adjournment', closing ?? {}, !closing),
    ],
  };
}

export function buildWaveDeck(ast: DocumentNode): Deck {
  const take = bucketSections(ast);
  const preamble = take('preamble')[0];
  const metrics = take('metrics')[0];
  const contextSection = take('context')[0];
  const comparisonSection = take('comparison')[0];
  const context = buildContext(take);
  const comparison = buildComparison(take);
  const closing = buildClosing(take);

  const kpis: Kpi[] | undefined = metrics
    ? prefixedPipeBullets(metrics, 'kpi').map((p) => ({ label: p[0] ?? '', value: p[1] ?? '' }))
    : undefined;
  const waveMetrics = metrics
    ? { hudLabel: metrics.heading.text, heading: paragraphsOf(metrics)[0], kpis: kpis?.length ? kpis : undefined }
    : null;

  const regions = take('regions')[0];
  const sectors = regions
    ? prefixedPipeBullets(regions, 'sector').map((p) => ({ label: p[0] ?? '', value: p[1] ?? '' })).slice(0, 3)
    : undefined;
  const regionsContent = regions ? { heading: paragraphsOf(regions)[0], sectors: sectors?.length ? sectors : undefined } : null;

  const consumed = new Set([preamble, metrics, contextSection, comparisonSection, regions].filter((s): s is SectionNode => !!s));
  const overflow = overflowSlides(leftoverSections(ast, consumed), { base: 'F4FAF8' });

  return {
    generated: true,
    themeId: 'template_wave',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'wave',
    slides: [
      makeSlideInstance('wave_cover', 'Introduction', 'Cover', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('wave_metrics', 'Introduction', 'Impact Metrics', waveMetrics ?? {}, !waveMetrics),
      makeSlideInstance('s5', 'Context', 'Sustainable Sourcing', context ?? {}, !context),
      ...overflow,
      makeSlideInstance('s8', 'Performance', 'Comparative Analysis', comparison ?? {}, !comparison),
      makeSlideInstance('s12', 'Strategy', 'Global Community Reach', regionsContent ?? {}, !regionsContent),
      makeSlideInstance('s14', 'Closing', 'Cultivate What Matters', closing ?? {}, !closing),
    ],
  };
}

export function buildEditorialDeck(ast: DocumentNode): Deck {
  const take = bucketSections(ast);
  const preamble = take('preamble')[0];
  const hero = buildHeroStat(take);
  const monumentOrSummary = take('monument')[0] ?? take('summary')[0];
  const context = take('context')[0];
  const monument = take('monument')[0];
  const quotes = take('quote');
  const closing = buildClosing(take);

  const story = context
    ? {
        hudLabel: context.heading.text,
        rightHeading: ensurePeriod(context.heading.text),
        rightBody: paragraphsOf(context)[0],
        leftAttributes: bulletsOf(context).slice(0, 3),
      }
    : null;

  const metricsSlide = monument
    ? (() => {
        const { kv } = keyValueBullets(monument);
        return { stat: kv.value, label: paragraphsOf(monument)[0] ?? kv.title };
      })()
    : null;

  const quote = quotes[0];
  const quoteContent = quote
    ? (() => {
        const { kv } = keyValueBullets(quote);
        return { quote: paragraphsOf(quote)[0], author: kv.author };
      })()
    : null;

  const consumed = new Set([preamble, monumentOrSummary, context, quote].filter((s): s is SectionNode => !!s));
  const overflow = overflowSlides(leftoverSections(ast, consumed), { base: 'FDFBF7' });

  return {
    generated: true,
    themeId: 'template_editorial',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'editorial',
    slides: [
      makeSlideInstance('editorial_cover', 'Introduction', 'Cover', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('editorial_exec', 'Introduction', 'Executive Narrative', hero ? { ...hero, hudLabel: 'Executive Narrative' } : {}, !hero),
      ...overflow,
      makeSlideInstance('editorial_story', 'Context', 'Market Dynamics', story ?? {}, !story),
      makeSlideInstance('editorial_metrics', 'Performance', 'Audience Perception', metricsSlide ?? {}, !metricsSlide),
      makeSlideInstance('editorial_quote', 'Closing', 'Design Philosophy', quoteContent ?? {}, !quoteContent),
      ...closingSlidesFor('editorial_closing', 'Farewell', closing, { base: 'FDFBF7' }),
    ],
  };
}

export function buildProductShowcaseDeck(ast: DocumentNode): Deck {
  const take = bucketSections(ast);
  const preamble = take('preamble')[0];
  const monumentOrSummary = take('monument')[0] ?? take('summary')[0];
  const hero = buildHeroStat(take);
  const context = take('context')[0];
  const roadmap = take('roadmap')[0];
  const closing = buildClosing(take);

  const heroContent = hero
    ? { hudLabel: 'Single Screen Hero', eyebrow: 'IMMERSIVE INTERFACE', heading: hero.heading, body: hero.body }
    : null;
  const ecosystemSection = context ?? (roadmap && paragraphsOf(roadmap)[0] ? roadmap : undefined);
  const ecosystemHeading = context
    ? ensurePeriod(context.heading.text)
    : roadmap && paragraphsOf(roadmap)[0]
      ? ensurePeriod(paragraphsOf(roadmap)[0])
      : undefined;
  const trio = ecosystemHeading ? { hudLabel: 'Product Ecosystem', eyebrow: 'COMPLETE PRODUCT SUITE', heading: ecosystemHeading } : null;

  const consumed = new Set([preamble, monumentOrSummary, ecosystemSection].filter((s): s is SectionNode => !!s));
  const overflow = overflowSlides(leftoverSections(ast, consumed), { base: '050507' });

  return {
    generated: true,
    themeId: 'wozku',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'product-showcase',
    slides: [
      makeSlideInstance('product_showcase_cover', 'Introduction', 'Product Launch Keynote', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('product_showcase_hero', 'Product', 'Hero Interface', heroContent ?? {}, !heroContent),
      makeSlideInstance('product_showcase_trio', 'Product', 'Product Ecosystem', trio ?? {}, !trio),
      ...overflow,
      ...closingSlidesFor('product_showcase_closing', 'App Availability', closing, { base: '050507' }),
    ],
  };
}

export function buildUxJourneyDeck(ast: DocumentNode): Deck {
  const take = bucketSections(ast);
  const preamble = take('preamble')[0];
  const process = take('process')[0];
  const monument = take('monument')[0];
  const closing = buildClosing(take);

  const flow = process
    ? { hudLabel: 'Step-by-Step Workflow', eyebrow: '3-STEP USER WORKFLOW', heading: ensurePeriod(paragraphsOf(process)[0] ?? process.heading.text) }
    : null;
  const beforeAfter = monument
    ? (() => {
        const { kv } = keyValueBullets(monument);
        const stat = [kv.value, kv.unit].filter(Boolean).join(' ');
        return {
          hudLabel: 'UX Transformation',
          eyebrow: 'BEFORE VS AFTER',
          heading: ensurePeriod(stat || kv.title || monument.heading.text),
        };
      })()
    : null;

  const consumed = new Set([preamble, process, monument].filter((s): s is SectionNode => !!s));
  const overflow = overflowSlides(leftoverSections(ast, consumed), { base: '020617' });

  return {
    generated: true,
    themeId: 'wozku',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'ux-journey',
    slides: [
      makeSlideInstance('ux_journey_cover', 'Introduction', 'User Journey Architecture', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('ux_journey_flow', 'Workflow', '3-Step Product Sequence', flow ?? {}, !flow),
      makeSlideInstance('ux_journey_before_after', 'Workflow', 'UX Transformation Comparison', beforeAfter ?? {}, !beforeAfter),
      ...overflow,
      ...closingSlidesFor('ux_journey_closing', 'Rollout Roadmap', closing, { base: '020617' }),
    ],
  };
}

export function buildMobileEditorialDeck(ast: DocumentNode): Deck {
  const take = bucketSections(ast);
  const preamble = take('preamble')[0];
  const context = take('context')[0];
  const closing = buildClosing(take);

  const story = context
    ? {
        hudLabel: context.heading.text,
        eyebrow: 'Physical & Digital Harmony',
        heading: ensurePeriod(paragraphsOf(context)[0] ?? context.heading.text),
        body: paragraphsOf(context)[1],
      }
    : null;

  const consumed = new Set([preamble, context].filter((s): s is SectionNode => !!s));
  const overflow = overflowSlides(leftoverSections(ast, consumed), { base: 'F8F6F0' });

  return {
    generated: true,
    themeId: 'template_editorial',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'mobile-editorial',
    slides: [
      makeSlideInstance('mobile_editorial_cover', 'Introduction', 'Atelier Mobile Collection', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('mobile_editorial_asymmetric', 'Narrative', 'Curated Touchpoints', story ?? {}, !story),
      ...overflow,
      ...closingSlidesFor('mobile_editorial_closing', 'Conclusion', closing, { base: 'F8F6F0' }),
    ],
  };
}

export function buildProductDataDeck(ast: DocumentNode): Deck {
  const take = bucketSections(ast);
  const preamble = take('preamble')[0];
  const metrics = take('metrics')[0];
  const closing = buildClosing(take);

  const kpis: Kpi[] | undefined = metrics
    ? prefixedPipeBullets(metrics, 'kpi').map((p) => ({ label: p[0] ?? '', value: p[1] ?? '' }))
    : undefined;
  const kpiSlide = metrics
    ? {
        hudLabel: 'Product Telemetry',
        eyebrow: 'ENGAGEMENT ACCELERATION',
        heading: ensurePeriod(paragraphsOf(metrics)[0] ?? metrics.heading.text),
        kpis: kpis?.length ? kpis.slice(0, 3) : undefined,
      }
    : null;

  const consumed = new Set([preamble, metrics].filter((s): s is SectionNode => !!s));
  const overflow = overflowSlides(leftoverSections(ast, consumed), { base: '070A12' });

  return {
    generated: true,
    themeId: 'template_ai_native',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'product-data',
    slides: [
      makeSlideInstance('product_data_cover', 'Introduction', 'Product Performance Keynote', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('product_data_screen_kpi', 'Performance', 'Retention & Engagement Lift', kpiSlide ?? {}, !kpiSlide),
      ...overflow,
      ...closingSlidesFor('product_data_closing', 'Enterprise Deployment', closing, { base: '070A12' }),
    ],
  };
}

export function buildInvestorMemoDeck(ast: DocumentNode): Deck {
  const take = bucketSections(ast);
  const preamble = take('preamble')[0];
  const comparisonSection = take('comparison')[0];
  const comparison = buildComparison(take);
  const closing = buildClosing(take);

  const terms = comparison
    ? { hudLabel: 'Deal Architecture', eyebrow: 'ROUND STRUCTURE', heading: ensurePeriod(comparisonSection?.heading.text ?? 'Deal Terms'), rows: comparison.rows }
    : null;

  const consumed = new Set([preamble, comparisonSection].filter((s): s is SectionNode => !!s));
  const overflow = overflowSlides(leftoverSections(ast, consumed), { base: '0A0F1D' });

  return {
    generated: true,
    themeId: 'template_startup_bold',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'investor-memorandum',
    slides: [
      makeSlideInstance('investor_memo_cover', 'Introduction', 'Series A Syndicate Memo', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('investor_memo_terms', 'Terms', 'Deal Architecture', terms ?? {}, !terms),
      ...overflow,
      ...closingSlidesFor('investor_memo_closing', 'Syndicate Adjournment', closing, { base: '0A0F1D' }),
    ],
  };
}

export function buildAiNativeDeck(ast: DocumentNode): Deck {
  const take = bucketSections(ast);
  const preamble = take('preamble')[0];
  const monumentOrSummary = take('monument')[0] ?? take('summary')[0];
  const hero = buildHeroStat(take);
  const metrics = take('metrics')[0];
  const process = take('process')[0];
  const closing = buildClosing(take);

  const dividers = take('divider');
  const parts: IndexPart[] = dividers
    .map((d) => ({ title: d.heading.text, description: paragraphsOf(d)[0] ?? '' }))
    .slice(0, 4);
  const overview = parts.length ? { hudLabel: 'System Architecture & Agenda', heading: 'System Architecture & Objectives.', parts } : null;

  const problem = hero ? { hudLabel: 'Market Bottleneck', heading: hero.heading, body: hero.body, metricLabel: hero.metricLabel, metricText: hero.metricText } : null;

  const bars: MetricBar[] | undefined = metrics
    ? prefixedPipeBullets(metrics, 'bar').map((p) => ({ label: p[0] ?? '', pct: Math.max(0, Math.min(100, parseFloat(p[1] ?? '0') || 0)), active: (p[2] ?? '').toLowerCase() === 'active' }))
    : undefined;
  const kpis: Kpi[] | undefined = metrics
    ? prefixedPipeBullets(metrics, 'kpi').map((p) => ({ label: p[0] ?? '', value: p[1] ?? '' }))
    : undefined;
  const metricsSlide = metrics
    ? { hudLabel: 'System Telemetry & Accuracy', heading: ensurePeriod(paragraphsOf(metrics)[0] ?? metrics.heading.text), bars: bars?.length ? bars : undefined, kpis: kpis?.length ? kpis.slice(0, 3) : undefined }
    : null;

  const steps: ProcessStep[] | undefined = process
    ? prefixedPipeBullets(process, 'step').map((p, i) => ({ num: String(i + 1).padStart(2, '0'), title: p[0] ?? '', text: p[1] }))
    : undefined;
  const pipeline = steps?.length ? { hudLabel: 'Execution Pipeline', heading: ensurePeriod(paragraphsOf(process!)[0] ?? process!.heading.text), steps } : null;

  const consumed = new Set([preamble, monumentOrSummary, metrics, process, ...dividers].filter((s): s is SectionNode => !!s));
  const overflow = overflowSlides(leftoverSections(ast, consumed), { base: '0B071A' });

  return {
    generated: true,
    themeId: 'template_ai_native',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'ai-native',
    slides: [
      makeSlideInstance('ai_native_cover', 'Introduction', 'AI Native™ Pitch Deck', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('ai_native_overview', 'Introduction', 'System Architecture', overview ?? {}, !overview),
      makeSlideInstance('ai_native_problem', 'Introduction', 'Problem & Bottleneck', problem ?? {}, !problem),
      makeSlideInstance('ai_native_metrics', 'Performance', 'Telemetry & Accuracy', metricsSlide ?? {}, !metricsSlide),
      makeSlideInstance('ai_native_pipeline', 'Strategy', 'Agentic Execution Loop', pipeline ?? {}, !pipeline),
      ...overflow,
      ...closingSlidesFor('ai_native_closing', 'Deployment Console', closing, { base: '0B071A' }),
    ],
  };
}

export function buildStartupBoldDeck(ast: DocumentNode): Deck {
  const take = bucketSections(ast);
  const preamble = take('preamble')[0];
  const monumentOrSummary = take('monument')[0] ?? take('summary')[0];
  const hero = buildHeroStat(take);
  const metrics = take('metrics')[0];
  const roadmap = take('roadmap')[0];

  const problem = hero ? { hudLabel: 'The Market Friction', heading: hero.heading, body: hero.body, metricLabel: hero.metricLabel, metricText: hero.metricText } : null;

  const bars: MetricBar[] | undefined = metrics
    ? prefixedPipeBullets(metrics, 'bar').map((p) => ({ label: p[0] ?? '', pct: Math.max(0, Math.min(100, parseFloat(p[1] ?? '0') || 0)), active: (p[2] ?? '').toLowerCase() === 'active' }))
    : undefined;
  const kpis: Kpi[] | undefined = metrics
    ? prefixedPipeBullets(metrics, 'kpi').map((p) => ({ label: p[0] ?? '', value: p[1] ?? '' }))
    : undefined;
  const traction = metrics
    ? { hudLabel: 'Financial Trajectory', heading: ensurePeriod(paragraphsOf(metrics)[0] ?? metrics.heading.text), bars: bars?.length ? bars : undefined, kpis: kpis?.length ? kpis.slice(0, 3) : undefined }
    : null;

  const phases: RoadmapPhase[] | undefined = roadmap
    ? prefixedPipeBullets(roadmap, 'phase').map((p, i) => ({ num: String(i + 1).padStart(2, '0'), title: p[0] ?? '', timing: p[1], body: p[2] }))
    : undefined;
  const roadmapSlide = phases?.length ? { hudLabel: 'Execution Roadmap', heading: ensurePeriod(paragraphsOf(roadmap!)[0] ?? roadmap!.heading.text), phases } : null;

  const consumed = new Set([preamble, monumentOrSummary, metrics, roadmap].filter((s): s is SectionNode => !!s));
  const look = { base: '09090B' };
  const overflow = overflowSlides(leftoverSections(ast, consumed), look);
  // This template has no closing slide, so the closing section would otherwise
  // be built and then dropped. It becomes a slide of its own instead.
  const closing = buildClosing(take);
  const farewell = closing?.body ? proseSlides('Closing', ensurePeriod(closing.heading ?? 'Closing'), closing.body, look) : [];

  return {
    generated: true,
    themeId: 'template_startup_bold',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'startup-bold',
    slides: [
      makeSlideInstance('startup_cover', 'Introduction', 'Startup Pitch Deck', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('startup_problem', 'Introduction', 'Problem & Opportunity', problem ?? {}, !problem),
      ...overflow,
      makeSlideInstance('startup_traction', 'Performance', 'Traction & Unit Economics', traction ?? {}, !traction),
      makeSlideInstance('startup_roadmap', 'Performance', 'Go-to-Market Roadmap', roadmapSlide ?? {}, !roadmapSlide),
      ...farewell,
    ],
  };
}

/**
 * A closing slide that is a single display line plus contacts, with no body
 * slot to draw a paragraph in.
 *
 * Setting `body` on one of these put the document's closing prose on a field
 * nothing renders, so it vanished with no warning. Short text becomes the
 * display line; anything longer keeps its own slide ahead of the closing
 * rather than being dropped or crammed into a line meant for a few words.
 */
function closingSlidesFor(
  templateId: string,
  title: string,
  closing: ReturnType<typeof buildClosing>,
  look: TemplateLook
): SlideInstance[] {
  if (!closing) return [makeSlideInstance(templateId, 'Closing', title, {}, true)];

  const line = closing.body && closing.body.length <= 80 ? ensurePeriod(closing.body) : undefined;
  const slide = makeSlideInstance(templateId, 'Closing', title, {
    heading: line ?? closing.heading,
    contacts: closing.contacts,
  });
  if (line || !closing.body) return [slide];
  return [...proseSlides(title, ensurePeriod(title), closing.body, look), slide];
}

/**
 * The box each long-form slot is drawn in, so text a document supplies can be
 * sized to fit it. Read off the renderers: `w` and `h` are the space the slot
 * has in the 1920x1080 design space and `max` is the size the template draws
 * it at, so a slot whose text already fits keeps the template's own size and
 * gets no override at all.
 *
 * A slot missing from here falls back to a deliberately cautious box. Erring
 * small costs a little presence; erring large puts text off the slide, and a
 * generated deck has no one watching to catch that before it is presented.
 */
interface SlotBox {
  w: number;
  h: number;
  max: number;
  min: number;
}

/** The space a slot has, where it is narrower or deeper than the cautious
 *  default. Sizes are not set here: see `RENDERED_PX`. */
const SLOT_BOXES: Record<string, Omit<SlotBox, 'max'>> = {
  's3.body': { w: 1640, h: 300, min: 18 },
  's5.leftBody': { w: 720, h: 420, min: 16 },
  's5.rightBody': { w: 720, h: 420, min: 16 },
  's13.quote': { w: 1440, h: 600, min: 32 },
  's14.body': { w: 800, h: 300, min: 18 },
  's6.body': { w: 800, h: 260, min: 16 },
  's4.subtitle': { w: 960, h: 300, min: 16 },
};

/**
 * The size each renderer actually draws a slot at.
 *
 * This has to be the renderer's own number and nothing else. `fitSlideText`
 * leaves a slot alone when the text fits at `max`, so a `max` smaller than the
 * template draws is not a cautious guess, it is a silent failure: the pass
 * measures 72px, concludes it fits, writes no override, and the renderer then
 * draws the same words at 180px and runs them through whatever sits below.
 * That is what put a closing heading on top of its own body copy.
 *
 * Hand-maintaining it is what went wrong: seven slots were listed out of
 * seventy-eight, and one of those seven (`s6.body`, 32px against a real 24px in
 * an 800px column, not 1200px) had already drifted. `scripts/typesize-check.mjs`
 * reads these back off the renderers and fails on any disagreement.
 */
const RENDERED_PX: Record<string, number> = {
  'ai_native_closing.heading': 96,
  'ai_native_cover.headingLines': 130,
  'ai_native_cover.tagline': 24,
  'ai_native_metrics.heading': 64,
  'ai_native_overview.heading': 68,
  'ai_native_pipeline.heading': 64,
  'ai_native_problem.body': 24,
  'ai_native_problem.heading': 78,
  'blank.body': 28,
  'editorial_closing.heading': 110,
  'editorial_cover.headingLines': 124,
  'editorial_cover.tagline': 26,
  'editorial_exec.body': 30,
  'editorial_exec.heading': 92,
  'editorial_metrics.stat': 220,
  'editorial_quote.quote': 68,
  'editorial_story.leftBody': 22,
  'editorial_story.leftHeading': 52,
  'editorial_story.rightBody': 22,
  'editorial_story.rightHeading': 52,
  'investor_memo_closing.heading': 96,
  'investor_memo_cover.headingLines': 104,
  'investor_memo_cover.tagline': 24,
  'investor_memo_terms.heading': 64,
  'mobile_editorial_asymmetric.body': 24,
  'mobile_editorial_asymmetric.heading': 78,
  'mobile_editorial_closing.heading': 96,
  'mobile_editorial_cover.headingLines': 108,
  'mobile_editorial_cover.tagline': 24,
  'product_data_closing.heading': 96,
  'product_data_cover.headingLines': 92,
  'product_data_cover.tagline': 24,
  'product_data_screen_kpi.heading': 68,
  'product_showcase_closing.heading': 96,
  'product_showcase_cover.headingLines': 96,
  'product_showcase_cover.tagline': 24,
  'product_showcase_hero.body': 24,
  'product_showcase_hero.heading': 78,
  'product_showcase_trio.heading': 64,
  's1.headingLines': 130,
  's1.tagline': 24,
  's10.body': 32,
  's10.heading': 100,
  's11.heading': 100,
  's12.heading': 100,
  's13.quote': 84,
  's14.body': 32,
  's14.heading': 180,
  's2.heading': 100,
  's3.body': 32,
  's3.heading': 100,
  's4.heading': 180,
  's4.subtitle': 30,
  's5.leftBody': 32,
  's5.leftHeading': 72,
  's5.rightBody': 32,
  's5.rightHeading': 72,
  's6.body': 24,
  's6.heading': 56,
  's6.value': 240,
  's9.heading': 100,
  'startup_cover.headingLines': 150,
  'startup_cover.tagline': 26,
  'startup_problem.body': 24,
  'startup_problem.heading': 78,
  'startup_roadmap.heading': 64,
  'startup_traction.heading': 68,
  'swiss_cover.headingLines': 120,
  'swiss_cover.tagline': 24,
  'swiss_metrics.body': 24,
  'swiss_metrics.heading': 76,
  'ux_journey_closing.heading': 96,
  'ux_journey_cover.headingLines': 96,
  'ux_journey_flow.heading': 54,
  'ux_journey_cover.tagline': 24,
  'wave_cover.headingLines': 120,
  'wave_cover.tagline': 24,
  'wave_metrics.heading': 72,
};

const DEFAULT_BODY_BOX: Omit<SlotBox, 'max'> = { w: 1200, h: 380, min: 16 };
const DEFAULT_HEADING_BOX: Omit<SlotBox, 'max'> = { w: 1400, h: 300, min: 28 };

/** The box a slot is drawn in: its space from `SLOT_BOXES`, its size from the
 *  renderer. A slot the renderer does not set a size for keeps the cautious
 *  default, which is the only case where guessing is the best available. */
function boxFor(templateId: string, slot: string): SlotBox {
  const key = `${templateId}.${slot}`;
  const space = SLOT_BOXES[key] ?? (HEADING_SLOTS.has(slot) ? DEFAULT_HEADING_BOX : DEFAULT_BODY_BOX);
  const max = RENDERED_PX[key] ?? (HEADING_SLOTS.has(slot) ? 72 : 32);
  return { ...space, max, min: Math.min(space.min, max) };
}

/** Slots drawn as display type, which need a heading-sized floor rather than
 *  a body-sized one when a document hands them more words than they expect. */
const HEADING_SLOTS = new Set(['heading', 'leftHeading', 'rightHeading', 'stat', 'value']);
const TEXT_SLOTS = [
  'heading', 'body', 'subtitle', 'quote', 'label', 'caption', 'tagline',
  'leftBody', 'rightBody', 'leftHeading', 'rightHeading',
] as const;

/**
 * Size every long-form slot a builder filled so it fits the box it is drawn
 * in, leaving anything that already fits exactly as the template drew it.
 *
 * Applied once to every builder's output rather than at each of the couple of
 * hundred places a builder assigns text: the failure is systemic (a source
 * document's paragraphs are simply longer than the few words a template slot
 * was designed around) and catching it per assignment guarantees the next
 * builder added will miss it.
 */
export function fitSlideText(slide: SlideInstance): SlideInstance {
  const styles: Record<string, SlotStyle> = { ...(slide.content.styles ?? {}) };
  let changed = false;

  for (const slot of TEXT_SLOTS) {
    const text = slide.content[slot];
    if (typeof text !== 'string' || !text.trim()) continue;
    // A size the builder set deliberately wins; this only rescues the rest.
    if (styles[slot]?.sizePx) continue;

    const box = boxFor(slide.templateId, slot);

    if (estimateTextHeight(text, box.max, box.w) <= box.h) continue;

    const sizePx = fitBodyPx(text, { widthPx: box.w, heightPx: box.h, maxPx: box.max, minPx: box.min });
    if (sizePx >= box.max) continue;
    styles[slot] = { ...styles[slot], sizePx };
    changed = true;
  }

  return changed ? { ...slide, content: { ...slide.content, styles } } : slide;
}

/** Every builder's output passes through here, so no template can ship text
 *  that overflows the slot it was written into. */
function fitDeckText(deck: Deck): Deck {
  return { ...deck, slides: deck.slides.map(fitSlideText) };
}

/** Registry of Business-Record-capable builders, keyed by `PRESENTATION_TEMPLATES` id.
 *  'default' maps to the classic builder too, so switching between classic and
 *  a document is a no-op rather than tripping the "switch to Classic" warning. */
/**
 * The classic 14-slot builder predates the shape router and reads only
 * paragraphs and bullets, so a table, quote or image in a source document was
 * parsed and then dropped. Those slides are appended here rather than
 * rewriting its fixed mapping, which the rest of the app still depends on.
 */
function withRichBlocks(build: (ast: DocumentNode) => Deck): (ast: DocumentNode) => Deck {
  return (ast) => {
    const deck = build(ast);
    const look: TemplateLook = { base: 'FFFFFF' };
    const extra: SlideInstance[] = [];

    for (const section of ast.sections) {
      const title = section.heading.text.trim() || 'Additional Content';
      const tables = [
        ...unsupportedOf(section, 'table').map(parseMarkdownTable),
        ...paragraphsOf(section).map(pipeTableFrom).filter((t): t is string[][] => !!t),
      ];
      for (const cells of tables) {
        const slide = tableSlide(section, cells, look, title);
        if (slide) extra.push(slide);
      }
      for (const raw of unsupportedOf(section, 'blockquote')) {
        const quote = parseBlockquote(raw);
        if (quote) extra.push(makeSlideInstance('s13', 'Closing', title, { quote }));
      }
      for (const raw of unsupportedOf(section, 'image')) {
        extra.push(
          makeSlideInstance('s10', 'Strategy', title, {
            eyebrow: 'Image',
            heading: ensurePeriod(title),
            body: parseImageAlt(raw) || undefined,
          })
        );
      }
    }

    if (!extra.length) return deck;
    // Ahead of the closing slide, so the deck still ends where it should.
    const closingAt = deck.slides.findIndex((s) => s.templateId === 's14');
    const at = closingAt < 0 ? deck.slides.length : closingAt;
    return { ...deck, slides: [...deck.slides.slice(0, at), ...extra, ...deck.slides.slice(at)] };
  };
}

const BUILDERS: Record<string, (ast: DocumentNode) => Deck> = {
  default: withRichBlocks(buildDeckFromDocument),
  'swiss-minimal': buildSwissDeck,
  wave: buildWaveDeck,
  editorial: buildEditorialDeck,
  'product-showcase': buildProductShowcaseDeck,
  'ux-journey': buildUxJourneyDeck,
  'mobile-editorial': buildMobileEditorialDeck,
  'product-data': buildProductDataDeck,
  'investor-memorandum': buildInvestorMemoDeck,
  'ai-native': buildAiNativeDeck,
  'startup-bold': buildStartupBoldDeck,
};

export const DOCUMENT_TEMPLATE_BUILDERS: Record<string, (ast: DocumentNode) => Deck> = Object.fromEntries(
  Object.entries(BUILDERS).map(([id, build]) => [id, (ast: DocumentNode) => fitDeckText(build(ast))])
);
