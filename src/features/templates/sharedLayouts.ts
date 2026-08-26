/**
 * The slide types every presentation template carries on top of its own cover,
 * hero and closing, so a template is a deck to present from rather than three
 * slides and a gap.
 *
 * One renderer per layout (`slides/SharedSlides.tsx`), one palette per
 * template, and an id of `<template prefix>_<layout>`. The suffixes are unique
 * against every template's own slide ids, which is what lets the PowerPoint
 * exporter route a shared slide by suffix onto the classic layout that already
 * builds it natively.
 */

export interface SharedPalette {
  /** Slide ground. May be a gradient. */
  bg: string;
  /** The flat colour behind it, which is what decides light or dark. */
  ground: string;
  ink: string;
  dim: string;
  line: string;
  card: string;
  accent: string;
}

export const SHARED_LAYOUT_NAMES = [
  'agenda', 'statement', 'stat', 'pillars', 'gauge', 'versus', 'phases', 'voice',
] as const;

export type SharedLayoutName = (typeof SHARED_LAYOUT_NAMES)[number];

/** The classic slide each shared layout exports as, so a .pptx of a shared
 *  slide is native and editable rather than blank. */
export const SHARED_EXPORT_AS: Record<SharedLayoutName, string> = {
  agenda: 's2',
  statement: 's4',
  stat: 's6',
  pillars: 's11',
  gauge: 's7',
  versus: 's8',
  phases: 's9',
  voice: 's13',
};

/** Every template carrying the shared layouts, keyed by its slide id prefix. */
export const SHARED_PALETTES: Record<string, SharedPalette> = {
  product_showcase: { bg: 'radial-gradient(120% 100% at 75% 0%, #18181B 0%, #09090B 100%)', ground: '#09090B', ink: '#FFFFFF', dim: '#A1A1AA', line: 'rgba(255,255,255,0.10)', card: 'rgba(255,255,255,0.04)', accent: '#10B981' },
  ux_journey: { bg: '#020617', ground: '#020617', ink: '#F8FAFC', dim: '#94A3B8', line: 'rgba(148,163,184,0.18)', card: 'rgba(148,163,184,0.08)', accent: '#38BDF8' },
  mobile_editorial: { bg: '#F8F6F0', ground: '#F8F6F0', ink: '#1C1917', dim: '#78716C', line: 'rgba(28,25,23,0.14)', card: 'rgba(28,25,23,0.04)', accent: '#B45309' },
  product_data: { bg: '#070A12', ground: '#070A12', ink: '#F1F5F9', dim: '#8FA0B8', line: 'rgba(143,160,184,0.18)', card: 'rgba(143,160,184,0.08)', accent: '#22D3EE' },
  investor_memo: { bg: '#0A0F1D', ground: '#0A0F1D', ink: '#F8FAFC', dim: '#94A3B8', line: 'rgba(148,163,184,0.18)', card: 'rgba(148,163,184,0.07)', accent: '#F59E0B' },
  editorial: { bg: '#FDFBF7', ground: '#FDFBF7', ink: '#18181B', dim: '#71717A', line: 'rgba(24,24,27,0.14)', card: 'rgba(24,24,27,0.035)', accent: '#B91C1C' },
  ai_native: { bg: '#0B071A', ground: '#0B071A', ink: '#FFFFFF', dim: '#A1A1AA', line: 'rgba(255,255,255,0.10)', card: 'rgba(255,255,255,0.04)', accent: '#A78BFA' },
  startup: { bg: '#09090B', ground: '#09090B', ink: '#FAFAFA', dim: '#A1A1AA', line: 'rgba(255,255,255,0.10)', card: 'rgba(255,255,255,0.04)', accent: '#F97316' },
  swiss: { bg: '#FFFFFF', ground: '#FFFFFF', ink: '#0F172A', dim: '#64748B', line: '#E2E8F0', card: '#F8FAFC', accent: '#2563EB' },
  wave: { bg: '#F4FAF8', ground: '#F4FAF8', ink: '#0F2A22', dim: '#4F6F65', line: 'rgba(15,42,34,0.14)', card: 'rgba(15,42,34,0.04)', accent: '#0D9488' },
};

export function sharedIdsFor(prefix: string): Record<SharedLayoutName, string> {
  return Object.fromEntries(SHARED_LAYOUT_NAMES.map((n) => [n, `${prefix}_${n}`])) as Record<SharedLayoutName, string>;
}

function isDarkGround(hex: string): boolean {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

/** Shared slide ids that paint a dark ground, for the canvas chrome. */
export const SHARED_DARK_IDS: string[] = Object.entries(SHARED_PALETTES)
  .filter(([, p]) => isDarkGround(p.ground))
  .flatMap(([prefix]) => SHARED_LAYOUT_NAMES.map((name) => `${prefix}_${name}`));

const SHARED_IDS = new Set(
  Object.keys(SHARED_PALETTES).flatMap((prefix) => SHARED_LAYOUT_NAMES.map((n) => `${prefix}_${n}`))
);

/** The classic slide id a shared templateId exports as, or undefined for a
 *  slide that is not one of the shared layouts. */
export function sharedExportId(templateId: string): string | undefined {
  if (!SHARED_IDS.has(templateId)) return undefined;
  const suffix = templateId.slice(templateId.lastIndexOf('_') + 1) as SharedLayoutName;
  return SHARED_EXPORT_AS[suffix];
}
