/**
 * The one description of what a deck looks like.
 *
 * A deck is drawn twice by two engines that share no code: `PresentationCanvas`
 * paints it as DOM for the screen, and `pptxNative` rebuilds it as real
 * PowerPoint objects for the export. Until this file existed, each engine
 * carried its own copy of the palette and the type stack - CSS custom
 * properties in `tokens.css` on one side, a block of hex string constants at the
 * top of `pptxNative.ts` on the other.
 *
 * Two copies of the same values is a slow leak: change an emerald on one side
 * and the canvas and the .pptx quietly disagree, which is the single worst class
 * of bug this product can have, because you only find out after the client has
 * the file. Worse, it makes per-client theming impossible to build correctly -
 * you would have to teach two unrelated systems the same new palette and hope.
 *
 * So both engines now read from here:
 *
 *  - the canvas via `themeCssVars()`, which projects a theme onto the CSS custom
 *    properties the slide renderers already reference, scoped to the slide root
 *    rather than `:root` - so the studio chrome keeps its own tone and only the
 *    slide changes;
 *  - the exporter by deriving its hex constants from the active theme.
 *
 * Adding a value means adding it here and teaching both sides to read it, which
 * is exactly one more place than before and the reason they cannot drift.
 *
 * Structure follows what a client brand kit actually varies. `accent` and
 * `fonts` are the brand; the neutral ramp is shared scaffolding that stays
 * neutral whoever the client is; `ink`/`surface`/`rule` are the semantic roles
 * the templates paint with, several of which (text on a dark divider, a table's
 * rule) were bare hex literals buried mid-file before.
 */

/** Hex without '#', uppercase - the form PowerPoint wants, so the exporter can
 *  use these verbatim and the canvas only has to prepend a '#'. */
type Hex = string;

/**
 * One typeface in two forms, because the two engines need different things and
 * conflating them breaks one of them.
 *
 * PowerPoint's `fontFace` takes a single family name and has no concept of a
 * fallback list. CSS needs the whole stack: Satoshi is not self-hosted in
 * `public/fonts`, so a bare `font-family: Satoshi` would drop the slide's body
 * copy to the browser's default serif instead of Inter or the system UI face.
 */
export interface ThemeFont {
  /** Single family name, for PowerPoint's `fontFace`. */
  family: string;
  /** Full CSS `font-family` list, fallbacks included. */
  stack: string;
}

export interface DeckTheme {
  /** Stable key, used to remember a deck's theme choice. */
  id: string;
  /** Shown in the UI. */
  name: string;

  fonts: {
    /** Headings and display numerals. */
    display: ThemeFont;
    /** Body copy. */
    sans: ThemeFont;
    /** Eyebrows, labels, slide numbers, data. */
    mono: ThemeFont;
  };

  /** The brand colour, in the four steps the templates actually use. */
  accent: {
    /** The default accent: rules, active states, emphasis on light slides. */
    base: Hex;
    /** A lighter step, for accent text on a dark slide where `base` is too dim. */
    bright: Hex;
    /** A darker step, for accent text that has to pass contrast on white. */
    deep: Hex;
    /** A wash, for tinted panels behind copy. */
    tint: Hex;
  };

  /** Shared greyscale scaffolding. Stays neutral across brand kits. */
  neutral: {
    n50: Hex;
    n100: Hex;
    n200: Hex;
    n300: Hex;
    n400: Hex;
    n500: Hex;
    n600: Hex;
    n700: Hex;
    n900: Hex;
  };

  /** Text roles. Split by the ground the text sits on, because a dark divider
   *  slide cannot use the light slides' ink and stay legible. */
  ink: {
    onLight: Hex;
    dimOnLight: Hex;
    /** A slightly cooler dim, used by the footer strip on light slides. */
    mutedOnLight: Hex;
    onDark: Hex;
    dimOnDark: Hex;
    /** Headings on a dark slide: not pure white, so they read as type rather
     *  than glare. */
    headingOnDark: Hex;
  };

  surface: {
    /** The default slide ground. */
    light: Hex;
    /** Dividers and the closing slide. */
    dark: Hex;
  };

  rule: {
    /** Hairline dividers on light slides. */
    hairline: Hex;
    /** Table cell borders, which sit a step stronger than a hairline. */
    table: Hex;
    /** The decorative background grid on a light slide. CSS colour, not hex:
     *  it is drawn with alpha, and a flat hex grid reads as a hard cage. */
    gridOnLight: string;
    /** The same grid on a dark slide, where a near-white rule is invisible. */
    gridOnDark: string;
  };
}

/**
 * Wozku's own deck theme, and the default for every deck.
 *
 * Every value here is the value that was already in use, moved rather than
 * chosen: the exporter's hex constants and the emerald/neutral ramps in
 * `tokens.css` agreed, and this records that agreement in one place. That is why
 * introducing this file changes no pixel and no exported byte.
 */
export const WOZKU_THEME: DeckTheme = {
  id: 'wozku',
  name: 'Wozku',

  // Stacks copied verbatim from tokens.css, so projecting them onto the slide
  // root resolves to exactly the faces that were resolving before.
  fonts: {
    display: {
      family: 'Space Grotesk',
      stack: '"Space Grotesk", "Inter", sans-serif',
    },
    sans: {
      family: 'Satoshi',
      stack: '"Satoshi", "Inter", ui-sans-serif, system-ui, sans-serif',
    },
    mono: {
      family: 'JetBrains Mono',
      stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    },
  },

  accent: {
    base: '10B981',
    bright: '34D399',
    deep: '059669',
    tint: 'ECFDF5',
  },

  neutral: {
    n50: 'FBFBFB',
    n100: 'F5F5F5',
    n200: 'E5E5E5',
    n300: 'D4D4D4',
    n400: 'A3A3A3',
    n500: '737373',
    n600: '525252',
    n700: '404040',
    n900: '171717',
  },

  ink: {
    onLight: '171717',
    dimOnLight: '737373',
    mutedOnLight: '5A5A69',
    onDark: 'FFFFFF',
    dimOnDark: 'CCCCCC',
    headingOnDark: 'DDDDDD',
  },

  surface: {
    light: 'FFFFFF',
    dark: '000000',
  },

  rule: {
    hairline: 'E5E5E5',
    table: 'D9D9D9',
    gridOnLight: 'rgba(245,245,245,0.8)',
    gridOnDark: 'rgba(255,255,255,0.06)',
  },
};

/**
 * An austere variant with no colour at all: the accent collapses onto the ink
 * ramp. Not a decorative option - some decks (legal, financial, a client whose
 * own brand is monochrome) read wrong with any accent, and the alternative was
 * a user hand-picking near-black in the kit editor and getting the tint step
 * subtly wrong.
 */
export const MONOCHROME_THEME: DeckTheme = {
  ...WOZKU_THEME,
  id: 'monochrome',
  name: 'Monochrome',
  accent: {
    base: '171717',
    bright: '737373',
    deep: '000000',
    tint: 'F5F5F5',
  },
};

/** The themes that ship with the app. Client brand kits are stored separately
 *  (see brandKitStore) because they are user data, not code. */
export const BUILT_IN_THEMES: DeckTheme[] = [WOZKU_THEME, MONOCHROME_THEME];

/**
 * Resolves a theme id against the built-ins plus any extra themes (a caller's
 * saved brand kits).
 *
 * Falls back to Wozku rather than throwing on an unknown id, because an id can
 * outlive the thing it points at: a deck saved with a kit that has since been
 * deleted must still open, in the house look, rather than fail to render.
 */
export function themeById(id: string | undefined, extra: DeckTheme[] = []): DeckTheme {
  if (!id) return WOZKU_THEME;
  return [...BUILT_IN_THEMES, ...extra].find((t) => t.id === id) ?? WOZKU_THEME;
}

// ---------------------------------------------------------------------------
// Deriving a kit from a single colour
// ---------------------------------------------------------------------------

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Hex (with or without '#') to HSL, h in degrees, s/l in 0..1. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

/** HSL back to the bare uppercase hex the rest of this module uses. */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const lit = clamp01(l);
  const c = (1 - Math.abs(2 * lit - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lit - c / 2;
  const seg = Math.floor(hue / 60) % 6;
  const rgb = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg];
  return rgb
    .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

/** True when a hex string is a well-formed 6-digit colour. */
export function isHex6(value: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

/** WCAG relative luminance of a bare hex. */
export function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(clean.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** Contrast ratio between two bare hexes, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Walks lightness in `step` increments, same hue, until `ok` is satisfied or the
 *  ramp runs out of room. Returns the last colour tried either way, so a brand
 *  colour that cannot reach the target still yields the closest usable step
 *  rather than nothing. */
function walkLightness(hex: string, step: number, ok: (candidate: string) => boolean): string {
  const { h, s, l } = hexToHsl(hex);
  // Saturation is left exactly as given. An earlier version nudged it up on the
  // way down to keep a darkened colour from going muddy, which looked harmless
  // and was not: for a brand colour that already meets its contrast target the
  // loop exits on the first candidate, so the nudge became the only change - and
  // it made `deep` fractionally *lighter* than its own base. Hue and saturation
  // belong to the client; only lightness is ours to move.
  const sat = clamp01(s);
  let lit = l;
  let candidate = hslToHex(h, sat, lit);
  // 50 steps of 0.02 covers the whole 0..1 range from either end.
  for (let i = 0; i < 50; i++) {
    if (ok(candidate)) return candidate;
    const next = lit + step;
    if (next < 0 || next > 1) break;
    lit = next;
    candidate = hslToHex(h, sat, lit);
  }
  return candidate;
}

/** Minimum contrast for accent text against the ground it sits on. Below 3:1 an
 *  accent stops being type and becomes decoration. */
const ACCENT_MIN_CONTRAST = 3.5;
/** Body ink must stay comfortably readable on a tinted panel. */
const TINT_MIN_INK_CONTRAST = 7;

/**
 * Builds the four accent steps the templates need from the one colour a user
 * actually knows: their brand hex.
 *
 * Asking for four colours would be asking the wrong question - nobody has a
 * "tint" in their brand guidelines, and a hand-picked set would drift out of
 * relation with itself.
 *
 *  - `base`   the colour as given, untouched
 *  - `deep`   darkened until accent text holds up on a white slide
 *  - `bright` lightened until accent text holds up on a black slide
 *  - `tint`   a near-white wash, for panels behind dark copy
 *
 * Each step is found by walking lightness at constant hue until it *measures*
 * readable, rather than by applying a fixed offset. Fixed offsets were the first
 * attempt and they fail at both ends of the range, which `brand-kit-check.mjs`
 * demonstrates: a near-black brand colour clamped upward into a `deep` step
 * lighter than its own base, and a brand yellow darkened by a flat 10% still only
 * reached 2:1 against white - an accent nobody could read. Deriving to a contrast
 * target instead means a client's colour is honoured where it works and adjusted
 * exactly as far as it must be where it doesn't.
 *
 * Because `deep` only ever darkens and `bright` only ever lightens from `base`,
 * the ramp is monotonic by construction.
 */
export function accentRamp(baseHex: string): DeckTheme['accent'] {
  const base = baseHex.replace('#', '').toUpperCase();
  const { h, s } = hexToHsl(base);

  return {
    base,
    deep: walkLightness(base, -0.02, (c) => contrastRatio(c, 'FFFFFF') >= ACCENT_MIN_CONTRAST),
    bright: walkLightness(base, +0.02, (c) => contrastRatio(c, '000000') >= ACCENT_MIN_CONTRAST),
    // Deliberately desaturated as well as lightened: a wash at full saturation
    // reads as a highlighter rather than a ground.
    tint: walkLightness(
      hslToHex(h, Math.min(s, 0.5), 0.955),
      +0.005,
      (c) => contrastRatio(c, '171717') >= TINT_MIN_INK_CONTRAST
    ),
  };
}

/**
 * A client brand kit: the house theme with the client's colour swapped in.
 *
 * Typography is deliberately *not* part of a v1 kit. The exporter can only embed
 * typefaces it has files for (see FONT_FILES in pptxFontEmbed.ts), so a kit that
 * chose an arbitrary font would produce a deck that silently re-renders in a
 * substitute face on the client's machine - the one failure mode this product
 * cannot afford. The agency's typographic system, the client's colour.
 */
export function brandKitTheme(kit: { id: string; name: string; accent: string }): DeckTheme {
  return {
    ...WOZKU_THEME,
    id: kit.id,
    name: kit.name,
    accent: accentRamp(kit.accent),
  };
}

/** `#RRGGBB` for the DOM, from the bare hex the exporter uses. */
export function css(hex: Hex): string {
  return `#${hex}`;
}

/**
 * Projects a theme onto the CSS custom properties the slide renderers already
 * reference, for spreading onto the slide root's `style`.
 *
 * Deliberately the same property names the renderers use today
 * (`--emerald-500`, `--neutral-200`, `--font-display`) rather than a fresh
 * `--slide-*` namespace. Those names already appear ~150 times across the
 * renderers; redefining them on the slide's own element makes every one of those
 * references theme-driven without editing a single line of the templates, and a
 * custom property set on an element wins over `:root` for that subtree only, so
 * the studio chrome around the slide is untouched.
 */
export function themeCssVars(theme: DeckTheme): Record<string, string> {
  return {
    '--font-display': theme.fonts.display.stack,
    '--font-sans': theme.fonts.sans.stack,
    '--font-mono': theme.fonts.mono.stack,

    '--emerald-50': css(theme.accent.tint),
    '--emerald-400': css(theme.accent.bright),
    '--emerald-500': css(theme.accent.base),
    '--emerald-600': css(theme.accent.deep),

    '--neutral-50': css(theme.neutral.n50),
    '--neutral-100': css(theme.neutral.n100),
    '--neutral-200': css(theme.neutral.n200),
    '--neutral-300': css(theme.neutral.n300),
    '--neutral-400': css(theme.neutral.n400),
    '--neutral-500': css(theme.neutral.n500),
    '--neutral-600': css(theme.neutral.n600),
    '--neutral-700': css(theme.neutral.n700),
    '--neutral-900': css(theme.neutral.n900),

    '--pure-white': css(theme.surface.light),
  };
}
