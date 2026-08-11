/**
 * Human labels for slot keys, so the toolbar can say "Left heading" instead of
 * "leftHeading" or "bars.2.label". Purely cosmetic - nothing depends on these
 * strings, so an unmapped key degrades to a readable fallback rather than
 * blocking a slot from being formattable.
 */

const SLOT_LABELS: Record<string, string> = {
  eyebrow: 'Eyebrow',
  heading: 'Heading',
  headingLines: 'Hero heading',
  body: 'Body',
  hudLabel: 'Header label',
  projectLabel: 'Project label',
  versionLabel: 'Version label',
  tagline: 'Tagline',
  metricLabel: 'Metric label',
  metricText: 'Metric value',
  subtitle: 'Subtitle',
  leftLabel: 'Left label',
  leftHeading: 'Left heading',
  leftBody: 'Left body',
  rightLabel: 'Right label',
  rightHeading: 'Right heading',
  rightBody: 'Right body',
  value: 'Value',
  unit: 'Unit',
  quote: 'Quote',
  author: 'Author',
  role: 'Role',
};

/** Singular noun for each list, keyed by the plural field name. */
const LIST_NOUNS: Record<string, string> = {
  parts: 'Part',
  bars: 'Bar',
  kpis: 'KPI',
  rows: 'Row',
  phases: 'Phase',
  steps: 'Step',
  sectors: 'Region',
  contacts: 'Contact',
  leftAttributes: 'Attribute',
};

/** Sub-field names inside a list item that deserve better than raw camelCase. */
const SUBFIELDS: Record<string, string> = {
  dim: 'dimension',
  cur: 'current',
  tgt: 'target',
  delta: 'delta',
};

/**
 * Turns a computed CSS font-family list into a display name.
 *
 * getComputedStyle returns the whole stack - '"JetBrains Mono", ui-monospace,
 * monospace' - because CSS variables are resolved but fallbacks are kept. The
 * first entry is the font that will actually be used if it loaded, which is the
 * one worth naming. Generic families are stripped so a stack that resolved to
 * nothing useful degrades to a readable word rather than 'sans-serif'.
 */
const GENERIC = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
]);

export function fontLabel(fontFamily: string | undefined): string | undefined {
  if (!fontFamily) return undefined;
  for (const raw of fontFamily.split(',')) {
    const name = raw.trim().replace(/^["']|["']$/g, '');
    if (name && !GENERIC.has(name.toLowerCase())) return name;
  }
  return undefined;
}

/** 'bars.2.label' -> 'Bar 3 label'; 'heading' -> 'Heading'. Indices are shown
 *  1-based because the slide shows them that way. */
export function slotLabel(slot: string): string {
  const direct = SLOT_LABELS[slot];
  if (direct) return direct;

  const parts = slot.split('.');
  if (parts.length >= 2) {
    const noun = LIST_NOUNS[parts[0]] ?? parts[0];
    const idx = Number(parts[1]);
    const head = Number.isFinite(idx) ? `${noun} ${idx + 1}` : noun;
    const sub = parts[2];
    if (!sub) return head;
    return `${head} ${SUBFIELDS[sub] ?? sub}`;
  }

  // Unmapped single-word key: split camelCase and sentence-case it.
  return slot
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}
