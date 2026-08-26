# Working rules for this repo

Wozku's Master Template Generator: a deck studio that turns a business record into
branded slides, edits them on a 1920x1080 canvas, and exports editable PowerPoint,
PDF, images and standalone HTML.

## Writing style

- **No em dashes.** Anywhere: UI copy, changelog, comments, commit messages. Use a
  comma, colon, parentheses, semicolon or full stop. `npm test` fails on one.
  En dashes are fine only where they mean a range (`8-480px`).
- **Comments: one line maximum.** Only where the reason is not obvious from the code.
  Existing block comments stay unless the surrounding code is being rewritten, but
  do not add new ones.
- **UI copy says what the user gets**, not what changed internally. "The slide
  counter is readable on white slides", not "moved chrome out of SlideStage".
- Smart quotes (`’`) are used in UI copy already; keep them consistent.

## Before calling anything done

```
npx tsc -p tsconfig.app.json --noEmit
npm test        # theme, brand kit, preflight, fonts, formatting seam, pptx format, shared slides, dashes
npm run build
```

Interaction changes cannot be proved by these. Say plainly what was verified by a
test and what still needs clicking through in `npm run dev`.

## Brand rails, not a generic editor

The point of the formatting controls is that the fast path is the on-brand path.
When adding a control:

- Offer a scale the templates already use, not free numbers. See `TYPE_SCALE`,
  `LINE_HEIGHTS`, `LETTER_SPACINGS` in `src/features/formatting/rails.ts`.
- Give it an escape hatch one interaction deeper (typed px, typed hex), never
  as the default.
- Colour comes from the palette swatches. Emerald means "this is the point", so it
  stays scarce.
- New shapes and text land grid-aligned at brand sizes (`overlayModel.ts`), so the
  common case needs no styling.

## The toolbar

`src/features/formatting/EditToolbar.tsx` is one bar, one row, fixed height. Its
middle is contextual: text controls for text, shape controls for shapes. Controls
that cannot apply are absent, not disabled. Anything with more than about four
options goes behind a labelled dropdown. Session actions belong in the top bar.

## Formatting has one seam, and it is tested

A `SlotStyle` override has two independent consumers: the React canvas
(`applyToCss`) and the PowerPoint exporter (`applyToPptx`). Both go through
`src/features/formatting/resolve.ts`. Adding a field to `SlotStyle` means:

1. `isEmptyStyle` (or `patchStyles` throws the override away as empty)
2. `applyToCss`
3. `applyToPptx`, plus the matching option in `pptxNative.ts`'s `TextOpts`
4. a sample value in `scripts/resolve-check.mjs`

`scripts/resolve-check.mjs` reads the field list off the TypeScript declaration, so
a field missed anywhere fails the suite. `scripts/pptx-format-check.mjs` then proves
it lands as real OOXML. Never let a format look right on canvas and vanish on
export: that is invisible until a client opens the file.

Paragraph properties (leading, paragraph space, indent, bullets, alignment) cannot
vary between runs packed into one PowerPoint text box. Case has no run-level OOXML
equivalent at all, so the exporter rewrites the string via `caseText`.

## Coordinates and units

Everything in the deck model is design px in the 1920x1080 space. The exporter maps
that at 144px/inch onto `LAYOUT_WIDE`. Slot positions are stored as deltas from
where the template put them (`SlotOffset`), never absolute, so a nudged slot still
follows its template.

## Collaboration is a prototype, not a backend

There is no server. Sign-in (`src/features/auth/`) checks a hardcoded list of demo
users and keeps the session in `sessionStorage`, deliberately: per-tab sessions are
what let one browser be two people at once, which is the only way the sharing and
multiplayer work can be demonstrated. Live editing (`src/features/collab/`) rides
`BroadcastChannel`, so it reaches other tabs of the same browser and nothing else.

None of this is security. It exists so a dev team can replace each seam (auth store,
collab channel, deck ownership in `deckStore.ts`) with a real one. Do not describe
the app as private or local-only in UI copy any more: a deck can now be shared.

## Storage

- Decks live in `localStorage` (~5MB total) via `src/features/deck/deckStore.ts`.
  Anything large must not go in a deck. Images are downscaled to JPEG data URLs.
- Video bytes live in IndexedDB (`src/features/deck/mediaStore.ts`); the deck stores
  only an asset id. Uploaded media therefore does not travel between browsers, and
  the UI has to say so rather than showing an empty box.
- Every new field on the deck model must be optional, and absent must mean exactly
  the old behaviour, so saved decks keep rendering the same.

## Exports

- `.pptx` is native and editable (`pptxNative.ts`), one build function per template.
  Not a screenshot.
- PDF, PNG and HTML are captures of the live canvas, so canvas-side CSS reaches them
  for free. HTML export lives in `exportHelper.ts`.
- **No silent degradation.** If a video was too large to embed, or a font could not
  be embedded, collect a note and toast it. Finding out during a client presentation
  is the failure mode being avoided.
- Theme reaches the exporter through `setExportTheme` and must be cleared in a
  `finally`, or one client's palette leaks into the next export.

## Present mode

Present mode covers the slide with a full-bleed click catcher. Anything that needs
the pointer (video controls) has to be mounted above it, not inside the slide's
stacking context. See `PresentVideoLayer.tsx`.

## Ship a changelog entry

Any user-visible change adds to the top of `CHANGELOG` in
`src/features/help/changelog.ts` and bumps the version. The app reads `CHANGELOG[0]`
as latest and shows an unread dot, so that file is the whole release process.
