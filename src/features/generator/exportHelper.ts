import html2canvas from 'html2canvas';
import pptxgen from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { addNativeSlide } from './pptxNative';
import { embedPptxFonts } from './pptxFontEmbed';
import type { SlideInstance } from '../deck/types';

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

// Slides are rendered on-screen scaled-down (transform: scale) and pulled up with
// a negative margin by the canvas's fit engine. Capturing that transformed element
// directly makes html2canvas misplace layers (grid over text, grey strips). So we
// neutralize the transform, capture at native 1920×1080, then restore.
const SLIDE_W = 1920;
const SLIDE_H = 1080;

async function captureSlide(id: string): Promise<HTMLCanvasElement | null> {
  const el = document.getElementById(id);
  if (!el) return null;

  const prevTransform = el.style.transform;
  const prevMargin = el.style.marginBottom;
  el.style.transform = 'none';
  el.style.marginBottom = '0px';

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
    el.style.transform = prevTransform;
    el.style.marginBottom = prevMargin;
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
  onProgress?: (current: number, total: number) => void
) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';

  const total = slides.length;
  if (total === 0) return;

  for (let i = 0; i < total; i++) {
    onProgress?.(i, total);
    const num = String(i + 1).padStart(2, '0');
    const slide = pptx.addSlide();
    await addNativeSlide(slide, slides[i], num, logoUrl, `${i + 1} / ${total}`);
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
