# Master Template Generator

Master Template turns structured business documents into polished, on-brand presentations. It parses structured Markdown files, dynamically compiles a slide deck using predefined visual templates, and allows interactive slide editing, duplication, reordering, and exporting.

---

## Key Features

### ⚡ Automatic Generation
* Upload structured Markdown documents (`.md` or `.markdown`) with YAML frontmatter.
* The built-in parser validates required metadata keys (`title`, `version`, `type`, `client`) and constructs an Abstract Syntax Tree (AST).
* The Presentation Compiler maps document sections (e.g. *Executive Summary*, *Key Metric*, *Comparative Table*, *Process*) to custom-designed slide layouts.

### ✍️ Interactive Slide Editing
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
* **Libraries:** `html2canvas` (slide capturing), `pptxgenjs` (PowerPoint compilation)

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
