import JSZip from 'jszip';
import { listProjects, loadProjectSession } from '../deck/deckStore';
import { exportPptxBuffer } from '../generator/exportHelper';
import { themeById, WOZKU_THEME } from '../theme/deckTheme';

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'deck';
}

/**
 * Export all presentation decks inside a folder as a single ZIP archive containing
 * editable PowerPoint (.pptx) files for each deck.
 */
export async function exportFolderToZip(
  folderId: string,
  folderName: string,
  onProgress?: (currentDeckIndex: number, totalDecks: number, currentDeckName: string) => void
): Promise<boolean> {
  const allDecks = listProjects().filter((p) => p.folderId === folderId);
  if (allDecks.length === 0) return false;

  const zip = new JSZip();
  let count = 0;

  for (let i = 0; i < allDecks.length; i++) {
    const meta = allDecks[i];
    onProgress?.(i + 1, allDecks.length, meta.name);
    const session = loadProjectSession(meta.id);
    if (!session || !session.deck || !session.deck.slides?.length) continue;

    const visibleSlides = session.deck.slides.filter((s) => !s.hidden);
    if (visibleSlides.length === 0) continue;

    const theme = session.deck.themeId ? (themeById(session.deck.themeId) ?? WOZKU_THEME) : WOZKU_THEME;

    try {
      const built = await exportPptxBuffer(
        visibleSlides,
        session.deck.logoUrl,
        session.deck.logoScale ?? 1,
        theme
      );
      if (built) {
        const filename = `${sanitize(meta.name)}.pptx`;
        zip.file(filename, built.buffer);
        count++;
      }
    } catch (err) {
      console.error(`Failed to export deck "${meta.name}" into folder zip:`, err);
    }
  }

  if (count === 0) return false;

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitize(folderName || 'folder')}_decks.zip`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
