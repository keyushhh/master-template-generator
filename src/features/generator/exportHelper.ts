import html2canvas from 'html2canvas';
import pptxgen from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { addNativeSlide, clearExportTheme, setExportTheme } from './pptxNative';
import { embedPptxFonts } from './pptxFontEmbed';
import type { SlideInstance } from '../deck/types';
import { WOZKU_THEME, type DeckTheme } from '../theme/deckTheme';

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
 * placed as an image. Runs entirely client-side (no server needed).
 */
export async function exportToPPTX(
  slides: SlideInstance[],
  deckTitle: string,
  logoUrl: string | undefined,
  onProgress?: (current: number, total: number) => void,
  /** Deck-level logo size multiplier, so a resized logo exports resized. */
  logoScale = 1,
  /** The deck's resolved theme. Absent means Wozku's own, which is what every
   *  deck saved before themes existed resolves to. */
  theme: DeckTheme = WOZKU_THEME
) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';

  const total = slides.length;
  if (total === 0) return;

  // The exporter reads its palette from module state (see pptxNative's note on
  // why), so the deck's theme is installed for the duration of this export and
  // released in `finally` - otherwise a throw part-way through would leave one
  // client's colours applied to whatever gets exported next.
  setExportTheme(theme);
  try {
    for (let i = 0; i < total; i++) {
      onProgress?.(i, total);
      const num = String(i + 1).padStart(2, '0');
      const slide = pptx.addSlide();
      await addNativeSlide(slide, slides[i], num, logoUrl, `${i + 1} / ${total}`, logoScale);
    }
  } finally {
    clearExportTheme();
  }

  onProgress?.(total, total);

  const rawBuffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  let finalBuffer = rawBuffer;
  try {
    finalBuffer = await embedPptxFonts(rawBuffer);
  } catch (err) {
    console.error('Font embedding failed, exporting without embedded fonts:', err);
  }

  const blob = new Blob([finalBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitize(deckTitle)}.pptx`;
  a.click();
  URL.revokeObjectURL(url);
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
  slideIds: string[],
  title: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const total = slideIds.length;
  if (total === 0) return;

  const images: string[] = [];
  for (let i = 0; i < total; i++) {
    onProgress?.(i, total);
    const canvas = await captureSlide(slideIds[i]);
    if (canvas) {
      images.push(canvas.toDataURL('image/jpeg', 0.92));
    }
  }
  onProgress?.(total, total);

  if (images.length === 0) return;

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
  <img id="slide-img" alt="Slide" />

  <div class="footer-bar" id="footer">
    <button class="btn" id="prev-btn" title="Previous (←)">&#10094;</button>
    <span class="counter" id="counter-text">01 / ${totalPad}</span>
    <button class="btn" id="next-btn" title="Next (→)">&#10095;</button>
    <button class="btn" id="full-btn" title="Fullscreen (F)">&#x26F6;</button>
  </div>

  <script>
    var images = ${JSON.stringify(images)};
    var currentIdx = 0;
    var total = images.length;
    var img = document.getElementById('slide-img');
    var counter = document.getElementById('counter-text');
    var footer = document.getElementById('footer');
    var idleTimer;

    function pad(n) { return String(n).padStart(2, '0'); }

    function show() {
      img.src = images[currentIdx];
      counter.textContent = pad(currentIdx + 1) + ' / ' + pad(total);
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
