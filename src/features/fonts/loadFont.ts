import { catalogNow, fontByFamily, isBundled, loadCatalog, type CatalogFont } from './fontCatalog';

/**
 * Pulls a Google Font into the page so the canvas can draw with it.
 *
 * The three house faces arrive with the document, in `index.html`. Everything
 * else is chosen at runtime and has to be requested at runtime, so this injects
 * one `<link>` per family the moment something needs it.
 *
 * A stylesheet link rather than a constructed `FontFace`: the CDN's response is a
 * set of `@font-face` rules with a `unicode-range` per subset, which is what makes
 * a large family load only the bytes the text on screen needs. Rebuilding that by
 * hand would mean either downloading every subset or losing the split.
 */

/** Families we have asked the browser for, so a re-render does not re-request. */
const requested = new Set<string>();

/** Resolves when a family's file has actually arrived, per family. */
const ready = new Map<string, Promise<void>>();

const linkId = (family: string) => `wg-font-${family.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;

function stylesheetUrl(font: CatalogFont): string {
  const weights = font.weights.length ? font.weights : [400];
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family).replace(
    /%20/g,
    '+'
  )}:wght@${weights.join(';')}&display=swap`;
}

/**
 * Ensure `family` is available to the renderer.
 *
 * Safe to call repeatedly and safe to call for a family that is not in the
 * catalogue (an imported deck can name any font its author had): unknown
 * families resolve immediately, because there is nothing to fetch and the CSS
 * stack behind them will fall back on its own.
 */
export async function ensureFont(family: string | undefined): Promise<void> {
  if (!family || isBundled(family)) return;
  const existing = ready.get(family);
  if (existing) return existing;

  const promise = (async () => {
    // The catalogue is needed to know the family's real weights. Asking for a
    // weight a family does not publish makes the whole request fail.
    if (!catalogNow()) {
      try {
        await loadCatalog();
      } catch {
        return;
      }
    }
    const font = fontByFamily(family);
    if (!font) return;

    if (!requested.has(family)) {
      requested.add(family);
      const link = document.createElement('link');
      link.id = linkId(family);
      link.rel = 'stylesheet';
      link.href = stylesheetUrl(font);
      document.head.appendChild(link);
    }

    // `document.fonts.load` returns once the face for that specification is
    // usable. Without waiting, a caller that measures text (the fit check, the
    // auto-fit search) would measure the fallback and be wrong by a whole
    // typeface. The size is arbitrary; `load` keys on family, not on size.
    try {
      await document.fonts.load(`400 16px "${family}"`);
      await document.fonts.load(`700 16px "${family}"`);
    } catch {
      // A face that will not load is not worth failing an export over. The stack
      // falls back, and the export pre-flight reports what could not be embedded.
    }
  })();

  ready.set(family, promise);
  return promise;
}

/** Ensure a whole set, concurrently. Used when a deck opens: every family any
 *  slot has been switched to has to be present before the first paint is
 *  trustworthy. */
export async function ensureFonts(families: Iterable<string | undefined>): Promise<void> {
  const unique = new Set<string>();
  for (const f of families) if (f && !isBundled(f)) unique.add(f);
  if (unique.size === 0) return;
  await Promise.all([...unique].map((f) => ensureFont(f)));
}
