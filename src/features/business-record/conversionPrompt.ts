/**
 * The canonical "call transcript → Business Record" conversion prompt.
 *
 * This is the CONTRACT between Claude (run manually in claude.ai for now) and the
 * deterministic deck builder. The section keywords and typed-bullet grammar below
 * mirror exactly what `deck/deckBuilder.ts` recognizes - `classifySection()` heading
 * keywords and the `prefixedPipeBullets` / `keyValueBullets` prefixes. If the parser's
 * routing or bullet prefixes change, update this string to match, or Claude and the
 * parser drift apart and content silently disappears from the deck.
 *
 * Kept in sync with `docs/conversion-prompt.md`. A future step generates this string
 * from the parser constants so it can never drift (see docs/transcript-to-deck-plan.md).
 */
export const CONVERSION_PROMPT = `Convert the sales-call transcript at the bottom into a "Business Record" markdown that
feeds a slide generator. Reorganize what was said into the exact format below.

DO THIS IN ONE SHOT. Put the ENTIRE document inside ONE fenced code block - begin with a
line of three backticks followed by "markdown", and end with a line of three backticks -
so I can copy the raw source in one click. No text before or after the block, and DO NOT
ask me any questions. If something is missing, just omit that section.

Rules:
- Use ONLY facts from the transcript. Never invent numbers, names, or metrics.
- Don't drop anything important: if a point fits no section below, put it under a plain
  "## <Short Heading>" and it still becomes a slide.
- Bullet fields are split on " | " (space-pipe-space). Keep each on one line.
- Never use em dashes. Use a normal hyphen (-) or a semicolon (;) instead.

Start with this frontmatter (client and title are required; drop optional lines you lack):

---
version: 1.0
type: business-record
client: <company name>
title: <short proposal title>
subtitle: <optional one-line descriptor>
tagline: <optional one-sentence summary>
---

Then include ONLY the sections you have content for, using these exact headings:

## Executive Summary
1–2 short paragraphs: the problem and the proposed shift.

## Section: <Name>
Optional divider before a major topic. One line under it = its subtitle.

## Context
Current state - 2 short paragraphs, up to 3 factual bullets.

## Key Metric
- value: <number>
- unit: <M, %, x, …>
- title: <what the number measures>

## Metrics
- bar: <Label> | <0-100> | active      (third field optional; marks the highlighted bar)
- kpi: <Label> | <Value>

## Comparison
- row: <Dimension> | <Current> | <Target> | <Outcome>

## Roadmap
- phase: <Title> | <Description> | done   (third field optional; marks a done phase)

## Process
- step: <Title> | <Description>

## Regions
- sector: <Region> | <Status/Value>

## Quote
One paragraph = the quote, then:
- author: <Name>
- role: <Title, company>

## Closing
One paragraph, then any of:
- email: <address>
- social: <@handle>
- web: <url>

TRANSCRIPT:
<<< paste the raw call transcript here >>>`;
