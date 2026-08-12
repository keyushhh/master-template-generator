import { brandKitTheme, type DeckTheme, type KitFonts } from './deckTheme';

/**
 * Saved client brand kits.
 *
 * The reason this is a store and not just a field on a deck: an agency runs the
 * same client repeatedly. "Northwind's green" should be defined once and adopted
 * by every Northwind deck, and editing it should move every one of them - which
 * a colour pasted into each deck could never do. So a deck holds a `themeId` and
 * the colour lives here.
 *
 * Stored, like decks, in localStorage:
 *   wozku-brand-kits-v1  →  BrandKit[]
 *
 * Only the *inputs* are persisted (name + one hex), never the derived four-step
 * accent ramp. Persisting the derived values would freeze them: improve the ramp
 * maths and every saved kit would keep the old output forever.
 */

const KEY = 'wozku-brand-kits-v1';

export interface BrandKit {
  /** Stable id, referenced by `Deck.themeId`. */
  id: string;
  name: string;
  /** The client's brand colour. Hex, no '#', uppercase. */
  accent: string;
  /**
   * The client's typefaces, per role. Family names only, never a resolved stack:
   * a stack is derived, and a kit that stored one would freeze today's fallback
   * chain into saved data.
   *
   * Absent, or any role absent, means the house face for that role - the same way
   * an absent `themeId` on a deck means the house look. So every kit saved before
   * this existed keeps working and reads as "Wozku type, client colour".
   */
  fonts?: KitFonts;
  updatedAt: number;
}

function newId(): string {
  return `kit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function listBrandKits(): BrandKit[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BrandKit[];
    if (!Array.isArray(parsed)) return [];
    // Tolerate partial records rather than throwing away the whole list: one
    // malformed kit should not lose a user every other kit they have.
    return parsed.filter((k) => k && typeof k.id === 'string' && typeof k.accent === 'string');
  } catch {
    return [];
  }
}

function write(kits: BrandKit[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(kits));
    return true;
  } catch {
    // Storage may be unavailable (private mode / quota).
    return false;
  }
}

export function createBrandKit(name: string, accent: string, fonts?: KitFonts): BrandKit {
  const kit: BrandKit = {
    id: newId(),
    name: name.trim() || 'Untitled kit',
    accent: accent.replace('#', '').toUpperCase(),
    ...(cleanFonts(fonts) ? { fonts: cleanFonts(fonts) } : {}),
    updatedAt: Date.now(),
  };
  write([...listBrandKits(), kit]);
  return kit;
}

/**
 * Drops roles set to nothing, and the whole object if no role survives.
 *
 * An absent role has to mean "the house face", so storing `{ display: undefined }`
 * or an empty object would be a third state that means the same as absence and
 * reads differently in the saved JSON.
 */
function cleanFonts(fonts: KitFonts | undefined): KitFonts | undefined {
  if (!fonts) return undefined;
  const out: KitFonts = {};
  for (const role of ['display', 'sans', 'mono'] as const) {
    const family = fonts[role]?.trim();
    if (family) out[role] = family;
  }
  return Object.keys(out).length ? out : undefined;
}

export function updateBrandKit(
  id: string,
  patch: Partial<Pick<BrandKit, 'name' | 'accent'>> & { fonts?: KitFonts }
): void {
  write(
    listBrandKits().map((k) => {
      if (k.id !== id) return k;
      const next: BrandKit = {
        ...k,
        ...(patch.name !== undefined ? { name: patch.name.trim() || k.name } : {}),
        ...(patch.accent !== undefined ? { accent: patch.accent.replace('#', '').toUpperCase() } : {}),
        updatedAt: Date.now(),
      };
      if (patch.fonts !== undefined) {
        const fonts = cleanFonts(patch.fonts);
        if (fonts) next.fonts = fonts;
        else delete next.fonts;
      }
      return next;
    })
  );
}

export function deleteBrandKit(id: string): void {
  write(listBrandKits().filter((k) => k.id !== id));
}

/** The saved kits as themes, ready to pass to `themeById` as its `extra` list. */
export function brandKitThemes(kits: BrandKit[]): DeckTheme[] {
  return kits.map((k) => brandKitTheme(k));
}
