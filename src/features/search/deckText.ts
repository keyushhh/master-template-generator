import type { Deck, SlideInstance } from '../deck/types';

/**
 * Every word a deck actually says, for the library's one search field.
 *
 * Library search matched deck names only, so a deck you remembered by a line on
 * slide nine was unfindable unless you also remembered what you had called the
 * file. Find and replace already reaches inside a deck; this is the same reach
 * from the outside.
 *
 * The walk is generic rather than a list of content fields on purpose. A field
 * list here would be a third copy of the model that silently stops matching the
 * day a template gains a slot, and search that quietly misses is worse than
 * search that is a little broad.
 */

/** Keys whose value is a machine string: an id, a colour, a URL, a font name. */
const NOT_PROSE = /(^|[a-z])(id|ids|url|kind|layout|colou?r|hex|font|fontfamily|align|valign|transition|templateid|instanceid|assetid)$/i;

function collect(value: unknown, key: string, out: string[]): void {
  if (typeof value === 'string') {
    // A data URL is megabytes of base64 that will match almost any query.
    if (NOT_PROSE.test(key) || value.startsWith('data:') || value.startsWith('http')) return;
    const text = value.trim();
    if (text) out.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, key, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collect(v, k, out);
  }
}

/** Everything readable on one slide, including notes and overlay text. */
export function slideStrings(slide: SlideInstance): string[] {
  const out: string[] = [];
  collect(slide.content, 'content', out);
  collect(slide.notes, 'notes', out);
  return out;
}

export interface DeckTextHit {
  /** 1-based, counting hidden slides too: it is where the slide sits in the deck. */
  slideNumber: number;
  slideTitle: string;
  /** The matched line, shortened around the match. */
  snippet: string;
}

/** A snippet of `text` around the first hit, at most `width` characters. */
function excerpt(text: string, at: number, query: string, width = 68): string {
  const flat = text.replace(/\s+/g, ' ');
  if (flat.length <= width) return flat;
  const start = Math.max(0, at - Math.floor((width - query.length) / 2));
  const end = Math.min(flat.length, start + width);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}

/** The first place a deck says `query`, or null. Deck names are the caller's job. */
export function findDeckText(deck: Deck | null | undefined, query: string): DeckTextHit | null {
  const q = query.trim().toLowerCase();
  if (!deck || q.length < 2) return null;
  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    for (const text of slideStrings(slide)) {
      const at = text.toLowerCase().indexOf(q);
      if (at === -1) continue;
      return {
        slideNumber: i + 1,
        slideTitle: slide.title || 'Untitled slide',
        snippet: excerpt(text, at, q),
      };
    }
  }
  return null;
}
