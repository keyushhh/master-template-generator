# 🎨 Phase 2: Visual Polish & Architectural Roadmap

> **Audit Report & Strategy Document**  
> *Target: Elevating Wozku Master Template Generator beyond Google Slides, Figma Slides, and Pitch.com.*  
> *Note: Fully focused on Light Mode UI aesthetics for Phase 2 (Dark Mode deferred to Phase 3/4).*

---

## 🎯 Executive Summary

The **Master Template Generator** possesses a strong technical core: AST-driven Markdown parsing ([ast.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/business-record/parser/ast.ts)), native vector PPTX compilation ([pptxNative.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/pptxNative.ts)), exact 1920x1080 canvas scaling ([PresentationCanvas.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/PresentationCanvas.tsx)), multi-deck persistence ([deckStore.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/deck/deckStore.ts)), and custom slot snapping ([snap.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/formatting/snap.ts)).

This document outlines:
1. **Part I: Visual & UI Polish** — Immediate light-mode cosmetic and UX upgrades for the existing UI components and canvas stage.
2. **Part II: Feature Superpowers** — Functional enhancements to surpass Google Slides across AI, animations, layout engines, and delivery modes.
3. **Comparison Matrix** — Capability breakdown between Google Slides, Current Wozku, and Next-Gen Wozku.

---

# 🪄 Part I: Visual & UI Polish (Immediate Light-Mode Cosmetic & UX Enhancements)

Focusing exclusively on **refining the visuals, layout, typography, and interactive light-mode polish of what is currently built**:

### 1. Studio Workbench Stage & Canvas Framing
* **Current State**: Canvas renders on a flat neutral background with basic grid dots ([PresentationCanvas.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/PresentationCanvas.tsx)).
* **Light Mode Visual Polish Upgrades**:
  * **Clean Workbench Backdrop**: Wrap the canvas stage in a pristine light grey/off-white workbench backdrop (`bg-[#F8F9FA]` or `bg-[#F3F4F6]`) with subtle radial warmth behind the active slide (`bg-radial from-slate-200/60 to-transparent`).
  * **3D Elevation & Soft Canvas Shadow**: Give the 1920x1080 slide container a crisp 1px border (`border border-slate-200/90`) and a multi-layered soft drop shadow (`shadow-[0_20px_50px_-10px_rgba(0,0,0,0.08)]`) to make the white slide "float" off the desk workspace.
  * **Resolution & Aspect Badge**: Add a floating pill badge at the bottom-right of the canvas (`1920 × 1080 • 16:9 Widescreen`) in clean white with a subtle border (`bg-white/90 text-slate-700 border border-slate-200 shadow-xs`).
  * **Vector Selection Bounding Boxes**: Upgrade slot selection bounding boxes with emerald corner anchor handles, 1px dashed alignment vectors, and real-time gap measurement pills (`bg-emerald-600 text-white font-mono text-xs px-2 py-0.5 rounded-full`) when dragging elements.

---

### 2. Light Frosted Navigation Header & Segmented Controls
* **Current State**: Top navigation header with standard button row ([GeneratorSidebar.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/GeneratorSidebar.tsx) / [MasterTemplatePage.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/app/MasterTemplatePage.tsx)).
* **Light Mode Visual Polish Upgrades**:
  * **Floating Frosted Header**: Transform the top navbar into a floating light glassmorphic header (`backdrop-blur-xl bg-white/85 border border-slate-200/80 inset-x-4 top-3 rounded-2xl shadow-sm`) detached slightly from screen edges.
  * **Animated Segmented Toggle**: Replace plain text mode buttons with a modern light pill toggle (`[ View | Edit | Present ]`) featuring a smooth white card tab with soft elevation shadow (`shadow-xs bg-white text-slate-900`).
  * **Inline Project Title & Sync Status**: Interactive title editor with subtle slate hover underline, accompanied by a live emerald pulse badge (`● Local Autosaved`).

---

### 3. High-Fidelity Light Sidebar & Slide Thumbnails
* **Current State**: Sidebar rendering thumbnail preview cards ([SlideNavList.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/SlideNavList.tsx)).
* **Light Mode Visual Polish Upgrades**:
  * **Miniature Slide Cards**: Style thumbnails with crisp 16:9 ratio white containers, rounded borders (`rounded-xl border-slate-200 bg-white hover:border-slate-300`), and glowing emerald active state indicators (`ring-2 ring-emerald-500 shadow-md shadow-emerald-500/10`).
  * **Section Group Banners**: Add sticky visual group headers (*"SECTION 01 — EXECUTIVE SUMMARY"*) with subtle grey pill badges (`bg-slate-100 text-slate-600 font-mono text-xs`) and drag-handle affordance icons (`:::` grabbers).
  * **Hover Action Overlay**: Show smooth hover micro-actions directly on slide thumbnails (quick-dim eye toggle, duplicate icon, delete trigger) in a translucent white pill floating over the card.

---

### 4. Floating Utility Toolbar (Figma-Style Formatting)
* **Current State**: Top fixed edit bar ([EditToolbar.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/formatting/EditToolbar.tsx)).
* **Light Mode Visual Polish Upgrades**:
  * **Clean White Floating Pill Palette**: Redesign the toolbar as a floating white glass pill bar anchored near the top of the canvas (`bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-full px-5 py-2.5 shadow-xl shadow-slate-900/5`).
  * **Font Family Visual Picker**: Render font dropdown options in their native typeface preview (*Space Grotesk, Satoshi, JetBrains Mono, Inter*).
  * **Color Memory Swatches**: Show active color swatches with recent project colors palette, hex color picker, and eye-dropper tool.
  * **Editing Session Banner**: Add a pulsing emerald indicator (`● Edit Mode Active`) with quick Undo/Redo shortcuts tooltips (`⌘Z` / `⌘⇧Z`).

---

### 5. Glassmorphic Modals & AST Code Preview
* **Current State**: Standard modal overlays ([SourceMaterialModal.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/SourceMaterialModal.tsx), [ReviewModal.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/ReviewModal.tsx), [TemplateSwitchModal.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/TemplateSwitchModal.tsx)).
* **Light Mode Visual Polish Upgrades**:
  * **Soft Blurred Overlay**: Light backdrop blur overlay (`backdrop-blur-md bg-slate-900/20`) with smooth scale-up entrance animations for crisp white modal containers (`bg-white border border-slate-200 rounded-2xl shadow-2xl`).
  * **Rich Template Switcher Cards**: Render templates with high-resolution slide thumbnails, category filter tags (*Executive, Data-Heavy, Storytelling, Minimal*), and live hover preview cards.
  * **Polished AST Code Editor**: Enhance the Markdown / AST editor view with a clean light-theme code block, line numbers, syntax highlighting, clear error pills, and tab toggles between formatted visual AST and raw Markdown.

---

### 6. Clean Presenter Mode
* **Current State**: Fullscreen overlay with slide and notes panel ([PresentMode.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/PresentMode.tsx)).
* **Light Mode Visual Polish Upgrades**:
  * **Clean Theatre Ambience**: Distraction-free off-white display background (`bg-[#F8F9FA]`) with smooth Framer Motion slide crossfades and soft drop shadow.
  * **Floating Speaker Notes Dock**: Light frosted glass bottom-right tray (`bg-white/90 border border-slate-200 shadow-lg text-slate-800 rounded-xl`) with adjustable typography size and elapsed timer badge (`14:20 elapsed`).

---

# 🚀 Part II: Architectural & Feature Enhancements (Phase 2 Roadmap)

Beyond cosmetic polish, these functional pillars will elevate Wozku above legacy presentation tools:

### Pillar A: Canvas & Authoring Experience
1. **Smart Auto-Layout Flex Containers**:
   * *Concept*: Move beyond static slot templates. Adding or removing items in a slide (e.g. metric cards or team members) automatically reflows container spacing, padding, and font scales so text never breaks layout boundaries.
2. **Infinite Pan & Smooth Zoom Controls**:
   * *Concept*: Pinch-to-zoom / `Ctrl + Scroll` from 10% to 400% zoom level, pan navigation (`Space + Drag`), pixel grid overlays, and custom ruler guides.
3. **Slide Sorter (2D Matrix View)**:
   * *Concept*: A full-screen grid view showing all slides simultaneously for multi-select reordering, section organization, and batch operations.

---

### Pillar B: Visuals, Themes & Data Intelligence
1. **1-Click Theme Switcher & Brand Kit**:
   * *Concept*: Switch between curated light themes (*Executive Light, Swiss Minimalist, Warm Editorial, Clean Slate*) or upload custom brand colors to instantly recolor all 14 slide templates ([templateSwitch.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/deck/templateSwitch.ts)).
2. **Interactive SVG Chart Engine**:
   * *Concept*: Native Bar, Line, Donut, and Radar charts editable via an inline spreadsheet grid or CSV upload, compiling natively into PowerPoint chart objects ([pptxNative.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/pptxNative.ts)).
3. **Integrated Asset Library**:
   * *Concept*: Native Lucide vector icon selector, Unsplash stock photos, and prompt-to-image AI generation directly inside the canvas.
4. **Advanced Layer & Shape Properties**:
   * *Concept*: Corner radius sliders, subtle shadows, border styles, and linear/radial gradient fills on overlay shapes ([overlayModel.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/formatting/overlayModel.ts)).

---

### Pillar C: AI & Automation Superpowers
1. **In-Editor AI Slide Assistant**:
   * *Concept*: Direct LLM integration for **AI Copy Rewrite** ("Make more executive"), **Prompt-to-Deck** ("Generate a 5-slide startup pitch"), and **Auto-Fix** (1-click layout re-balancing).
2. **Automated Speaker Notes Generator**:
   * *Concept*: 1-click analysis of slide key takeaways to auto-populate presenter talking points.

---

### Pillar D: Delivery, Animations & Presenter Mode
1. **Framer Motion "Smart Morph" Transitions**:
   * *Concept*: Dynamic element-level transitions (`layoutId`) between slides where numbers count up, metric bars expand, and images morph across consecutive slides.
2. **Presenter Console 2.0**:
   * *Concept*: Teleprompter mode with auto-scrolling notes, virtual laser pointer / spotlight tool, and dual-window support (Audience Screen vs. Presenter Screen).
3. **Presenter Video Recording (Loom-style)**:
   * *Concept*: Webcam picture-in-picture overlay bubble recording per slide, exported as a polished MP4 video presentation.

---

### Pillar E: Multi-Format Export & Version Management
1. **Single-File Interactive HTML Export**:
   * *Concept*: Export a self-contained `.html` presentation deck with built-in CSS animations and presenter controls that works offline in any browser without PowerPoint.
2. **Visual Versioning & Slide Diffing**:
   * *Concept*: Named version restore points with side-by-side visual diffing showing added, deleted, or modified slide components.

---

# 📊 Feature Comparison Matrix

| Feature Area | Google Slides | Current Wozku App | Proposed Next-Gen Wozku |
| :--- | :--- | :--- | :--- |
| **Layout System** | Freeform manual drag (cluttered, easy to misalign) | Structured slots + overlay shapes ([overlayModel.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/formatting/overlayModel.ts)) | **Smart Flex Auto-Layout** (Auto-reflowing cards, grid containers) |
| **Aesthetics & Styling** | Flat 2010s templates, manual styling | Light executive brand system ([tokens.css](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/theme/tokens.css)) | **1-Click Theme Switcher**, Frosted Glass, Shadow/Radius controls |
| **Content Creation** | Manual typing box-by-box | Markdown/AST compilation ([parser.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/business-record/parser/parser.ts)) | **AI Copilot**: Slide rewriting, prompt-to-deck, auto-summarization |
| **Data & Visual Assets** | Manual basic charts | Metric bars & static KPI cards ([types.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/deck/types.ts#L153-L170)) | **Interactive SVG Charts** (CSV import) + **Icon & Unsplash Library** |
| **Presentation Mode** | Fullscreen static slides + Q&A | Fullscreen presenter view ([PresentMode.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/PresentMode.tsx)) | **Presenter 2.0**: Smart Morph transitions, Teleprompter, Spotlight laser |
| **Export Formats** | Flat PDF / PPTX | Native editable PPTX + PDF + PNG ([exportHelper.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/exportHelper.ts)) | **Standalone Single-File Interactive HTML Deck** + Video recording (MP4) |

---

## 📁 Key File Mapping Reference

- **Canvas Stage**: [PresentationCanvas.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/PresentationCanvas.tsx)
- **Edit Toolbar**: [EditToolbar.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/formatting/EditToolbar.tsx)
- **Sidebar & Nav**: [SlideNavList.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/SlideNavList.tsx) & [GeneratorSidebar.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/GeneratorSidebar.tsx)
- **Present Mode**: [PresentMode.tsx](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/PresentMode.tsx)
- **Deck Store & State**: [deckStore.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/deck/deckStore.ts)
- **Exporter Engine**: [exportHelper.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/exportHelper.ts) & [pptxNative.ts](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/features/generator/pptxNative.ts)
- **Design Tokens**: [tokens.css](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/theme/tokens.css) & [BrandGuidelines.css](file:///Users/biradhwaj/Desktop/repo's/wozku-repo's/master-template-generator/src/theme/BrandGuidelines.css)
