# Master Template Generator

Master Template turns structured business documents into polished, on-brand presentations. It parses structured Markdown files, compiles a slide deck using 14 predefined visual templates, and supports interactive editing, duplication, reordering, and exporting - all client-side, no backend required.

---

## Key Features

### ⚡ Automatic Generation
* Upload structured Markdown documents (`.md` or `.markdown`) with YAML frontmatter.
* The built-in parser validates required metadata keys (`title`, `version`, `type`, `client`) and constructs an Abstract Syntax Tree (AST).
* The Presentation Compiler maps document sections (e.g. *Executive Summary*, *Key Metric*, *Comparative Table*, *Process*) to custom-designed slide layouts.

### ✍️ Interactive Slide Editing
* Click **Edit Content** to toggle editing mode; slide slots become directly editable inline.
* A floating session bar lets you save or discard in-progress edits.
* **Reset** (armed with a confirmation safeguard) reverts the deck to its generated state.
* Undo/redo for committed changes, persisted across page reloads.
* Image containers (uploaded photos, maps) can be deleted entirely, not just cleared - the layout falls back to a text-only variant.

### 📋 Slide Thumbnails & Deck Operations
* Dim / hide slides to exclude them from export and present mode.
* Duplicate, rename, reorder, or delete slides from the navigation sidebar.
* Manage multiple named decks side by side, each with its own source, slides, and edit history.

### 💾 Export & Sharing
* **Export PPTX:** Builds a native PowerPoint file via `pptxgenjs` - real, editable text boxes, shapes, and tables per template, not a flattened image. Only genuine raster content (photos, logos, maps) is embedded as an image; decorative backgrounds (grid/glow) are baked into the slide's actual (non-editable) background fill.
* **Export PDF:** Captures each slide's live DOM at native 1920x1080 resolution and assembles a landscape PDF via `jsPDF`.
* **Download PNGs:** Captures each slide as a PNG and bundles them into a zip via `jszip`.
* **Copy Share Link:** Copies the active deck's URL to your clipboard.

All exports run entirely in the browser - no server involved.

---

## Tech Stack

* **Core Framework:** React, TypeScript, Vite
* **Styling:** CSS variables + Tailwind CSS v4
* **Motion & Interactions:** Framer Motion
* **Export:** `pptxgenjs` (native PPTX), `jspdf` + `html2canvas` (PDF), `jszip` (PNG bundling)
* **Persistence:** `localStorage`, multi-deck aware

---

## Development

Install dependencies:
```sh
npm install
```

Start the local development server:
```sh
npm run dev
```

Build the application for production:
```sh
npm run build
```

No additional services are required - export, persistence, and editing are all client-side.
