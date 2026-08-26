/**
 * Deck data model - the single source of truth for what the presentation
 * contains. The 14 slide templates (s1..s14) are renderers; a Deck is an
 * ordered list of SlideInstances, each pointing at a template and carrying
 * the content that fills that template's slots. Every content field is
 * optional: an absent field makes the renderer fall back to its master
 * template placeholder, so an empty deck renders the untouched template.
 */

export type SlideTemplateId =
  | 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7'
  | 's8' | 's9' | 's10' | 's11' | 's12' | 's13' | 's14'
  /** User-inserted freeform slide (heading + body + optional image). */
  | 'blank'
  /** A slide imported from an uploaded .pptx, keeping its original layout.
   *  Carries positioned shapes rather than template slots - see ImportedShape. */
  | 'imported'
  | (string & {});

/** One text run inside an imported shape: the smallest span of characters that
 *  share formatting. Kept as runs (not flattened) so bold labels, coloured
 *  emphasis and mixed sizes survive the round trip. */
export interface ImportedRun {
  text: string;
  sizePx?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Hex, no '#'. Already mapped onto the brand palette at import. */
  color?: string;
  /** Already mapped onto the brand type stack at import. */
  font?: string;
}

export interface ImportedParagraph {
  runs: ImportedRun[];
  align?: 'left' | 'center' | 'right';
  /** Line height in px, as the source deck set it. Absent means the renderer's
   *  own default. A blank paragraph is a spacer of exactly this height, which
   *  is how a source deck's deliberate gaps survive. */
  leadingPx?: number;
}

/** One cell of an imported table. Its own fill wins over the table's banding,
 *  the same precedence PowerPoint uses when a cell has an explicit override. */
export interface ImportedTableCell {
  /** Hex, no '#'. Absent means transparent - let the row's banding show. */
  fill?: string;
  paragraphs?: ImportedParagraph[];
}

export interface ImportedTableRow {
  heightPx: number;
  cells: ImportedTableCell[];
}

/** A shape lifted from an uploaded .pptx, positioned in the 1920x1080 design
 *  space. Geometry is preserved exactly; fill, line and type are mapped onto
 *  the brand palette so the slide reads as Wozku without moving. */
export interface ImportedShape {
  id: string;
  kind: 'rect' | 'ellipse' | 'image' | 'table';
  x: number;
  y: number;
  w: number;
  h: number;
  /** Hex, no '#'. Absent means no fill. */
  fill?: string;
  line?: { color: string; widthPx: number };
  /** Present for kind==='image'. Data URL. */
  imageUrl?: string;
  /** Present for kind==='image'. Fractions of the box the picture is inset by,
   *  as PowerPoint's fillRect stores them: negative extends past the edge and
   *  is cropped. Absent means the picture simply fits the box. */
  crop?: { l: number; t: number; r: number; b: number };
  paragraphs?: ImportedParagraph[];
  vAlign?: 'top' | 'middle' | 'bottom';
  /** Present for kind==='table'. Column widths sum to `w`. */
  colWidthsPx?: number[];
  rows?: ImportedTableRow[];
}

/** One slide lifted from an uploaded file, before it becomes a SlideInstance.
 *  Shared by the .pptx and .pdf importers so both feed the same deck builder. */
export interface ImportedSlide {
  shapes: ImportedShape[];
  /** Hex, no '#'. */
  base: string;
  /** First substantial line of copy, used to title the slide in the sidebar. */
  title: string;
}

/** A per-slot formatting override applied on top of whatever the template
 *  renderer already specifies. Every field is optional and an absent field
 *  means "keep the template's value" - so a slide with no overrides renders
 *  pixel-identically to how it did before formatting existed, and existing
 *  saved decks are unaffected.
 *
 *  Both renderers consume these through src/features/formatting/resolve.ts:
 *  the React canvas as CSS, the native exporter as pptxgenjs text options.
 *  Adding a field here means teaching both sides about it. */
export interface SlotStyle {
  /** Design px, in the 1920x1080 canvas space - the same unit the renderers
   *  and the exporter's `size` option already use. */
  sizePx?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Hex, no '#'. */
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** A family name from FONT_CHOICES in formatting/rails.ts - the same string
   *  the exporter passes to PowerPoint as `fontFace`, so the canvas and the
   *  .pptx cannot disagree about which font a slot is in. */
  fontFamily?: string;

  /** Leading, as a multiple of the font size - what CSS line-height and pptx lineSpacingMultiple both take. */
  lineHeight?: number;
  /** Tracking in em, so it stays correct when the slot is resized. */
  letterSpacing?: number;
  /** Space above / below the paragraph, in design px. */
  spaceBefore?: number;
  spaceAfter?: number;
  /** Case shown, without changing what was typed. Absent means as-typed. */
  textCase?: 'upper' | 'lower' | 'title';
  /** Indent depth, 0-4 steps of INDENT_STEP_PX. */
  indentLevel?: number;
  /** Bulleted paragraph - one bullet per paragraph, in both renderers. */
  bullet?: boolean;
}

/** One cell of a freshly-inserted (not imported) table: a single string
 *  rather than paragraphs/runs, since there is no source pptx formatting to
 *  preserve here - see ImportedTableCell for that richer case. */
export interface OverlayTableCell {
  text?: string;
  /** Hex, no '#'. Absent means transparent. */
  fill?: string;
  /** Reuses SlotStyle so a header row can be told apart from body cells with
   *  the same Bold/size/colour controls as everything else in the toolbar. */
  style?: SlotStyle;
}

export interface OverlayTableRow {
  heightPx: number;
  cells: OverlayTableCell[];
}

export type OverlayChartType = 'bar' | 'line' | 'pie';

export interface OverlayChartSeries {
  name: string;
  values: number[];
}

/**
 * A user-inserted element sitting on top of (or behind) a slide's template
 * content: a text box, a rectangle, an ellipse, an image, a table, or a chart.
 *
 * Deliberately a separate field from the imported `shapes` array. Those are an
 * imported .pptx slide's actual content; these are additions the user made in
 * the app. Keeping them apart means an imported slide can carry both, and that
 * "clear my insertions" can never eat imported content.
 *
 * Text formatting reuses SlotStyle, so the same format toolbar drives a text
 * box with no extra plumbing.
 */
export interface OverlayShape {
  id: string;
  kind: 'rect' | 'ellipse' | 'text' | 'image' | 'table' | 'chart' | 'video';
  /** Geometry in the 1920x1080 design space, matching every other coordinate
   *  in the deck model. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Hex, no '#'. Absent means no fill (an outlined shape, or a plain text box). */
  fill?: string;
  line?: { color: string; widthPx: number };
  /** Clockwise rotation in degrees about the shape's own centre. Absent means 0,
   *  i.e. exactly the unrotated behaviour every shape had before this field.
   *  x/y/w/h stay the unrotated box, so geometry, snapping and the export all
   *  keep reading the same numbers they always did. */
  rotation?: number;
  /** 0 (invisible) to 1 (solid). Absent means 1, so an untouched shape is opaque
   *  exactly as before. Stored as a fraction to match CSS; the exporter converts
   *  to PowerPoint's transparency percentage. */
  opacity?: number;
  /** kind === 'image' - a downscaled data URL, as elsewhere in the deck. */
  imageUrl?: string;
  /** kind === 'image' - describes the image for screen readers and appears
   *  as the picture's alt text in the exported .pptx. Absent means an empty
   *  alt, exactly the behaviour before this field existed. */
  altText?: string;
  /** kind === 'image' - how the picture meets its box. `contain` letterboxes
   *  the whole image, which is the original behaviour and stays the default;
   *  `cover` fills the box and crops the overflow. */
  fit?: 'contain' | 'cover';
  /** kind === 'image' - which point of the picture stays in frame while
   *  `cover` crops, as fractions of width and height. Absent is the centre
   *  (0.5, 0.5). Only read when `fit` is 'cover'. */
  focal?: { x: number; y: number };
  /** kind === 'text' - the text box's content. Newlines are honoured. */
  text?: string;
  /** kind === 'text' - size/weight/colour/alignment, shared with template slots. */
  style?: SlotStyle;
  /** Vertical placement of text within the box. */
  vAlign?: 'top' | 'middle' | 'bottom';
  /** Renders behind the template's own content instead of over it. Needed for
   *  the common case of a tinted panel sitting behind existing copy - without
   *  it, a highlight rectangle would bury the text it is meant to highlight. */
  behind?: boolean;
  /** kind === 'table' - column widths sum to `w`. */
  colWidthsPx?: number[];
  /** kind === 'table' */
  rows?: OverlayTableRow[];
  /** kind === 'chart' */
  chartType?: OverlayChartType;
  chartCategories?: string[];
  chartSeries?: OverlayChartSeries[];
  /** kind === 'chart' - per-index colour overrides, bare hex with no '#'. The
   *  index is the series for a bar or line chart and the category for a pie,
   *  which is what each of those cycles colour by. An empty string, or an index
   *  past the end, means the deck's own chart palette - so absent (every chart
   *  until someone changes one) is exactly the old behaviour. See
   *  features/formatting/chartPalette.ts. */
  chartColors?: string[];
  /** kind === 'video' - a YouTube/Vimeo page link or a direct file URL. */
  videoUrl?: string;
  /** kind === 'video' - id of an uploaded file in the IndexedDB media store, since the bytes can't live in a deck. */
  videoAssetId?: string;
  /** kind === 'video' - the uploaded file's name, so the UI can name a source whose blob it hasn't loaded yet. */
  videoName?: string;
  /** kind === 'video' - poster frame (data URL or provider thumbnail), shown before playback and used by the .pptx. */
  posterUrl?: string;
  /** kind === 'video' */
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** Ties this shape to one of the 'blank' template's layouts (see
   *  `SlideContent.blankLayout`) - it renders and exports only while the
   *  slide is on that layout. Undefined (the default, and the only value
   *  every other template ever sees) means "always visible", same as before
   *  this field existed. Exists for elements a layout seeds for itself, like
   *  two-column's table, which would otherwise leak into Standard/Full-bleed
   *  since overlay shapes are normally layout-agnostic. */
  blankLayoutOnly?: 'standard' | 'two-column' | 'full-bleed';
}

/**
 * How far a template slot has been dragged from where its template puts it, in
 * design px.
 *
 * Stored as a delta rather than an absolute position on purpose. Template slots
 * are laid out by their renderer (flex, padding, computed hero sizes), so there
 * is no absolute coordinate to overwrite - and a delta means a slot the user
 * nudged still follows the template if the template's own layout changes.
 * Absent (the default) means the slot sits exactly where the template put it.
 */
export interface SlotOffset {
  dx: number;
  dy: number;
}

export interface IndexPart {
  title: string;
  description: string;
}

export interface MetricBar {
  label: string;
  pct: number;
  active?: boolean;
}

export interface Kpi {
  label: string;
  value: string;
}

export interface ComparisonRow {
  dim: string;
  cur: string;
  tgt: string;
  delta: string;
}

export interface RoadmapPhase {
  num?: string;
  title: string;
  description?: string;
  body?: string;
  timing?: string;
  completed?: boolean;
}

export interface ProcessStep {
  num?: string;
  title: string;
  description?: string;
  text?: string;
}

export interface RegionSector {
  label: string;
  value: string;
}

export interface MobileScreenAsset {
  id?: string;
  src: string;
  alt?: string;
}

/** A slide's own background, overriding its template's default (and, on the
 *  classic Wozku Master template, hiding the hairline grid). Only 'color' and
 *  'gradient' export as a fully native PowerPoint fill; 'image' and 'gradient'
 *  both end up flattened to a picture on export, since pptxgenjs has no native
 *  gradient-fill API - see `applyBackground` in pptxNative.ts. */
export interface SlideBackground {
  kind: 'color' | 'gradient' | 'image' | 'none';
  /** Hex, no '#'. For kind 'color'. */
  color?: string;
  /** Hex, no '#'. For kind 'gradient'. */
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
  /** Data URL (downscaled JPEG, same path as every other deck image). For kind 'image'. */
  imageUrl?: string;
}

/** Flat bag of every slot the 14 templates expose. Renderers read only the
 *  fields relevant to their template. */
export interface SlideContent {
  // Shared
  eyebrow?: string;
  heading?: string;
  body?: string;
  hudLabel?: string;
  /** Per-slide background override. Undefined means "use the template's own
   *  default" - currently only honored on the classic Wozku Master template's
   *  slide types (s1-s14, blank, imported); absent elsewhere so the control
   *  stays hidden rather than silently doing nothing. */
  background?: SlideBackground;

  // s1 Cover
  headingLines?: string[];
  projectLabel?: string;
  versionLabel?: string;
  tagline?: string;
  /** The cover's legal line ("Proprietary and confidential"). Editable, and an
   *  empty string hides it - some decks aren't confidential. */
  confidentialLabel?: string;

  /** Hides the slide's footer strip (title + slide number). Per slide, because
   *  a cover or a full-bleed divider often wants a clean bottom edge. */
  hideFooter?: boolean;

  // s2 Index
  parts?: IndexPart[];

  // s3 Executive Summary
  metricLabel?: string;
  metricText?: string;

  // s4 Section Divider
  subtitle?: string;

  // s5 Two-Column Context
  leftLabel?: string;
  leftHeading?: string;
  leftBody?: string;
  leftAttributes?: string[];
  rightLabel?: string;
  rightHeading?: string;
  rightBody?: string;

  // s6 Data Monument
  value?: string;
  unit?: string;
  stat?: string;
  label?: string;
  caption?: string;

  // s7 Metrics Dashboard
  bars?: MetricBar[];
  kpis?: Kpi[];

  // s8 Comparative Table
  rows?: ComparisonRow[];

  // s9 Strategic Roadmap
  phases?: RoadmapPhase[];

  // s11 Process Architecture
  steps?: ProcessStep[];

  // s12 Global Reach Map
  sectors?: RegionSector[];

  // s10 Image Editorial - uploaded image as a (downscaled) data URL
  imageUrl?: string;
  /** User dismissed the image area entirely (s10/s12) - the template falls
   *  back to a text-only layout instead of showing an empty upload
   *  placeholder. Re-adding an image clears this. */
  hideImage?: boolean;

  // Mobile / Screen Mockup PNG Assets
  screenAsset?: string;
  screenAssets?: (string | MobileScreenAsset)[];
  screens?: MobileScreenAsset[];

  // s13 Featured Quote
  quote?: string;
  author?: string;
  role?: string;
  /** Uploaded author headshot (downscaled data URL). */
  avatarUrl?: string;
  avatarScale?: number;
  // Layout and composition overrides
  coverLayout?: 'classic' | 'centered-hero' | 'split-editorial' | 'monumental-bold' | 'data-grid' | 'swiss-minimal';
  layoutVariant?: string;
  badge?: string;
  categoryTag?: string;

  // s14 Exit
  contacts?: string[];

  // blank - freeform slide layout choice
  blankLayout?: 'standard' | 'two-column' | 'full-bleed';
  /** 'standard' layout's second text container, stacked below heading/body -
   *  standard has no image slot, so a slide needing two blocks of content
   *  gets a second heading+body instead. */
  secondHeading?: string;
  secondBody?: string;

  /** Per-slot formatting overrides, keyed by the slot's stable name. For a
   *  plain field the key is the SlideContent field it writes ('heading',
   *  'eyebrow'); for an item inside a list it is dotted ('bars.0.label'), so
   *  reordering a list carries its formatting with the index. Absent (the
   *  default) means every slot uses its template styling. */
  styles?: Record<string, SlotStyle>;

  /** Per-slot drag offsets, keyed the same way as `styles`. Lets a user move a
   *  slot the template positioned, without having to delete it and re-create it
   *  as a free-floating text box. */
  offsets?: Record<string, SlotOffset>;

  /** User-inserted text boxes, shapes and images layered on this slide.
   *  Available on every template, including imported slides. Array order is
   *  z-order (later = in front); `behind` drops an item below the template's
   *  own content. */
  overlay?: OverlayShape[];

  // imported - positioned shapes lifted from an uploaded .pptx
  shapes?: ImportedShape[];
  /** The source slide's own background colour, so a deck's black divider or
   *  closing slides keep their dark treatment instead of being forced white. */
  importedBase?: string;
}

export interface SlideInstance {
  /** Unique per instance - duplicating a slide mints a new instanceId while
   *  keeping the same templateId. Used as the DOM anchor id. */
  instanceId: string;
  templateId: SlideTemplateId;
  /** Nav group label (Introduction, Context, …). */
  group: string;
  /** Row title shown in the sidebar nav and slide footer. */
  title: string;
  /** Hidden slides stay in the deck (and nav, dimmed) but are excluded from
   *  the canvas and from numbering. */
  hidden: boolean;
  /** Speaker notes. Exported into PowerPoint's notes pane and shown in Present
   *  mode; never rendered on the slide itself. */
  notes?: string;
  /** True once the user has renamed this slide by hand. Template switching
   *  reads it to decide whether it may adopt the new template's default name:
   *  a title the user chose must survive the switch, an untouched default
   *  should follow the template. */
  titleCustomized?: boolean;
  content: SlideContent;
  /** Overrides the deck's transition for this slide only. Absent means it
   *  follows the deck. */
  transition?: SlideTransition;
  /** Ties this slide to its other versions: every slide sharing a
   *  `variantGroup` is one take on the same slide, and at most one of them is
   *  visible. Absent, which is every slide until someone makes a variant,
   *  means an ordinary standalone slide. See features/deck/variants.ts. */
  variantGroup?: string;
}

export interface Deck {
  slides: SlideInstance[];
  /** True once "Generate Deck" has populated content from a Business Record. */
  generated: boolean;
  /** Deck-level client logo (data URL or frontmatter URL); editable in edit mode. */
  logoUrl?: string;
  /** Size multiplier for the logo, 1 = the template's default height. Deck-level
   *  rather than per-slide so one client's mark stays a consistent size across
   *  the cover, dividers and the closing slide. */
  logoScale?: number;
  /** Which theme (palette + type stack) this deck is drawn in, keyed by
   *  `DeckTheme.id`. Absent means Wozku's own, which is what every existing
   *  deck gets - so adding this field changes nothing about a saved deck.
   *  One field rather than an embedded copy of the palette: a theme is a shared
   *  thing, and a deck that inlined its colours would not follow an edit to the
   *  brand kit it came from. */
  themeId?: string;
  /** Which `PRESENTATION_TEMPLATES` entry built this deck (eg. 'editorial',
   *  'ux-journey'). Absent means the classic Wozku Master template, which is
   *  what every existing deck gets. Lets a Business Record import target the
   *  active template's own slide types instead of always falling back to the
   *  classic s1-s14 set. */
  presentationTemplateId?: string;
  /** How one slide gives way to the next in present mode. Absent means Fade,
   *  the house default, so a deck saved before transitions existed presents
   *  the same way a new one does rather than hard-cutting. */
  transition?: SlideTransition;
}

/** The transitions present mode offers. Deliberately short: a deck reads as one
 *  piece when every slide changes the same way, and a picker of twenty does the
 *  opposite. */
export type SlideTransition = 'none' | 'fade' | 'push' | 'wipe' | 'rise';
