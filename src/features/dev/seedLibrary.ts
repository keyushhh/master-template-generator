import { createTemplateDeck } from '../deck/deckBuilder';
import {
  createFolder,
  createProject,
  deleteFolder,
  deleteProject,
  listFolders,
  listProjects,
  moveProjectToFolder,
  setProjectUpdatedAt,
  type FolderColor,
} from '../deck/deckStore';
import { createBrandKit, deleteBrandKit, listBrandKits } from '../theme/brandKitStore';
import type { Deck } from '../deck/types';

/**
 * Fills the library with plausible work, so its layout can be judged at the sizes
 * it will actually be used at.
 *
 * Every state past "one empty deck" was previously unreachable without an hour of
 * clicking, which means the states nobody could see were the states nobody
 * designed: what forty decks scroll like, what five clients do to the filter row,
 * whether a long client name breaks a row. Dev-only, and the panel that drives it
 * is compiled out of production builds.
 */

/** Client kits, with colours far enough apart to tell the filter chips apart. */
const CLIENTS: { name: string; accent: string }[] = [
  { name: 'Northwind Group', accent: '2563EB' },
  { name: 'Halcyon Labs', accent: '7C3AED' },
  { name: 'Meridian Retail', accent: 'DC2626' },
  { name: 'Kestrel Bio', accent: '0F766E' },
  { name: 'Atlas Freight', accent: 'D97706' },
];

/** Real deck names an agency would actually have on file. Deliberately varied in
 *  length, including one long enough to test truncation. */
const DECK_NAMES = [
  'Q3 Performance Review',
  'Brand Refresh Proposal',
  'Series B Narrative',
  'Retail Media Playbook',
  'Annual Strategy Offsite',
  'Category Entry Assessment',
  'Paid Social Teardown',
  'Website Redesign Scope',
  'Market Landscape 2026',
  'Customer Research Readout',
  'Pricing Architecture Review and Recommendations',
  'Channel Mix Rebalance',
  'Creative Concept Territories',
  'Partnership Business Case',
  'Loyalty Programme Design',
  'Media Investment Plan',
  'Post-Campaign Analysis',
  'Content Operating Model',
  'Regional Expansion Brief',
  'Quarterly Business Review',
  'Sponsorship Evaluation',
  'Positioning Workshop Output',
  'Lifecycle Marketing Audit',
  'Competitive Response Plan',
];

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Deterministic pseudo-random, so a seeded library looks the same every time and
 *  a layout problem can be reproduced rather than hunted for. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** A deck of `count` slides, cut from the master template and given a heading so
 *  the cover is not fourteen identical placeholders. */
function deckOf(count: number, heading: string, themeId?: string): Deck {
  const base = createTemplateDeck();
  const slides = base.slides.slice(0, Math.max(1, Math.min(count, base.slides.length)));
  const [cover, ...rest] = slides;
  return {
    ...base,
    themeId,
    slides: [
      {
        ...cover,
        content: {
          ...cover.content,
          headingLines: heading.split(' ').length > 2
            ? [heading.split(' ').slice(0, 2).join(' '), heading.split(' ').slice(2).join(' ')]
            : [heading],
          projectLabel: 'WOZKU',
        },
      },
      ...rest,
    ],
  };
}

/** Ages spread across today, this week, this month and older, so the library's
 *  time grouping actually has something in every bucket. */
function ageFor(i: number, total: number, rand: () => number): number {
  const now = Date.now();
  if (i === 0) return now - 4 * 60_000;
  const band = i / total;
  if (band < 0.2) return now - Math.floor(rand() * 8 * HOUR) - HOUR;
  if (band < 0.5) return now - Math.floor(1 + rand() * 5) * DAY;
  if (band < 0.8) return now - Math.floor(8 + rand() * 20) * DAY;
  return now - Math.floor(35 + rand() * 300) * DAY;
}

/** Remove every deck and every brand kit. */
export function clearLibrary(): void {
  for (const p of listProjects()) deleteProject(p.id);
  for (const k of listBrandKits()) deleteBrandKit(k.id);
}

/** Folder names varied enough to catch a long one wrapping the card's title. */
const FOLDER_NAMES = [
  'Q3 Clients',
  'Pitch Decks',
  'Retail Vertical',
  'Internal',
  'Archive 2025',
  'Onboarding',
  'Strategy Work',
  'Brand Refresh',
  'Renewals',
  'Case Studies',
  'Workshops',
  'New Business',
  'Retainer Clients',
  'One-offs',
  'Templates',
  'Q4 Planning',
  'Executive Reviews',
  'Media Plans',
  'Research',
  'Proposals',
  'Legacy',
  'Fast Track',
  'VIP Accounts',
  'A Folder With A Genuinely Long Name',
];

const FOLDER_COLORS: FolderColor[] = [
  'orange',
  'purple',
  'blue',
  'emerald',
  'rose',
  'slate',
  'indigo',
  'amber',
];

/** Remove every folder (decks inside are untouched - they fall back to Uncategorised). */
export function clearFolders(): void {
  for (const f of listFolders()) deleteFolder(f.id);
}

/**
 * Replace the folder shelf with `count` folders, so the grid's wrap-to-a-new-row
 * behaviour can be judged at a size beyond the two or three anyone has by hand.
 *
 * Deliberately doesn't touch decks: folders are a layout question on their own,
 * and forcing a deck reseed alongside it would make "just the folders" a state
 * you could never isolate. Whatever decks already exist get distributed across
 * roughly two-thirds of the new folders, so counts vary and some stay empty -
 * both are real states the empty-folder icon and the deck-count line need to
 * survive looking at.
 */
export function seedFolders(count: number): void {
  clearFolders();

  const rand = rng(count * 104729);
  const projects = listProjects();
  let cursor = 0;

  for (let i = 0; i < count; i++) {
    const name =
      FOLDER_NAMES[i % FOLDER_NAMES.length] +
      (i >= FOLDER_NAMES.length ? ` ${Math.floor(i / FOLDER_NAMES.length) + 1}` : '');
    const color = FOLDER_COLORS[i % FOLDER_COLORS.length];
    const folder = createFolder(name, color);

    if (projects.length && rand() < 0.7) {
      const take = 1 + Math.floor(rand() * 4);
      for (let j = 0; j < take && cursor < projects.length; j++, cursor++) {
        moveProjectToFolder(projects[cursor].id, folder.id);
      }
    }
  }
}

/**
 * Replace the library with `count` decks spread across a handful of clients.
 *
 * Clears first: seeding on top of a seeded library is how you end up debugging a
 * layout against sixty decks you did not mean to have.
 */
export function seedLibrary(count: number): void {
  clearLibrary();

  const rand = rng(count * 7919);
  const clientCount = count <= 3 ? 1 : count <= 8 ? 3 : CLIENTS.length;
  const kitIds = CLIENTS.slice(0, clientCount).map((c) => createBrandKit(c.name, c.accent).id);

  for (let i = 0; i < count; i++) {
    const name = DECK_NAMES[i % DECK_NAMES.length] + (i >= DECK_NAMES.length ? ` (${Math.floor(i / DECK_NAMES.length) + 1})` : '');
    // Roughly a quarter stay on the house theme, which is what an agency's own
    // internal decks look like.
    const onHouse = rand() < 0.25;
    const themeId = onHouse ? undefined : kitIds[Math.floor(rand() * kitIds.length)];
    const slideCount = 4 + Math.floor(rand() * 11);

    const meta = createProject(name, {
      ast: null,
      deck: deckOf(slideCount, name, themeId),
    });
    setProjectUpdatedAt(meta.id, ageFor(i, count, rand));
  }
}
