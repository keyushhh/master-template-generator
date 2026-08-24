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
 * fallback list. CSS needs the whole stack, so the canvas has something to draw
 * with in the moment before a web font lands and on a machine that blocks it.
 *
 * All three families are now self-hosted in `public/fonts` and embedded into the
 * .pptx, which is the property that matters: a family named in the export but
 * absent from the file is substituted by PowerPoint, and the deck the client
 * opens stops being the deck you designed. Satoshi used to be the exception -
 * it came from Fontshare, was never embedded, and silently substituted on every
 * machine but ours.
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

  /** System-level visual personality and composition rules */
  styleSystem?: {
    coverLayout?: 'centered' | 'left-aligned' | 'split-card' | 'monumental' | 'editorial-split';
    coverGradient?: string;
    slideBackground?: string;
    isDarkSlideDefault?: boolean;
    cardStyle?: 'glass' | 'bordered' | 'solid' | 'minimal';
    glowColor?: string;
    showGrid?: boolean;
    headerStyle?: 'minimal' | 'hud' | 'boxed' | 'underline';
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
      family: 'DM Sans',
      stack: '"DM Sans", "Inter", ui-sans-serif, system-ui, sans-serif',
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
    gridOnLight: 'rgba(245,245,245,0.4)',
    gridOnDark: 'rgba(255,255,255,0.03)',
  },
};

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

export const EDITORIAL_THEME: DeckTheme = {
  ...WOZKU_THEME,
  id: 'template_editorial',
  name: 'The Editorial',
  accent: {
    base: 'C2884A',
    bright: 'D5A26B',
    deep: '855B2E',
    tint: 'FDF8F3',
  },
  fonts: {
    display: { family: 'Playfair Display', stack: '"Playfair Display", "Georgia", serif' },
    sans: { family: 'Plus Jakarta Sans', stack: '"Plus Jakarta Sans", "Inter", sans-serif' },
    mono: { family: 'Space Mono', stack: '"Space Mono", monospace' },
  },
  styleSystem: {
    coverLayout: 'centered',
    coverGradient: 'radial-gradient(ellipse at 50% 30%, #2A2420 0%, #151311 60%, #0D0C0B 100%)',
    slideBackground: '#FDFBF7',
    glowColor: 'rgba(194, 136, 74, 0.12)',
    showGrid: false,
    headerStyle: 'minimal',
  },
};

export const AI_NATIVE_THEME: DeckTheme = {
  ...WOZKU_THEME,
  id: 'template_ai_native',
  name: 'AI-Native',
  accent: {
    base: '7C3AED',
    bright: 'A78BFA',
    deep: '5B21B6',
    tint: '1E1338',
  },
  surface: {
    light: '0B071A',
    dark: '05020D',
  },
  ink: {
    onLight: 'FFFFFF',
    dimOnLight: 'A1A1AA',
    mutedOnLight: '71717A',
    onDark: 'FFFFFF',
    dimOnDark: 'A1A1AA',
    headingOnDark: 'F4F4F5',
  },
  neutral: {
    n50: '18122B',
    n100: '1F1836',
    n200: '2E254A',
    n300: '3D335E',
    n400: '6D5F9A',
    n500: '9D92C4',
    n600: 'C4BCDF',
    n700: 'E2DEEE',
    n900: 'FFFFFF',
  },
  fonts: {
    display: { family: 'Outfit', stack: '"Outfit", "Inter", sans-serif' },
    sans: { family: 'Inter', stack: '"Inter", sans-serif' },
    mono: { family: 'JetBrains Mono', stack: '"JetBrains Mono", monospace' },
  },
  styleSystem: {
    coverLayout: 'centered',
    coverGradient: 'radial-gradient(circle at 50% 0%, #3B1676 0%, #170C30 50%, #090514 100%)',
    slideBackground: '#0B071A',
    isDarkSlideDefault: true,
    cardStyle: 'glass',
    glowColor: 'rgba(124, 58, 237, 0.35)',
    showGrid: true,
    headerStyle: 'boxed',
  },
};

export const WAVE_THEME: DeckTheme = {
  ...WOZKU_THEME,
  id: 'template_wave',
  name: 'The Wave Organic',
  accent: {
    base: '0D9488',
    bright: '2DD4BF',
    deep: '0F766E',
    tint: 'E6F7F4',
  },
  surface: {
    light: 'F4FAF8',
    dark: '0F2D27',
  },
  fonts: {
    display: { family: 'Plus Jakarta Sans', stack: '"Plus Jakarta Sans", "Inter", sans-serif' },
    sans: { family: 'Inter', stack: '"Inter", sans-serif' },
    mono: { family: 'DM Mono', stack: '"DM Mono", monospace' },
  },
  styleSystem: {
    coverLayout: 'left-aligned',
    coverGradient: 'linear-gradient(135deg, #E6F4F1 0%, #D2EBE4 45%, #B7E4D8 100%)',
    slideBackground: '#F4FAF8',
    glowColor: 'rgba(13, 148, 136, 0.18)',
    showGrid: false,
    headerStyle: 'underline',
  },
};

export const STARTUP_BOLD_THEME: DeckTheme = {
  ...WOZKU_THEME,
  id: 'template_startup_bold',
  name: 'Startup Bold',
  accent: {
    base: 'EA580C',
    bright: 'FB923C',
    deep: 'C2410C',
    tint: 'FFF7ED',
  },
  surface: {
    light: '09090B',
    dark: '000000',
  },
  ink: {
    onLight: 'FAFAFA',
    dimOnLight: 'A1A1AA',
    mutedOnLight: '71717A',
    onDark: 'FAFAFA',
    dimOnDark: 'A1A1AA',
    headingOnDark: 'FFFFFF',
  },
  neutral: {
    n50: '18181B',
    n100: '27272A',
    n200: '3F3F46',
    n300: '52525B',
    n400: '71717A',
    n500: 'A1A1AA',
    n600: 'D4D4D8',
    n700: 'E4E4E7',
    n900: 'FFFFFF',
  },
  fonts: {
    display: { family: 'Syne', stack: '"Syne", "Inter", sans-serif' },
    sans: { family: 'Inter', stack: '"Inter", sans-serif' },
    mono: { family: 'JetBrains Mono', stack: '"JetBrains Mono", monospace' },
  },
  styleSystem: {
    coverLayout: 'monumental',
    coverGradient: 'radial-gradient(circle at 80% 20%, #431407 0%, #18181B 60%, #09090B 100%)',
    slideBackground: '#09090B',
    isDarkSlideDefault: true,
    cardStyle: 'bordered',
    glowColor: 'rgba(234, 88, 12, 0.28)',
    showGrid: true,
    headerStyle: 'hud',
  },
};

export const SWISS_MINIMAL_THEME: DeckTheme = {
  ...WOZKU_THEME,
  id: 'template_swiss_minimal',
  name: 'Swiss Minimal',
  accent: {
    base: '2563EB',
    bright: '60A5FA',
    deep: '1D4ED8',
    tint: 'EFF6FF',
  },
  fonts: {
    display: { family: 'Space Grotesk', stack: '"Space Grotesk", "Inter", sans-serif' },
    sans: { family: 'DM Sans', stack: '"DM Sans", "Inter", sans-serif' },
    mono: { family: 'Space Mono', stack: '"Space Mono", monospace' },
  },
  styleSystem: {
    coverLayout: 'editorial-split',
    coverGradient: 'linear-gradient(180deg, #F8FAFC 0%, #EDF2F7 100%)',
    slideBackground: '#FFFFFF',
    glowColor: 'rgba(37, 99, 235, 0.08)',
    showGrid: true,
    headerStyle: 'minimal',
  },
};

/** The themes that ship with the app. Client brand kits are stored separately
 *  (see brandKitStore) because they are user data, not code. */
export const BUILT_IN_THEMES: DeckTheme[] = [
  WOZKU_THEME,
  MONOCHROME_THEME,
  EDITORIAL_THEME,
  AI_NATIVE_THEME,
  WAVE_THEME,
  STARTUP_BOLD_THEME,
  SWISS_MINIMAL_THEME,
];

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
/** The typeface roles a kit may override. Absent means the house face. */
export interface KitFonts {
  display?: string;
  sans?: string;
  mono?: string;
}

/**
 * One role's face, given a chosen family and the house face it replaces.
 *
 * The chosen family goes in front of the house stack rather than replacing it, so
 * the fallback chain stays *role-correct*: a client's mono falls back to JetBrains
 * Mono and then to the system monospace, never to a sans. A single generic stack
 * for all three roles would put body-face fallbacks behind a code face, which is
 * what you would see for the second before the web font arrives.
 */
function roleFont(family: string | undefined, house: ThemeFont): ThemeFont {
  if (!family || family === house.family) return house;
  return { family, stack: `"${family}", ${house.stack}` };
}

/**
 * A client kit as a theme.
 *
 * Colour and type, because a brand is both. The kit stores family *names* and the
 * roles are resolved here, which is what makes the rest of the app free: every
 * renderer reads `--font-display` / `--font-sans` / `--font-mono` out of
 * `themeCssVars`, the exporter reads `theme().fonts.<role>.family`, and
 * `familiesInDeck` already collects all three for embedding. So a kit's typefaces
 * reach the canvas, the thumbnails, present mode and the .pptx without any of
 * them knowing kits exist.
 */
export function brandKitTheme(kit: {
  id: string;
  name: string;
  accent: string;
  fonts?: KitFonts;
}): DeckTheme {
  return {
    ...WOZKU_THEME,
    id: kit.id,
    name: kit.name,
    accent: accentRamp(kit.accent),
    fonts: {
      display: roleFont(kit.fonts?.display, WOZKU_THEME.fonts.display),
      sans: roleFont(kit.fonts?.sans, WOZKU_THEME.fonts.sans),
      mono: roleFont(kit.fonts?.mono, WOZKU_THEME.fonts.mono),
    },
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
  const isDark = theme.styleSystem?.isDarkSlideDefault;
  const headingColor = isDark ? css(theme.ink.headingOnDark || theme.ink.onDark) : css(theme.ink.onLight);
  const bodyColor = isDark ? css(theme.ink.dimOnDark || theme.ink.onDark) : css(theme.ink.dimOnLight);
  const mutedColor = isDark ? css(theme.ink.dimOnDark) : css(theme.ink.mutedOnLight);

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
    '--neutral-500': bodyColor,
    '--neutral-600': mutedColor,
    '--neutral-700': isDark ? css(theme.neutral.n700) : css(theme.neutral.n700),
    '--neutral-900': headingColor,

    '--pure-white': css(theme.surface.light),
    '--border-subtle': isDark ? 'rgba(255,255,255,0.08)' : css(theme.rule.hairline),
  };
}
