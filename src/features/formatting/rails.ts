/**
 * Brand rails for the formatting controls.
 *
 * The point of this module is that the fast path is always the on-brand path.
 * Sizes step through a real type scale instead of 1pt at a time, colours are
 * offered as palette swatches, and alignment is a three-way choice. Each
 * control also has an escape hatch (an arbitrary px size, an arbitrary hex)
 * one interaction deeper - so nothing is impossible, it is just not the
 * default. That is the whole difference between this and a generic editor:
 * fewer, better choices, and it takes deliberate effort to go off-brand.
 *
 * Values mirror src/theme/tokens.css and the constants in pptxNative.ts. If a
 * brand colour changes, it changes in all three places or the export drifts.
 */

/** Type scale, in design px of the 1920x1080 canvas.
 *
 *  Steps are the sizes the 14 templates actually use, so stepping a heading
 *  down lands on a size that already exists elsewhere in the deck rather than
 *  an arbitrary in-between value. The huge end (420) is the Data Monument's
 *  hero numeral; the small end (11) is the cover's footer line. */
export const TYPE_SCALE = [
  11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 80, 100, 120, 150, 180, 240, 300, 420,
] as const;

/** Hard bounds for the custom-size escape hatch. Below ~8px text is unreadable
 *  at any projection size; above 480px a single glyph exceeds the slide. */
export const SIZE_MIN = 8;
export const SIZE_MAX = 480;

/** Moves `current` one step along the scale. Because a template's own size may
 *  sit between two steps (renderers compute some sizes at runtime - the cover's
 *  hero font is fitted to the title length), this snaps to the neighbouring
 *  step rather than assuming `current` is already on the scale. */
export function stepSize(current: number, direction: 1 | -1): number {
  if (direction === 1) {
    const next = TYPE_SCALE.find((s) => s > current);
    return next ?? Math.min(SIZE_MAX, Math.round(current * 1.1));
  }
  const prev = [...TYPE_SCALE].reverse().find((s) => s < current);
  return prev ?? Math.max(SIZE_MIN, Math.round(current * 0.9));
}

export function clampSize(px: number): number {
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(px)));
}

/** Leading steps as multiples of the font size - the values the 14 templates already use. */
export const LINE_HEIGHTS = [0.8, 0.9, 0.95, 1, 1.05, 1.15, 1.25, 1.4, 1.5, 1.6, 1.8, 2] as const;
export const LINE_HEIGHT_MIN = 0.6;
export const LINE_HEIGHT_MAX = 3;

/** Tracking steps in em - negative closes up display sizes, 0.12-0.2 is where the mono labels sit. */
export const LETTER_SPACINGS = [-0.04, -0.02, -0.01, 0, 0.02, 0.04, 0.08, 0.12, 0.16, 0.2, 0.3] as const;
export const LETTER_SPACING_MIN = -0.1;
export const LETTER_SPACING_MAX = 0.6;

/** Paragraph space before/after, in design px. */
export const PARA_SPACES = [0, 4, 8, 12, 16, 24, 32, 48] as const;
export const PARA_SPACE_MAX = 200;

/** One indent step in design px; four steps stay inside the narrowest template column. */
export const INDENT_STEP_PX = 40;
export const INDENT_MAX_LEVEL = 4;

/** Steps to the neighbouring value on an ascending scale, since a template's own value may sit between two steps. */
export function stepScale(
  scale: readonly number[],
  current: number,
  direction: 1 | -1,
  min: number,
  max: number
): number {
  const EPS = 1e-6;
  const next = direction === 1
    ? scale.find((v) => v > current + EPS)
    : [...scale].reverse().find((v) => v < current - EPS);
  if (next !== undefined) return next;
  return direction === 1 ? max : min;
}

export const clampLineHeight = (v: number) =>
  Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, Math.round(v * 100) / 100));

export const clampLetterSpacing = (v: number) =>
  Math.min(LETTER_SPACING_MAX, Math.max(LETTER_SPACING_MIN, Math.round(v * 1000) / 1000));

export const clampParaSpace = (v: number) =>
  Math.min(PARA_SPACE_MAX, Math.max(0, Math.round(v)));

export const clampIndent = (v: number) =>
  Math.min(INDENT_MAX_LEVEL, Math.max(0, Math.round(v)));

/**
 * Rotation steps in degrees, for an inserted shape.
 *
 * Deliberately not a free dial. A deck's shapes are either square to the grid or
 * on one of a few deliberate angles, and a tilt of 7 degrees reads as a mistake
 * rather than a decision - so the fast path offers the angles that look intended
 * and the typed box below them is the escape hatch for anything else.
 */
export const ROTATIONS = [0, 90, 180, 270, 45, 135, 225, 315, 15, 345] as const;

/** Rotation is stored modulo a full turn, so stepping past 360 wraps rather
 *  than accumulating a number nothing can read back. */
export const clampRotation = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

/** Opacity steps as fractions. Coarse on purpose: a tinted panel behind copy
 *  wants roughly a tenth, a watermark roughly a fifth, and the values between
 *  them are not distinguishable on a projector. */
export const OPACITIES = [1, 0.9, 0.75, 0.6, 0.5, 0.4, 0.25, 0.15, 0.1] as const;

/** Floor is above zero: a fully invisible shape is indistinguishable from a
 *  deleted one, and someone who wants it gone has Delete. */
export const OPACITY_MIN = 0.05;
export const OPACITY_MAX = 1;

export const clampOpacity = (v: number) =>
  Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, Math.round(v * 100) / 100));

export const TEXT_CASES = [
  { key: 'upper', label: 'UPPERCASE' },
  { key: 'lower', label: 'lowercase' },
  { key: 'title', label: 'Title Case' },
] as const;
export type TextCase = (typeof TEXT_CASES)[number]['key'];

export interface Swatch {
  /** Hex, no '#'. */
  hex: string;
  label: string;
  /** Marks the near-white/white end of the ramp, which needs a visible border
   *  in the picker or the chip disappears against the toolbar. */
  light?: boolean;
}

/** Ink and neutral ramp - the workhorse colours for body copy and labels. */
export const NEUTRAL_SWATCHES: Swatch[] = [
  { hex: '171717', label: 'Ink' },
  { hex: '525252', label: 'Secondary' },
  { hex: '737373', label: 'Muted' },
  { hex: 'A3A3A3', label: 'Soft' },
  { hex: 'D4D4D4', label: 'Faint' },
  { hex: 'E5E5E5', label: 'Hairline', light: true },
  { hex: 'FFFFFF', label: 'White', light: true },
];

/** Accent ramp. Emerald is the deck's single accent - it means "this is the
 *  point", so the picker deliberately offers only three steps of it. */
export const ACCENT_SWATCHES: Swatch[] = [
  { hex: '059669', label: 'Emerald 600' },
  { hex: '10B981', label: 'Emerald 500' },
  { hex: '34D399', label: 'Emerald 400' },
];

export const ALL_SWATCHES = [...NEUTRAL_SWATCHES, ...ACCENT_SWATCHES];

export const ALIGNMENTS = ['left', 'center', 'right'] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

/** True if `hex` is one of the brand swatches - lets the picker show which
 *  chip is active, and show a custom value as a distinct state rather than
 *  silently matching nothing. */
export function isBrandColor(hex: string | undefined): boolean {
  if (!hex) return false;
  const h = hex.replace('#', '').toUpperCase();
  return ALL_SWATCHES.some((s) => s.hex.toUpperCase() === h);
}

/** Accepts '#abc', 'abc', '#aabbcc', 'aabbcc' and returns a bare 6-digit
 *  uppercase hex, or undefined if it isn't a colour. Used by the custom-hex
 *  input, which has to tolerate whatever a user types or pastes. */
export function normalizeHex(input: string): string | undefined {
  const h = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    return h.split('').map((c) => c + c).join('').toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(h)) return h.toUpperCase();
  return undefined;
}

/** Relative luminance (0..1) of a bare hex, for deciding whether a swatch
 *  needs light or dark contrast against it. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The house faces, pinned to the top of the typeface menu.
 *
 * No longer the whole list - the picker searches the Google Fonts catalogue
 * behind these - but still the fast path, because these three are the ones the
 * app ships in `public/fonts` and embeds from local files. Everything reachable
 * through search is a Google Font, which means it can be fetched for the canvas,
 * named for Google Slides and embedded for PowerPoint; these three are simply the
 * ones that need no network to do it.
 *
 * `stack` is what the canvas renders with; `face` is the single family name the
 * .pptx carries.
 */
export interface FontChoice {
  /** Stored on the slot, and sent to PowerPoint verbatim. */
  face: string;
  label: string;
  /** CSS stack used on the canvas, with fallbacks. */
  stack: string;
}

export const FONT_CHOICES: FontChoice[] = [
  { face: 'Space Grotesk', label: 'Display', stack: '"Space Grotesk", "Inter", sans-serif' },
  { face: 'DM Sans', label: 'Sans', stack: '"DM Sans", "Inter", ui-sans-serif, system-ui, sans-serif' },
  { face: 'JetBrains Mono', label: 'Mono', stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace' },
];

/**
 * CSS stack for a chosen face.
 *
 * The house three have hand-written stacks. Anything else is a family pulled from
 * the Google Fonts catalogue at runtime, and gets the body face behind it so
 * there is something sensible on screen for the moment before it arrives rather
 * than the browser's default serif.
 */
export function fontStack(face: string | undefined): string | undefined {
  if (!face) return undefined;
  const house = FONT_CHOICES.find((f) => f.face === face);
  if (house) return house.stack;
  return `"${face}", "DM Sans", "Inter", ui-sans-serif, system-ui, sans-serif`;
}
