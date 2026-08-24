import type { Deck } from './types';
import { mintInstanceId } from './deckBuilder';

/**
 * User-saved deck templates: "start a new deck from this one, content and all."
 *
 * A `DeckStarter` (see `deckStarters.ts`) is a fixed, code-defined entry; this is
 * the same idea for a deck a user built themselves. Saving one snapshots the
 * slides only - no `themeId`, for the same reason a built-in starter carries
 * none: a starter decides the slides, a brand kit decides the colour, and a
 * template that baked in a colour would force that colour on every client it's
 * later used for.
 *
 * Stored, like brand kits, in localStorage:
 *   wozku-deck-templates-v1  →  SavedDeckTemplate[]
 */

const KEY = 'wozku-deck-templates-v1';

export interface SavedDeckTemplate {
  id: string;
  name: string;
  description: string;
  deck: Deck;
  slideCount: number;
  updatedAt: number;
}

function newId(): string {
  return `tpl_${crypto.randomUUID()}`;
}

export function listDeckTemplates(): SavedDeckTemplate[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedDeckTemplate[];
    if (!Array.isArray(parsed)) return [];
    // Tolerate partial records rather than throwing away the whole list: one
    // malformed template should not lose a user every other template they saved.
    return parsed
      .filter((t) => t && typeof t.id === 'string' && t.deck && Array.isArray(t.deck.slides))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function write(templates: SavedDeckTemplate[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(templates));
    return true;
  } catch {
    // Storage may be unavailable (private mode / quota).
    return false;
  }
}

/** Snapshot a deck's slides as a reusable starter. Drops `themeId`; keeps `logoUrl`. */
export function saveDeckTemplate(name: string, description: string, deck: Deck): SavedDeckTemplate {
  const template: SavedDeckTemplate = {
    id: newId(),
    name: name.trim() || 'Untitled template',
    description: description.trim(),
    deck: { generated: false, slides: deck.slides, logoUrl: deck.logoUrl },
    slideCount: deck.slides.length,
    updatedAt: Date.now(),
  };
  write([...listDeckTemplates(), template]);
  return template;
}

export function deleteDeckTemplate(id: string): void {
  write(listDeckTemplates().filter((t) => t.id !== id));
}

/**
 * A template's deck, ready to hand to a new project.
 *
 * Reminted instance ids, not the saved ones: two decks started from the same
 * template must not share slide identity, or an edit tracked by instance id in
 * one would silently apply to the other were they ever compared or merged.
 */
export function instantiateDeckTemplate(template: SavedDeckTemplate): Deck {
  return {
    generated: false,
    logoUrl: template.deck.logoUrl,
    slides: template.deck.slides.map((s) => ({ ...s, instanceId: mintInstanceId(s.templateId) })),
  };
}
