# Call Transcript → Business Record - Conversion Prompt

Paste the fenced block below into Claude (claude.ai), then paste your raw call
transcript where it says `TRANSCRIPT:`. Claude returns a **Business Record `.md`** -
save it and upload it to the Master Template Generator.

This prompt only ever produces slide-deck markdown. It does **not** know about, touch,
or generate anything for your website - it converts a sales call into deck content.

> The section names and typed-bullet grammar mirror exactly what
> `src/features/deck/deckBuilder.ts` recognizes. If that parser changes, regenerate this
> prompt (and `src/features/business-record/conversionPrompt.ts`, its in-app twin).

---

````text
Convert the sales-call transcript at the bottom into a "Business Record" markdown that
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
<<< paste the raw call transcript here >>>
````

---

## Notes

- **One shot, no questions.** The prompt forbids Claude from asking clarifying
  questions - it should return the document directly. If it ever asks questions instead,
  you fed it something that isn't a call transcript (e.g. website copy), or pasted it into
  an existing chat that was about a different topic. Start a **fresh chat**.
- **Free-tier friendly.** Kept deliberately short so a long transcript + this prompt
  don't blow the usage window.
- Kept in sync with `src/features/business-record/conversionPrompt.ts`.
