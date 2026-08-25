/**
 * Maps a foreign deck's type and colour onto the brand of the template the
 * deck is being imported into.
 *
 * This is what makes an uploaded .pptx read as ours rather than merely sitting
 * on our background: every typeface lands on the brand stack, and every colour
 * snaps to the nearest step of the brand ramps. Geometry and text are never
 * touched.
 *
 * The ramps used to be the house emerald and Space Grotesk regardless of which
 * template the user had chosen, so importing into Mobile Editorial produced an
 * emerald, Space Grotesk deck. They now come from the active theme, which is
 * what "brand theme applied" was always supposed to mean.
 */
import type { DeckTheme } from '../theme/deckTheme';
import type { ImportedSlide, ImportedShape, ImportedParagraph } from '../deck/types';
import { hexIsDark } from '../deck/slideBackground';
import { templateIsDark } from '../templates/templateLook';

export interface BrandMap {
  display: string;
  sans: string;
  mono: string;
  neutrals: string[];
  accents: string[];
  /** Whether the template being imported into paints dark slides. Undefined
   *  means "unknown", and nothing is ever re-lit. */
  isDark?: boolean;
}

/** Brand type stack, from src/theme/tokens.css. */
const DISPLAY = 'Space Grotesk';
const MONO = 'JetBrains Mono';
const SANS = 'DM Sans';

const MONO_FACES = /courier|consolas|monaco|menlo|mono|typewriter/i;
const SERIF_FACES = /times|georgia|garamond|cambria|book|serif|palatino|baskerville/i;

/**
 * Faces we deliberately leave alone: symbol fonts carry glyphs (bullets,
 * arrows, icons) that do not exist in a text face, so remapping them turns
 * the character into tofu.
 */
const KEEP = /wingding|webding|symbol|awesome|material|glyph/i;

export function mapFont(typeface: string, brand: BrandMap = WOZKU_BRAND): string {
  const face = typeface.trim();
  if (!face || KEEP.test(face)) return face;
  if (MONO_FACES.test(face)) return brand.mono;
  // A serif in a foreign deck is nearly always a heading face, and display is
  // the closest role in any of our templates.
  if (SERIF_FACES.test(face)) return brand.display;
  // Everything else is a grotesque doing display or body work. The display face
  // is metrically close to Arial/Helvetica, so this does not reflow noticeably.
  return face.toLowerCase() === brand.display.toLowerCase() ? face : brand.display;
}

/** Neutral ramp (tokens.css). */
const NEUTRALS = [
  '0A0A0A', '171717', '262626', '404040', '525252', '737373',
  'A3A3A3', 'D4D4D4', 'E5E5E5', 'F5F5F5', 'FBFBFB', 'FFFFFF',
];

/** Emerald ramp - the brand's only accent. */
const EMERALDS = [
  '064E3B', '065F46', '047857', '059669', '10B981',
  '34D399', '6EE7B7', 'A7F3D0', 'D1FAE5', 'ECFDF5',
];

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation([r, g, b]: [number, number, number]): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function nearestByLuminance(ramp: string[], target: number): string {
  let best = ramp[0];
  let bestDelta = Infinity;
  for (const step of ramp) {
    const delta = Math.abs(luminance(toRgb(step)) - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = step;
    }
  }
  return best;
}

/** The house brand, and the fallback for any caller with no theme in hand. */
export const WOZKU_BRAND: BrandMap = {
  display: DISPLAY,
  sans: SANS,
  mono: MONO,
  neutrals: NEUTRALS,
  accents: EMERALDS,
};

/**
 * The brand a template imports into. The accent ramp is spun out of the
 * theme's four accent steps so a colour can still be matched by lightness:
 * four steps alone leave visible banding on a deck that shades one accent.
 */
export function brandMapFor(theme: DeckTheme, presentationTemplateId?: string): BrandMap {
  const base = [theme.accent.deep, theme.accent.base, theme.accent.bright, theme.accent.tint]
    .map((c) => String(c).replace('#', '').toUpperCase())
    .filter((c) => /^[0-9A-F]{6}$/.test(c));

  const accents: string[] = [];
  for (let i = 0; i < base.length - 1; i++) {
    accents.push(base[i], mix(base[i], base[i + 1]));
  }
  accents.push(base[base.length - 1]);

  return {
    display: theme.fonts.display.family,
    sans: theme.fonts.sans.family,
    mono: theme.fonts.mono.family,
    neutrals: NEUTRALS,
    accents: accents.length ? accents : EMERALDS,
    // The template's own look first: a template can paint dark slides while
    // carrying a light palette, and the palette is the wrong thing to ask.
    isDark: templateIsDark(presentationTemplateId) ?? theme.styleSystem?.isDarkSlideDefault === true,
  };
}

/** The midpoint of two hexes, as one more step on a ramp. */
function mix(a: string, b: string): string {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return [(ar + br) / 2, (ag + bg) / 2, (ab + bb) / 2]
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Snaps a colour onto the brand palette, preserving its lightness so contrast
 * relationships survive: a dark heading stays dark, a pale card stays pale.
 *
 * Greys go to the neutral ramp, anything with real chroma goes to the accent.
 * That is deliberate - a template has exactly one accent, so a deck arriving
 * with blue accents comes out in the accent of the template it lands on.
 *
 * `flip` mirrors the match to the opposite end of the ramp, which is how a dark
 * deck becomes a light one: because every colour on the slide - background,
 * fill, rule and type - is matched by the same lightness, inverting all of them
 * at once preserves every contrast relationship rather than breaking them.
 */
export function snapToBrand(hex: string, brand: BrandMap = WOZKU_BRAND, flip = false): string {
  const clean = hex.replace('#', '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(clean)) return clean;

  const rgb = toRgb(clean);
  const lum = flip ? 1 - luminance(rgb) : luminance(rgb);

  // Pure black and white are structural, not decorative - a black divider slide
  // must stay black, and white must stay white. Except when re-lighting, where
  // keeping white white is exactly what strands white text on a cream slide.
  if (!flip && (clean === 'FFFFFF' || clean === '000000')) return clean;

  if (saturation(rgb) < 0.15) return nearestByLuminance(brand.neutrals, lum);
  return nearestByLuminance(brand.accents, lum);
}

// A slide's ground is never the accent: a full-bleed emerald slide is exactly
// what "the accent stays scarce" rules out, whatever the source deck used.
export function snapGround(hex: string, brand: BrandMap = WOZKU_BRAND, flip = false): string {
  const clean = hex.replace('#', '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(clean)) return clean;
  const lum = luminance(toRgb(clean));
  return nearestByLuminance(brand.neutrals, flip ? 1 - lum : lum);
}

/**
 * Mirrors every colour in the deck onto the opposite end of its ramp, so a deck
 * built dark reads correctly on a light template and the reverse.
 *
 * Done for the whole deck at once, never per slide: a dark divider inside an
 * otherwise light deck is dark *relative to* its neighbours, and flipping each
 * slide against the template independently would collapse that difference. One
 * decision for the deck keeps the odd slide odd.
 *
 * Text with no explicit colour needs nothing here - the renderer already picks
 * its ink from the slide's background, which this flips.
 */
function flipAll(slides: ImportedSlide[], brand: BrandMap): ImportedSlide[] {
  const snap = (hex: string | undefined) => (hex === undefined ? undefined : snapToBrand(hex, brand, true));
  const paras = (ps: ImportedParagraph[] | undefined) => ps?.map((p) => ({
    ...p,
    runs: p.runs.map((r) => (r.color ? { ...r, color: snapToBrand(r.color, brand, true) } : r)),
  }));
  const shape = (sh: ImportedShape): ImportedShape => ({
    ...sh,
    fill: snap(sh.fill),
    line: sh.line ? { ...sh.line, color: snapToBrand(sh.line.color, brand, true) } : sh.line,
    paragraphs: paras(sh.paragraphs),
    rows: sh.rows?.map((row) => ({
      ...row,
      cells: row.cells.map((c) => ({ ...c, fill: snap(c.fill), paragraphs: paras(c.paragraphs) })),
    })),
  });
  return slides.map((s) => ({
    ...s,
    base: snapGround(s.base, brand, true),
    shapes: s.shapes.map(shape),
  }));
}

/** Decides whether this deck disagrees with the template's lightness, and
 *  mirrors it if so. Majority vote, so one dark divider in a light deck does
 *  not decide it for the other twenty. */
export function relightForBrand(
  slides: ImportedSlide[],
  brand: BrandMap
): { slides: ImportedSlide[]; relit: boolean } {
  const sourceIsDark = slides.filter((s) => hexIsDark(s.base)).length * 2 > slides.length;
  const relit = brand.isDark !== undefined && brand.isDark !== sourceIsDark;
  return { slides: relit ? flipAll(slides, brand) : slides, relit };
}
