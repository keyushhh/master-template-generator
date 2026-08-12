import type { Deck } from '../deck/types';
import { overlayOf } from '../formatting/overlayModel';
import type { DeckTheme } from '../theme/deckTheme';

/**
 * Every typeface a deck needs in order to be drawn correctly.
 *
 * There are five places a family can come from, and missing any one of them
 * shows up as a slide that renders in the wrong face until you happen to click
 * the thing that carries it:
 *
 *  - the deck's theme, for the three roles the templates use
 *  - a per-slot override, from the toolbar's typeface menu
 *  - an inserted text box or shape
 *  - a cell of an inserted table
 *  - a run inside a shape imported from a .pptx, which can name any font at all
 *
 * Used both to preload on open and to decide what an export has to embed, so the
 * two can never disagree about which fonts a deck is actually in.
 */
export function familiesInDeck(deck: Deck, theme?: DeckTheme): string[] {
  const out = new Set<string>();

  if (theme) {
    out.add(theme.fonts.display.family);
    out.add(theme.fonts.sans.family);
    out.add(theme.fonts.mono.family);
  }

  for (const slide of deck.slides) {
    const c = slide.content;

    for (const style of Object.values(c.styles ?? {})) {
      if (style?.fontFamily) out.add(style.fontFamily);
    }

    for (const shape of overlayOf(c)) {
      if (shape.style?.fontFamily) out.add(shape.style.fontFamily);
      for (const row of shape.rows ?? []) {
        for (const cell of row.cells) {
          if (cell.style?.fontFamily) out.add(cell.style.fontFamily);
        }
      }
    }

    for (const shape of c.shapes ?? []) {
      for (const para of shape.paragraphs ?? []) {
        for (const run of para.runs ?? []) {
          if (run.font) out.add(run.font);
        }
      }
      for (const row of shape.rows ?? []) {
        for (const cell of row.cells ?? []) {
          for (const para of cell.paragraphs ?? []) {
            for (const run of para.runs ?? []) {
              if (run.font) out.add(run.font);
            }
          }
        }
      }
    }
  }

  return [...out];
}
