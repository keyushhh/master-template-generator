# Phase 2 Checklist

Tracks the gaps identified against the discovery-call feedback (Section 2 "Current
Workflow", Q14 "Final review screen", Q17 "Looking ahead"). Phase 1 (deterministic
MD -> deck, in-canvas editing, Review & Export, PPTX/PDF/PNG export) is done and is
not repeated here - see [[roadmap-and-generation-strategy]] and
[[transcript-to-deck-plan]] in memory, and `docs/transcript-to-deck-plan.md`.

Check items off as they land. Each item notes the files it touches so this stays a
map back into the code, not just a status list.

## 1. Use-case repository
Goal: account managers stop needing to "contact multiple people" to find a past
relevant use case.

- [x] Expand `SampleDeck` beyond a plain list into a taggable library (`campaignType`,
      searchable) - `src/features/business-record/sampleDecks.ts` (verified in-browser:
      6 samples load, each tagged, no console errors)
- [x] Filter/search UI on the Samples tab - `src/features/generator/SourceMaterialModal.tsx`
      (verified: campaign-type chips narrow the list, search box filters by name/description)
- [x] "Save Deck" CTA in Review & Export's header opens `SaveToLibraryModal.tsx`
      (name/campaign type/description), saving the exact current deck+ast - real
      generated decks now accumulate in the library, not just the 6 seed samples
- [x] Persisted to localStorage (`wozku-use-case-library-v1`, `libraryStore.ts`) -
      same pattern as `deckStore.ts`'s project sessions; revisit backend only if it
      needs to be shared across more than one browser/user
- [x] Saved entries merge into the Samples tab's list (newest first, ahead of seed
      samples), filterable/searchable exactly like seed samples, with a delete
      (trash) affordance per saved entry - `SourceMaterialModal.tsx`
- [x] Loading a saved entry restores the deck exactly as saved (edits included) via
      `dispatchHistory({type:'set', ...})`, not a markdown re-parse -
      `MasterTemplatePage.handleLoadLibraryEntry`

## 2. Multiple sample simulations with placeholders
Goal: "with just a few clicks I should be able to generate simulations automatically."

- [x] Seed samples covering the campaign types mentioned in the interviews (Partner
      Advocacy, Event Journey, Community Activation, Product Launch, ROI/Sales
      Enablement, Customer Advocacy) - `sampleDecks.ts` (6 total, verified each builds
      a deck without error)
- [x] Each sample uses obvious placeholder tokens (`[CLIENT]`) in frontmatter and body
      so it's clear what needs replacing before sending to a client; the logo slot
      (`deck.logoUrl`) is already a separate upload affordance, not a text placeholder
- [ ] One-click "duplicate as new deck" from a sample without re-importing through the
      modal (nice-to-have, low priority)

**Gotcha hit while building this**: a pill/badge-styled label (font-mono + uppercase +
padding + background) silently rendered with `display: none` - `tokens.css` has an
app-wide rule banning that exact class combo. Fixed by using the plain "· label" text
convention already used in `ReviewModal.tsx`. See memory `no-pill-badge-css-rule` before
adding any new tag/badge UI.

## 3. In-app AI conversion (remove the manual claude.ai round-trip)
Goal: replace the "Copy prompt -> paste into claude.ai -> copy result back" loop.

- [ ] Decision needed: API key + minimal backend/serverless endpoint (browser can't
      hold a key safely) - blocked on infra decision, not a code task
- [ ] Endpoint takes raw transcript text, runs it through the existing
      `CONVERSION_PROMPT` (`src/features/business-record/conversionPrompt.ts`)
- [ ] Wire the endpoint's output straight into `ImportService.importRecord` - no
      parser/deck changes needed since the output format is unchanged

## 4. Explicit review-checklist fields - BUILT AND REVERTED, do not re-attempt this shape
Goal: match Q14's answers - Account Manager, ROI numbers, brand sample post, "does
it solve the How and What" - as structured review items, not implicit slide content.

- [x] Built 2026-07-21: `ReviewChecklist` field on `Deck`, rendered as a "Before you
      send this" panel in `ReviewModal.tsx` (account manager text field + 3 checkboxes,
      soft/non-blocking, persisted fine, zero console errors)
- [x] **Reverted the same day** - user feedback: "the whole thing is just noise... a
      manual checklist adds nothing real to the review flow." Root problem: the boxes
      were pure honor-system self-report with zero connection to the deck's actual
      content - indistinguishable from decoration next to the coverage banner's real
      analysis. Fully removed from `types.ts`, `ReviewModal.tsx`, `MasterTemplatePage.tsx`.
- [ ] Still an open goal (Q14 answers are real feedback), but the next attempt needs a
      different shape - likely auto-detected from actual slide content (e.g. does a
      `kpi:`/`bar:` bullet exist in Metrics -> "ROI numbers" checks itself) rather than
      typed/checked by hand. Don't rebuild the manual-checkbox version.
- [ ] Decide later whether to promote any of these to Business Record frontmatter
      (`accountManager:` etc.) so they're set at import time instead of typed in
      Review

## Phase 3 backlog (template-quality epics, 2026-07-21)
Three items handed over as a batch: auto-fit/overflow (P0), native data charts (P0),
structural density variants (P1). Decided with the user before starting: #3 (density
variants) is ON HOLD - it would reverse the "14 renderers stay fixed" rule for
s5/s7/s9/s11, and we chose to ship the two P0 items first and revisit #3 later.
Funnel chart export decision (for when #2 starts): fake it as a stacked/decreasing
bar chart, since PowerPoint/pptxgenjs has no native funnel chart type.

### 1. Smart auto-fit & overflow guardrails - DONE 2026-07-21
- [x] `autoFitHeadingFontSize` / `autoFitBodyFontSize` formula-based helpers in new
      `src/features/generator/autoFit.ts` - character-count based (not real DOM
      measurement), generalizing the heuristic the Cover slide's hero heading already
      used before this existed
- [x] Applied across all 14 renderers + SlideBlank in `PresentationCanvas.tsx`: every
      `DISPLAY_HEADING_BASE` heading bound to editable content, plus the major body
      paragraphs (executive summary, two-column both sides, data monument, image
      editorial, quote, exit) - each given a `min`/`max` px range and a width/height
      (or max-lines) budget tuned to that slide's actual layout
- [x] `FitHint` component (edit-mode-only small amber badge next to the eyebrow/label)
      shows when a slot's computed font landed below its max - the "recommended
      character budget" nudge from the spec, without a numeric budget UI
- [x] Verified in-browser: normal-length real content (Planview sample deck) renders
      pixel-identical to before across all 14 slides (no regressions); an extreme-length
      pasted heading shrinks and wraps within its slot instead of overflowing, and shows
      the Auto-fit hint. Zero console errors introduced.
- Deliberately NOT real DOM-measurement (ResizeObserver-based) auto-fit - matches
  existing codebase precedent and is far lower-risk across 14 hand-tuned absolute/flex
  layouts. If a specific slide still overflows with real client copy, tune that slide's
  `widthBudget`/`heightBudget`/`maxLines` numbers rather than redesigning the mechanism.

### 2. Brand-compliant dynamic data charts - NOT STARTED
- [ ] New chart types (donut, line, funnel) don't exist in `SlideContent` at all yet -
      needs new fields + new renderer components; today `s7`'s bars/KPIs are styled
      `<div>`s, not a chart library
- [ ] Native PPTX export is 100% `html2canvas` DOM screenshots today (see
      [[transcript-to-deck-plan]]) - editable native charts need `pptxgenjs`'s
      `addChart()` on a separate code path just for chart slides
- [ ] Funnel -> fake as stacked/decreasing bar chart in the PPTX export (decided above)

### 3. Structural slot density variants - ON HOLD, needs the fixed-layout decision revisited
- [ ] s5 Two-Column (50/50, 30/70, stacked), s7 Metrics (2/3/4-card, 6-kpi), s9 Roadmap
      (3/4-phase horizontal, 5-stage stack), s11 Process (3-6 steps)
- [ ] Reverses "14 renderers stay fixed" for these 4 slides specifically - re-confirm
      scope before starting

## Already done (Phase 1, for reference)
- [x] Deterministic Business Record MD -> 14-template deck (`deckBuilder.ts`)
- [x] Conversion prompt doc for manual transcript -> MD step (`docs/conversion-prompt.md`)
- [x] In-canvas media/content editing (images, charts, tables, roadmap, process, regions)
- [x] Review & Export screen with coverage/diagnostics banner (`ReviewModal.tsx`)
- [x] Client logo slot (`deck.logoUrl`) threaded through canvas + exports
- [x] Client-side PPTX/PDF/PNG export, Present mode, drag-reorder, bulk select
