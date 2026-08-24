/**
 * Business Record → Deck, for the presentation templates whose slide system
 * is close enough to the classic Wozku Master's (cover / two-column context /
 * comparison table / roadmap / closing) that the same section classification
 * can drive it. Each of these decks has a fixed, small slide count - a
 * document section that doesn't match one of that template's own slide kinds
 * has nowhere to land and won't appear, the same tradeoff the classic system
 * makes with its 14 fixed slots.
 *
 * Templates that are fundamentally image-driven (screenshots, device mockups)
 * rather than text-driven aren't handled here - see IMAGE_DRIVEN_TEMPLATE_IDS.
 */
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck, ComparisonRow, RoadmapPhase, Kpi } from './types';
import {
  bucketSections,
  makeSlideInstance,
  paragraphsOf,
  bulletsOf,
  keyValueBullets,
  prefixedPipeBullets,
  chunk,
  ensurePeriod,
  splitTitleLines,
} from './deckBuilder';

/** Templates with no realistic text-only mapping - their slides revolve
 *  around device screenshots / product shots a Business Record can't supply. */
export const IMAGE_DRIVEN_TEMPLATE_IDS = new Set(['ux-journey', 'product-showcase']);

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

export function buildSwissDeck(ast: DocumentNode): Deck {
  const take = bucketSections(ast);
  const preamble = take('preamble')[0];
  const hero = buildHeroStat(take);
  const context = buildContext(take);
  const comparison = buildComparison(take);
  const roadmap = buildRoadmap(take);
  const closing = buildClosing(take);

  return {
    generated: true,
    themeId: 'template_swiss_minimal',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'swiss-minimal',
    slides: [
      makeSlideInstance('swiss_cover', 'Introduction', 'Cover', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('swiss_metrics', 'Introduction', 'Financial Performance', hero ?? {}, !hero),
      makeSlideInstance('s5', 'Context', 'Key Findings & Capital', context ?? {}, !context),
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

  return {
    generated: true,
    themeId: 'template_wave',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'wave',
    slides: [
      makeSlideInstance('wave_cover', 'Introduction', 'Cover', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('wave_metrics', 'Introduction', 'Impact Metrics', waveMetrics ?? {}, !waveMetrics),
      makeSlideInstance('s5', 'Context', 'Sustainable Sourcing', context ?? {}, !context),
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

  return {
    generated: true,
    themeId: 'template_editorial',
    logoUrl: ast.metadata.values.logo,
    presentationTemplateId: 'editorial',
    slides: [
      makeSlideInstance('editorial_cover', 'Introduction', 'Cover', buildCover(ast, preamble ? paragraphsOf(preamble)[0] : undefined)),
      makeSlideInstance('editorial_exec', 'Introduction', 'Executive Narrative', hero ? { ...hero, hudLabel: 'Executive Narrative' } : {}, !hero),
      makeSlideInstance('editorial_story', 'Context', 'Market Dynamics', story ?? {}, !story),
      makeSlideInstance('editorial_metrics', 'Performance', 'Audience Perception', metricsSlide ?? {}, !metricsSlide),
      makeSlideInstance('editorial_quote', 'Closing', 'Design Philosophy', quoteContent ?? {}, !quoteContent),
      makeSlideInstance(
        'editorial_closing',
        'Closing',
        'Farewell',
        closing
          ? {
              // This slide's heading is a single large display line, not a
              // paragraph - only use the closing text if it's short enough.
              heading: closing.body && closing.body.length <= 80 ? closing.body : undefined,
              contacts: closing.contacts,
            }
          : {},
        !closing
      ),
    ],
  };
}

/** Registry of Business-Record-capable builders, keyed by `PRESENTATION_TEMPLATES` id. */
export const DOCUMENT_TEMPLATE_BUILDERS: Record<string, (ast: DocumentNode) => Deck> = {
  'swiss-minimal': buildSwissDeck,
  wave: buildWaveDeck,
  editorial: buildEditorialDeck,
};
