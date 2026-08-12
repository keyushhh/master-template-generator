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
    version: '0.8.0',
    date: '2026-08-12',
    summary: 'Infinite Pan & Zoom, macOS Dock slide drawer, and Auto-Play presentation controls.',
    added: [
      'Infinite Pan & Smooth Zoom: Pinch or Ctrl+Scroll between 10% and 400% on the canvas, with Space+Drag stage panning.',
      'Auto-Hiding Presenter Sidebar: Hover the left edge in Present mode to reveal a slide thumbnail drawer, macOS Dock style.',
      'Unified Auto-Play Slideshow: Integrated Play/Pause icon button driving 5-second automatic slide advancement and presentation timer.',
      'Smart Auto-Layout Containers: Dynamic flex container reflows layout spacing and gaps when items are added or removed.',
    ],
    improved: [
      'Relocated slide navigation handle to top-left edge to avoid overlapping slide navigation arrows.',
      'Updated ionic circle outline icons (play-circle-outline and pause-circle-outline) for toolbar controls.',
      'Renamed Presenter label to Notes in present mode toolbar.',
    ],
    fixed: [
      'Ensured blackout eye-off icon inherits white stroke/fill against dark presenter bar.',
      'Made presenter timer display non-clickable so presentation timer and auto-play are unified.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-08-12',
    summary: 'Deck setup happens when you create a deck, not after you have built one.',
    added: [
      'A New deck screen: name it, choose what it starts from, and choose which client’s brand it is in, with the real cover shown in those colours before you commit.',
      'New clients can be added from that screen, so the first deck for a new client is one step rather than two.',
      '"Start from" is a list the app reads rather than a fixed choice, which is where per-client and per-pitch templates will appear in a later phase.',
    ],
    improved: [
      'The brand kit button has left the slide rail. It was a decision about the whole deck sitting among the controls for one slide, and it only offered the choice after the deck had already been built in house colours.',
      'Changing an existing deck’s brand is now a command in the palette (⌘K, "brand"), so it costs no standing screen space for something you do once.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-08-12',
    summary: 'A pre-flight before you send, and one place to reach everything.',
    added: [
      'Command palette. Press ⌘K (Ctrl+K on Windows) anywhere in the studio to jump to a slide by name, change a layout, export, present, or open any panel without going to find it.',
      'Borrow a slide from another deck. Pick the case study or the pricing table out of last quarter’s deck and it arrives in this deck’s brand colours, keeping its copy and its layout.',
      'Fit it. Any slide the studio says is cutting text off now offers a one-press fix that steps the type down until it fits, as a single undo.',
      'A pre-flight in the export sheet: placeholder text still showing, text being cut off, and anything your source document didn’t land on a slide, all in one list.',
      'Placeholder detection. A deck cannot quietly go out with "Project Name Placeholder" on the cover any more. Nearly-finished slides are listed first, since those are the ones somebody missed.',
    ],
    improved: [
      'The three export warnings used to be three stacked banners that pushed the format picker off the bottom of the sheet. They are one grouped checklist now.',
      'Slides borrowed or duplicated get a fresh identity, so editing a copy can never reach back and change the original.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-12',
    summary: 'The studio tells you when a slide is cutting your text off.',
    added: [
      'Fit check. Every slide in the rail is measured against its own layout, and any slide where text is being cut off is marked on its thumbnail. Hover the mark to see which text.',
      'The export sheet warns you before you send a deck with cut-off text, and names the slides. The slots are a fixed size, so anything cut in the studio is cut in the PowerPoint file too.',
      'A real table for the library’s List view, sortable by name, client, slides and date, with the source of each deck shown.',
      'Pagination on the library, with First, Back, Next and Last and a rows-per-page choice.',
    ],
    improved: [
      'The library no longer grows without end: it pages instead, so the way back from the oldest deck is one press rather than a long scroll.',
      'A back-to-top button appears once you have scrolled past the first screen.',
    ],
    fixed: [
      'The library’s pagination was drawing twice in List view.',
      'The changelog and the keyboard shortcuts sheet were being clipped to the height of the header bar instead of opening over the page.',
      'Removed the hairline grid behind the library, which was competing with the deck covers.',
    ],
  },
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
      'Decks in Grid view are grouped by Today / This week / This month / Older.',
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
