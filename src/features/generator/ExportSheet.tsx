import { useCallback, useEffect, useRef, useState } from 'react';
import { FitStage } from './FitStage';
import { analyzeCoverage } from '../deck/deckBuilder';
import { useToast } from '../toast/Toast';
import { useFocusTrap } from '../a11y/useFocusTrap';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';
import { ArrowForwardIcon, CheckIcon, CloseIcon, LayersIcon, WarningIcon } from '../ui/icons';
import { WOZKU_THEME, type DeckTheme } from '../theme/deckTheme';

type ExportKind = 'pptx' | 'pdf' | 'png';

interface ExportSheetProps {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  ast: DocumentNode | null;
  /** The deck's own name. The export screen used to derive its heading from the
   *  first slide's content, which meant an untouched deck announced itself as
   *  "Cover" - and, because the same string is the download filename, shipped
   *  the client a file called `cover.pptx`. */
  projectName: string;
  /** Open the slide sorter. */
  onOpenSorter: () => void;
  /** The deck's resolved theme, used for the cover preview and the export. */
  theme?: DeckTheme;
}

const FORMATS: {
  kind: ExportKind;
  tab: string;
  ext: string;
  headline: string;
  detail: string;
  suffix?: string;
}[] = [
  {
    kind: 'pptx',
    tab: 'PowerPoint',
    ext: '.pptx',
    headline: 'Editable slides, not pictures of slides.',
    detail:
      'Every heading, table and shape arrives as a real PowerPoint object your client can edit, with the brand fonts embedded.',
  },
  {
    kind: 'pdf',
    tab: 'PDF',
    ext: '.pdf',
    headline: 'Exactly what you see, permanently.',
    detail:
      'Each slide flattened to a 1920 × 1080 page. Nothing can reflow or substitute a font on someone else’s machine. The safe one to attach to an email.',
  },
  {
    kind: 'png',
    tab: 'Images',
    ext: '.zip',
    suffix: '-slides',
    headline: 'One image per slide, zipped.',
    detail:
      'Captured at 2× for retina screens. For dropping slides into a doc, a proposal, or a social post.',
  },
];

/**
 * Mirrors `sanitize()` in exportHelper so the sheet can show the filename that
 * is about to land in Downloads. Deliberately a copy rather than an import:
 * exportHelper pulls in pptxgenjs, jsPDF and html2canvas (~900kB), and it is
 * lazily imported for exactly that reason - importing one helper from it
 * statically would drag the whole chunk into the initial bundle.
 */
function sanitize(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'presentation';
}

/**
 * Export.
 *
 * Third design of this screen, and the approach is what changed rather than the
 * decoration. The first was a slide grid with export buttons stapled underneath;
 * the second a tidy list of three formats. Both had the same flaw: they were
 * *racks of buttons*, so every format competed for the same click and nothing on
 * screen told you what you were about to send anyone.
 *
 * This is a pick-then-confirm sheet instead:
 *
 *  - **The deck is the subject.** Its cover, its real name, and the facts that
 *    matter - how many slides, how many are excluded - sit at the top. You are
 *    sending an object, and the object is on screen.
 *  - **One choice, then one action.** The three formats are a segmented picker,
 *    not three live triggers. Picking is free, so each format gets room to say
 *    what it is actually for, and there is exactly one primary button to hit.
 *  - **The filename is shown before it exists.** You see `q3_review.pptx` in
 *    the sheet, not after it has appeared in Downloads under a name you didn't
 *    choose.
 *  - **Organize is on the slide count**, where the thought "wait, 15?" happens.
 *    It was a footer link nobody found.
 *
 * Present is intentionally absent: it is a different verb from export, and the
 * header's mode control already carries it one click away.
 */
export function ExportSheet({ open, onClose, deck, ast, projectName, onOpenSorter, theme = WOZKU_THEME }: ExportSheetProps) {
  const { showToast } = useToast();
  const [kind, setKind] = useState<ExportKind>('pptx');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  const visible = deck.slides.filter((s) => !s.hidden);
  const hiddenCount = deck.slides.length - visible.length;
  const cover = visible[0] ?? deck.slides[0];
  const format = FORMATS.find((f) => f.kind === kind) ?? FORMATS[0];
  const filename = `${sanitize(projectName)}${format.suffix ?? ''}${format.ext}`;
  const empty = visible.length === 0;

  // Only walked while the sheet is actually up - it is a full pass over the
  // source document, and this component stays mounted for the whole session.
  const coverage = open && ast ? analyzeCoverage(ast, deck) : null;
  const issues = coverage ? coverage.unmatchedBullets.length + coverage.insightSections.length : 0;

  const run = useCallback(async () => {
    if (busy || empty) return;
    setBusy(true);
    setProgress({ current: 0, total: visible.length });
    try {
      const mod = await import('./exportHelper');
      const ids = visible.map((s) => s.instanceId);
      const onProgress = (current: number, total: number) => setProgress({ current, total });
      if (kind === 'pdf') await mod.exportToPDF(ids, projectName, onProgress);
      else if (kind === 'png') await mod.exportSlidesAsPngZip(ids, projectName, onProgress);
      else await mod.exportToPPTX(visible, projectName, deck.logoUrl, onProgress, deck.logoScale, theme);
    } catch (err) {
      console.error(`${kind} export error:`, err);
      // Report the actual reason. A bare "try again" hides the one piece of
      // information that makes the failure fixable.
      const reason = err instanceof Error ? err.message : String(err);
      showToast(`Export failed: ${reason}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, empty, visible, kind, projectName, deck.logoUrl, deck.logoScale, theme, showToast]);

  useEffect(() => {
    if (!open || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // The sheet has exactly one action, so Enter should be it - unless the
      // focus is already on a button, where Enter means "press that".
      if (e.key === 'Enter' && (e.target as HTMLElement | null)?.tagName !== 'BUTTON') {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose, run]);

  if (!open) return null;

  const pct = progress.total ? (progress.current / progress.total) * 100 : 0;

  return (
    <div
      className="wg-overlay fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={() => !busy && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Export deck"
        className="wg-modal flex flex-col w-full max-w-[560px] max-h-[92vh] overflow-hidden my-auto bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Subject: what you are about to send ───────────────────────────── */}
        <div className="relative flex gap-4 p-5 pb-[18px] border-b border-neutral-150 shrink-0">
          {cover && (
            <div
              className="shrink-0 w-[132px] self-start"
              style={{ boxShadow: '0 0 0 1px var(--neutral-200), 0 4px 14px -6px rgba(15,23,20,0.25)' }}
            >
              <FitStage slide={cover} ast={ast} num="01" logoUrl={deck.logoUrl} theme={theme} />
            </div>
          )}

          <div className="flex flex-col gap-1.5 min-w-0 flex-1 pt-0.5">
            <div className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
              Export deck
            </div>
            <h2 className="text-[19px] font-bold leading-tight text-neutral-900 break-words pr-7">
              {projectName}
            </h2>

            {/* The slide count doubles as the way into the organizer. This is
                where "wait, how many slides?" actually occurs to someone, so
                it is where the answer should be reachable. */}
            <button
              onClick={() => { onClose(); onOpenSorter(); }}
              disabled={busy}
              className="group mt-0.5 self-start flex items-center gap-1.5 -mx-1.5 px-1.5 py-1 rounded-[var(--radius-sharp)] hover:bg-neutral-100 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <LayersIcon size={13} />
              <span className="text-[12.5px] font-semibold text-neutral-700">
                {visible.length} slide{visible.length === 1 ? '' : 's'}
              </span>
              {hiddenCount > 0 && (
                <span className="text-[12.5px] text-neutral-400">· {hiddenCount} excluded</span>
              )}
              <span className="text-neutral-300 group-hover:text-neutral-600 transition-colors flex items-center">
                <ArrowForwardIcon size={12} />
              </span>
            </button>
            <span className="text-[11px] text-neutral-400 pl-[1px]">Organize, reorder or exclude slides</span>
          </div>

          <button
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
          >
            <CloseIcon size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Coverage advisory. Only ever present when something is wrong, and it
              routes to the place you would fix it. A clean deck says nothing:
              a permanent green "all good" banner is just furniture. */}
          {issues > 0 && (
            <div className="flex items-start gap-2.5 px-5 py-3 bg-amber-50 border-b border-amber-200">
              <span className="shrink-0 mt-[1px] text-amber-600">
                <WarningIcon size={14} />
              </span>
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[12.5px] font-bold text-amber-900 leading-snug">
                  {issues} thing{issues === 1 ? '' : 's'} from your source didn’t land on a slide
                </span>
                <ul className="flex flex-col gap-1 text-[11.5px] text-amber-800/90 leading-relaxed list-disc pl-4">
                  {coverage?.unmatchedBullets.slice(0, 3).map((b, i) => (
                    <li key={`u${i}`}>
                      In <span className="font-semibold">{b.section}</span>:{' '}
                      <span className="font-mono text-[10.5px]">{b.text}</span>
                    </li>
                  ))}
                  {coverage?.insightSections.slice(0, 3).map((s, i) => (
                    <li key={`i${i}`}>
                      <span className="font-semibold">{s}</span> wasn’t a recognized section
                    </li>
                  ))}
                  {issues > 3 && <li className="list-none text-amber-700/80">and {issues - 3} more</li>}
                </ul>
                <span className="text-[11px] text-amber-700/80">
                  Exporting is fine. This is only what your source document didn’t map onto a template.
                </span>
              </div>
            </div>
          )}

          {/* ── Format: one choice, explained ───────────────────────────────── */}
          <div className="p-5 pt-4 flex flex-col gap-3">
            <div className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
              Format
            </div>

            <div
              role="radiogroup"
              aria-label="Export format"
              className="grid grid-cols-3 gap-1 p-1 bg-neutral-100"
            >
              {FORMATS.map((f) => {
                const active = f.kind === kind;
                return (
                  <button
                    key={f.kind}
                    role="radio"
                    aria-checked={active}
                    disabled={busy}
                    onClick={() => setKind(f.kind)}
                    className={`flex flex-col items-center justify-center gap-0.5 h-[52px] rounded-[var(--radius-sharp)] transition-all cursor-pointer disabled:cursor-not-allowed ${
                      active ? 'bg-white' : 'hover:bg-white/60'
                    }`}
                    // Emerald rather than black. Selection is a state, and the
                    // brand accent is what the rest of the studio already uses
                    // to mean "this one" (the active rail slide, the sorter's
                    // selected cards). Black is reserved for the action.
                    style={
                      active
                        ? { boxShadow: '0 0 0 1.5px var(--emerald-500)' }
                        : undefined
                    }
                  >
                    <span
                      className={`text-[12.5px] font-bold ${active ? 'text-emerald-700' : 'text-neutral-500'}`}
                    >
                      {f.tab}
                    </span>
                    <span
                      className={`font-mono text-[10px] ${active ? 'text-emerald-600/70' : 'text-neutral-400'}`}
                    >
                      {f.ext}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* What the choice means. Room for this is the whole reason picking
                is separated from firing. */}
            <div className="flex flex-col gap-1 min-h-[64px]">
              <span className="text-[13px] font-bold text-neutral-900">{format.headline}</span>
              <span className="text-[12px] text-neutral-500 leading-relaxed">{format.detail}</span>
            </div>

            {/* The artifact, named before it exists. */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50 border border-neutral-200">
              <span className="shrink-0 text-emerald-600 flex items-center">
                <CheckIcon size={13} />
              </span>
              <span className="font-mono text-[11.5px] text-neutral-700 truncate">{filename}</span>
              <span className="ml-auto shrink-0 text-[10.5px] text-neutral-400 whitespace-nowrap">
                {visible.length} slide{visible.length === 1 ? '' : 's'} · 1920 × 1080
              </span>
            </div>
          </div>
        </div>

        {/* ── One action ────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-neutral-150">
          {/* Progress reads across the full width of the sheet rather than inside
              the button, so it is legible from across the desk. */}
          {busy && (
            <div className="h-[2px] bg-neutral-200">
              <div
                className="h-full bg-emerald-500 transition-[width] duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {/* Only ever says something while there is something to say. A
              standing reassurance that nothing is uploaded answers a question
              nobody in the studio was asking. */}
          {busy && (
            <div className="px-5 pt-2.5 text-[11.5px] text-neutral-500">
              Rendering slide {progress.current} of {progress.total}
            </div>
          )}
          {/* Two buttons at equal width rather than one pinned to the right.
              A lone action floating in the bottom-right corner left the whole
              left half of the footer as dead space, which made the sheet's most
              committing moment read as its least important. An explicit Cancel
              is technically redundant with Esc, the X and the backdrop, but it
              is what balances the row, and a dialog that produces a file should
              name both of its outcomes. */}
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-white">
            <button
              onClick={() => !busy && onClose()}
              disabled={busy}
              className="flex-1 h-[42px] flex items-center justify-center text-[13px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={run}
              disabled={busy || empty}
              className="flex-1 h-[42px] flex items-center justify-center gap-2 text-[13px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              {busy ? 'Exporting…' : empty ? 'No slides to export' : `Export ${format.tab}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
