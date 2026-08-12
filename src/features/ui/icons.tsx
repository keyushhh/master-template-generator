/**
 * The app's icon set: Ionicons (ionic.io/ionicons), inlined.
 *
 * Generated from the `ionicons` package rather than redrawn, so each glyph is
 * the real thing, and inlined rather than loaded through the `<ion-icon>` web
 * component, which fetches every icon from a CDN at runtime.
 *
 * Each path keeps its own stroke/fill attributes exactly as Ionicons ships
 * them. That matters: several outline icons mix stroked and filled paths (the
 * pencil nib in create-outline is filled), so a blanket fill="none" on the
 * wrapper would quietly drop parts of them.
 *
 * Drawn at the native 512 viewBox and scaled by the <svg> box - re-plotting
 * onto a 24 grid throws the stroke weight off against the rest of the set.
 *
 * Slide *content* deliberately does not use these. A slide has to look
 * identical in the editor, in Present mode and in the exported .pptx, so its
 * marks live in the renderers and the exporter, not here.
 */

function Ion({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden
      style={{ flexShrink: 0, display: 'block' }}
    >
      {children}
    </svg>
  );
}

interface IconProps {
  size?: number;
}


/** ionicons: close-outline */
export function CloseIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M368 368 144 144M368 144 144 368" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: checkmark-outline */
export function CheckIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M416 128 192 384l-96-96" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: chevron-down-outline */
export function ChevronDownIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="m112 184 144 144 144-144" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="48px"/>
    </Ion>
  );
}

/** ionicons: chevron-back-outline */
export function ChevronBackIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M328 112 184 256l144 144" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="48px"/>
    </Ion>
  );
}

/** ionicons: chevron-forward-outline */
export function ChevronForwardIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="m184 112 144 144-144 144" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="48px"/>
    </Ion>
  );
}

/** ionicons: eye-outline */
export function EyeIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M255.66 112c-77.94 0-157.89 45.11-220.83 135.33a16 16 0 0 0-.27 17.77C82.92 340.8 161.8 400 255.66 400c92.84 0 173.34-59.38 221.79-135.25a16.14 16.14 0 0 0 0-17.47C428.89 172.28 347.8 112 255.66 112" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <circle cx="256" cy="256" r="80" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: eye-off-outline */
export function EyeOffIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M432 448a15.92 15.92 0 0 1-11.31-4.69l-352-352a16 16 0 0 1 22.62-22.62l352 352A16 16 0 0 1 432 448M255.66 384c-41.49 0-81.5-12.28-118.92-36.5-34.07-22-64.74-53.51-88.7-91v-.08c19.94-28.57 41.78-52.73 65.24-72.21a2 2 0 0 0 .14-2.94L93.5 161.38a2 2 0 0 0-2.71-.12c-24.92 21-48.05 46.76-69.08 76.92a31.92 31.92 0 0 0-.64 35.54c26.41 41.33 60.4 76.14 98.28 100.65C162 402 207.9 416 255.66 416a239.1 239.1 0 0 0 75.8-12.58 2 2 0 0 0 .77-3.31l-21.58-21.58a4 4 0 0 0-3.83-1 204.8 204.8 0 0 1-51.16 6.47M490.84 238.6c-26.46-40.92-60.79-75.68-99.27-100.53C349 110.55 302 96 255.66 96a227.3 227.3 0 0 0-74.89 12.83 2 2 0 0 0-.75 3.31l21.55 21.55a4 4 0 0 0 3.88 1 192.8 192.8 0 0 1 50.21-6.69c40.69 0 80.58 12.43 118.55 37 34.71 22.4 65.74 53.88 89.76 91a.13.13 0 0 1 0 .16 310.7 310.7 0 0 1-64.12 72.73 2 2 0 0 0-.15 2.95l19.9 19.89a2 2 0 0 0 2.7.13 343.5 343.5 0 0 0 68.64-78.48 32.2 32.2 0 0 0-.1-34.78" fill="currentColor"/>
      <path d="M256 160a96 96 0 0 0-21.37 2.4 2 2 0 0 0-1 3.38l112.59 112.56a2 2 0 0 0 3.38-1A96 96 0 0 0 256 160M165.78 233.66a2 2 0 0 0-3.38 1 96 96 0 0 0 115 115 2 2 0 0 0 1-3.38Z" fill="currentColor"/>
    </Ion>
  );
}

/** ionicons: play-outline */
export function PlayIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M112 111v290c0 17.44 17 28.52 31 20.16l247.9-148.37c12.12-7.25 12.12-26.33 0-33.58L143 90.84c-14-8.36-31 2.72-31 20.16Z" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: play-circle-outline */
export function PlayCircleIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm0 384c-97.05 0-176-78.95-176-176S158.95 80 256 80s176 78.95 176 176-78.95 176-176 176z" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <path d="M213.57 357.73l142-95.8a16 16 0 0 0 0-26.6l-142-95.8A16 16 0 0 0 192 152.82v191.64a16 16 0 0 0 21.57 13.27z" fill="currentColor"/>
    </Ion>
  );
}

/** ionicons: pause-circle-outline */
export function PauseCircleIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm0 384c-97.05 0-176-78.95-176-176S158.95 80 256 80s176 78.95 176 176-78.95 176-176 176z" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <path d="M208 176v160M304 176v160" fill="none" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: download-outline */
export function DownloadIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M336 176h40a40 40 0 0 1 40 40v208a40 40 0 0 1-40 40H136a40 40 0 0 1-40-40V216a40 40 0 0 1 40-40h40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="m176 272 80 80 80-80M256 48v288" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: add-outline */
export function AddIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M256 112v288M400 256H112" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: ellipsis-horizontal */
export function EllipsisIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <circle cx="256" cy="256" r="48"/>
      <circle cx="416" cy="256" r="48"/>
      <circle cx="96" cy="256" r="48"/>
    </Ion>
  );
}

/** ionicons: warning-outline */
export function WarningIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M85.57 446.25h340.86a32 32 0 0 0 28.17-47.17L284.18 82.58c-12.09-22.44-44.27-22.44-56.36 0L57.4 399.08a32 32 0 0 0 28.17 47.17" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="m250.26 195.39 5.74 122 5.73-121.95a5.74 5.74 0 0 0-5.79-6h0a5.74 5.74 0 0 0-5.68 5.95" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <path fill="currentColor" d="M256 397.25a20 20 0 1 1 20-20 20 20 0 0 1-20 20"/>
    </Ion>
  );
}

/** ionicons: alert-circle-outline */
export function AlertIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192 192-86 192-192Z" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <path d="M250.26 166.05 256 288l5.73-121.95a5.74 5.74 0 0 0-5.79-6h0a5.74 5.74 0 0 0-5.68 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="M256 367.91a20 20 0 1 1 20-20 20 20 0 0 1-20 20"/>
    </Ion>
  );
}

/** ionicons: flash-outline */
export function FlashIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M315.27 33 96 304h128l-31.51 173.23a2.36 2.36 0 0 0 2.33 2.77h0a2.36 2.36 0 0 0 1.89-.95L416 208H288l31.66-173.25a2.45 2.45 0 0 0-2.44-2.75h0a2.42 2.42 0 0 0-1.95 1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: document-outline */
export function DocumentIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M416 221.25V416a48 48 0 0 1-48 48H144a48 48 0 0 1-48-48V96a48 48 0 0 1 48-48h98.75a32 32 0 0 1 22.62 9.37l141.26 141.26a32 32 0 0 1 9.37 22.62Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="M256 56v120a32 32 0 0 0 32 32h120" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: document-text-outline */
export function DocumentTextIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M416 221.25V416a48 48 0 0 1-48 48H144a48 48 0 0 1-48-48V96a48 48 0 0 1 48-48h98.75a32 32 0 0 1 22.62 9.37l141.26 141.26a32 32 0 0 1 9.37 22.62Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="M256 56v120a32 32 0 0 0 32 32h120M176 288h160M176 368h160" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: albums-outline */
export function AlbumsIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <rect width="384" height="256" x="64" y="176" rx="28.87" ry="28.87" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="M144 80h224M112 128h288" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: arrow-undo-outline */
export function UndoIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M240 424v-96c116.4 0 159.39 33.76 208 96 0-119.23-39.57-240-208-240V88L64 256Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: arrow-redo-outline */
export function RedoIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M448 256 272 88v96C103.57 184 64 304.77 64 424c48.61-62.24 91.6-96 208-96v96Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: arrow-forward-outline */
export function ArrowForwardIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="m268 112 144 144-144 144M392 256H100" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="48px"/>
    </Ion>
  );
}

/** ionicons: cloud-upload-outline */
export function CloudUploadIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M320 367.79h76c55 0 100-29.21 100-83.6s-53-81.47-96-83.6c-8.89-85.06-71-136.8-144-136.8-69 0-113.44 45.79-128 91.2-60 5.7-112 43.88-112 106.4s54 106.4 120 106.4h56" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="m320 255.79-64-64-64 64M256 448.21V207.79" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: link-outline */
export function LinkIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M208 352h-64a96 96 0 0 1 0-192h64M304 160h64a96 96 0 0 1 0 192h-64M163.29 256h187.42" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="36px"/>
    </Ion>
  );
}

/** ionicons: remove-outline */
export function MinusIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M400 256H112" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: reorder-two-outline */
export function GripIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M112 304h288M112 208h288" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: text-outline */
export function TextIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="m32 415.5 120-320 120 320M230 303.5H74M326 239.5c12.19-28.69 41-48 74-48h0c46 0 80 32 80 80v144" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="M320 358.5c0 36 26.86 58 60 58 54 0 100-27 100-106v-15c-20 0-58 1-92 5-32.77 3.86-68 19-68 58" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: tablet-landscape-outline */
export function RectIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <rect width="352" height="480" x="80" y="16" rx="48" ry="48" transform="rotate(-90 256 256)" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: ellipse-outline */
export function EllipseIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <circle cx="256" cy="256" r="192" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: image-outline */
export function ImageIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <rect width="416" height="352" x="48" y="80" rx="48" ry="48" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="32px"/>
      <circle cx="336" cy="176" r="32" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <path d="m304 335.79-90.66-90.49a32 32 0 0 0-43.87-1.3L48 352M224 432l123.34-123.34a32 32 0 0 1 43.11-2L464 368" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: list-outline */
/** A table: an outer frame, a header row, and a column division. Distinct from
 *  ListIcon's bullets, which read as a list of items rather than a grid of
 *  fields - and the library's list view is a real table now. */
export function TableIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <rect x="64" y="80" width="384" height="352" rx="16" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="M64 176h384M240 176v256" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="M64 304h384" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

export function ListIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M160 144h288M160 256h288M160 368h288" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <circle cx="80" cy="144" r="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <circle cx="80" cy="256" r="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <circle cx="80" cy="368" r="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: pie-chart-outline */
export function PieChartIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M256.05 80.65Q263.94 80 272 80c106 0 192 86 192 192s-86 192-192 192A192.09 192.09 0 0 1 89.12 330.65" fill="none" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="32px"/>
      <path d="M256 48C141.12 48 48 141.12 48 256a207.3 207.3 0 0 0 18.09 85L256 256Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: layers-outline */
export function LayersIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="m434.8 137.65-149.36-68.1c-16.19-7.4-42.69-7.4-58.88 0L77.3 137.65c-17.6 8-17.6 21.09 0 29.09l148 67.5c16.89 7.7 44.69 7.7 61.58 0l148-67.5c17.52-8 17.52-21.1-.08-29.09M160 308.52l-82.7 37.11c-17.6 8-17.6 21.1 0 29.1l148 67.5c16.89 7.69 44.69 7.69 61.58 0l148-67.5c17.6-8 17.6-21.1 0-29.1l-79.94-38.47" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="m160 204.48-82.8 37.16c-17.6 8-17.6 21.1 0 29.1l148 67.49c16.89 7.7 44.69 7.7 61.58 0l148-67.49c17.7-8 17.7-21.1.1-29.1L352 204.48" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: copy-outline */
export function CopyIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <rect width="336" height="336" x="128" y="128" rx="57" ry="57" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="m383.5 128 .5-24a56.16 56.16 0 0 0-56-56H112a64.19 64.19 0 0 0-64 64v216a56.16 56.16 0 0 0 56 56h24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: create-outline */
export function CreateIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M384 224v184a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V168a40 40 0 0 1 40-40h167.48" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="M459.94 53.25a16.06 16.06 0 0 0-23.22-.56L424.35 65a8 8 0 0 0 0 11.31l11.34 11.32a8 8 0 0 0 11.34 0l12.06-12c6.1-6.09 6.67-16.01.85-22.38M399.34 90 218.82 270.2a9 9 0 0 0-2.31 3.93L208.16 299a3.91 3.91 0 0 0 4.86 4.86l24.85-8.35a9 9 0 0 0 3.93-2.31L422 112.66a9 9 0 0 0 0-12.66l-9.95-10a9 9 0 0 0-12.71 0"/>
    </Ion>
  );
}

/** ionicons: trash-outline */
export function TrashIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="m112 112 20 320c.95 18.49 14.4 32 32 32h184c17.67 0 30.87-13.51 32-32l20-320" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="M80 112h352" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="32px"/>
      <path d="M192 112V72h0a23.93 23.93 0 0 1 24-24h80a23.93 23.93 0 0 1 24 24h0v40M256 176v224M184 176l8 224M328 176l-8 224" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: refresh-outline */
export function RefreshIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M320 146s24.36-12-64-12a160 160 0 1 0 160 160" fill="none" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="32px"/>
      <path d="m256 58 80 80-80 80" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: eyedrop-outline */
export function EyedropIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M262.51 204.22 70 396.69C57.56 409.15 48 464 48 464s54.38-9.09 67.31-22L307.8 249.51" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <rect width="192.15" height="64.05" x="211.72" y="172.19" rx="32.03" ry="32.03" transform="rotate(45 307.788 204.2)" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
      <path d="M289.91 141s20.57 8.57 37.22-8.08l54.67-70.63c18.5-19.41 49.26-18.69 67.94 0h0c18.68 18.68 19.34 48.81 0 67.93l-70.68 54.67c-15.65 15.65-8.08 37.22-8.08 37.22M115.31 442s-26.48 17.34-44.56-.73-.75-44.58-.75-44.58" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: help-circle-outline */
export function HelpIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M256 80a176 176 0 1 0 176 176A176 176 0 0 0 256 80Z" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <path d="M200 202.29s.84-17.5 19.57-32.57C230.68 160.77 244 158.18 256 158c10.93-.14 20.69 1.67 26.53 4.45 10 4.76 29.47 16.38 29.47 41.09 0 26-17 37.81-36.37 50.8S251 281.43 251 296" fill="none" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="28px"/>
      <circle cx="250" cy="348" r="20" fill="currentColor"/>
    </Ion>
  );
}

/** ionicons: search-outline */
export function SearchIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M221.09 64a157.09 157.09 0 1 0 157.09 157.09A157.1 157.1 0 0 0 221.09 64Z" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <path d="M338.29 338.29 448 448" fill="none" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: sparkles-outline */
export function SparklesIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M259.92 262.91 216.4 149.77a9 9 0 0 0-16.8 0l-43.52 113.14a9 9 0 0 1-5.17 5.17L37.77 311.6a9 9 0 0 0 0 16.8l113.14 43.52a9 9 0 0 1 5.17 5.17L199.6 490.23a9 9 0 0 0 16.8 0l43.52-113.14a9 9 0 0 1 5.17-5.17l113.14-43.52a9 9 0 0 0 0-16.8l-113.14-43.52a9 9 0 0 1-5.17-5.17ZM108 68.4 88.85 61.05a2.72 2.72 0 0 1-1.55-1.55L79.95 40.35a2.7 2.7 0 0 0-5.04 0L67.55 59.5A2.72 2.72 0 0 1 66 61.05L46.85 68.4a2.7 2.7 0 0 0 0 5.04L66 80.79a2.72 2.72 0 0 1 1.55 1.55l7.36 19.15a2.7 2.7 0 0 0 5.04 0l7.35-19.15a2.72 2.72 0 0 1 1.55-1.55l19.15-7.35a2.7 2.7 0 0 0 0-5.04ZM399.36 152.55 372.28 142.15a3.85 3.85 0 0 1-2.19-2.19l-10.4-27.08a3.82 3.82 0 0 0-7.13 0l-10.4 27.08a3.85 3.85 0 0 1-2.19 2.19l-27.08 10.4a3.82 3.82 0 0 0 0 7.13l27.08 10.4a3.85 3.85 0 0 1 2.19 2.19l10.4 27.08a3.82 3.82 0 0 0 7.13 0l10.4-27.08a3.85 3.85 0 0 1 2.19-2.19l27.08-10.4a3.82 3.82 0 0 0 0-7.13Z" fill="currentColor"/>
    </Ion>
  );
}

/** ionicons: keypad-outline, used as the keyboard-shortcut mark */
export function KeyboardIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <circle cx="256" cy="256" r="26" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <circle cx="256" cy="152" r="26" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <circle cx="256" cy="360" r="26" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <circle cx="152" cy="256" r="26" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <circle cx="152" cy="152" r="26" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <circle cx="152" cy="360" r="26" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <circle cx="360" cy="256" r="26" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <circle cx="360" cy="152" r="26" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
      <circle cx="360" cy="360" r="26" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: arrow-up-outline */
export function ArrowUpIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M112 244l144-144 144 144M256 120v292" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="48px"/>
    </Ion>
  );
}

/** ionicons: swap-vertical-outline, used as the unsorted-column mark */
export function SortIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M464 208 352 96 240 208M368 96v320M48 304l112 112 112-112M160 416V96" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: folder-outline */
export function FolderIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M440 432H72a40 40 0 01-40-40V120a40 40 0 0140-40h120l32 40h216a40 40 0 0140 40v232a40 40 0 01-40 40z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="32px"/>
    </Ion>
  );
}

/** ionicons: folder (filled) */
export function FolderFilledIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M496 152a56 56 0 00-56-56H220.37l-32-40H72a56 56 0 00-56 56v288a56 56 0 0056 56h368a56 56 0 0056-56z" fill="currentColor"/>
    </Ion>
  );
}

/** ionicons: folder-open (filled open) */
export function FolderOpenIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M408 96H252.11l-32-40H80a48.05 48.05 0 00-48 48v288a48.05 48.05 0 0048 48h328a48.05 48.05 0 0048-48V144a48.05 48.05 0 00-48-48z" fill="currentColor"/>
    </Ion>
  );
}

/** ionicons: folder-open-outline */
export function FolderOpenOutlineIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M64 192v-72a40 40 0 0140-40h75.89a40 40 0 0122.19 6.72l27.84 18.56a40 40 0 0022.19 6.72H408a40 40 0 0140 40v40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32"/>
      <path d="M479.9 226.55L463.68 392a40 40 0 01-39.93 40H88.25a40 40 0 01-39.93-40L32.1 226.55A32 32 0 0164 192h384.1a32 32 0 0131.8 34.55z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32"/>
    </Ion>
  );
}

/** ionicons: arrow-back-outline */
export function ArrowBackNavIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M244 400L100 256l144-144M120 256h292" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="48px"/>
    </Ion>
  );
}

/** ionicons: arrow-forward-outline */
export function ArrowForwardNavIcon({ size = 14 }: IconProps) {
  return (
    <Ion size={size}>
      <path d="M268 112l144 144-144 144M392 256H100" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="48px"/>
    </Ion>
  );
}
