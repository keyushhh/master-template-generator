/**
 * Deck data model - the single source of truth for what the presentation
 * contains. The 14 slide templates (s1..s14) are renderers; a Deck is an
 * ordered list of SlideInstances, each pointing at a template and carrying
 * the content that fills that template's slots. Every content field is
 * optional: an absent field makes the renderer fall back to its master
 * template placeholder, so an empty deck renders the untouched template.
 */

export type SlideTemplateId =
  | 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7'
  | 's8' | 's9' | 's10' | 's11' | 's12' | 's13' | 's14'
  /** User-inserted freeform slide (heading + body + optional image). */
  | 'blank';

export interface IndexPart {
  title: string;
  description: string;
}

export interface MetricBar {
  label: string;
  pct: number;
  active?: boolean;
}

export interface Kpi {
  label: string;
  value: string;
}

export interface ComparisonRow {
  dim: string;
  cur: string;
  tgt: string;
  delta: string;
}

export interface RoadmapPhase {
  title: string;
  description: string;
  completed?: boolean;
}

export interface ProcessStep {
  title: string;
  description: string;
}

export interface RegionSector {
  label: string;
  value: string;
}

/** Flat bag of every slot the 14 templates expose. Renderers read only the
 *  fields relevant to their template. */
export interface SlideContent {
  // Shared
  eyebrow?: string;
  heading?: string;
  body?: string;
  hudLabel?: string;

  // s1 Cover
  headingLines?: string[];
  projectLabel?: string;
  versionLabel?: string;
  tagline?: string;

  // s2 Index
  parts?: IndexPart[];

  // s3 Executive Summary
  metricLabel?: string;
  metricText?: string;

  // s4 Section Divider
  subtitle?: string;

  // s5 Two-Column Context
  leftLabel?: string;
  leftHeading?: string;
  leftBody?: string;
  leftAttributes?: string[];
  rightLabel?: string;
  rightHeading?: string;
  rightBody?: string;

  // s6 Data Monument
  value?: string;
  unit?: string;

  // s7 Metrics Dashboard
  bars?: MetricBar[];
  kpis?: Kpi[];

  // s8 Comparative Table
  rows?: ComparisonRow[];

  // s9 Strategic Roadmap
  phases?: RoadmapPhase[];

  // s11 Process Architecture
  steps?: ProcessStep[];

  // s12 Global Reach Map
  sectors?: RegionSector[];

  // s10 Image Editorial - uploaded image as a (downscaled) data URL
  imageUrl?: string;
  /** User dismissed the image area entirely (s10/s12, and blank's 'standard'
   *  layout) - the template falls back to a text-only layout instead of
   *  showing an empty upload placeholder. Re-adding an image clears this. */
  hideImage?: boolean;

  // s13 Featured Quote
  quote?: string;
  author?: string;
  role?: string;
  /** Uploaded author headshot (downscaled data URL). */
  avatarUrl?: string;

  // s14 Exit
  contacts?: string[];

  // blank - freeform slide layout choice
  blankLayout?: 'standard' | 'two-column' | 'full-bleed';
}

export interface SlideInstance {
  /** Unique per instance - duplicating a slide mints a new instanceId while
   *  keeping the same templateId. Used as the DOM anchor id. */
  instanceId: string;
  templateId: SlideTemplateId;
  /** Nav group label (Introduction, Context, …). */
  group: string;
  /** Row title shown in the sidebar nav and slide footer. */
  title: string;
  /** Hidden slides stay in the deck (and nav, dimmed) but are excluded from
   *  the canvas and from numbering. */
  hidden: boolean;
  content: SlideContent;
}

export interface Deck {
  slides: SlideInstance[];
  /** True once "Generate Deck" has populated content from a Business Record. */
  generated: boolean;
  /** Deck-level client logo (data URL or frontmatter URL); editable in edit mode. */
  logoUrl?: string;
}
