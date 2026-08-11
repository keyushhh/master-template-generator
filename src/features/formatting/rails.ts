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
 * The families a slot may be switched to.
 *
 * Deliberately short and brand-bound: these are the three faces the templates
 * and the exporter already embed, so anything picked here survives the round
 * trip into PowerPoint. `stack` is what the canvas renders with; `face` is the
 * single family name the .pptx carries.
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
  { face: 'Satoshi', label: 'Sans', stack: '"Satoshi", "Inter", ui-sans-serif, system-ui, sans-serif' },
  { face: 'JetBrains Mono', label: 'Mono', stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace' },
];

export function fontStack(face: string | undefined): string | undefined {
  return FONT_CHOICES.find((f) => f.face === face)?.stack;
}
