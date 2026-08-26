# Wozku Studio (Master Template Generator)

A deck studio. It turns a business record into branded slides, edits them on a
1920x1080 canvas, and exports editable PowerPoint, PDF, images and standalone
HTML. Everything runs in the browser: no server is involved in generation,
editing, persistence or export.

## Key features

### Automatic generation

* Twelve presentation templates, each opening with nine to fourteen different
  slide types (cover, agenda, statement, headline number, three pillars, metrics
  dashboard, before-and-after table, timeline, quote, closing) written in that
  template's own voice and painted in its own palette.
* Upload a structured Markdown document (`.md` or `.markdown`) with YAML
  frontmatter.
* The parser validates the required metadata keys (`title`, `version`, `type`,
  `client`) and builds an Abstract Syntax Tree.
* The compiler maps document sections (Executive Summary, Key Metric,
  Comparative Table, Process and so on) onto the 14 house slide layouts.
* An existing `.pptx` can be uploaded instead. Its slides keep their own layout
  and content, remapped onto the brand palette and type stack.

### Interactive editing

* Edit mode forks the deck: slide slots become editable in place, and a session
  bar saves or discards the whole fork.
* Undo and redo for both committed changes and in-progress edits, persisted
  across reloads.
* Insert text boxes, rectangles, ellipses, images, tables, charts and video.
  Drag, resize, rotate, set opacity, snap to the brand grid, and reorder layers.
* Typography controls: Access to all 1,932 Google Fonts. Adjust line heights, 
  letter spacing, paragraph spacing, indents, bullets, and text case. All formatting
  survives the PowerPoint export.
* Change any slide's layout without losing content. Parked content returns if
  you switch back.
* Save as Template: Snapshot any deck's slides as a starter template you can 
  pick from the New Deck screen next time.
* Reset reverts a deck to the state it was in right after import or generation.

### Deck operations

* **Team Repository vs. Quick Sandbox**: Choose to save decks to the shared 
  team workspace or keep them strictly local for quick, emergency edits.
* Multiple named decks side by side, each with its own source, slides and edit
  history.
* **3D Folders**: Organize decks into folders with drag-and-drop filing, bulk move
  operations, color coding, and one-click ZIP export of entire folders.
* A slide sorter for reordering, hiding and bulk operations.
* Borrow slides from another deck.
* Speaker notes per slide, which travel into PowerPoint's own notes pane.
* Brand kits: A client's accent colour and specific typefaces (display, body, mono), 
  applied everywhere the deck is drawn and embedded into the export.

### Accessibility and screen size

* The editor's floor is 768px (iPad portrait). Below that the page says so and
  offers Present and the library, rather than drawing a layout nobody can work
  in. Presenting itself works at any size.
* One focus ring for the whole app, on `:focus-visible`. Small labels are set at
  or above WCAG AA contrast, and `scripts/a11y-check.mjs` fails the build if
  either regresses.
* Moving through the deck and the save state are announced to screen readers.

### Preflight

* The fit scanner finds text that is cut off and reports it per slide. "Fit all"
  shrinks the type on every clipped slide instantly as a single undo.
* The export sheet reports unfilled placeholders and any typeface that cannot
  be embedded, before you export rather than after.

### Present mode

* Fullscreen presenter with an annotation pen, a multi-colored laser pointer, a 
  blank-screen key and a jump-to-slide grid.
* A presenter view with the next slide, a rehearsal timer and speaker notes at a
  readable size, on a second window over `BroadcastChannel`.
* A teleprompter with adjustable speed and type size.
* Video on a slide plays natively in present mode.
* Presenting directly from the library remembers and resumes from your last 
  viewed slide position.

### Export

* **PPTX** is built natively through `pptxgenjs`, one build function per
  template. Real, editable text boxes, shapes, tables and charts, with the brand
  fonts embedded. Video plays natively. Only genuine raster content (photos, logos, maps) is embedded
  as an image, and decorative backgrounds are baked into the slide's background
  fill. It is not a screenshot.
* **PDF** captures each slide's live DOM at 1920x1080 and assembles a landscape
  document through `jsPDF`.
* **PNG** captures each slide at 2x and bundles them into a ZIP through `jszip`.
* **HTML** writes a single self-contained file with slide transitions and
  keyboard controls. Uploaded video is inlined and plays offline.
* **Backup file** writes the deck's own model as `.wozdeck.json` and reads it
  back as a new deck, so work can move between browsers and machines. Uploaded
  video cannot travel in it, and the reader says so rather than opening a deck
  with silently empty video slots.

## Tech stack

* React, TypeScript, Vite
* CSS custom properties plus Tailwind CSS v4
* CSS transitions for interaction

## Development

```sh
npm install
npm run dev
```

Before calling anything done:

```sh
npm run verify
```

That is `typecheck`, `lint`, `test` and `build` in one command. The pieces run
on their own too:

| Command | What it proves |
| --- | --- |
| `npm run typecheck` | The types hold. |
| `npm run lint` | ESLint, including the React hooks rules. |
| `npm run test:unit` | Vitest over the logic with no DOM in it: undo/redo, template switching, the deck store, the storage schema, colour maths. |
| `npm run test:checks` | The node scripts that drive the real exporter, importer, fonts, theme, type sizes, accessibility floor and writing style. |
| `npm run test:e2e` | One Playwright path: create a deck, edit it, reload, and find the edit still there. Needs `npx playwright install chromium` once. |

CI (`.github/workflows/ci.yml`) runs all of it on every push and pull request.

Interaction changes beyond the smoke path still need clicking through in
`npm run dev`.

## Storage

Decks live in `localStorage`, so they do not travel between browsers on their
own: use a backup file for that. Video bytes live in IndexedDB and the deck
stores only an asset id. Images are downscaled to JPEG data URLs. See
`CLAUDE.md` for the rules this places on the deck model.

Every stored session carries a `schemaVersion` (see
`src/features/deck/schema.ts`). Reads run through `migrate()`, so the app only
ever sees a current session; a session written by a newer build is handed back
untouched rather than downgraded. The deck menu shows how much of the browser's
5MB budget is in use, and warns at 80% rather than only when a save fails.
