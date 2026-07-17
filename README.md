# Master Template Generator

A prototype-first presentation generation tool for **Wozku**, designed to transform structured AI-generated content into fully editable, on-brand presentation decks.

Instead of manually rebuilding PowerPoint presentations after every client conversation, the Master Template Generator provides a standardized workflow that converts structured content into consistent, branded deliverables that can be reviewed, edited, and exported.

---

## Background

Wozku is a B2B LinkedIn advocacy platform that helps organizations amplify event engagement by turning attendees into organic LinkedIn advocates through QR codes, pre-written social posts, and participation leaderboards.

Today, different internal teams (Sales, Marketing, Customer Success) independently use AI tools such as Claude to generate presentation content after client calls. While the content quality is good, every deck is manually designed, resulting in:

- inconsistent branding
- duplicated design effort
- time spent formatting slides instead of refining content
- no shared presentation standard

The Master Template Generator aims to solve this problem by separating **content creation** from **presentation design**.

---

# Vision

```
Client Call
      │
      ▼
Transcript
      │
      ▼
Claude generates structured content (.md)
      │
      ▼
Upload into Master Template
      │
      ▼
Automatic slide generation
      │
      ▼
Editable presentation
      │
      ▼
Review
      │
      ▼
Export (PPT / PDF / Share Link)
```

The goal is to make presentation creation predictable, consistent, and significantly faster while preserving editing flexibility.

---

# The Problem

Current workflow:

- Team member has a client conversation
- Uses Claude in a separate chat
- Manually copies content into PowerPoint
- Adjusts layouts
- Fixes branding inconsistencies
- Exports deck

This process is repeated across multiple teams with no centralized presentation system.

---

# The Solution

The Master Template Generator introduces a structured workflow.

Instead of asking AI to design slides, Claude only generates structured content.

Example:

```
Transcript
      ↓
Claude
      ↓
structured Markdown
      ↓
Master Template Generator
      ↓
Presentation
```

The application automatically:

- parses uploaded content
- identifies slide types
- maps content into predefined layouts
- creates editable slides
- enforces branding consistency
- requires review before sharing

---

# Key Features

## Upload Structured Content

Supports drag-and-drop or file selection.

Accepted formats:

- `.md`
- `.markdown`
- `.txt`

Future versions may support structured JSON.

---

## Automatic Deck Generation

The generator analyzes uploaded content and builds slides dynamically based on the available information.

Slide count is driven by content rather than a fixed template.

---

## Editable Slides

Every generated slide remains editable after generation.

Users can:

- modify text
- reorder content
- adjust wording
- make presentation-specific improvements

without regenerating the deck.

---

## Review Before Export

Every export action is protected by a mandatory review confirmation.

This prevents unfinished decks from being shared accidentally.

Available export actions:

- Export as PDF
- Export as PowerPoint
- Copy Share Link

---

## Consistent Branding

The interface is based on Wozku's existing Brand Guidelines experience and preserves its editorial visual language.

Current design includes:

- dark interface
- green accent palette
- editorial typography
- sidebar navigation
- live slide preview

---

# Supported Slide Types

The current prototype includes sample implementations of:

- Cover
- Hero Statistics
- Data Table
- Closing / Contact

Future versions will support additional layouts including:

- ROI summary
- Company breakdown
- Geographic analysis
- Industry distribution
- Notable advocates
- Sample LinkedIn posts
- User journey diagrams
- Event summaries
- Recommendations
- Final notes

---

# Prototype Status

Current prototype includes:

- Upload Document interface
- Dynamic sidebar navigation
- Sample slide rendering
- Editable slide content
- Review confirmation modal
- Export action placeholders
- Dark editorial UI

Current implementation is intentionally frontend-only and uses placeholder data.

No Markdown parsing has been implemented yet.

---

# Technology

Current prototype:

- HTML
- CSS
- Vanilla JavaScript

Target implementation:

- React
- TypeScript
- Vite
- Tailwind CSS v4
- Framer Motion

The production version will integrate with the existing Wozku design system, including tokenized colors, typography, and theming.

---

# Planned Roadmap

## Phase 1

Objective:

Validate content-to-slide mapping.

Features:

- Markdown upload
- ROI Report generation
- Automatic slide creation
- Preview
- PDF export

No editing.

---

## Phase 2

Objective:

Presentation editing.

Features:

- Editable slides
- PowerPoint export
- Review confirmation
- Pitch Deck support

---

## Phase 3

Objective:

Collaboration.

Features:

- Share links
- Permissions
- Team feedback improvements
- Additional presentation templates
- Workflow refinements

---

# Future Work

Upcoming work includes:

- Defining a reliable Markdown schema
- Designing slide mapping rules
- Building a Markdown parser
- PPT export engine
- PDF export engine
- Shareable presentation links
- Additional presentation templates
- Claude prompt templates for transcript-to-Markdown generation

---

# Repository Structure

```
master-template-generator/
│
├── index.html
├── README.md
└── assets/
```

The project currently exists as a standalone HTML prototype before being migrated into the React-based Wozku application.

---

# Development Workflow

This project follows a prototype-first workflow.

1. Design interactions using standalone HTML.
2. Validate the UX.
3. Port the interface into the Wozku React application.
4. Build parsing and generation logic.
5. Add editing and export capabilities.
6. Iterate with internal team feedback.

---

# Project Goal

The long-term vision is to make presentation creation as simple as:

```
Upload structured content
        ↓
Generate deck
        ↓
Review
        ↓
Export
```

By separating content generation from presentation design, the Master Template Generator enables every Wozku team to produce professional, consistent, and editable client presentations in minutes instead of hours.