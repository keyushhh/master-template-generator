/**
 * Asserts a source document longer than a template's fixed slide count still
 * reaches the deck, on the template the user picked.
 *
 * Two separate failures produced the same symptom (a four-slide deck from a
 * twenty-section document), so both are checked here:
 *
 *   1. Generating from a document used to swap the deck onto the classic
 *      Wozku Master layout for every template without its own builder.
 *   2. Every builder took only the FIRST section matching each of its slide
 *      kinds and dropped the rest, so the sections past that vanished with no
 *      error - the deck just quietly stopped partway through the document.
 *
 * The leftover sections now become slides of their own, and the layout is
 * picked from the shape of each section's content rather than one layout
 * repeated: a table for `row:` bullets, a dashboard for `bar:`/`kpi:`, prose
 * otherwise. That routing is what the bulk of this file exercises, because
 * every structured classic layout falls back to placeholder rows, bars and
 * steps when its field is unset - so routing a plain-prose section to one of
 * them puts stale template junk on the slide, which is a silent failure of
 * exactly the kind this whole file exists to catch.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const jiti = createJiti(resolvePath(here, 'overflow-check.mjs'), { interopDefault: true });

const { tokenize } = await jiti.import(resolvePath(root, 'src/features/business-record/parser/lexer.ts'));
const { parse } = await jiti.import(resolvePath(root, 'src/features/business-record/parser/parser.ts'));
const { DOCUMENT_TEMPLATE_BUILDERS, NO_DOCUMENT_MAPPING_TEMPLATE_IDS, fitSlideText } = await jiti.import(
  resolvePath(root, 'src/features/deck/templateDocumentBuilders.ts')
);
const { PRESENTATION_TEMPLATES } = await jiti.import(
  resolvePath(root, 'src/features/templates/presentationTemplates.ts')
);

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok, detail });

const astOf = (md) => parse(tokenize(md));
const visible = (deck) => deck.slides.filter((s) => !s.hidden);
const kindsOf = (deck) => visible(deck).map((s) => s.templateId);

// --- a document with far more sections than any template has slide kinds ------

const PROSE_SECTIONS = 12;
const LONG_DOC = `---
version: 1.0
type: campaign
client: Wozku
title: SAP Connect Day
subtitle: Ahmedabad
---

## Executive Summary

The campaign drove qualified pipeline across two regions.

- Proof point: 42% lift

${Array.from({ length: PROSE_SECTIONS }, (_, i) => `## Slide ${i + 1}: The Goal

Narrative paragraph for section ${i + 1} describing what this part of the plan covers in prose.`).join('\n\n')}

## Closing

Thanks for reading.

- email: hello@wozku.com
`;

const longAst = astOf(LONG_DOC);

// --- 1. every template keeps its own identity and carries the whole document --

for (const template of PRESENTATION_TEMPLATES) {
  const builder = DOCUMENT_TEMPLATE_BUILDERS[template.id];
  const expectedToHaveOne = !NO_DOCUMENT_MAPPING_TEMPLATE_IDS.has(template.id);

  if (!expectedToHaveOne) {
    check(`${template.id}: intentionally has no builder`, !builder);
    continue;
  }

  if (!builder) {
    check(`${template.id}: has a Business-Record builder`, false, 'missing from DOCUMENT_TEMPLATE_BUILDERS');
    continue;
  }

  const deck = builder(longAst);

  // The whole point: generating must not silently switch template.
  check(
    `${template.id}: keeps its own template`,
    deck.presentationTemplateId === template.id || template.id === 'default',
    `got ${deck.presentationTemplateId}`
  );

  // The deck must grow past the template's own fixed slide count, or the
  // document is being truncated again.
  const shown = visible(deck).length;
  check(`${template.id}: document is not truncated`, shown >= PROSE_SECTIONS, `only ${shown} visible slides`);

  // No slide may be left with no content at all.
  const empty = visible(deck).filter((s) => Object.keys(s.content).length === 0);
  check(`${template.id}: no visible slide is empty`, empty.length === 0, empty.map((s) => s.templateId).join(', '));
}

// --- 2. prose never lands on a layout that would show placeholder data --------

const PLACEHOLDER_FIELDS = ['rows', 'bars', 'kpis', 'phases', 'steps', 'sectors', 'parts'];
const STRUCTURED_KINDS = new Set(['s2', 's6', 's7', 's8', 's9', 's11', 's12']);

for (const [id, builder] of Object.entries(DOCUMENT_TEMPLATE_BUILDERS)) {
  const deck = builder(longAst);
  // Every structured slide in a prose-only deck must carry its own data, since
  // an unset field renders the template's placeholder rows/bars/steps instead.
  const bare = visible(deck).filter(
    (s) => STRUCTURED_KINDS.has(s.templateId) && !PLACEHOLDER_FIELDS.some((f) => s.content[f] !== undefined)
  );
  check(`${id}: no structured slide without its data`, bare.length === 0, bare.map((s) => s.templateId).join(', '));
}

// --- 3. structured content picks the layout that fits, not the prose one ------

const shapeDoc = (heading, bullets) => `---
version: 1.0
type: campaign
client: Wozku
title: Shapes
---

## ${heading}

${bullets.map((b) => `- ${b}`).join('\n')}
`;

const SHAPES = [
  ['row: Reach | 10 | 20 | +10', 's8', 'a comparison table'],
  ['bar: Passing | 94 | active', 's7', 'a metrics dashboard'],
  ['kpi: ARR | $4.2M', 's7', 'a metrics dashboard'],
  ['phase: Launch | Q1 | done', 's9', 'a roadmap'],
  ['step: Index | Vector graphs', 's11', 'a process diagram'],
  ['sector: EMEA | 4.1M', 's12', 'a reach map'],
];

for (const [bullet, expected, label] of SHAPES) {
  // 'default' is the classic builder, which has its own fixed routing.
  const deck = DOCUMENT_TEMPLATE_BUILDERS['product-showcase'](astOf(shapeDoc('Some Extra Section', [bullet])));
  const got = kindsOf(deck);
  check(`\`${bullet.split(':')[0]}:\` bullets become ${label}`, got.includes(expected), `got ${got.join(', ')}`);
}

// A big-stat section becomes the monument layout.
const monumentDeck = DOCUMENT_TEMPLATE_BUILDERS['product-showcase'](
  astOf(shapeDoc('An Extra Result', ['value: 94', 'unit: percent']))
);
check('a `value:`/`unit:` section becomes a stat slide', kindsOf(monumentDeck).includes('s6'), kindsOf(monumentDeck).join(', '));

// --- 4. prose lands on a text layout that reads on that template's background -

// Every template uses the same text layout; what changes is the ink. Product
// Showcase and UX Journey paint themselves dark while carrying the light house
// theme, so their prose slides carry a background and light ink of their own.
const DARK_TEMPLATES = ['product-showcase', 'ux-journey', 'product-data', 'investor-memorandum', 'ai-native', 'startup-bold'];
const LIGHT_TEMPLATES = ['editorial', 'swiss-minimal', 'wave', 'mobile-editorial'];
for (const id of DARK_TEMPLATES) {
  const prose = visible(DOCUMENT_TEMPLATE_BUILDERS[id](longAst)).filter((s) => s.templateId === 's10');
  check(`${id}: prose uses the text layout`, prose.length > 0);
  check(
    `${id}: prose is painted to match the template`,
    prose.every((s) => s.content.background?.kind === 'color' && s.content.styles?.heading?.color === 'FFFFFF')
  );
}
for (const id of LIGHT_TEMPLATES) {
  const prose = visible(DOCUMENT_TEMPLATE_BUILDERS[id](longAst)).filter((s) => s.templateId === 's10');
  check(`${id}: prose uses the text layout`, prose.length > 0);
  check(`${id}: prose is left to the deck theme`, prose.every((s) => !s.content.background));
}

// --- 4b. tables, blockquotes and images in the source reach the deck ----------

// The lexer parses these into Unsupported nodes and nothing used to read them
// back, so a markdown table was parsed and then dropped on the floor.
const RICH_DOC = `---
version: 1.0
type: campaign
client: Wozku
title: Rich
---

## Story Arc

| Time | Agenda Moment | Trigger | Post | Why this moment matters |
| --- | --- | --- | --- | --- |
| 5:30 PM | Opening keynote | Autonomous Enterprise | Post 1 | Sets the frame |
| 6:45 PM | Panel | Industry value maps | Post 2 | Proof from the field |

## A Voice From the Room

> The keynote gave me a sharper way to think about it.

## The Stage

![The main stage at SAP Connect Day](./stage.png)
`;

const richAst = astOf(RICH_DOC);
const richDeck = DOCUMENT_TEMPLATE_BUILDERS['product-showcase'](richAst);
const richKinds = kindsOf(richDeck);

const tableSlide = visible(richDeck).find((s) => s.templateId === 'imported');
check('a markdown table becomes a table slide', !!tableSlide, richKinds.join(', '));
if (tableSlide) {
  const shape = (tableSlide.content.shapes ?? []).find((sh) => sh.kind === 'table');
  check('the table slide carries a real table shape', !!shape);
  // 5 columns and 3 rows: the alignment rule must not survive as a row.
  check('every column survives', shape?.colWidthsPx?.length === 5, `${shape?.colWidthsPx?.length} columns`);
  check('the alignment rule is not a row', shape?.rows?.length === 3, `${shape?.rows?.length} rows`);
  const firstCell = shape?.rows?.[1]?.cells?.[0]?.paragraphs?.[0]?.runs?.[0]?.text;
  check('cell text is carried through', firstCell === '5:30 PM', String(firstCell));
}

check('a blockquote becomes a quote slide', richKinds.includes('s13'), richKinds.join(', '));
const quoted = visible(richDeck).find((s) => s.templateId === 's13');
check('the quote text loses its marker', !quoted?.content.quote?.includes('>'), quoted?.content.quote);

const imageSlide = visible(richDeck).find((s) => s.content.eyebrow === 'Image');
check('an image becomes a slide with an empty image slot', !!imageSlide && !imageSlide.content.hideImage);
check('the image alt text is kept', imageSlide?.content.body === 'The main stage at SAP Connect Day', imageSlide?.content.body);

// A section holding both prose and a table must yield both, not one or other.
const mixedDeck = DOCUMENT_TEMPLATE_BUILDERS['product-showcase'](
  astOf(`---
version: 1.0
type: campaign
client: Wozku
title: Mixed
---

## Mixed Section

A paragraph that belongs on a slide of its own.

| A | B |
| --- | --- |
| 1 | 2 |
`)
);
const mixedKinds = kindsOf(mixedDeck);
check(
  'a section with prose and a table produces both slides',
  mixedKinds.includes('imported') && mixedKinds.includes('s10'),
  mixedKinds.join(', ')
);

// --- 4c. generated headings are sized for their length -----------------------

const { fitHeadingPx, fitBodyPx } = await jiti.import(resolvePath(root, 'src/features/deck/deckBuilder.ts'));
const { TYPE_SCALE } = await jiti.import(resolvePath(root, 'src/features/formatting/rails.ts'));

const SHORT = 'The Goal.';
const LONG = 'Slide 17: Live Event Post 1 - After the Opening Keynote (5:30-6:15 PM).';
const shortPx = fitHeadingPx(SHORT, { widthPx: 1200, maxPx: 100, minPx: 40, maxLines: 2 });
const longPx = fitHeadingPx(LONG, { widthPx: 1200, maxPx: 100, minPx: 40, maxLines: 2 });
check('a short heading keeps the template size', shortPx === 100, `${shortPx}px`);
check('a long heading is sized down', longPx < 100 && longPx >= 40, `${longPx}px`);
check('heading sizes land on the type scale', TYPE_SCALE.includes(shortPx) && TYPE_SCALE.includes(longPx), `${shortPx}, ${longPx}`);
check(
  'body size falls as the text grows',
  fitBodyPx('x'.repeat(2000), { widthPx: 1200, heightPx: 420, maxPx: 32, minPx: 16 }) <
    fitBodyPx('x'.repeat(200), { widthPx: 1200, heightPx: 420, maxPx: 32, minPx: 16 })
);

// The long heading from the screenshot must actually be sized down on a real deck.
const longHeadingDeck = DOCUMENT_TEMPLATE_BUILDERS['product-showcase'](
  astOf(`---
version: 1.0
type: campaign
client: Wozku
title: Long
---

## ${LONG}

At SAP Connect Day in Ahmedabad right now, and the opening keynote just gave me a sharper way to think about Autonomous Enterprise, which is not AI replacing decisions but AI acting inside the actual business context.
`)
);
const sized = visible(longHeadingDeck).find((s) => s.templateId === 's10');
check('a generated long heading carries a size override', !!sized?.content.styles?.heading?.sizePx, JSON.stringify(sized?.content.styles));
check('that override is smaller than the template default', (sized?.content.styles?.heading?.sizePx ?? 999) < 100, `${sized?.content.styles?.heading?.sizePx}px`);

// --- 4d. a plain prose document, the shape most sources really are -----------

// Not every source is a Business Record with typed `bar:`/`row:` bullets. A
// document of "## Slide N: Title" headings over paragraphs, with **bold** and
// a pipe table written without leading pipes, has to come out readable too.
const PLAIN_DOC = `---
version: 1.0
type: campaign
client: Wozku
title: SAP Connect Day
---

## Slide 8: The ROI - What Wasif Gets

**Partner Rep Engagement** - PwC's own speakers and employees, not just SAP, visibly engaging and posting. The exact success measure Wasif named on the call. **Cost Avoidance** - no paid social spend, no amplification agency. Reach comes from people SAP and PwC already have relationships with. **Proof for the MDF Spend** - a concrete, trackable artifact Wasif can point to when justifying partner-fund investment on this event.

## Slide 11: Story Arc - Live Event (20 August, 5:30 PM onwards)

Time | Agenda Moment | Trigger | Post | Why this moment matters
5:30 PM | Opening keynote | Autonomous Enterprise | Post 1 | Sets the frame
6:45 PM | Panel | Industry value maps | Post 2 | Proof from the field
`;

const plainDeck = DOCUMENT_TEMPLATE_BUILDERS['product-showcase'](astOf(PLAIN_DOC));
const plainSlides = visible(plainDeck);

const proseSlides = plainSlides.filter((s) => s.templateId === 's10' && s.content.body);
check('a prose section becomes a readable text slide', proseSlides.length >= 1, kindsOf(plainDeck).join(', '));

const roi = proseSlides.find((s) => s.content.heading?.includes('ROI'));
check('inline bold markers are stripped from the body', !roi?.content.body?.includes('**'), roi?.content.body?.slice(0, 60));
check('inline bold markers are stripped from the heading', !roi?.content.heading?.includes('**'), roi?.content.heading);
check('no slide anywhere leaks raw markdown', !plainSlides.some((s) => JSON.stringify(s.content).includes('**')));

// The heading that rendered at 180px in the report must now be far smaller.
check('the prose heading is sized well under the display size', (roi?.content.styles?.heading?.sizePx ?? 999) <= 100, `${roi?.content.styles?.heading?.sizePx}px`);
check('the prose body carries a size too', !!roi?.content.styles?.body?.sizePx, `${roi?.content.styles?.body?.sizePx}px`);
// Heading and body share one height budget, so both must fit together.
const hPx = roi?.content.styles?.heading?.sizePx ?? 0;
const bPx = roi?.content.styles?.body?.sizePx ?? 0;
const hLines = Math.ceil(((roi?.content.heading?.length ?? 0) * hPx * 0.5) / 1200);
const bLines = Math.ceil(((roi?.content.body?.length ?? 0) * bPx * 0.5) / 1200);
check('heading and body fit the slide together', hLines * hPx * 1.05 + 40 + bLines * bPx * 1.5 <= 800, `${Math.round(hLines * hPx * 1.05 + 40 + bLines * bPx * 1.5)}px of 800`);

// On a template that paints itself dark, the theme-driven text must be flipped.
check('prose on a dark template gets a dark background', roi?.content.background?.kind === 'color', JSON.stringify(roi?.content.background));
check('prose on a dark template gets light ink', roi?.content.styles?.heading?.color === 'FFFFFF', roi?.content.styles?.heading?.color);
const lightProse = visible(DOCUMENT_TEMPLATE_BUILDERS['swiss-minimal'](astOf(PLAIN_DOC))).find((s) => s.templateId === 's10');
check('prose on a light template is left to the theme', !lightProse?.content.background && !lightProse?.content.styles?.heading?.color);

// The pipe table must become a table, not body text.
const plainTable = plainSlides.find((s) => s.templateId === 'imported');
check('a pipe table without leading pipes becomes a table', !!plainTable, kindsOf(plainDeck).join(', '));
const plainShape = (plainTable?.content.shapes ?? []).find((sh) => sh.kind === 'table');
check('that table keeps all five columns', plainShape?.colWidthsPx?.length === 5, `${plainShape?.colWidthsPx?.length}`);
check(
  'the table rows are not also left as body text',
  !plainSlides.some((s) => s.content.body?.includes('Agenda Moment')),
  plainSlides.find((s) => s.content.body?.includes('Agenda Moment'))?.title
);

// Ordinary prose containing a stray pipe must NOT be mistaken for a table.
const stray = DOCUMENT_TEMPLATE_BUILDERS['swiss-minimal'](
  astOf(`---
version: 1.0
type: campaign
client: Wozku
title: Stray
---

## A Normal Section

We compared A | B in passing and then wrote several more sentences that are clearly prose.
`)
);
check('prose with a stray pipe is not turned into a table', !kindsOf(stray).includes('imported'), kindsOf(stray).join(', '));

// A two-column table has only one pipe per line, so it cannot be found by
// counting pipes; what marks it is every line agreeing on the count.
const twoCol = DOCUMENT_TEMPLATE_BUILDERS['product-showcase'](
  astOf(`---
version: 1.0
type: campaign
client: Wozku
title: Two
---

## Slide 3: The Mechanic

Step | What Happens
1 | Wozku CMT and SAP build the campaign, reviewed and approved by both sides.
2 | SAP and PwC distribute one link to speakers via WhatsApp or email.
`)
);
const twoColShape = visible(twoCol).map((s) => (s.content.shapes ?? []).find((sh) => sh.kind === 'table')).find(Boolean);
check('a two-column pipe table becomes a table', !!twoColShape, kindsOf(twoCol).join(', '));
check('the two-column table keeps both columns', twoColShape?.colWidthsPx?.length === 2, `${twoColShape?.colWidthsPx?.length}`);

// Prose whose lines do not agree on a pipe count stays prose.
const raggedPipes = DOCUMENT_TEMPLATE_BUILDERS['swiss-minimal'](
  astOf(`---
version: 1.0
type: campaign
client: Wozku
title: Ragged
---

## A Normal Section

We compared A | B in passing here on this line.
This next line has no pipe at all and is plainly prose.
`)
);
check('prose with uneven pipes is not turned into a table', !kindsOf(raggedPipes).includes('imported'), kindsOf(raggedPipes).join(', '));

// --- 4e. no generated text slide may exceed the box it is drawn in -----------

// The editor's Fit it gives up past a point ("resizing cannot fix this, the
// text needs shortening"), so a generated slide has to arrive inside its box:
// sized down where that is enough, continued on another slide where it is not.
const { TEXT_ONLY_TEXT_W, TEXT_ONLY_TEXT_H, TEXT_ONLY_MAX_W, TEXT_ONLY_PAD_X, estimateTextHeight } = await jiti.import(
  resolvePath(root, 'src/features/deck/deckBuilder.ts')
);

check(
  'the text-only column is most of the slide, not a third of it',
  TEXT_ONLY_TEXT_W >= 1100,
  `${TEXT_ONLY_TEXT_W}px of 1920`
);
check('the text width matches the box minus its padding', TEXT_ONLY_TEXT_W === TEXT_ONLY_MAX_W - TEXT_ONLY_PAD_X * 2);

/** The height a generated text slide really needs, by the same estimate the
 *  builder sizes with: eyebrow, heading lines, gap, then body lines. */
function proseHeight(slide) {
  const h = slide.content.heading ?? '';
  const b = slide.content.body ?? '';
  const hPx = slide.content.styles?.heading?.sizePx ?? 100;
  const bPx = slide.content.styles?.body?.sizePx ?? 32;
  const hLines = Math.max(1, Math.ceil((h.length * hPx * 0.5) / TEXT_ONLY_TEXT_W));
  // The same model the builder packs with: paragraphs wrap and space apart.
  return 60 + hLines * hPx * 1.05 + 40 + estimateTextHeight(b, bPx, TEXT_ONLY_TEXT_W, 1.5);
}

// A section far longer than one slide can hold, of the kind that produced the
// "3 pieces of text cut off" chip.
const HUGE = Array.from(
  { length: 9 },
  (_, i) =>
    `${i + 1} | Wozku CMT and SAP build the campaign, with post variants drafted for SAP speakers and employees and for PwC speakers and employees, reviewed and approved by both sides, in a setup taking well under fifteen minutes end to end.`
).join('\n\n');

const hugeDeck = DOCUMENT_TEMPLATE_BUILDERS['product-showcase'](
  astOf(`---
version: 1.0
type: campaign
client: Wozku
title: Huge
---

## Slide 3: The Mechanic

${HUGE}
`)
);
const hugeProse = visible(hugeDeck).filter((s) => s.templateId === 's10');
check('a section too long for one slide is continued on more', hugeProse.length > 1, `${hugeProse.length} slides`);
check(
  'every continued slide stays inside the box',
  hugeProse.every((s) => proseHeight(s) <= TEXT_ONLY_TEXT_H),
  hugeProse.map((s) => Math.round(proseHeight(s))).join(', ') + ` of ${TEXT_ONLY_TEXT_H}`
);
check(
  'continued slides stay readable rather than shrinking away',
  hugeProse.every((s) => (s.content.styles?.body?.sizePx ?? 0) >= 24),
  hugeProse.map((s) => s.content.styles?.body?.sizePx).join(', ')
);
check('no continued slide is empty', hugeProse.every((s) => (s.content.body ?? '').trim().length > 0));
check(
  'splitting does not lose or duplicate any text',
  hugeProse.map((s) => s.content.body).join('\n\n') === HUGE
);

// And the general case: across every template, no generated text slide overflows.
for (const [id, builder] of Object.entries(DOCUMENT_TEMPLATE_BUILDERS)) {
  const tall = visible(builder(longAst))
    .filter((s) => s.templateId === 's10' && s.content.body)
    .filter((s) => proseHeight(s) > TEXT_ONLY_TEXT_H);
  check(`${id}: no text slide overflows its box`, tall.length === 0, tall.map((s) => Math.round(proseHeight(s))).join(', '));
}

// --- 4f. nothing a builder writes may land on a slot nothing draws -----------

// Six closing slides are a display line plus contacts with no body slot, and
// the builders were setting `body` on them: the document's closing paragraph
// was written to a field the component never reads, so it vanished with no
// warning. Content loss like that is invisible until a client opens the deck.
const canvasSrc = readFileSync(join(root, 'src/features/generator/PresentationCanvas.tsx'), 'utf8');
const registry = canvasSrc.match(/const SLIDE_RENDERERS[\s\S]*?=\s*\{([\s\S]*?)\n\};/)[1];
const componentFor = {};
for (const m of registry.matchAll(/^\s*'?([A-Za-z0-9_]+)'?\s*:\s*([A-Za-z0-9_]+)\s*,/gm)) componentFor[m[1]] = m[2];

let allSlideSrc = canvasSrc;
for (const f of [
  'ProductShowcaseSlides', 'UxJourneySlides', 'AiNativeSlides', 'StartupSlides', 'ProductDataSlides',
  'InvestorMemoSlides', 'MobileEditorialSlides', 'SwissSlides', 'WaveSlides', 'EditorialSlides',
]) {
  allSlideSrc += readFileSync(join(root, `src/features/templates/slides/${f}.tsx`), 'utf8');
}

/** The source of one slide component, enough of it to see every slot it reads. */
function componentBody(name) {
  const at = allSlideSrc.indexOf(`function ${name}(`);
  return at < 0 ? null : allSlideSrc.slice(at, at + 9000);
}

// Fields that are not slots: layout switches, overlays, and imported geometry.
const NOT_A_SLOT = new Set([
  'styles', 'offsets', 'overlay', 'shapes', 'importedBase', 'hideImage', 'hideFooter',
  'background', 'screenAsset', 'screenAssets', 'screens', 'blankLayout', 'coverLayout', 'layoutVariant',
]);

const richAstForSlots = astOf(`---
version: 1.0
type: campaign
client: Wozku
title: Slot Coverage
---

## Executive Summary

${'A paragraph of real narrative prose that a source document would supply. '.repeat(4)}

## Context

${'Context prose describing the current state of the account and the plan. '.repeat(4)}

## Quote

The keynote gave me a sharper way to think about it.

- author: Sabyasachi Konar

## Closing

${'A closing paragraph that is far too long to sit on a single display line. '.repeat(3)}

- email: hello@wozku.com
`);

for (const [id, builder] of Object.entries(DOCUMENT_TEMPLATE_BUILDERS)) {
  const dropped = new Set();
  for (const slide of visible(builder(richAstForSlots))) {
    const body = componentFor[slide.templateId] && componentBody(componentFor[slide.templateId]);
    if (!body) continue;
    for (const [field, value] of Object.entries(slide.content)) {
      if (NOT_A_SLOT.has(field) || value == null) continue;
      if (typeof value === 'string' && !value.trim()) continue;
      if (!body.includes(`content.${field}`)) dropped.add(`${slide.templateId}.${field}`);
    }
  }
  check(`${id}: every field it sets is actually drawn`, dropped.size === 0, [...dropped].join(' '));
}

// And the closing text specifically has to survive somewhere on the deck.
for (const [id, builder] of Object.entries(DOCUMENT_TEMPLATE_BUILDERS)) {
  const all = JSON.stringify(visible(builder(richAstForSlots)).map((s) => s.content));
  check(`${id}: the closing paragraph is not lost`, all.includes('A closing paragraph that is far too long'));
}

// --- 5. a section with no content of its own never becomes a slide -----------

const emptySectionDeck = DOCUMENT_TEMPLATE_BUILDERS['product-showcase'](
  astOf(`---
version: 1.0
type: campaign
client: Wozku
title: Empty
---

## A Heading With Nothing Under It
`)
);
check(
  'an empty section does not become a placeholder slide',
  !kindsOf(emptySectionDeck).some((k) => k === 's10' || k === 's4'),
  kindsOf(emptySectionDeck).join(', ')
);

// --- 6. every emitted slide kind can actually be rendered and exported --------

const canvas = readFileSync(join(root, 'src/features/generator/PresentationCanvas.tsx'), 'utf8');
const pptx = readFileSync(join(root, 'src/features/generator/pptxNative.ts'), 'utf8');

const emitted = new Set();
for (const builder of Object.values(DOCUMENT_TEMPLATE_BUILDERS)) {
  for (const slide of builder(longAst).slides) emitted.add(slide.templateId);
}

const rendererBlock = canvas.match(/const SLIDE_RENDERERS[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
if (!rendererBlock) throw new Error('SLIDE_RENDERERS not found - has it been renamed?');
for (const id of [...emitted].sort()) {
  const renderable = new RegExp(`(^|[\\s{,])'?${id}'?\\s*:`, 'm').test(rendererBlock[1]);
  check(`${id}: has a canvas renderer`, renderable);
  const exportable = pptx.includes(`case '${id}'`);
  check(`${id}: has a PowerPoint builder`, exportable);
}

// --- 7. an imported .pptx keeps the template it is imported into --------------

// Exporting a deck from one template and uploading it into another produced a
// deck with no theme and no template at all: it fell back to the house brand,
// so a gold Investor Memo landed emerald inside a Mobile Editorial deck that
// was still named Mobile Editorial.
const { buildDeckFromImport } = await jiti.import(resolvePath(root, 'src/features/pptx-import/pptxDeckBuilder.ts'));
const { brandMapFor, snapToBrand, mapFont, WOZKU_BRAND } = await jiti.import(
  resolvePath(root, 'src/features/pptx-import/brandMap.ts')
);
const { BUILT_IN_THEMES, themeById } = await jiti.import(resolvePath(root, 'src/features/theme/deckTheme.ts'));

const fakeSlides = [{ title: 'Cover', base: '0A0F1D', shapes: [] }];
const editorialTheme = themeById('template_editorial');
const imported = buildDeckFromImport(fakeSlides, {
  themeId: editorialTheme.id,
  presentationTemplateId: 'mobile-editorial',
});
check('an imported deck keeps the chosen theme', imported.themeId === 'template_editorial', String(imported.themeId));
check('an imported deck keeps the chosen template', imported.presentationTemplateId === 'mobile-editorial', String(imported.presentationTemplateId));
check('an import with no template still builds', !!buildDeckFromImport(fakeSlides).slides.length);

// Every theme must give the importer a usable brand, or colours snap to nothing.
for (const theme of BUILT_IN_THEMES) {
  const brand = brandMapFor(theme);
  const okRamp = brand.accents.length >= 4 && brand.accents.every((c) => /^[0-9A-F]{6}$/.test(c));
  check(`${theme.id}: gives the importer an accent ramp`, okRamp, brand.accents.join(' '));
  check(`${theme.id}: gives the importer its own display face`, brand.display === theme.fonts.display.family, brand.display);
}

// A foreign accent lands on the target template's accent, not always emerald.
const GOLD = 'F59E0B';
const startupBrand = brandMapFor(themeById('template_startup_bold'));
const aiBrand = brandMapFor(themeById('template_ai_native'));
check(
  'a foreign accent snaps to the template it lands on',
  snapToBrand(GOLD, startupBrand) !== snapToBrand(GOLD, aiBrand),
  `${snapToBrand(GOLD, startupBrand)} vs ${snapToBrand(GOLD, aiBrand)}`
);
check(
  'the house brand still behaves as it did',
  /^[0-9A-F]{6}$/.test(snapToBrand(GOLD, WOZKU_BRAND)) && snapToBrand('FFFFFF') === 'FFFFFF'
);
check(
  'type lands on the target template face',
  mapFont('Arial', brandMapFor(themeById('template_editorial'))) === themeById('template_editorial').fonts.display.family,
  mapFont('Arial', brandMapFor(themeById('template_editorial')))
);
// Symbol faces are still left alone, or bullets and arrows turn to tofu.
check('symbol faces are still untouched', mapFont('Wingdings', startupBrand) === 'Wingdings');

// --- 8. a dark deck imported onto a light template is re-lit whole ------------

// Keeping the source's lightness left white text on a cream slide. Background,
// fill, rule and type are all matched by lightness, so mirroring every one of
// them at once is what keeps the contrast intact.
const { relightForBrand } = await jiti.import(resolvePath(root, 'src/features/pptx-import/pptxParser.ts'));
const { hexIsDark } = await jiti.import(resolvePath(root, 'src/features/deck/slideBackground.ts'));

const darkDeck = () => [
  { title: 'Cover', base: '0B071A', shapes: [
    { id: 'a', kind: 'rect', x: 0, y: 0, w: 100, h: 100, fill: '18181B', line: { color: 'FFFFFF', widthPx: 1 },
      paragraphs: [{ runs: [{ text: 'Memorandum.', color: 'F59E0B' }, { text: ' plain' }] }] },
    { id: 'b', kind: 'table', x: 0, y: 0, w: 100, h: 100, rows: [
      { heightPx: 10, cells: [{ fill: '27272A', paragraphs: [{ runs: [{ text: 'ARR', color: 'FFFFFF' }] }] }] },
    ] },
  ] },
  { title: 'Two', base: '09090B', shapes: [] },
];

const lightBrand = brandMapFor(themeById('template_editorial'));
const darkBrand = brandMapFor(themeById('template_ai_native'));

const flipped = relightForBrand(darkDeck(), lightBrand);
check('a dark deck onto a light template is re-lit', flipped.relit);
check('every re-lit background comes out light', flipped.slides.every((s) => !hexIsDark(s.base)),
  flipped.slides.map((s) => s.base).join(' '));

const flatRuns = (slides) => slides.flatMap((s) => s.shapes.flatMap((sh) => [
  ...(sh.paragraphs ?? []),
  ...(sh.rows ?? []).flatMap((r) => r.cells.flatMap((c) => c.paragraphs ?? [])),
])).flatMap((p) => p.runs);

// The whole point: text has to travel with the background it sits on.
const litRuns = flatRuns(flipped.slides).filter((r) => r.color);
check('re-lit text is dark, not left white on a light slide',
  litRuns.length === 2 && litRuns.every((r) => hexIsDark(r.color)),
  litRuns.map((r) => r.color).join(' '));
check('white is not held back as structural when re-lighting',
  snapToBrand('FFFFFF', lightBrand, true) !== 'FFFFFF' && hexIsDark(snapToBrand('FFFFFF', lightBrand, true)),
  snapToBrand('FFFFFF', lightBrand, true));
check('black becomes light when re-lighting',
  !hexIsDark(snapToBrand('000000', lightBrand, true)), snapToBrand('000000', lightBrand, true));

const flippedShape = flipped.slides[0].shapes[0];
check('a shape fill is re-lit with everything else', !hexIsDark(flippedShape.fill), String(flippedShape.fill));
check('a rule is re-lit with everything else', hexIsDark(flippedShape.line.color), String(flippedShape.line?.color));
check('a table cell fill is re-lit', !hexIsDark(flipped.slides[0].shapes[1].rows[0].cells[0].fill),
  String(flipped.slides[0].shapes[1].rows[0].cells[0].fill));
check('text with no colour of its own is left to the renderer',
  flatRuns(flipped.slides).some((r) => r.text === ' plain' && r.color === undefined));

// Nothing is touched when the source already agrees with the template, and a
// deck with no known target is never re-lit at all.
const kept = relightForBrand(darkDeck(), darkBrand);
check('a dark deck onto a dark template is left alone', !kept.relit);
check('a left-alone deck keeps its exact colours',
  kept.slides[0].base === '0B071A' && kept.slides[0].shapes[0].fill === '18181B');
check('an unknown target never re-lights', !relightForBrand(darkDeck(), WOZKU_BRAND).relit);

// One dark divider must not flip a light deck: the vote is over the whole deck.
const mostlyLight = [
  { title: 'a', base: 'FFFFFF', shapes: [] },
  { title: 'b', base: 'FFFFFF', shapes: [] },
  { title: 'c', base: '0A0A0A', shapes: [] },
];
check('one dark divider does not flip a light deck', !relightForBrand(mostlyLight, lightBrand).relit);
check('a light deck onto a dark template is re-lit', relightForBrand(mostlyLight, darkBrand).relit);

// --- 9. text is sized against the size the renderer really draws ----------------

// The fit pass leaves a slot alone when the text fits at its `max`, so a `max`
// below what the template draws means it writes nothing and the renderer sets
// the same words far larger. On the closing slide that put a three-line heading
// straight through its own body copy.
const LONG_HEADING = 'Join Us in Backing the Next Category-Defining Leader.';
const slideOf = (templateId, content) =>
  ({ instanceId: 'x', templateId, group: 'Closing', title: 't', hidden: false, content });
const sizeOf = (templateId, slot, text) =>
  fitSlideText(slideOf(templateId, { [slot]: text })).content.styles?.[slot]?.sizePx;

const exitPx = sizeOf('s14', 'heading', LONG_HEADING);
check('a long heading on the 180px closing slide is brought down', !!exitPx && exitPx < 180, String(exitPx));
check('it comes down far enough to fit two lines, not three', !!exitPx && exitPx <= 120, String(exitPx));
check('a long heading on the 180px section divider is brought down too',
  (sizeOf('s4', 'heading', LONG_HEADING) ?? 180) < 180, String(sizeOf('s4', 'heading', LONG_HEADING)));

// The same words on the layout they were written for must not be touched: this
// pass rescues overflow, it does not restyle a template that is already right.
check('the same heading on its own 96px layout is left alone',
  sizeOf('investor_memo_closing', 'heading', LONG_HEADING) === undefined);
check('a short heading keeps the template\'s full display size',
  sizeOf('s14', 'heading', 'Thank You.') === undefined);
check('a size the builder set deliberately is never overruled',
  fitSlideText(slideOf('s14', { heading: LONG, styles: { heading: { sizePx: 64 } } }))
    .content.styles.heading.sizePx === 64);

// s6's body is drawn at 24px in an 800px column; the hand-written table said
// 32px across 1200px. Drift cuts both ways: that one over-shrank copy that fits
// perfectly well, so a paragraph the template can hold is now left alone.
check('a body slot is measured in the column it is actually drawn in',
  sizeOf('s6', 'body', 'Placeholder content for this template slot. '.repeat(10).slice(0, 400)) === undefined);

// --- report -------------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
}

console.log(
  failed === 0
    ? '\nAll document overflow checks passed.'
    : `\n${failed} document overflow check${failed === 1 ? '' : 's'} failed.`
);
process.exit(failed === 0 ? 0 : 1);
