import html2canvas from 'html2canvas';
import pptxgen from 'pptxgenjs';

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
 * Launch browser printing layout (configured with print media queries for clean slide margins).
 */
export function exportToPDF() {
  window.print();
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
