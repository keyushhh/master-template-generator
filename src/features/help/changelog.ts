/**
 * The changelog.
 *
 * ── How to add a release ───────────────────────────────────────────────────
 * Put the new entry at the TOP of `CHANGELOG` and bump its `version`. The app
 * reads `CHANGELOG[0]` as "latest", and shows an unread dot on the help button
 * until someone opens the changelog at that version, so shipping a release is
 * this file plus nothing else.
 *
 * Keep `date` as `YYYY-MM-DD`. Group changes under `added` / `improved` /
 * `fixed`; omit a group rather than leaving it empty. Write each line as what a
 * reader gets, not what was refactored: "the slide counter is readable on white
 * slides" rather than "moved chrome out of SlideStage".
 */

export type ChangeKind = 'added' | 'improved' | 'fixed';

export interface Release {
  version: string;
  date: string;
  /** One line on what the release is about, shown under the version. */
  summary: string;
  added?: string[];
  improved?: string[];
  fixed?: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '0.4.0',
    date: '2026-08-12',
    summary: 'A front door for the app: every deck in one place, grouped and searchable.',
    added: [
      'Deck Library at the app root, showing every deck as its actual cover rather than a list of names.',
      'The deck you were last in gets a hero, with Open and Present side by side, so you can present a finished deck without passing through the editor.',
      'Decks group by client automatically, taken from the brand kit each one is on. No folders to maintain.',
      'Search, plus List and Grid views for the index, with your choice remembered.',
      'Rename, duplicate and delete a deck from the library.',
    ],
    improved: [
      'Decks past the first screenful sit behind a "Show more" press instead of an endless scroll, and are grouped by Today / This week / This month / Older.',
      'The Wozku mark in the studio header now takes you back to the library.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-08-12',
    summary: 'Client brand kits: one colour, applied across all fourteen layouts.',
    added: [
      'Brand kits. Save a client’s brand colour once and any deck can adopt it; editing the kit moves every deck on it.',
      'The four accent steps each layout needs are derived from your one hex, and adjusted until they measure readable rather than by a fixed offset.',
      'A Monochrome house theme, for decks that read wrong with any accent.',
      'A live cover preview while you pick the colour, drawn through the real slide renderer.',
    ],
    improved: [
      'The canvas and the PowerPoint export now read their palette and type stack from one place, so what you see and what the client opens cannot drift apart.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-08-12',
    summary: 'Presenting and exporting, rebuilt.',
    added: [
      'Presenter view: the current slide, what’s coming next, speaker notes at a readable size and an elapsed timer, all at once. Press P.',
      'Jump to any slide mid-presentation with G, and blank the screen with B.',
      'Slide organiser: the whole deck at once for reordering, hiding and bulk edits, with shift-click for a range.',
      'The export sheet now shows the deck you are about to send, names the file before it exists, and explains what each format is for.',
    ],
    improved: [
      'Add slide drops the new slide where you are looking in the rail, instead of always at the very end.',
      'Export and deck organisation are two screens now, each doing one job, rather than one screen doing four.',
    ],
    fixed: [
      'The slide counter in Present mode was unreadable on white slides. All presenter controls now sit off the slide, on their own ground.',
      'Clicking the left half of a slide while presenting used to go backwards with nothing saying so. Clicking anywhere now advances.',
      'The thumbnail action menu was cut off by the window when opened on the last slide in the rail.',
      'Exported files were named after the first slide’s heading, so most decks arrived as cover.pptx. They now use the deck’s name.',
      'Removed a Copy Link button that copied a link showing the recipient their own empty studio.',
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0].version;

const SEEN_KEY = 'wozku-changelog-seen-v1';

/** True when the newest release has not been opened yet, which is what puts the
 *  dot on the help button. */
export function hasUnreadChangelog(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== LATEST_VERSION;
  } catch {
    // No storage: treat as read, so a private window doesn't nag every load.
    return false;
  }
}

export function markChangelogSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, LATEST_VERSION);
  } catch {
    // Non-fatal: the dot will just come back next load.
  }
}

/** "12 Aug 2026" from the stored `YYYY-MM-DD`, without pulling in a date lib.
 *  Parsed as UTC so a date never slips a day west of Greenwich. */
export function formatReleaseDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
