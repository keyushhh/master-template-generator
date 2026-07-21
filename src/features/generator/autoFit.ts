/**
 * Formula-based auto-fit for slide text - shrinks a font size within [min, max]
 * so long client copy never overflows its slot or wraps awkwardly. Character-
 * count based (not real DOM measurement), matching the approach the Cover
 * slide's hero heading already used before this was generalized.
 */

export interface HeadingFitOptions {
  min: number;
  max: number;
  /** Available width in px at `max` font size. */
  widthBudget: number;
  /** Available height in px for the whole (possibly multi-line) block. */
  heightBudget: number;
  /** Average glyph width as a fraction of font-size. Condensed display type
   *  (this app's heading font, negative letter-spacing) runs narrow. */
  charWidthRatio?: number;
  /** Effective line height as a fraction of font-size. */
  lineHeightRatio?: number;
}

/** For headings with explicit, author-controlled line breaks (`\n`) - one or
 *  more short lines, each user-authored rather than wrapped by the browser. */
export function autoFitHeadingFontSize(text: string, opts: HeadingFitOptions): number {
  const { min, max, widthBudget, heightBudget, charWidthRatio = 0.6, lineHeightRatio = 0.95 } = opts;
  const lines = text.split('\n').filter(Boolean);
  const lineCount = Math.max(lines.length, 1);
  const longestLine = Math.max(...lines.map((l) => l.length), 1);
  return Math.round(
    Math.max(
      min,
      Math.min(max, widthBudget / (longestLine * charWidthRatio), heightBudget / (lineCount * lineHeightRatio))
    )
  );
}

export interface BodyFitOptions {
  min: number;
  max: number;
  /** Available width in px a wrapped line can occupy at `max` font size. */
  widthBudget: number;
  /** How many wrapped lines this paragraph is allowed to grow to before the
   *  font shrinks further (a soft cap, not a hard line-clamp). */
  maxLines: number;
  charWidthRatio?: number;
}

/** For paragraphs that wrap naturally (no author-controlled line breaks) -
 *  shrinks proportionally to total character count so a long paragraph settles
 *  at a smaller size instead of spilling past its allotted number of lines. */
export function autoFitBodyFontSize(text: string, opts: BodyFitOptions): number {
  const { min, max, widthBudget, maxLines, charWidthRatio = 0.52 } = opts;
  const totalChars = Math.max(text.replace(/\s+/g, ' ').trim().length, 1);
  return Math.round(Math.max(min, Math.min(max, (maxLines * widthBudget) / (totalChars * charWidthRatio))));
}
