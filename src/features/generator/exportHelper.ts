import html2canvas from 'html2canvas';
import pptxgen from 'pptxgenjs';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';

/**
 * html2canvas's CSS parser doesn't understand `color-mix()` (or the `color()`
 * function Chrome normalizes it to) and throws while parsing it — whether it
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
 * assigning it to a custom property on a live probe element — `getComputedStyle`
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

  // Stylesheet rules (dark-mode/edit-mode chrome) — rewritten in place so any
  // future rule keeps working even though the slide renderers never use them.
  for (const sheet of Array.from(clonedDoc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet (CDN fonts) — inaccessible, and irrelevant here
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

/**
 * Capture slide DOM elements as high-resolution images and build a PPTX file.
 * Each slide is rendered as a full-bleed background slide inside PPTX.
 */
export async function exportToPPTX(
  slideIds: string[],
  deckTitle: string,
  onProgress?: (current: number, total: number) => void
) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  const total = slideIds.length;
  if (total === 0) return;

  for (let i = 0; i < total; i++) {
    const id = slideIds[i];
    const element = document.getElementById(id);
    if (!element) continue;

    if (onProgress) {
      onProgress(i, total);
    }

    // Capture the slide at 2x resolution for presentation quality
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: null,
      onclone: resolveColorMixForHtml2Canvas,
    });

    const imgData = canvas.toDataURL('image/png');
    const slide = pptx.addSlide();

    // Fill slide canvas (Standard 16:9 aspect ratio sizing in pptxgenjs is 10 x 5.625 inches)
    slide.addImage({
      data: imgData,
      x: 0,
      y: 0,
      w: 10,
      h: 5.625,
    });
  }

  if (onProgress) {
    onProgress(total, total);
  }

  const sanitizedTitle = deckTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'presentation';
  await pptx.writeFile({ fileName: `${sanitizedTitle}.pptx` });
}

/**
 * Generate a true vector PDF via the local headless-Chrome service and trigger
 * a one-click download. The backend loads the app's `/print` route with the
 * deck injected, then prints it through Chrome's own PDF pipeline (real,
 * selectable text — not a raster capture).
 *
 * Requires the PDF server to be running (see `npm run dev:all`). The `/api`
 * path is proxied to it by the Vite dev server.
 */
export async function exportToPDF(
  session: { ast: DocumentNode | null; deck: Deck },
  title: string
): Promise<void> {
  const res = await fetch('/api/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, title }),
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) detail = body.error;
    } catch {
      // Non-JSON error body — keep the status line.
    }
    throw new Error(detail);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const sanitized = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'presentation';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitized}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
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
