/** The app changelog. */

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
    version: '1.7.0',
    date: '2026-08-13',
    summary: 'A cleaner header and a beautiful new modal for choosing where your decks are saved.',
    added: [
      'A new two-card "Deck Type" selection modal when creating a deck, clearly separating "Team Repository" from the "Quick Sandbox".',
    ],
    improved: [
      'Decluttered the homepage header by moving the "Quick Sandbox" option into the new creation flow.',
    ],
    fixed: [
      'Fixed a bug where decks promoted from the Quick Sandbox to the Team Repository wouldn\'t jump to the top of the "Recently Edited" list.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-08-13',
    summary: 'Redesigned Private Workspace layout featuring a fixed desktop sidebar, with the Shared Team Workspace remaining unchanged.',
    added: [
      'Personal Workspace visual layout featuring a viewport-locked sidebar navigation panel, local storage allocation bar, and custom profile switch menu.',
    ],
    improved: [
      'Locked Private Workspace header toolbar to the top of the viewport during page scroll to match the fixed sidebar placement.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-13',
    summary: 'Rotation and opacity controls for shapes, deck rename affordances, and library present resumption.',
    added: [
      'Rotation and opacity controls for inserted shapes, image containers, and text boxes, with full native export to PowerPoint.',
      'Explicit hover affordance for renaming decks in library grid and hero cards.',
      'Presenting from the library now remembers and resumes from your last viewed slide position.',
    ],
    improved: [
      'Updated tab title to "Wozku Studio", added favicon, and aligned browser theme-color with app ground (#F1F2F4).',
      'Cleaned up README and added build outputs (dist/) to .gitignore.',
    ],
    fixed: [
      'Fixed library skeleton loading state so it renders correctly on deferred cover load paths.',
      'Removed duplicate "New Folder" action from the folder shelf.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-13',
    summary: 'Full control of text spacing, and videos you can put on a slide and actually play.',
    added: [
      'Spacing controls in the format bar: line height, letter spacing, space before and after a paragraph, indent, and bullets. Each one starts from the value the slide is really using, steps through the sizes the templates already use, and can be reset to the template on its own.',
      'Text case as formatting (UPPERCASE, lowercase or Title Case) without changing a word of what you typed, so you can take it off again.',
      'Video on a slide. Insert a video from the rail, then paste a YouTube or Vimeo link, or upload a file from your machine. It plays in Present mode, travels into the HTML export, and lands in the .pptx as a real PowerPoint video.',
    ],
    improved: [
      'Everything in the spacing and case controls survives the PowerPoint export, so what you set on the canvas is what the client opens.',
      'Folder icons open the way the design does: the front flap slides down over 300ms rather than one icon cross-fading into another.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-12',
    summary: 'Save a deck as a template, a working laser pointer, and a folder shelf that scales.',
    added: [
      'Save deck as template. From the command palette, snapshot the current deck’s slides as a starter you can pick from the New deck screen next time, without touching its brand colour.',
      'The changelog can be filtered by Added, Improved or Fixed. Click a tag to see just that kind of change, click Clear to see everything again.',
      'Present mode’s annotation pen and laser pointer actually draw now, and the laser has a colour picker (red, green, blue, yellow, purple).',
      'Pinch (or Ctrl/Cmd+scroll, or the new zoom buttons) resizes the folder shelf’s icons, up to a ceiling sized so two full rows always fit before the shelf would need to scroll. Past the smallest useful size it switches to a list instead of shrinking into something unreadable, and the list is a real table: name, date created, deck count, and the same actions as icons.',
      'The library’s search covers folders as well as decks now, so there is one search box rather than a second one just for the shelf.',
    ],
    improved: [
      'Folders sit inside one shared container instead of each getting its own boxed card, and wrap into more rows as the shelf grows rather than spreading further sideways. The shelf itself is capped at two rows at its largest icon size and scrolls internally past that, rather than pushing the decks below it further down every time a folder is added.',
      'The folder “...” menu has icons now, highlights while open, and closes when you click anywhere else on the shelf.',
      'Every delete (a deck, a slide, a shape, a table, a saved template, single or bulk) asks first and says plainly that it can’t be undone. Deleting a folder that has decks in it asks whether to keep them (moved to Uncategorised) or delete them too, instead of only ever moving them.',
    ],
    fixed: [
      'The annotation pen and laser pointer toggled a state nothing read: clicking them changed nothing on screen. Neither drew anything, and "Clear Ink" rendered its label outside its own button.',
      'The laser’s colour picker opened below the bottom toolbar, off the bottom of the screen, which looked like it did nothing when clicked.',
      'Pinching the folder shelf zoomed the whole page along with the icons. React’s wheel handler is registered passive, so `preventDefault` inside it was silently ignored; a real listener on the shelf itself fixed it.',
      'A folder deleted elsewhere (or wiped by the dev seeder) while you were looking at it left the library stuck showing an empty view for an id that no longer existed. It now returns to the root.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-12',
    summary: 'Brand kits carry typefaces, not just colour.',
    added: [
      'A brand kit now sets the client’s typefaces as well as their colour: display for headings, body for paragraphs, mono for labels. Any role left on House keeps the Wozku face, so a kit can change only the headings.',
      'The kit’s type shows up everywhere its colour does, with nothing to set per slide: the canvas, the rail thumbnails, the library covers, present mode, and embedded into the .pptx.',
      'Fit all. When the export sheet says text is cut off on six slides, one press fixes every one of them, as a single undo. Also in the palette as "Fit text on every clipped slide".',
    ],
    improved: [
      'A deck filed into a folder leaves the library list. It lives in that folder now; take it out and it comes back. Before this, filing a deck tidied nothing, because the same deck then appeared in two places.',
      'The library’s list is headed Uncategorised rather than "Everything else", which is what it now actually contains.',
      'Search reaches every deck, filed or not, and a result that lives in a folder says which one. Inside a folder, search stays inside that folder.',
      'Removed the drop shadow from the New Folder button in the masthead.',
      'The library’s List view is called Table now, with an icon to match. It has been a real sortable table for a while and the old name undersold it.',
      'The library opens in Table view, which is the one that scales past a screenful of decks.',
    ],
    fixed: [
      'Opening a folder permanently changed the library’s own view to Grid. A folder is always a grid, but that was being saved as though you had chosen it, so coming back out left the library in Grid for good.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-12',
    summary: 'All 1,932 Google Fonts in the typeface menu, and body copy that exports in the font you can see.',
    added: [
      'The typeface menu now searches the whole Google Fonts library, with filters for Sans, Serif, Display, Mono and Script. Every row is set in the face it names.',
      'Any font you pick is fetched for the canvas, embedded into the .pptx so desktop PowerPoint has it, and named so Google Slides resolves it with nothing installed.',
      'The export sheet warns you when a deck names a typeface that cannot be embedded, which happens with fonts an imported .pptx brought in from its original author.',
    ],
    improved: [
      'The three house faces stay pinned at the top of the menu. Reaching the rest takes typing, so the on-brand choice is still the fastest one.',
      'Google’s own brand faces are deliberately absent from the list. The API will serve them, but they carry no licence that lets us put them inside a file you send a client.',
    ],
    fixed: [
      'Choosing a typeface did nothing unless the text already had some other formatting on it. The override was being judged "empty" and discarded before it reached the slide, so the menu closed and nothing changed.',
      'The toolbar kept naming the old typeface after you had changed it. It was reporting the font measured off the slide when the slot was selected rather than the one you picked, so a change that had worked looked like one that had not.',
      'Body copy exported in the display face while the studio drew it in the body face. Every paragraph in every deck exported before this was in the wrong typeface, and because the difference was a font rather than a position, nothing looked broken until you put the two side by side.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08-12',
    summary: '3D Folders, Drag-and-Drop Deck Organization, and Bulk Move Controls.',
    added: [
      '3D Folder Management: Organize decks into custom color-coded folders featuring high-resolution 3D SVG folder states and smooth open-on-hover animations.',
      'Drag-and-Drop Deck Movement: Drag any deck directly onto a folder card from both List and Grid views to instantly move it inside.',
      'Bulk "Move to Folder" Toolbar: Move multiple selected decks at once into any folder or back to the main library directly from the table action bar.',
      '"Add Existing Decks" Modal: Search and import existing decks into any open folder using a dedicated deck selector dialog with live slide cover thumbnails.',
      'Row Hover Folder Controls: Added a quick "Move to Folder" hover action button on every table row with filled color-matched folder icons.',
      'One-Click Folder ZIP Export: Download the full ZIP archive of all PowerPoint (.pptx) decks inside any folder with a single click.',
    ],
    improved: [
      'Refined folder header with prominent "[ ← Back ]" navigation and interactive breadcrumbs.',
      'Scoped deck row clicks so opening a deck happens specifically when clicking its name or cover thumbnail.',
      'Removed unnecessary card drop shadows on folder hover to maintain clean 0px sharp-corner brand aesthetics.',
    ],
  },
  {
    version: '0.9.1',
    date: '2026-08-12',
    summary: 'The body typeface is now one a client’s machine can actually get.',
    improved: [
      'Satoshi has been replaced by DM Sans as the body typeface. Every face in the deck is now a free Google Font, self-hosted and embedded into the .pptx, and available by name in Google Slides.',
      'The typeface menu is wider, so two-word family names read on one line instead of wrapping into what looked like two options.',
    ],
    fixed: [
      'Satoshi was never embedded in exports. It came from Fontshare rather than Google Fonts, so a deck looked right in the studio and substituted to something else the moment anyone else opened it.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-08-12',
    summary: 'Standalone Interactive HTML Export, Pre-Flight Quality Checklist, and Editable Export Filename.',
    added: [
      'Interactive HTML Export: Export decks as self-contained interactive HTML presentations (.html) with offline keyboard navigation, fullscreen mode, and pixel-perfect 2× retina slide rendering.',
      'Pre-Flight "Before You Send" Checklist: Automatic scan in the Export Sheet checking for unedited template placeholder text, clipped text overflows, and missing source items.',
      'Editable Export Filenames: Click the filename box inside the Export Sheet to customize the file name before saving, with automatic format extension handling.',
      'Unified 4-Format Export Selector: Single-row selection grid for PowerPoint (.pptx), PDF (.pdf), Interactive HTML (.html), and Retina Images (.zip).',
    ],
    improved: [
      'Refined Pre-Flight checklist formatting with compact inline counters and quick slide reference indicators.',
      'Enhanced Export progress indicator with live rendering progress bar and animated status spinner.',
    ],
    fixed: [
      'Fixed text overlap issue on Data Monument slide (s6) by adjusting metric font sizing and element margins.',
      'Fixed HTML export presentation slide counter and restored initial slide total rendering.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-08-12',
    summary: 'Infinite Pan & Zoom, Slide Drawer, and Auto-Play presentation controls.',
    added: [
      'Infinite Pan & Smooth Zoom: Pinch or Ctrl+Scroll between 10% and 400% on the canvas, with Space+Drag stage panning.',
      'Auto-Hiding Presenter Sidebar: Hover the left edge in Present mode to reveal an interactive slide thumbnail drawer.',
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

/** True when the newest release has not been opened yet. */
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

/** Formats YYYY-MM-DD release date representation. */
export function formatReleaseDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
