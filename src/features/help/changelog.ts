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
    version: '3.6.1',
    date: '2026-08-26',
    summary: 'One PDF export instead of two.',
    improved: [
      'The export sheet offered a plain PDF and a separate Handout PDF, both landing as ".pdf" and easy to pick wrong. Handout is gone; PDF still exports one slide per page, exactly what is on screen.',
    ],
  },
  {
    version: '3.6.0',
    date: '2026-08-26',
    summary: 'A lockable slide, scatter and combo charts, a diff on every saved version, and the studio can reach Help again after the first day.',
    added: [
      'A slide can be locked from its menu. Nothing about it can be dragged, resized, deleted or typed into until it is unlocked again, a guard against a stray click on a slide someone has already signed off on.',
      'Two more chart types: scatter, and combo, which draws every series but the last as bars and the last as a line over them. Both export as real PowerPoint charts, not pictures of one.',
      'Version history now says what changed since the version before it, not just when it was saved: how many slides were added, removed or edited.',
      'A slide carrying an off-brand colour, or text that fails contrast against its own fill, is flagged right on its thumbnail, the same check the export sheet runs, now visible while the slide is still being worked on.',
      'The studio can reach the Help menu (changelog, keyboard shortcuts, replay the getting-started tour) again after first open. It was only ever reachable from the library page before.',
      'The app can now be added to an iPhone or iPad home screen with its own icon, instead of a screenshot of whatever page was open.',
    ],
    improved: [
      'A toast now carries an icon for its kind, and a repeated failure updates one toast instead of stacking a new one every time.',
      'Every card in the deck library grid lifts slightly on hover, matching the motion already on the featured cover.',
      'A keyboard user can jump straight past the top bar into the slide or the library grid with one skip link, and every toolbar dropdown now identifies itself to a screen reader as a menu.',
    ],
  },
  {
    version: '3.5.0',
    date: '2026-08-26',
    summary: 'Two versions of a slide, a window for the projector, rehearsing against the clock, and the deck writes its own record back out.',
    added: [
      'Make a variant keeps two versions of one slide side by side. Only the version you pick is in the deck, so numbering, export and present are unaffected, and you can switch between them mid-presentation when the room asks the other question.',
      'Screen 2 opens a window with nothing in it but the slide, to drag onto a projector or a second display. It follows the presenting window, blanks with it, and picks the deck up again if you start presenting a second time.',
      'Rehearse against a target length. The bar says whether you are on pace, and leaving the rehearsal shows where the time went, slide by slide, with the ones that ate it flagged.',
      'Save the Business Record writes the deck back out as the Markdown record it could have come from, so the record follows the deck instead of going stale the first time somebody edits a slide. Generating from it again rebuilds the same slides.',
      'Brand check lists every size, colour, typeface and position that is not one the templates use, with a one-click way to put each back. Off brand on purpose stays: nothing changes until you say so.',
      'A brand kit can be read off the client’s logo. Drop the logo in and the colours come back in order of how much of the mark they cover, with one proposed as the accent.',
      'Handout export: portrait pages, three slides each, the speaker notes beside every slide, and a contents page in front.',
      'Library search now reaches inside the decks. A deck you remember by a line on slide nine is findable by that line, and the result says which slide it was.',
      'The app installs to the dock or home screen and opens without a connection, which is the state a laptop is in before a client meeting more often than anyone plans for.',
      'A chart takes a dropped CSV file as well as a pasted spreadsheet table.',
      'A chart series, or a pie slice, can be set to a different colour from the deck palette, or to a typed hex, and put back to the deck’s own colour in one click.',
    ],
    fixed: [
      'A chart drew itself in Wozku’s green whatever brand kit the deck was on, because chart colours were hardcoded rather than taken from the deck. Charts now use the deck’s own palette, and the PowerPoint export uses the same one, so the file matches the slide.',
      'Adding a category or a series to a chart added an invisible one: it arrived at zero, and a bar of zero height is nothing to look at. A new category now arrives at the same magnitude as the data beside it, ready to type over, and a category that really is zero shows a mark on the axis instead of vanishing.',
      'Chart labels were drawn in dark ink on every slide, including the dark ones they could not be read on.',
      'PDF, image, HTML and handout export all failed on the first slide with an unsupported colour function. Chrome changed how it writes out a resolved colour, and the export’s colour handling had been written against the old spelling. Every modern colour value is now resolved by the browser itself, so this cannot break again the next time the spelling changes.',
    ],
  },
  {
    version: '3.4.0',
    date: '2026-08-26',
    summary: 'Add a written slide instead of a blank one, and the studio says when a screen is too small.',
    added: [
      'Add slide now opens this deck’s own layouts as finished slides: agenda, statement, headline number, three pillars, metrics, before-and-after, timeline, quote and the rest, each written in the deck’s voice and painted in its palette. Pick one and edit it rather than starting from an empty slide.',
      'A picture can fill its box instead of sitting inside it, and you can say which part stays in frame from a nine-point anchor. The framing survives the PowerPoint export rather than reverting to the whole photo.',
      'Save a backup file writes the deck as a file and Open a backup file reads it back, so a deck can move between browsers and machines. Uploaded video cannot travel in a file, and the reader says which slides lost theirs.',
      'The deck menu shows how much of the browser’s storage the app is using, and warns while there is still room to act rather than after a save has failed.',
      'A short getting-started tour on first open, replayable any time from the help menu.',
      'Alt with the up or down arrow moves the selected slide through the deck, so reordering no longer needs a mouse.',
    ],
    improved: [
      'The editor now has a stated minimum size. On a tablet everything is present and the slide is no longer clipped by the tool rail; below tablet width the page says the editor needs a bigger screen and offers Present and the library instead of drawing a layout nobody can work in.',
      'The format bar no longer covers the bottom of the slide it is formatting.',
      'Small labels across the app were a grey that failed contrast against white. Every one of them is readable now, and there is a single visible focus ring for anyone working by keyboard.',
      'Quick Sandbox decks appear in the library, labelled, instead of disappearing the moment you left the studio.',
      'Exports are named ux-journey-flow.pptx rather than ux_journey___flow.pptx.',
      'The library header wraps on a narrow window instead of pushing New deck off the edge.',
      'Presenting from a phone or tablet: the controls come back on a tap, having previously waited for a mouse that was never coming.',
    ],
  },
  {
    version: '3.3.0',
    date: '2026-08-26',
    summary: 'Every template is a deck you can present, not three slides and a gap.',
    added: [
      'Each template now opens with nine or ten different slide types instead of three or four. Agenda, a full-slide statement, a headline number, three pillars, a metrics dashboard, a before-and-after table, a timeline and a quote have been added across Product Showcase, UX Journey, Mobile Editorial, Product & Data SaaS, Investor Syndicate Memo, The Editorial, AI-Native, Startup, Swiss Enterprise Minimal and The Wave Organic.',
      'Every new slide arrives written, so a template reads as a finished deck you edit rather than a set of empty layouts.',
    ],
    improved: [
      'The template gallery previews the whole deck, not just the cover. Step through every slide of the selected template with the arrows beside the preview, and a small counter on the slide says where you are.',
      'The new slides are painted in each template’s own colours, so an agenda in Product Showcase is black and emerald while the same layout in The Wave Organic is off-white and teal.',
      'All of them export to PowerPoint as native, editable slides, the same as the layouts beside them.',
    ],
    fixed: [
      'Template thumbnails left a sliver of the card showing along their right and bottom edges. They were measuring themselves while the gallery was still animating open.',
      'Start a deck on an empty library now asks where the deck should be saved, the same as New deck does.',
    ],
  },
  {
    version: '3.2.0',
    date: '2026-08-25',
    summary: 'Slides move when you present, and the studio opens faster.',
    added: [
      'Slides now change with a transition rather than a hard cut. Pick one from the bar while presenting and see it straight away: Fade, Push, Wipe, Rise, or Cut for no transition at all. The choice stays with the deck, so it presents the same way next time.',
      'Going back reverses the transition rather than repeating it, so arrowing to the previous slide reads as going back.',
      'A single slide can carry its own transition instead of the deck’s. Set it from the slide’s … menu in the sidebar, or from the transition picker itself while presenting; a small dot marks a slide that overrides the deck.',
    ],
    improved: [
      'The gallery opens on about half the code it used to, so the library appears sooner on a slow connection.',
      'A transition is skipped for anyone whose system asks for reduced motion. They get the cut, not a slower version of the same movement.',
    ],
    fixed: [
      'A slide that failed to draw took the whole studio with it and left only a Reload button. The header, the slide list and the rest of the deck now stay, and the slide itself offers to try again.',
      'Messages such as a finished export or a full-storage warning were not reliably announced by screen readers.',
    ],
  },
  {
    version: '3.1.0',
    date: '2026-08-25',
    summary: 'Reactions throw real confetti, and the bell reacts when something lands.',
    improved: [
      'A reaction now bursts as physical confetti. The paper tumbles, catches the air, falls and settles along the bottom of the slide instead of fading in mid air.',
      'The notification bell answers a new notification: the count slides in on a diagonal and springs into place, and the bell gives a short ring.',
    ],
  },
  {
    version: '3.0.0',
    date: '2026-08-25',
    summary: 'Sign in, invite people, and edit a deck together.',
    added: [
      'Studio now asks who you are. Sign in with one of the demo accounts shown on the login screen, and sign out from the menu behind your avatar.',
      'A deck can be shared. Invite someone by email from the Share button, choose whether they can edit or only view, and change or revoke that at any time. Decks shared with you appear in your library under Shared with me.',
      'Two people can work on one deck at once. You see who else has it open in the top bar, their cursor moves on the slide as they move it, and their edits appear as they make them. Undo still only takes back your own work, never theirs.',
      'Click somebody in the top bar to go to the slide they are on. It takes you there once rather than tying you to them, so you can look and then carry on with your own work.',
      'Every deck keeps a version history, saved as you go. Open it from the clock in the top bar to see who changed what and when, and restore any earlier version. Restoring keeps everything newer, so it can always be undone by restoring again.',
    ],
    improved: [
      'The profile menu shows the account you signed in with, and nothing else. The workspace switcher it used to carry described teams that did not exist.',
      'The Share window is a list of people rather than a wall of boxes, and the storage promise it used to make has gone, because a shared deck is no longer private to your browser.',
      'Removed the download that produced a .wozku file. Nothing could open one, including Studio itself. Use Export for PowerPoint or PDF.',
    ],
  },
  {
    version: '2.5.0',
    date: '2026-08-25',
    summary: 'The header wears the current Wozku mark.',
    improved: [
      'The wordmark in both headers is now the current Wozku logo, as a vector rather than a raster PNG, so it stays crisp at any size and on any screen density.',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-08-25',
    summary: 'An uploaded .pptx comes in readable, on the template you chose.',
    fixed: [
      'An uploaded deck ignored the template you dropped it onto and sat on a flat grey of its own. Imported slides now take the background, grid, glow and accent of the template you picked, so Wozku Master Classic arrives on white with its grid, The Editorial on cream with none, and AI-Native dark. A slide whose background stood apart from the rest of the source deck, a divider, still keeps its own.',
      'A logo drawn in white for a dark deck vanished when that deck was re-lit onto a light template. Cut-out artwork is now re-lit along with everything else, keeping its shape and any colour it carries, so a partner logo strip survives the move. Photos and screenshots are left alone and still say so.',
      'Text from an uploaded deck arrived invisible on decks whose background is painted once on the slide master rather than on each slide, which is most of them. The importer read only the slide, found nothing, and assumed white, so a deck of white text landed on a white slide. It now follows the background through to the layout and the master, including a background that is a picture, and re-lights the deck from that.',
      'Pictures placed as a shape’s fill, which is how nearly all cropped and rounded artwork is placed, were dropped on the way in. Every one of them now comes across, cropped to the same window it filled in PowerPoint.',
      'Text sitting on a dark card over a light slide came in dark on dark. Text with no colour of its own now takes its ink from the card it actually sits on, on the canvas and in the exported .pptx alike.',
      'Blank lines between paragraphs collapsed to a fixed height, so copy underneath them rode up into the label above. Line spacing now comes across as the source deck set it.',
      'A slide’s background no longer snaps to the accent colour. An imported deck used to be able to arrive as twenty-eight full-bleed emerald slides.',
    ],
    improved: [
      'Artwork is stored at screen size instead of print size, and a picture with no transparency is kept as a photo rather than losing to a lossless format. A picture-heavy deck now takes about a third of the space it used to.',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-08-24',
    summary: 'Folders open on hover.',
    improved: [
      'Hovering a folder now lifts its papers right out and swings the front flap open on a hinge, each paper springing up on its own beat. The old folder squashed its flap flat and nudged the papers a couple of pixels, which read as a wobble rather than as opening.',
      'The same folder is drawn live in the New Folder and Edit Folder window, so hovering the preview shows you exactly what the colour you picked will do in the library.',
      'Folders are now drawn rather than loaded from flat pictures, so every colour is built from the swatch you chose instead of being a hue-shifted copy of the blue one. Emerald, rose and slate folders in particular are now the colours their swatches promise.',
    ],
  },
  {
    version: '2.2.1',
    date: '2026-08-24',
    summary: 'Uploads land on the template you picked, and say so when they cannot.',
    fixed: [
      'A .pdf or .pptx uploaded onto a dark template came in white. Product Showcase, UX Journey, Product & Data, Investor Memo, AI-Native and Startup Pitch all paint dark slides while carrying a light palette, and the importer was asking the palette rather than the template, so it decided nothing needed re-lighting. It now reads the template’s own look, which is also the one the document builders use.',
      'When an upload failed, it said so at the bottom of the window, underneath a drop zone tall enough to push it out of sight. The reason now appears above the drop zone, so a file that cannot be read no longer looks like a button that does nothing.',
    ],
    improved: [
      'Reading a PDF counts the pages as it goes rather than showing one unchanging word, and lets the window redraw between them. A long PDF is read a page at a time and used to look like the app had frozen.',
      'A page with no text in it, which has to come in as a picture, is now drawn at nearly twice the resolution. Pages that do have text are still only drawn large enough to read their colours from, so this costs nothing on an ordinary document.',
      'There is a ceiling on how much page artwork one import will store, because a deck is kept in this browser and has a few megabytes to work with. A picture-heavy PDF that reaches it now says how many pages came in blank, instead of quietly producing a deck that will not save.',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-08-24',
    summary: 'Upload a PDF, and one Upload tab instead of three.',
    added: [
      'PDFs can now be uploaded like a .pptx. Every page becomes a slide with its text and pictures where you left them, brought onto whichever template you picked: brand type, brand palette, and flipped to match the template’s lightness if the PDF was built the other way round.',
      'PDF text arrives as real editable text, not a picture of a page. A PDF stores no headings or paragraphs, only glyphs at positions, so lines and paragraphs are rebuilt from the spacing on the page. Expect to tidy the odd block.',
      'A scanned PDF has no text in it at all. Those pages come in as images and the confirmation says so, rather than presenting an empty slide as a success.',
    ],
    improved: [
      'One Upload tab that takes every format, replacing the separate Upload .md and Upload .pptx tabs. Drop or browse for a .md, .txt, .pptx or .pdf in the same place: there is no file type to set first, since the file already says what it is.',
      'Legacy .ppt and Keynote files now say what to do about it instead of failing as an unreadable file.',
      'The client name in the deck library is readable on every brand kit. AI-Native’s was its own dark violet on a dark violet chip, and Wozku’s green sat below the contrast floor on its pale green one.',
    ],
  },
  {
    version: '2.1.1',
    date: '2026-08-24',
    summary: 'Headings no longer run through the text underneath them.',
    fixed: [
      'A heading long enough to wrap onto a third line ran straight through the body copy below it, most visibly on closing and section-divider slides where the type is set at 180px. Text is now sized against the size the slide actually sets it at, so it wraps to a height the layout has room for.',
      'Switching a slide to a different layout kept the text at the size the old layout used. A heading written for a 96px slot arrived on a 180px one unchanged and immediately overlapped whatever sat beneath it. Layouts now re-fit the text they receive.',
      'Body copy on the stat slide was being shrunk when it did not need to be: it was measured against a 1200px column when the slide draws it in an 800px one at a smaller size.',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-08-24',
    summary: 'A dark deck imported onto a light template comes out light, text and all.',
    fixed: [
      'Uploading a dark .pptx onto a light template (or a light one onto a dark template) left every slide at its original lightness, so a deck built on black arrived black inside a cream template and looked nothing like the template you picked.',
      'Type kept its original colour in that case, which is what put white headings on a near-white slide and made them unreadable.',
    ],
    improved: [
      'An imported deck is now re-lit as a whole to match the template it lands on: backgrounds, shape fills, rules, table cells and text all move together, so a heading that stood out against its background still stands out against the new one. The decision is made once for the deck rather than slide by slide, so a dark divider inside a light deck stays the odd one out instead of being flattened.',
      'Images are left exactly as they are, since their background is baked into the picture. Where an imported deck has any, the confirmation says so, so a screenshot that now sits bright against a dark slide is something you know about rather than something you find in the meeting.',
      'The confirmation after an import says whether colours were re-lit, alongside the theme it used.',
    ],
  },
  {
    version: '2.0.9',
    date: '2026-08-24',
    summary: 'Generating from a document keeps your chosen template, and builds every slide your source asks for.',
    fixed: [
      'Generating a deck from a Business Record or an outline used to replace most templates with Classic Wozku Master, even though only Blank Presentation actually has nowhere for a document’s sections to land. Every other template - Product Showcase, UX Journey & Flow, Mobile Editorial, Product & Data SaaS, Investor Syndicate Memo, AI-Native Pitch Deck and Startup Pitch Deck included - now fills its own slide layout, fonts and colors directly.',
      'A document with more sections than the template had slides for used to lose everything past the first match, so a twenty-section source could generate a four-slide deck with no warning. Every section now gets a slide.',
      'Reset did nothing after generating a deck. It was reverting to the generated deck itself rather than to the empty template, so there was never anything to change. It now takes the deck back to the placeholders the chosen template started with.',
      'The closing section of your source was being dropped on eight of the twelve templates, because it was written to a field those closing slides do not draw, or because the template has no closing slide at all. It now always reaches the deck, as the closing line where it is short enough and as its own slide where it is not.',
      'Text longer than the slot it was written into is now sized to fit on every template, not just on the slides generated from leftover sections. A paragraph landing in a display heading no longer runs off the slide.',
      'Uploading a .pptx kept the template you picked. It used to arrive with no template and no theme at all, falling back to the house brand, so a deck imported into Mobile Editorial came back in Wozku green and Space Grotesk while still being named Mobile Editorial. Imported type and colour now land on the accent and fonts of the template you are importing into, and the confirmation names the theme it actually used.',
    ],
    added: [
      'Tables, quotes and images in your source now become slides. A table is built as a real, editable table keeping every one of its columns, whether or not it is written with leading pipes; a blockquote becomes a pull quote; an image becomes a slide with an empty image slot and its caption, ready for you to drop the artwork in. These were read from your document and then discarded before, which is why a source full of tables generated nothing but text slides.',
    ],
    improved: [
      'Slides built from the leftover sections of your source pick a layout that suits their content instead of repeating one: a table for comparison rows, a dashboard for metrics and KPIs, a timeline for phases, a process diagram for steps, a headline stat for a single figure, and a text slide for prose. A section that has no figures of its own no longer lands on a chart layout showing sample numbers.',
      'Text-only slides use a much wider column. It was capped at 800px on a 1920px slide, so text crowded into the left third while the rest of the slide sat empty.',
      'Headings and body text on generated slides are sized to their length against the space the slide actually has, so a long heading arrives at a size that fits instead of filling the slide and pushing its own body off the bottom. Sizes come from the standard type scale, so they stay on brand and you can still step them yourself.',
      'A section with more text than one slide can hold now continues on the next slide, breaking between paragraphs or sentences, rather than shrinking to an unreadable size or running off the bottom edge. Nothing generated should arrive already cut off.',
      'Bold, italic, code and link markers in your source are no longer printed on the slide as raw asterisks and brackets.',
      'A section holding both prose and a table now produces both slides rather than only one of them.',
      'Mockup and screenshot slots on generated slides keep the template’s placeholder image, so you can drop in your own screens or delete the slide. Only slides whose content the source actually supplies are built.',
      'The Source Material window opens on the Conversion Prompt. The Samples tab has been removed.',
    ],
  },
  {
    version: '2.0.8',
    date: '2026-08-24',
    summary: 'Every export format is now dramatically smaller, at the same visual quality.',
    improved: [
      'PowerPoint exports are compressed properly for the first time: the exporter was writing every file uncompressed inside its own zip package. A pristine deck now exports at roughly a fifth of its previous size, with zero change to the file’s content.',
      'PDF, PNG and standalone HTML exports capture each slide at 1.5x resolution instead of 2x (still sharper than a 1080p screen) and flatten to JPEG at the same quality level already used for stored images elsewhere in the app. Both cut file size substantially with no visible change.',
    ],
  },
  {
    version: '2.0.7',
    date: '2026-08-24',
    summary: 'A much faster load, and a labeling bug fixed on two templates.',
    fixed: [
      'UX Journey & Flow’s "Legacy Journey" / "Redesigned Flow" labels, and a badge on mobile mockup slides, were being hidden by a leftover style rule from before this app’s own design system existed. Both show again.',
    ],
    improved: [
      'The app loads its editor and export tools only once you actually open a deck or export one, instead of downloading all of it up front. The gallery now opens with well under half the code it used to.',
    ],
  },
  {
    version: '2.0.6',
    date: '2026-08-24',
    summary: 'Paste a spreadsheet straight into a chart.',
    added: [
      'The chart data panel now accepts a pasted table from a spreadsheet, in addition to the existing CSV file upload. Copy a range in Sheets or Excel, click the chart’s Data button, and paste to replace its categories and series.',
    ],
  },
  {
    version: '2.0.5',
    date: '2026-08-24',
    summary: 'A brand check before you export, catching off-palette colours and low-contrast text.',
    added: [
      'The export sheet now flags any typed-in colour that doesn’t match the deck’s theme, and any text sitting on its own fill below the 4.5:1 contrast minimum, slide by slide, before you send.',
    ],
  },
  {
    version: '2.0.4',
    date: '2026-08-24',
    summary: 'Alt text on images, and a cleaner changelog timeline.',
    added: [
      'Image shapes have an Alt text field in the toolbar. It describes the picture for screen readers on the canvas and carries through to the exported .pptx.',
    ],
    improved: [
      'The changelog timeline no longer has a floating vertical line; its dots sit closer to the left edge with a tighter, deliberate gap before each release card.',
    ],
  },
  {
    version: '2.0.3',
    date: '2026-08-24',
    summary: 'Per-slide backgrounds on Wozku Master Classic, and cleaner changelog timeline markers.',
    added: [
      'Wozku Master Classic slides now have their own Background control in the toolbar: a solid color, a two-color gradient, or an uploaded image. "Remove background" clears it to plain white, and "Reset to template default" always brings the original background and hairline grid back.',
    ],
    improved: [
      'Changelog timeline markers are now solid filled circles, precisely centered on the timeline’s vertical line instead of sitting slightly off it.',
    ],
  },
  {
    version: '2.0.2',
    date: '2026-08-24',
    summary: 'Lighter background grid on Wozku Master Classic slides.',
    improved: [
      'The hairline background grid on Wozku Master Classic is noticeably fainter, on screen and in exports, so it stays a texture instead of competing with slide content.',
    ],
  },
  {
    version: '2.0.1',
    date: '2026-08-24',
    summary: 'Plain .md outlines from teammates now upload and generate directly, and Wozku Master Classic leads the template gallery.',
    added: [
      'Upload .md now accepts any markdown outline with headings, not only a formatted Business Record. Share a plain slide-by-slide .md between teammates and it builds straight into a deck, no Conversion Prompt round-trip required.',
      'Generating from a Business Record now respects the active presentation template. The Editorial, Swiss Enterprise Minimal, and Wave Organic templates build their own slide types from your source instead of always falling back to Wozku Master Classic. Templates built entirely from screenshots (UX Journey & Flow, Product Showcase) or without a mapping yet now ask before switching to Classic, instead of silently discarding the template.',
    ],
    improved: [
      'Wozku Master Classic now shows first in the template gallery instead of near the bottom of the list.',
      'A generic content slide built from an imported document no longer shows an empty image placeholder that pushed real text into a narrow column and caused overflow. It uses the full slide width; the image area can still be brought back from the slide’s own controls.',
    ],
    fixed: [
      'Uploading a Business Record .md file that still had a wrapping ```markdown fence, the way a downloaded Claude reply or a Slack file often looks, no longer triggers the raw-transcript warning.',
      'A "Next Steps" or similar closing section with plain bullet points no longer disappears from the final slide; its bullets now show in the closing slide body.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-08-14',
    summary: 'Dedicated Presentation Template Architecture, Native Mobile Screen Mockups, and Template-Specific Visual Systems.',
    added: [
      'Dedicated Presentation Template Architecture: Every template now features its own complete, bespoke slide suite with custom typography, layouts, grids, and composition rhythm.',
      'Native Mobile Screen Mockup System: Reusable device frames with precision bezels, Dynamic Island, status bar, and elevation shadows for single, dual, trio, and sequential workflow slides.',
      'Replaceable PNG Screen Assets: Complete separation of physical phone frames from content, enabling in-place PNG screen image replacement in edit mode without altering device geometry.',
      'Four Product & Mobile Storytelling Templates: Product Showcase, UX Journey & Flow, Mobile Editorial, and Product & Data SaaS.',
      'Institutional Investor Syndicate Memo: High-density venture syndicate presentation with deal terms, valuation sheets, and allocation matrices.',
      'Unified Thumbnail & Preview Engine: Template cards and selected previews now render through the exact same FitStage renderer for pixel-perfect visual fidelity.',
    ],
    improved: [
      'Template-Specific Backgrounds: Scoped technical hairline grids strictly to the Classic Wozku template, giving each template its own authentic background ground.',
      'Brand Alignment: Enforced strict 0px corner radius across all template modal cards, buttons, tabs, and container elements.',
      'Clean Action CTAs: Removed sparkle/AI icons from the deck creation action buttons.',
    ],
    fixed: [
      'Fixed template thumbnail and preview mismatch where thumbnails displayed simplified mockups instead of the actual template cover.',
      'Fixed default hairline grid leaking into dark and editorial slide presentations.',
    ],
  },
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
