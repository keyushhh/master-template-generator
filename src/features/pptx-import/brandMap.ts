/**
 * Maps a foreign deck's type and colour onto the Wozku brand.
 *
 * This is what makes an uploaded .pptx read as ours rather than merely sitting
 * on our background: every typeface lands on the brand stack, and every colour
 * snaps to the nearest step of the brand ramps. Geometry and text are never
 * touched.
 */

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

export function mapFont(typeface: string): string {
  const face = typeface.trim();
  if (!face || KEEP.test(face)) return face;
  if (MONO_FACES.test(face)) return MONO;
  // A serif in a foreign deck is nearly always a heading face; the brand has no
  // serif, and display is the closest role.
  if (SERIF_FACES.test(face)) return DISPLAY;
  // Everything else is a grotesque doing display or body work. Space Grotesk is
  // the brand's display face and metrically close to Arial/Helvetica, so this
  // does not reflow text noticeably.
  return face.toLowerCase().startsWith('space grotesk') ? face : DISPLAY;
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

/**
 * Snaps a colour onto the brand palette, preserving its lightness so contrast
 * relationships survive: a dark heading stays dark, a pale card stays pale.
 *
 * Greys go to the neutral ramp, anything with real chroma goes to emerald.
 * That is deliberate - the brand has exactly one accent, so a deck arriving
 * with blue or orange accents comes out emerald rather than off-brand.
 */
export function snapToBrand(hex: string): string {
  const clean = hex.replace('#', '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(clean)) return clean;

  const rgb = toRgb(clean);
  const lum = luminance(rgb);

  // Pure black and white are structural, not decorative - a black divider
  // slide must stay black, and white must stay white.
  if (clean === 'FFFFFF' || clean === '000000') return clean;

  if (saturation(rgb) < 0.15) return nearestByLuminance(NEUTRALS, lum);
  return nearestByLuminance(EMERALDS, lum);
}
