import type { DocumentNode, SectionNode } from '../business-record/parser/ast';
import type {
  Deck,
  SlideInstance,
  SlideTemplateId,
  SlideContent,
  IndexPart,
  MetricBar,
  Kpi,
  ComparisonRow,
  RoadmapPhase,
  ProcessStep,
  RegionSector,
} from './types';

// ---------------------------------------------------------------------------
// Template registry — canonical 14-slide skeleton (order, groups, titles)
// ---------------------------------------------------------------------------

interface TemplateEntry {
  templateId: SlideTemplateId;
  group: string;
  title: string;
}

export const TEMPLATE_SLIDES: TemplateEntry[] = [
  { templateId: 's1',  group: 'Introduction', title: 'Cover' },
  { templateId: 's2',  group: 'Introduction', title: 'Index / Contents' },
  { templateId: 's3',  group: 'Introduction', title: 'Executive Summary' },
  { templateId: 's4',  group: 'Context',      title: 'Section Divider' },
  { templateId: 's5',  group: 'Context',      title: 'Two-Column Context' },
  { templateId: 's6',  group: 'Context',      title: 'Data Monument' },
  { templateId: 's7',  group: 'Performance',  title: 'Metrics Dashboard' },
  { templateId: 's8',  group: 'Performance',  title: 'Comparative Table' },
  { templateId: 's9',  group: 'Performance',  title: 'Strategic Roadmap' },
  { templateId: 's10', group: 'Strategy',     title: 'Image Editorial' },
  { templateId: 's11', group: 'Strategy',     title: 'Process Architecture' },
  { templateId: 's12', group: 'Strategy',     title: 'Global Reach Map' },
  { templateId: 's13', group: 'Closing',      title: 'Featured Quote' },
  { templateId: 's14', group: 'Closing',      title: 'Exit / Thank You' },
];

let uidCounter = 0;
export function mintInstanceId(templateId: string): string {
  uidCounter += 1;
  return `${templateId}-${uidCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The pristine master template — all 14 slides, no content, nothing hidden. */
export function createTemplateDeck(): Deck {
  return {
    generated: false,
    slides: TEMPLATE_SLIDES.map((t) => ({
      instanceId: mintInstanceId(t.templateId),
      templateId: t.templateId,
      group: t.group,
      title: t.title,
      hidden: false,
      content: {},
    })),
  };
}

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

function paragraphsOf(section: SectionNode): string[] {
  return section.children
    .filter((c) => c.type === 'Paragraph')
    .map((c) => (c as { text: string }).text);
}

function bulletsOf(section: SectionNode): string[] {
  return section.children
    .filter((c) => c.type === 'BulletList')
    .flatMap((c) => (c as { items: { text: string }[] }).items.map((it) => it.text));
}

/** Parse `key: value` bullets into a map; non key-value bullets go to `rest`. */
function keyValueBullets(section: SectionNode): { kv: Record<string, string>; rest: string[] } {
  const kv: Record<string, string> = {};
  const rest: string[] = [];
  for (const bullet of bulletsOf(section)) {
    const idx = bullet.indexOf(':');
    if (idx > 0 && idx < 24) {
      kv[bullet.slice(0, idx).trim().toLowerCase()] = bullet.slice(idx + 1).trim();
    } else {
      rest.push(bullet);
    }
  }
  return { kv, rest };
}

/** Bullets of the shape `prefix: a | b | c` → array of pipe-split parts. */
function prefixedPipeBullets(section: SectionNode, prefix: string): string[][] {
  const out: string[][] = [];
  for (const bullet of bulletsOf(section)) {
    const idx = bullet.indexOf(':');
    if (idx > 0 && bullet.slice(0, idx).trim().toLowerCase() === prefix) {
      out.push(bullet.slice(idx + 1).split('|').map((p) => p.trim()));
    }
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ensurePeriod(text: string): string {
  const t = text.trim();
  return /[.!?"']$/.test(t) ? t : `${t}.`;
}

/** Split a title into up to 3 visually balanced lines for the cover slide. */
function splitTitleLines(title: string): string[] {
  const words = title.trim().split(/\s+/);
  if (words.length <= 1) return [ensurePeriod(title)];
  if (words.length <= 3) {
    const lines = [...words];
    lines[lines.length - 1] = ensurePeriod(lines[lines.length - 1]);
    return lines;
  }
  const lineCount = 3;
  const perLine = Math.ceil(words.length / lineCount);
  const lines = chunk(words, perLine).map((ws) => ws.join(' '));
  lines[lines.length - 1] = ensurePeriod(lines[lines.length - 1]);
  return lines;
}

// ---------------------------------------------------------------------------
// Section → template routing
// ---------------------------------------------------------------------------

type SectionKind =
  | 'summary' | 'divider' | 'context' | 'monument' | 'metrics' | 'comparison'
  | 'roadmap' | 'insight' | 'process' | 'regions' | 'quote' | 'closing' | 'preamble';

function classifySection(section: SectionNode): SectionKind {
  const h = section.heading.text.trim().toLowerCase();
  if (h === '') return 'preamble';
  if (section.heading.level === 1) return 'divider';
  if (h.startsWith('section')) return 'divider';
  if (h.includes('executive') || h === 'summary') return 'summary';
  if (h.includes('context') || h.includes('current state')) return 'context';
  if (h.includes('key metric') || h.includes('headline') || h.includes('monument')) return 'monument';
  if (h.includes('metric') || h.includes('dashboard') || h.includes('performance')) return 'metrics';
  if (h.includes('comparison') || h.includes('benchmark') || h.includes('compare')) return 'comparison';
  if (h.includes('roadmap') || h.includes('timeline') || h.includes('phase')) return 'roadmap';
  if (h.includes('process') || h.includes('approach') || h.includes('how it works')) return 'process';
  if (h.includes('region') || h.includes('reach') || h.includes('geograph') || h.includes('market')) return 'regions';
  if (h.includes('quote') || h.includes('testimonial')) return 'quote';
  if (h.includes('closing') || h.includes('thank') || h.includes('next steps') || h.includes('contact')) return 'closing';
  return 'insight';
}

// ---------------------------------------------------------------------------
// Deck builder — Business Record AST → populated Deck
// ---------------------------------------------------------------------------

export function buildDeckFromDocument(ast: DocumentNode): Deck {
  const meta = ast.metadata.values;

  // Bucket every section by the template family it feeds.
  const buckets = new Map<SectionKind, SectionNode[]>();
  for (const section of ast.sections) {
    const kind = classifySection(section);
    const list = buckets.get(kind) ?? [];
    list.push(section);
    buckets.set(kind, list);
  }
  const take = (kind: SectionKind): SectionNode[] => buckets.get(kind) ?? [];

  const make = (
    templateId: SlideTemplateId,
    title: string,
    content: SlideContent,
    hidden = false
  ): SlideInstance => {
    const entry = TEMPLATE_SLIDES.find((t) => t.templateId === templateId)!;
    return {
      instanceId: mintInstanceId(templateId),
      templateId,
      group: entry.group,
      title,
      hidden,
      content,
    };
  };

  const slides: SlideInstance[] = [];

  // --- s1 Cover ---------------------------------------------------------
  const preamble = take('preamble')[0];
  slides.push(
    make('s1', 'Cover', {
      projectLabel: meta.client,
      versionLabel: meta.date,
      eyebrow: meta.subtitle,
      headingLines: meta.title ? splitTitleLines(meta.title) : undefined,
      tagline: meta.tagline ?? (preamble ? paragraphsOf(preamble)[0] : undefined),
    })
  );

  // --- s2 Index (parts filled after all slides exist) --------------------
  const indexSlide = make('s2', 'Index / Contents', {});
  slides.push(indexSlide);

  // --- s3 Executive Summary ----------------------------------------------
  const summary = take('summary')[0];
  slides.push(
    make(
      's3',
      'Executive Summary',
      summary
        ? {
            body: paragraphsOf(summary).join('\n\n'),
            metricLabel: 'Proof Point',
            metricText: bulletsOf(summary)[0],
          }
        : {},
      !summary
    )
  );

  // --- s4 Section Divider (one per `## Section:` / `# ` heading) ---------
  const dividers = take('divider');
  if (dividers.length === 0) {
    slides.push(make('s4', 'Section Divider', {}, true));
  } else {
    for (const d of dividers) {
      const title = d.heading.text.replace(/^section\s*[:\-–]?\s*/i, '').trim() || d.heading.text;
      slides.push(
        make('s4', title, {
          heading: ensurePeriod(title),
          subtitle: paragraphsOf(d)[0],
        })
      );
    }
  }

  // --- s5 Two-Column Context ----------------------------------------------
  const context = take('context')[0];
  if (context) {
    const paras = paragraphsOf(context);
    slides.push(
      make('s5', 'Two-Column Context', {
        leftBody: paras[0],
        rightBody: paras[1] ?? paras[0],
        leftAttributes: bulletsOf(context).slice(0, 3),
      })
    );
  } else {
    slides.push(make('s5', 'Two-Column Context', {}, true));
  }

  // --- s6 Data Monument ----------------------------------------------------
  const monument = take('monument')[0];
  if (monument) {
    const { kv } = keyValueBullets(monument);
    slides.push(
      make('s6', 'Data Monument', {
        value: kv.value,
        unit: kv.unit,
        heading: kv.title ? ensurePeriod(kv.title) : undefined,
        body: paragraphsOf(monument)[0],
      })
    );
  } else {
    slides.push(make('s6', 'Data Monument', {}, true));
  }

  // --- s7 Metrics Dashboard (kpis overflow → duplicated slides) ----------
  const metrics = take('metrics')[0];
  if (metrics) {
    const bars: MetricBar[] = prefixedPipeBullets(metrics, 'bar').map((p) => ({
      label: p[0] ?? '',
      pct: Math.max(0, Math.min(100, parseFloat(p[1] ?? '0') || 0)),
      active: (p[2] ?? '').toLowerCase() === 'active',
    }));
    const kpis: Kpi[] = prefixedPipeBullets(metrics, 'kpi').map((p) => ({
      label: p[0] ?? '',
      value: p[1] ?? '',
    }));
    const kpiPages = kpis.length > 3 ? chunk(kpis, 3) : [kpis];
    kpiPages.forEach((page, idx) => {
      slides.push(
        make('s7', idx === 0 ? 'Metrics Dashboard' : `Metrics Dashboard (${idx + 1})`, {
          bars: bars.length ? bars : undefined,
          kpis: page.length ? page : undefined,
        })
      );
    });
  } else {
    slides.push(make('s7', 'Metrics Dashboard', {}, true));
  }

  // --- s8 Comparative Table (rows overflow → duplicated slides) ----------
  const comparison = take('comparison')[0];
  if (comparison) {
    const rows: ComparisonRow[] = prefixedPipeBullets(comparison, 'row').map((p) => ({
      dim: p[0] ?? '',
      cur: p[1] ?? '',
      tgt: p[2] ?? '',
      delta: p[3] ?? '',
    }));
    const pages = rows.length > 4 ? chunk(rows, 4) : [rows];
    pages.forEach((page, idx) => {
      slides.push(
        make('s8', idx === 0 ? 'Comparative Table' : `Comparative Table (${idx + 1})`, {
          rows: page.length ? page : undefined,
        })
      );
    });
  } else {
    slides.push(make('s8', 'Comparative Table', {}, true));
  }

  // --- s9 Strategic Roadmap (phases overflow → duplicated slides) --------
  const roadmap = take('roadmap')[0];
  if (roadmap) {
    const phases: RoadmapPhase[] = prefixedPipeBullets(roadmap, 'phase').map((p) => ({
      title: p[0] ?? '',
      description: p[1] ?? '',
      completed: (p[2] ?? '').toLowerCase() === 'done',
    }));
    const pages = phases.length > 3 ? chunk(phases, 3) : [phases];
    pages.forEach((page, idx) => {
      slides.push(
        make('s9', idx === 0 ? 'Strategic Roadmap' : `Strategic Roadmap (${idx + 1})`, {
          heading: paragraphsOf(roadmap)[0],
          phases: page.length ? page : undefined,
        })
      );
    });
  } else {
    slides.push(make('s9', 'Strategic Roadmap', {}, true));
  }

  // --- s10 Image Editorial — every unrecognized section becomes an insight
  const insights = take('insight');
  if (insights.length === 0) {
    slides.push(make('s10', 'Image Editorial', {}, true));
  } else {
    for (const s of insights) {
      slides.push(
        make('s10', s.heading.text, {
          eyebrow: 'Insight',
          heading: ensurePeriod(s.heading.text),
          body: [...paragraphsOf(s), ...bulletsOf(s)].join('\n\n'),
        })
      );
    }
  }

  // --- s11 Process Architecture (steps overflow → duplicated slides) -----
  const process = take('process')[0];
  if (process) {
    const steps: ProcessStep[] = prefixedPipeBullets(process, 'step').map((p) => ({
      title: p[0] ?? '',
      description: p[1] ?? '',
    }));
    const pages = steps.length > 3 ? chunk(steps, 3) : [steps];
    pages.forEach((page, idx) => {
      slides.push(
        make('s11', idx === 0 ? 'Process Architecture' : `Process Architecture (${idx + 1})`, {
          heading: paragraphsOf(process)[0],
          steps: page.length ? page : undefined,
        })
      );
    });
  } else {
    slides.push(make('s11', 'Process Architecture', {}, true));
  }

  // --- s12 Global Reach Map ------------------------------------------------
  const regions = take('regions')[0];
  if (regions) {
    const sectors: RegionSector[] = prefixedPipeBullets(regions, 'sector').map((p) => ({
      label: p[0] ?? '',
      value: p[1] ?? '',
    }));
    slides.push(
      make('s12', 'Global Reach Map', {
        heading: paragraphsOf(regions)[0],
        sectors: sectors.length ? sectors.slice(0, 3) : undefined,
      })
    );
  } else {
    slides.push(make('s12', 'Global Reach Map', {}, true));
  }

  // --- s13 Featured Quote (one slide per quote section) -------------------
  const quotes = take('quote');
  if (quotes.length === 0) {
    slides.push(make('s13', 'Featured Quote', {}, true));
  } else {
    for (const [idx, q] of quotes.entries()) {
      const { kv } = keyValueBullets(q);
      slides.push(
        make('s13', idx === 0 ? 'Featured Quote' : `Featured Quote (${idx + 1})`, {
          quote: paragraphsOf(q)[0],
          author: kv.author,
          role: kv.role,
        })
      );
    }
  }

  // --- s14 Exit -------------------------------------------------------------
  const closing = take('closing')[0];
  const closingKv = closing ? keyValueBullets(closing).kv : {};
  slides.push(
    make('s14', 'Exit / Thank You', {
      body: closing ? paragraphsOf(closing)[0] : undefined,
      contacts: closing
        ? [closingKv.email, closingKv.social, closingKv.web].filter((c): c is string => !!c)
        : undefined,
    })
  );

  // --- Fill the Index slide from the assembled deck ------------------------
  const parts: IndexPart[] = [];
  for (const slide of slides) {
    if (slide.hidden || slide.templateId === 's1' || slide.templateId === 's2') continue;
    const existing = parts.find((p) => p.title === slide.group);
    if (existing) {
      if (!existing.description.includes(slide.title)) {
        existing.description += `, ${slide.title}`;
      }
    } else if (parts.length < 4) {
      parts.push({ title: slide.group, description: slide.title });
    }
  }
  indexSlide.content.parts = parts.length ? parts : undefined;

  return { slides, generated: true };
}
