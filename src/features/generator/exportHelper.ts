import html2canvas from 'html2canvas';
import pptxgen from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { addNativeSlide, clearExportTheme, setExportTheme, takeMediaNotes } from './pptxNative';
import { embedPptxFonts, type FontEmbedReport } from './pptxFontEmbed';
import { familiesInDeck } from '../fonts/deckFonts';
import type { SlideInstance } from '../deck/types';
import { WOZKU_THEME, type DeckTheme } from '../theme/deckTheme';
import { getVideo } from '../deck/mediaStore';
import { embedWithOptions, parseVideoSource } from '../formatting/videoSource';

/**
 * html2canvas's CSS parser doesn't understand `color-mix()` (or the `color()`
 * function Chrome normalizes it to) and throws while parsing it - whether it
 * appears in a stylesheet rule or, as with the slide background glow, inline
 * on the element itself. Rewrite both to plain `rgba()` on html2canvas's
 * *cloned* document right before capture; production styles are untouched.
 */
const COLOR_FN_RE = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/gi;

function colorFnToRgba(_m: string, r: string, g: string, b: string, a?: string): string {
  const chan = (v: string) => Math.round(parseFloat(v) * 255);
  const alpha = a !== undefined ? parseFloat(a) : 1;
  return `rgba(${chan(r)}, ${chan(g)}, ${chan(b)}, ${alpha})`;
}

/** Balanced-paren extraction of every `color-mix(...)` call in a CSS value string. */
function findColorMixCalls(text: string): string[] {
  const calls: string[] = [];
  let i = 0;
  while ((i = text.indexOf('color-mix(', i)) !== -1) {
    let depth = 0;
    let j = i + 'color-mix('.length - 1;
    do {
      if (text[j] === '(') depth++;
      else if (text[j] === ')') depth--;
      j++;
    } while (depth > 0 && j < text.length);
    calls.push(text.slice(i, j));
    i = j;
  }
  return calls;
}

/**
 * Resolves a standalone `color-mix(...)` expression to a concrete color by
 * assigning it to a custom property on a live probe element - `getComputedStyle`
 * resolves both `var()` references and the mix itself, just into Chrome's
 * `color(srgb ...)` form, which we then convert to `rgba()`.
 */
function resolveColorMixExpr(doc: Document, probe: HTMLElement, expr: string): string {
  probe.style.setProperty('--wg-color-mix-probe', expr);
  probe.style.color = 'var(--wg-color-mix-probe)';
  const computed = doc.defaultView?.getComputedStyle(probe).color ?? '';
  return computed.replace(COLOR_FN_RE, colorFnToRgba) || 'transparent';
}

function replaceColorMixInText(doc: Document, probe: HTMLElement, text: string): string {
  let result = text;
  for (const call of findColorMixCalls(text)) {
    result = result.replace(call, resolveColorMixExpr(doc, probe, call));
  }
  return result;
}

function resolveColorMixForHtml2Canvas(clonedDoc: Document) {
  const probe = clonedDoc.createElement('div');
  probe.style.cssText = 'position:absolute;top:-9999px;left:-9999px;visibility:hidden;';
  clonedDoc.body.appendChild(probe);

  // Inline styles (e.g. the slide background glow's radial-gradient stop).
  clonedDoc.querySelectorAll<HTMLElement>('[style*="color-mix("]').forEach((el) => {
    const raw = el.getAttribute('style');
    if (raw) el.setAttribute('style', replaceColorMixInText(clonedDoc, probe, raw));
  });

  // Stylesheet rules (dark-mode/edit-mode chrome) - rewritten in place so any
  // future rule keeps working even though the slide renderers never use them.
  for (const sheet of Array.from(clonedDoc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet (CDN fonts) - inaccessible, and irrelevant here
    }
    if (!rules) continue;
    for (let i = rules.length - 1; i >= 0; i--) {
      const rule = rules[i];
      if (rule.cssText.includes('color-mix(') && rule instanceof CSSStyleRule) {
        for (const prop of Array.from(rule.style)) {
          const value = rule.style.getPropertyValue(prop);
          if (value.includes('color-mix(')) {
            const priority = rule.style.getPropertyPriority(prop);
            rule.style.setProperty(prop, replaceColorMixInText(clonedDoc, probe, value), priority);
          }
        }
      }
    }
  }

  clonedDoc.body.removeChild(probe);
}

// The canvas presents one slide at a time: every slide stays mounted, but the
// off-stage ones are centred under the current slide with opacity 0. Capturing
// needs each one at native 1920×1080, unscaled, untranslated and fully opaque -
// so we neutralize the stage's presentation styles, capture, then restore.
// (The transform in particular must go: capturing a scaled element makes
// html2canvas misplace layers - grid over text, grey strips.)
const SLIDE_W = 1920;
const SLIDE_H = 1080;

async function captureSlide(id: string): Promise<HTMLCanvasElement | null> {
  const el = document.getElementById(id);
  if (!el) return null;

  const saved = {
    transform: el.style.transform,
    marginBottom: el.style.marginBottom,
    opacity: el.style.opacity,
    left: el.style.left,
    top: el.style.top,
    zIndex: el.style.zIndex,
  };
  el.style.transform = 'none';
  el.style.marginBottom = '0px';
  el.style.opacity = '1';
  el.style.left = '0px';
  el.style.top = '0px';
  el.style.zIndex = '1';

  try {
    return await html2canvas(el, {
      scale: 2, // 2× for crisp presentation-quality output
      useCORS: true,
      logging: false,
      backgroundColor: null,
      width: SLIDE_W,
      height: SLIDE_H,
      windowWidth: SLIDE_W,
      windowHeight: SLIDE_H,
      onclone: resolveColorMixForHtml2Canvas,
    });
  } finally {
    Object.assign(el.style, saved);
  }
}

function sanitize(title: string): string {
  return title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'presentation';
}

/**
 * Build a PPTX from the deck's data model, one native (fully editable) slide
 * per template - real text boxes, shapes, and tables via pptxgenjs, not a
 * flattened screenshot. Only genuine raster content (photos, logos, maps) is
/**
 * Generate a PPTX ArrayBuffer for a deck client-side.
 */
export async function exportPptxBuffer(
  slides: SlideInstance[],
  logoUrl: string | undefined,
  logoScale = 1,
  theme: DeckTheme = WOZKU_THEME
): Promise<{ buffer: ArrayBuffer; report: FontEmbedReport; mediaNotes: string[] } | null> {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';

  const total = slides.length;
  if (total === 0) return null;

  setExportTheme(theme);
  takeMediaNotes();
  try {
    for (let i = 0; i < total; i++) {
      const num = String(i + 1).padStart(2, '0');
      const slide = pptx.addSlide();
      await addNativeSlide(slide, slides[i], num, logoUrl, `${i + 1} / ${total}`, logoScale);
    }
  } finally {
    clearExportTheme();
  }
  const mediaNotes = takeMediaNotes();

  const rawBuffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  let finalBuffer = rawBuffer;
  let report: FontEmbedReport = { embedded: [], named: [], approximate: [] };
  try {
    // Every family the deck actually names, not just the theme's three: a slot
    // switched to a Google Font needs its outlines in the file too, or PowerPoint
    // substitutes exactly the face someone deliberately chose.
    const families = familiesInDeck({ generated: false, slides }, theme);
    const embedded = await embedPptxFonts(rawBuffer, families);
    finalBuffer = embedded.buffer;
    report = embedded.report;
  } catch (err) {
    console.error('Font embedding failed, exporting without embedded fonts:', err);
  }
  return { buffer: finalBuffer, report, mediaNotes };
}

/**
 * Build a PPTX from the deck's data model, one native (fully editable) slide
 * per template - real text boxes, shapes, and tables via pptxgenjs, not a
 * flattened screenshot. Only genuine raster content (photos, logos, maps) is
 * placed as an image. Runs entirely client-side (no server needed).
 */
export async function exportToPPTX(
  slides: SlideInstance[],
  deckTitle: string,
  logoUrl: string | undefined,
  onProgress?: (current: number, total: number) => void,
  logoScale = 1,
  theme: DeckTheme = WOZKU_THEME
) {
  onProgress?.(0, slides.length);
  const built = await exportPptxBuffer(slides, logoUrl, logoScale, theme);
  if (!built) return;
  onProgress?.(slides.length, slides.length);

  const blob = new Blob([built.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitize(deckTitle)}.pptx`;
  a.click();
  URL.revokeObjectURL(url);
  // Handed back so the caller can say which typefaces travelled and which will be
  // substituted. Silence here is what let the old body-face bug live for months.
  return { ...built.report, mediaNotes: built.mediaNotes };
}

/**
 * Build a PDF client-side: capture each slide and place it full-bleed on a
 * 1920×1080 landscape page. No server required - works with just `npm run dev`.
 */
export async function exportToPDF(
  slideIds: string[],
  title: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const total = slideIds.length;
  if (total === 0) return;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [SLIDE_W, SLIDE_H] });

  let placed = 0;
  for (let i = 0; i < total; i++) {
    onProgress?.(i, total);
    const canvas = await captureSlide(slideIds[i]);
    if (!canvas) continue;
    if (placed > 0) pdf.addPage([SLIDE_W, SLIDE_H], 'landscape');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, SLIDE_W, SLIDE_H);
    placed++;
  }

  onProgress?.(total, total);
  if (placed > 0) pdf.save(`${sanitize(title)}.pdf`);
}

/**
 * Capture each slide as a PNG and bundle them into a single downloadable zip.
 */
export async function exportSlidesAsPngZip(
  slideIds: string[],
  title: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const total = slideIds.length;
  if (total === 0) return;

  const zip = new JSZip();
  let placed = 0;
  for (let i = 0; i < total; i++) {
    onProgress?.(i, total);
    const canvas = await captureSlide(slideIds[i]);
    if (!canvas) continue;
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, base64, { base64: true });
    placed++;
  }

  onProgress?.(total, total);
  if (placed === 0) return;

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitize(title)}-slides.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build a standalone interactive HTML presentation by capturing each slide as
 * a high-resolution image (same as PDF/PNG export) and embedding them as base64
 * data URLs. This guarantees the output looks identical to the live editor -
 * every asset, placeholder, overlay, and layout quirk is captured pixel-for-pixel.
 */
export async function exportToHTML(
  slides: SlideInstance[],
  title: string,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const total = slides.length;
  if (total === 0) return [];

  const images: string[] = [];
  // Videos ride along as live elements over each slide image: the capture is a
  // flat JPEG, so a clip has to be layered back on at its own coordinates.
  const videos: HtmlVideoPlacement[][] = [];
  const notes: string[] = [];
  for (let i = 0; i < total; i++) {
    onProgress?.(i, total);
    const canvas = await captureSlide(slides[i].instanceId);
    if (canvas) {
      images.push(canvas.toDataURL('image/jpeg', 0.92));
      videos.push(await htmlVideoPlacements(slides[i], notes));
    }
  }
  onProgress?.(total, total);

  if (images.length === 0) return notes;

  const totalPad = String(images.length).padStart(2, '0');
  const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const htmlStr = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - Wozku Presentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #090a0f; }
    body { display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; }
    #stage { position: relative; width: 100vw; height: 100vh; }
    #slide-img {
      max-width: 100vw;
      max-height: 100vh;
      width: 100vw;
      height: 100vh;
      object-fit: contain;
      display: block;
      user-select: none;
      -webkit-user-drag: none;
    }
    /* Tracks the letterboxed image rather than the viewport, so a clip stays
       registered to the slide at any window aspect. */
    #video-layer { position: absolute; pointer-events: none; }
    #video-layer > div { position: absolute; pointer-events: auto; }
    #video-layer video, #video-layer iframe { width: 100%; height: 100%; border: 0; display: block; background: #000; }
    .footer-bar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 30px;
      padding: 8px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 100;
      transition: opacity 0.3s;
    }
    .footer-bar.hidden { opacity: 0; pointer-events: none; }
    .btn {
      background: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      transition: background 0.15s;
    }
    .btn:hover { background: rgba(255,255,255,0.15); }
    .counter {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 600;
      color: rgba(255,255,255,0.7);
      min-width: 60px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="stage">
    <img id="slide-img" alt="Slide" />
    <div id="video-layer"></div>
  </div>

  <div class="footer-bar" id="footer">
    <button class="btn" id="prev-btn" title="Previous (←)">&#10094;</button>
    <span class="counter" id="counter-text">01 / ${totalPad}</span>
    <button class="btn" id="next-btn" title="Next (→)">&#10095;</button>
    <button class="btn" id="full-btn" title="Fullscreen (F)">&#x26F6;</button>
  </div>

  <script>
    var images = ${JSON.stringify(images)};
    var videos = ${JSON.stringify(videos)};
    var currentIdx = 0;
    var total = images.length;
    var img = document.getElementById('slide-img');
    var counter = document.getElementById('counter-text');
    var footer = document.getElementById('footer');
    var idleTimer;

    function pad(n) { return String(n).padStart(2, '0'); }

    var layer = document.getElementById('video-layer');

    /* The image is object-fit: contain, so its drawn box is not the viewport. */
    function placeLayer() {
      var rect = img.getBoundingClientRect();
      var natural = 1920 / 1080;
      var boxW = rect.width, boxH = rect.height;
      var drawnW = boxW / boxH > natural ? boxH * natural : boxW;
      var drawnH = boxW / boxH > natural ? boxH : boxW / natural;
      layer.style.left = (rect.left + (boxW - drawnW) / 2) + 'px';
      layer.style.top = (rect.top + (boxH - drawnH) / 2) + 'px';
      layer.style.width = drawnW + 'px';
      layer.style.height = drawnH + 'px';
      Array.prototype.forEach.call(layer.children, function (el) {
        el.style.left = (el.dataset.x * drawnW) + 'px';
        el.style.top = (el.dataset.y * drawnH) + 'px';
        el.style.width = (el.dataset.w * drawnW) + 'px';
        el.style.height = (el.dataset.h * drawnH) + 'px';
      });
    }

    function renderVideos() {
      layer.innerHTML = '';
      (videos[currentIdx] || []).forEach(function (v) {
        var holder = document.createElement('div');
        holder.dataset.x = v.x; holder.dataset.y = v.y;
        holder.dataset.w = v.w; holder.dataset.h = v.h;
        if (v.embed) {
          var frame = document.createElement('iframe');
          frame.src = v.embed;
          frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
          frame.allowFullscreen = true;
          holder.appendChild(frame);
        } else {
          var vid = document.createElement('video');
          vid.src = v.src;
          if (v.poster) vid.poster = v.poster;
          vid.controls = true;
          vid.playsInline = true;
          if (v.autoplay) vid.autoplay = true;
          if (v.loop) vid.loop = true;
          if (v.muted || v.autoplay) vid.muted = true;
          holder.appendChild(vid);
        }
        layer.appendChild(holder);
      });
      placeLayer();
    }

    function show() {
      img.src = images[currentIdx];
      counter.textContent = pad(currentIdx + 1) + ' / ' + pad(total);
      renderVideos();
    }

    function go(delta) {
      currentIdx = Math.max(0, Math.min(total - 1, currentIdx + delta));
      show();
    }

    function resetIdle() {
      footer.classList.remove('hidden');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function() { footer.classList.add('hidden'); }, 3000);
    }

    show();
    resetIdle();

    document.getElementById('prev-btn').onclick = function() { go(-1); resetIdle(); };
    document.getElementById('next-btn').onclick = function() { go(1); resetIdle(); };
    document.getElementById('full-btn').onclick = function() {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    };

    img.addEventListener('load', placeLayer);
    window.addEventListener('resize', placeLayer);
    document.addEventListener('fullscreenchange', placeLayer);

    document.addEventListener('mousemove', resetIdle);

    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { go(1); resetIdle(); }
      if (e.key === 'ArrowLeft') { go(-1); resetIdle(); }
      if (e.key === 'f' || e.key === 'F') document.getElementById('full-btn').click();
      if (e.key === 'Escape' && document.fullscreenElement) document.exitFullscreen();
    });

    // Click left/right halves of the image to navigate
    img.addEventListener('click', function(e) {
      var rect = img.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) go(-1);
      else go(1);
      resetIdle();
    });
  </script>
</body>
</html>`;

  const blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitize(title)}.html`;
  a.click();
  URL.revokeObjectURL(url);
  return notes;
}

/** One video positioned in slide fractions, so the viewer can place it over the letterboxed image. */
interface HtmlVideoPlacement {
  x: number; y: number; w: number; h: number;
  /** Set for YouTube/Vimeo - the viewer builds an iframe. */
  embed?: string;
  /** Set for a file - inlined data URL, or a direct link. */
  src?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

/** A single .html file has nowhere to put a sidecar, so an uploaded clip has to be inlined. */
const HTML_INLINE_LIMIT_BYTES = 64 * 1024 * 1024;

async function htmlVideoPlacements(slide: SlideInstance, notes: string[]): Promise<HtmlVideoPlacement[]> {
  const out: HtmlVideoPlacement[] = [];
  for (const shape of slide.content.overlay ?? []) {
    if (shape.kind !== 'video') continue;
    const at = { x: shape.x / 1920, y: shape.y / 1080, w: shape.w / 1920, h: shape.h / 1080 };
    const flags = { autoplay: shape.autoplay, loop: shape.loop, muted: shape.muted };
    const src = parseVideoSource(shape.videoUrl);

    if (src && src.kind !== 'file') {
      out.push({ ...at, ...flags, embed: embedWithOptions(src, flags) });
      continue;
    }
    if (src?.kind === 'file') {
      out.push({ ...at, ...flags, src: src.embedUrl, poster: shape.posterUrl });
      continue;
    }
    if (!shape.videoAssetId) continue;

    const asset = await getVideo(shape.videoAssetId);
    if (!asset) {
      notes.push(`“${shape.videoName ?? 'A video'}” is not stored in this browser, so the HTML file has only its poster frame.`);
      continue;
    }
    if (asset.size > HTML_INLINE_LIMIT_BYTES) {
      notes.push(
        `“${asset.name}” is ${(asset.size / (1024 * 1024)).toFixed(0)}MB, too large to inline into a single HTML file - the slide shows its poster frame instead.`
      );
      continue;
    }
    out.push({ ...at, ...flags, src: await blobToDataUrl(asset.blob), poster: shape.posterUrl });
  }
  return out;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error('read failed'));
    r.readAsDataURL(blob);
  });
}

/**
 * Copy the current URL to clipboard.
 */
export async function copyShareLink(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch (err) {
    console.error('Failed to copy link:', err);
    return false;
  }
}
