# Plan - Transcript → Deck, without losing context

Status: **plan / spec** (no app code changed yet)
Last updated: 2026-07-20

## Guiding principle

The LLM never touches layout. It only converts a messy call transcript into the
**Business Record format** the parser already understands. Layout, brand, slide order,
and the 14-slide template stay **fixed and locked** - users adapt a deck by
**adding / removing / reordering slides**, not by restyling them. Every deliverable
below serves one goal: make the transcript→format conversion reliable and make any lost
content *visible*.

## Hard constraints (agreed)

- **The template layout does not change.** The 14 slide renderers in
  `PresentationCanvas.tsx` stay as they are. No new layouts, no repositioning.
- Users tailor decks via **add / remove / duplicate / reorder / hide** slides - already
  supported through `SlideInstance` (instanceId ≠ templateId) + localStorage session.
- The deterministic **Business Record → deck** path is working and is **not** being
  rewritten. All new work is additive.

## The pipeline (target end state)

```
Fathom call .md (A)  ──►  [Claude + Conversion Prompt]  ──►  Business Record .md (B)  ──►  upload  ──►  deck
     messy prose            manual, in claude.ai            strict format contract       existing parser + template
```

Only the middle arrow is new. Conversion runs **manually in claude.ai for now**
(no backend/API key yet); an in-app API version is a deferred fast-follow using the
identical prompt.

---

## Deliverable 1 - The Conversion Prompt  ✅ drafted

The copy-paste prompt that turns any transcript into a valid Business Record, encoding
the exact grammar the parser reads. Drafted at **`docs/conversion-prompt.md`**.

- Encodes frontmatter (`version`, `type`, `client`, `title` required; `subtitle`,
  `date`, `tagline`, `logo` optional).
- Encodes every `classifySection()` heading keyword → slide mapping.
- Encodes every typed-bullet grammar: `bar:`, `kpi:`, `row:`, `phase:`, `step:`,
  `sector:`, and key-value bullets (`value/unit/title`, `author/role`,
  `email/social/web`).
- States the **anti-loss rule**: content that fits no typed section goes under a plain
  `## Heading` (→ insight slide) rather than being dropped.

**Next step (code):** generate this prompt *from* the parser constants
(`schema.ts` + the keyword/prefix tables in `deckBuilder.ts`) so it can never drift.
Ship it in-app as an "Import a call" panel with a Copy button, sourced from the same
generated string.

## Deliverable 2 - Coverage / diagnostics report

The parser fails silently three ways today: no frontmatter → hard reject; unknown
`## Heading` → silent insight slide; malformed typed bullet → the line vanishes. For
sales people pasting LLM output, silent drops are the real context-loss risk.

Add a post-parse diagnostics object surfaced on the review screen before export:
- **Slides filled vs. hidden** - "12 of 14 populated; Comparative Table + Global Reach empty."
- **Unmatched bullets** - "Lines 44, 47 start with `-` but matched no known type - not shown on any slide."
- **Unrecognized sections** - "`## Objectives` wasn't a known type → rendered as an Insight slide." (warning, not silent success.)

Doubles as the answer to survey Q14 ("show everything's correct before exporting").
Implementation: extend the parse result with a `diagnostics` array; no template changes.

## Deliverable 3 - Sample repository

The #1 team frustration and Q17 both ask for "a repository of files with multiple use
cases." Grow `samples/` (one file today) into a browsable in-app library users load as a
starting point and edit - and reuse the same files as few-shot examples inside the
Deliverable 1 prompt. Kills "always start from scratch."

## Deliverable 4 - Media editing: images, tables, charts  ⚠️ new requirement

Survey Q9 wants **Replace images (100%)**, plus edit tables/charts. Current state:

| Media | Today | Gap |
|---|---|---|
| **Text** | Editable via `contentEditable` `E` primitive + `onEditSlide` | none - works |
| **Tables** (s8) | Renders `<table>` from `rows`; cell text editable | no **add / remove row** control |
| **Charts** (s7) | Renders `bars` + `kpis`; text editable | no **add / remove bar-or-KPI** control; bar % not adjustable |
| **Images** | **No image content field at all.** s10 is a hardcoded "Image Asset Placeholder"; only real `<img>` is the logo URL from frontmatter | **biggest gap** - no upload, no replace, no per-slide image |

Scope (all **additive to the content model - no layout change**):

1. **Images (highest priority - 100% wanted).** Add optional image slot(s) to
   `SlideContent` (e.g. `imageUrl?: string` / `imageDataUrl?`). In edit mode, the
   existing placeholder marks (s10 and the logo slot pattern already established around
   `PresentationCanvas.tsx:218–226`) become click-to-upload / replace. Store as a data
   URL in the same localStorage session so it round-trips. Export must embed the image
   (pptxgenjs `addImage`, and it already prints for PDF).
2. **Tables / charts editing (lower priority - 25% wanted).** Add row/bar/KPI
   **add & delete** controls in edit mode over the existing `rows` / `bars` / `kpis`
   arrays. Bars get a numeric % input. Reuses the array-of-typed-items model already in
   `types.ts`; renderers already loop over these arrays, so this is data-editing UI, not
   new layout.

The Business Record format can optionally carry images too (e.g. an `image:` bullet or a
frontmatter/section URL) so generation can pre-fill them - but manual upload in edit mode
is the must-have.

## Deliverable 5 (fast-follow, deferred) - In-app A→B conversion

Move the Deliverable 1 prompt server-side (`server/` scaffold) + Claude API so users
upload the raw transcript directly and skip the copy-paste. Identical contract, different
execution location. Deferred per roadmap (no API key/backend yet).

---

## Build order

1. **Conversion prompt** - drafted; next: auto-generate from parser + in-app Copy panel.
2. **Media editing → images first** - new `SlideContent` image slot + click-to-replace +
   export embedding. (Directly answers the 100%-wanted "Replace images.")
3. **Coverage report** - parser diagnostics on the review screen.
4. **Sample repository** - in-app loader over an expanded `samples/`.
5. **Table/chart row editing** - add/remove controls (lower priority).
6. *(later)* In-app API conversion.

## Explicitly out of scope

Changing template layout, slide positions, or brand; PPTX pixel-fidelity work;
backend / share links; the API call. Nothing here modifies the deterministic
Business Record → deck path or the 14 renderers.
