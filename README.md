# Master Template Generator



## Key Features

### ⚡ Automatic Generation
* Upload structured Markdown documents (`.md` or `.markdown`) with YAML frontmatter.
* The built-in parser validates required metadata keys (`title`, `version`, `type`, `client`) and constructs an Abstract Syntax Tree (AST).
* The Presentation Compiler maps document sections (e.g. *Executive Summary*, *Key Metric*, *Comparative Table*, *Process*) to custom-designed slide layouts.

### ✍️ Interactive Slide Editing
feat/sidebar-polish-and-logo-slots
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


* Click the **Edit Content** button to toggle editing mode.
* Slide slots become directly editable inline (`contentEditable` spans).
* A floating session bar lets you save or discard in-progress edits.
* Click the **Reset** button (armed with a confirmation safeguard) to revert the deck back to its generated state.

### 📋 Slide Thumbnails & Deck Operations
* Dim / hide slides to exclude them from the presentation view.
* Duplicate, rename, or delete slides directly from the navigation sidebar.

### 💾 Export & Sharing
* **Export PDF:** Triggers a vector print layout tailored via print stylesheets to render slides at their exact 1920x1080 resolution, complete with slide-by-slide page breaks.
* **Export PPTX:** Captures slides as high-definition images and compiles them into a standard 16:9 widescreen PowerPoint deck.
* **Copy Share Link:** Instantly copies the active deck's URL to your clipboard.


---

## Tech Stack

* **Core Framework:** React, TypeScript, Vite
* **Styling:** CSS variables + Tailwind CSS v4
* **Motion & Interactions:** Framer Motion


## Development

Install dependencies:
```sh
npm install


Start the local development server:
```sh
npm run dev
```

Build the application for production:
```sh
npm run build
```

No additional services are required - export, persistence, and editing are all client-side.

```

Start the local development server:
```sh
npm run dev
```

Build the application for production:
```sh
npm run build
```

