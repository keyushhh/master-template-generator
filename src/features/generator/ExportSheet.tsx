import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FitStage } from './FitStage';
import { analyzeCoverage } from '../deck/deckBuilder';
import { useToast } from '../toast/Toast';
import { useFocusTrap } from '../a11y/useFocusTrap';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';
import { AlertIcon, ArrowForwardIcon, CheckIcon, CloseIcon, CopyIcon, LayersIcon, WarningIcon } from '../ui/icons';
import { WOZKU_THEME, type DeckTheme } from '../theme/deckTheme';
import { useFitReport } from '../fit/fitStore';
import { placeholderReport } from '../preflight/placeholders';
import { brandCheckReport } from '../preflight/brandCheck';
import { catalogNow, fontByFamily, isBundled } from '../fonts/fontCatalog';
import { familiesInDeck } from '../fonts/deckFonts';

type ExportKind = 'pptx' | 'pdf' | 'png' | 'html';

interface ExportSheetProps {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  ast: DocumentNode | null;
  projectName: string;
  onOpenSorter: () => void;
  onFitAll?: () => void;
  theme?: DeckTheme;
  isSandbox?: boolean;
  onPromoteToRepository?: () => void;
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
    kind: 'html',
    tab: 'HTML',
    ext: '.html',
    headline: 'Standalone interactive HTML presentation.',
    detail:
      'A self-contained single HTML file with embedded slide transitions, keyboard controls, and theme styling. Uploaded videos are inlined and play offline; a YouTube or Vimeo embed needs a connection.',
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
export function ExportSheet({ open, onClose, deck, ast, projectName, onOpenSorter, onFitAll, theme = WOZKU_THEME, isSandbox, onPromoteToRepository }: ExportSheetProps) {
  const { showToast } = useToast();
  const [kind, setKind] = useState<ExportKind>('pptx');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [customBaseName, setCustomBaseName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  const visible = deck.slides.filter((s) => !s.hidden);
  const hiddenCount = deck.slides.length - visible.length;
  const cover = visible[0] ?? deck.slides[0];
  const format = FORMATS.find((f) => f.kind === kind) ?? FORMATS[0];
  const baseName = customBaseName ?? `${sanitize(projectName)}${format.suffix ?? ''}`;
  const filename = `${baseName}${format.ext}`;
  const empty = visible.length === 0;

  // Focus the name input when editing starts
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  // Reset custom name when sheet closes
  useEffect(() => {
    if (!open) {
      setCustomBaseName(null);
      setEditingName(false);
    }
  }, [open]);

  // Only walked while the sheet is actually up - it is a full pass over the
  // source document, and this component stays mounted for the whole session.
  const coverage = open && ast ? analyzeCoverage(ast, deck) : null;
  const issues = coverage ? coverage.unmatchedBullets.length + coverage.insightSections.length : 0;

  // Slides whose text the layout is cutting off, restricted to the ones actually
  // going out. A clipped slide you have already excluded is not an export
  // problem, and warning about it here would be noise at the worst moment.
  const fit = useFitReport();
  const clipped = visible
    .map((s, i) => ({ n: i + 1, id: s.instanceId, title: s.title }))
    .filter((s) => fit.slideIds.includes(s.id));

  // Placeholder copy is checked here and nowhere else. A deck at the start of
  // its life is entirely placeholder and its author knows it, so a badge on
  // every thumbnail in the rail would be noise that teaches you to ignore the
  // rail. The moment it matters is the moment you are about to send it.
  const unfilled = open ? placeholderReport(visible) : [];

  /** Off-palette colours and contrast, checked against the deck's own theme -
   *  see brandCheck.ts. Same "only at the moment it matters" timing as the
   *  placeholder check above. */
  const brandIssues = open ? brandCheckReport(visible, theme) : [];

  /**
   * Typefaces in this deck that PowerPoint will not have outlines for.
   *
   * Only shown for the PowerPoint format, because it is the only one affected:
   * PDF, HTML and the image export all render from the DOM, so whatever is on the
   * canvas is what lands. Only checked once the catalogue is in memory - it is
   * loaded lazily, and a warning that appears a second after the sheet opens is
   * worse than one that waits for the next open.
   */
  const unembeddable = useMemo(() => {
    if (!open || kind !== 'pptx' || !catalogNow()) return [];
    return familiesInDeck({ generated: false, slides: visible }, theme).filter(
      (f) => !isBundled(f) && !fontByFamily(f)
    );
  }, [open, kind, visible, theme]);

  const run = useCallback(async () => {
    if (busy || empty) return;
    setBusy(true);
    setProgress({ current: 0, total: visible.length });
    try {
      if (kind === 'html') {
        const mod = await import('./exportHelper');
        const onProgress = (current: number, total: number) => setProgress({ current, total });
        const notes = await mod.exportToHTML(visible, projectName, onProgress);
        showToast(`Exported ${filename}`, 'success');
        if (notes.length) showToast(notes.join(' '), 'info');
      } else {
        const mod = await import('./exportHelper');
        const ids = visible.map((s) => s.instanceId);
        const onProgress = (current: number, total: number) => setProgress({ current, total });
        if (kind === 'pdf') await mod.exportToPDF(ids, projectName, onProgress);
        else if (kind === 'png') await mod.exportSlidesAsPngZip(ids, projectName, onProgress);
        else {
          const report = await mod.exportToPPTX(
            visible, projectName, deck.logoUrl, onProgress, deck.logoScale, theme
          );
          // Say what actually travelled. PowerPoint has no font catalogue, so a
          // family we could not fetch outlines for is one it will substitute -
          // and a substitution nobody mentioned is how you find out about it in
          // front of a client. Google Slides resolves these by name regardless,
          // which is why this is a note rather than a failure.
          // Same reasoning for video: a clip that degraded to a still has to be
          // said out loud, not discovered mid-presentation.
          if (report?.mediaNotes.length) showToast(report.mediaNotes.join(' '), 'info');
          if (report?.named.length) {
            showToast(
              `Exported. ${report.named.join(', ')} could not be embedded, so desktop PowerPoint will substitute ${report.named.length === 1 ? 'it' : 'them'}. Google Slides will still show ${report.named.length === 1 ? 'it' : 'them'} correctly.`,
              'info'
            );
          }
        }
      }
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
          {/* Sandbox Notice */}
          {isSandbox && (
            <div className="bg-blue-50 border-b border-blue-200">
              <div className="flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <span className="text-[16px] select-none">🧪</span>
                  <div className="text-[12px] text-blue-950 leading-relaxed">
                    <strong className="font-bold text-blue-900 block">Quick Sandbox Active</strong>
                    This deck is currently hidden from the Team Repository.
                  </div>
                </div>
                {onPromoteToRepository && (
                  <button
                    type="button"
                    onClick={() => {
                      onPromoteToRepository();
                      showToast('Saved to Team Repository!', 'success');
                    }}
                    className="self-start px-3 py-1.5 text-[12px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
                  >
                    Save to Team Repository
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Before you send ───────────────────────────────────────────────
              One pre-flight block with up to three findings, rather than three
              stacked banners. Stacked, they read as unrelated alarms and push
              the format picker off the bottom of the sheet; grouped, they read
              as a checklist, which is what they are. Present only when there is
              something in it: a standing green "all clear" is furniture.

              Nothing here blocks the export. Every one of these is sometimes
              the right thing to ship, and that call belongs to the designer,
              not to a dialog. */}
          {(unfilled.length > 0 || clipped.length > 0 || issues > 0 || unembeddable.length > 0 || brandIssues.length > 0) && (
            <div className="bg-amber-50 border-b border-amber-200">
              <div className="flex items-center gap-2 px-5 pt-2.5 pb-1.5">
                <span className="text-amber-600 flex items-center">
                  <AlertIcon size={12} />
                </span>
                <span className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-amber-800/90">
                  Before you send
                </span>
              </div>

              <div className="flex flex-col divide-y divide-amber-200/70">
                {/* Placeholders first: the one that ends a client relationship.
                    A cover reading "Project Name Placeholder", or a body still
                    saying "Placeholder content for the Wozku Master Template".
                    Nearly-finished slides lead the list, because a slide with
                    one gap left is one somebody missed, while a slide with
                    eight is one they have not written yet. */}
                {unfilled.length > 0 && (
                  <div className="flex flex-col gap-1 px-5 py-2">
                    <span className="text-[12px] font-bold text-amber-900 leading-snug">
                      Placeholder text on {unfilled.length} slide
                      {unfilled.length === 1 ? '' : 's'}
                    </span>
                    <ul className="flex flex-col gap-0.5 text-[11px] text-amber-800/90 leading-snug">
                      {unfilled.slice(0, 4).map((s, idx) => (
                        <li key={s.instanceId} className="truncate">
                          <span className="font-mono text-[10px] font-bold">
                            {String(s.n).padStart(2, '0')}
                          </span>{' '}
                          <span className="font-semibold">{s.title}</span>
                          <span className="text-amber-700/75">
                            {' '}
                            &middot; {s.fields.slice(0, 2).join(', ')}
                            {s.fields.length > 2 ? ` +${s.fields.length - 2}` : ''}
                          </span>
                          {idx === 3 && unfilled.length > 4 && (
                            <span className="text-amber-700/70">{' '}…and {unfilled.length - 4} more</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Clipping. The slots are a fixed size and the exporter is
                    handed the same box, so whatever is cut on the canvas is cut
                    in PowerPoint. This is the last screen where that is still
                    fixable. */}
                {clipped.length > 0 && (
                  <div className="flex flex-col gap-1 px-5 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-bold text-amber-900 leading-snug">
                        Text cut off on {clipped.length} slide
                        {clipped.length === 1 ? '' : 's'}
                      </span>
                      {/* The fix, offered where the problem is named. Reading
                          "six slides are cut off" and then visiting six slides to
                          press the same button six times is not a fix, it is a
                          list of chores. Closes the sheet on purpose: this is an
                          edit, and it should land you in the deck where it
                          happened, with one undo available. */}
                      {onFitAll && (
                        <button
                          onClick={() => { onClose(); onFitAll(); }}
                          disabled={busy}
                          className="ml-auto h-[24px] px-2.5 flex items-center gap-1.5 text-[11px] font-bold text-white bg-amber-700 hover:bg-amber-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Step the type down on every one of these slides until nothing is cut off"
                        >
                          Fit {clipped.length === 1 ? 'it' : 'all'}
                        </button>
                      )}
                    </div>
                    <ul className="flex flex-col gap-0.5 text-[11px] text-amber-800/90 leading-snug">
                      {clipped.slice(0, 3).map((s, idx) => (
                        <li key={s.id} className="truncate">
                          <span className="font-mono text-[10px] font-bold">
                            {String(s.n).padStart(2, '0')}
                          </span>{' '}
                          <span className="font-semibold">{s.title}</span>
                          {idx === 2 && clipped.length > 3 && (
                            <span className="text-amber-700/70">{' '}…and {clipped.length - 3} more</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Fonts. A family with no file behind it is substituted by
                    desktop PowerPoint, which is the one export that carries no
                    font catalogue of its own. Worth saying before you send rather
                    than after, and worth saying precisely: Google Slides resolves
                    these by name, so "broken" would be wrong. */}
                {unembeddable.length > 0 && (
                  <div className="flex flex-col gap-1.5 px-5 py-3">
                    <span className="text-[12.5px] font-bold text-amber-900 leading-snug">
                      {unembeddable.length} typeface{unembeddable.length === 1 ? '' : 's'} can&rsquo;t be
                      embedded
                    </span>
                    <ul className="flex flex-col gap-1 text-[11.5px] text-amber-800/90 leading-relaxed">
                      {unembeddable.slice(0, 4).map((f) => (
                        <li key={f} className="truncate">
                          <span className="font-semibold">{f}</span>
                          <span className="text-amber-700/75"> &middot; not a Google Font</span>
                        </li>
                      ))}
                      {unembeddable.length > 4 && (
                        <li className="text-amber-700/80">and {unembeddable.length - 4} more</li>
                      )}
                    </ul>
                    <span className="text-[11px] text-amber-700/80">
                      Desktop PowerPoint will substitute {unembeddable.length === 1 ? 'it' : 'them'} on a
                      machine without {unembeddable.length === 1 ? 'it' : 'them'} installed. Google Slides
                      and the PDF export are unaffected. Usually an imported deck carrying its original
                      author&rsquo;s fonts.
                    </span>
                  </div>
                )}

                {/* Brand check: colours an editor typed by hand rather than
                    picked from the palette, and text that fails contrast
                    against its own fill. See brandCheck.ts. */}
                {brandIssues.length > 0 && (
                  <div className="flex flex-col gap-1 px-5 py-2">
                    <span className="text-[12px] font-bold text-amber-900 leading-snug">
                      {brandIssues.length} brand check issue{brandIssues.length === 1 ? '' : 's'}
                    </span>
                    <ul className="flex flex-col gap-0.5 text-[11px] text-amber-800/90 leading-snug">
                      {brandIssues.slice(0, 4).map((issue, idx) => (
                        <li key={`${issue.instanceId}-${idx}`} className="truncate">
                          <span className="font-mono text-[10px] font-bold">
                            {String(issue.n).padStart(2, '0')}
                          </span>{' '}
                          <span className="font-semibold">{issue.title}</span>
                          <span className="text-amber-700/75"> &middot; {issue.detail}</span>
                          {idx === 3 && brandIssues.length > 4 && (
                            <span className="text-amber-700/70">{' '}…and {brandIssues.length - 4} more</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Coverage: what the source document had and no template took.
                    Only ever present when a document was imported. */}
                {issues > 0 && (
                  <div className="flex flex-col gap-1 px-5 py-2">
                    <span className="text-[12px] font-bold text-amber-900 leading-snug">
                      {issues} source item{issues === 1 ? '' : 's'} missing from slides
                    </span>
                    <ul className="flex flex-col gap-0.5 text-[11px] text-amber-800/90 leading-snug list-disc pl-4">
                      {coverage?.unmatchedBullets.slice(0, 3).map((b, i) => (
                        <li key={`u${i}`}>
                          In <span className="font-semibold">{b.section}</span>:{' '}
                          <span className="font-mono text-[10px]">{b.text}</span>
                        </li>
                      ))}
                      {coverage?.insightSections.slice(0, 3).map((s, i) => (
                        <li key={`i${i}`}>
                          <span className="font-semibold">{s}</span> wasn&rsquo;t a recognized section
                        </li>
                      ))}
                      {issues > 3 && (
                        <li className="list-none text-amber-700/70">…and {issues - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}
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
              className="grid grid-cols-4 gap-1 p-1 bg-neutral-100"
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

            {/* The artifact, named before it exists. Click to rename. */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50 border border-neutral-200 cursor-pointer hover:border-neutral-300 transition-colors group"
              onClick={() => { if (!editingName) setEditingName(true); }}
              title="Click to rename"
            >
              <span className="shrink-0 text-emerald-600 flex items-center">
                <CheckIcon size={13} />
              </span>
              {editingName ? (
                <span className="flex items-center gap-0 min-w-0 flex-1">
                  <input
                    ref={nameInputRef}
                    type="text"
                    className="font-mono text-[11.5px] text-neutral-700 bg-white border border-emerald-400 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-emerald-400 min-w-0 flex-1"
                    defaultValue={baseName}
                    onBlur={(e) => {
                      const v = e.currentTarget.value.trim();
                      if (v) setCustomBaseName(sanitize(v));
                      setEditingName(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = e.currentTarget.value.trim();
                        if (v) setCustomBaseName(sanitize(v));
                        setEditingName(false);
                      } else if (e.key === 'Escape') {
                        setEditingName(false);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="font-mono text-[11.5px] text-neutral-400 shrink-0">{format.ext}</span>
                </span>
              ) : (
                <span className="font-mono text-[11.5px] text-neutral-700 truncate group-hover:text-emerald-700 transition-colors">
                  {filename}
                </span>
              )}
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
            <div className="px-5 pt-2.5 flex items-center gap-2 text-[11.5px] text-neutral-600 font-medium">
              <svg className="animate-spin h-3.5 w-3.5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Rendering slide <strong className="font-semibold text-neutral-900">{progress.current}</strong> of {progress.total}…</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-white">
            <button
              onClick={() => {
                const link = `${window.location.origin}${window.location.pathname}#/present`;
                void navigator.clipboard.writeText(link);
                showToast('Presentation link copied to clipboard', 'success');
              }}
              disabled={busy}
              className="h-[42px] px-3.5 flex items-center justify-center gap-1.5 text-[12.5px] font-bold text-neutral-800 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:opacity-40"
              title="Copy public presentation view mode link"
            >
              <CopyIcon size={14} />
              Copy Share Link
            </button>
            <button
              onClick={() => !busy && onClose()}
              disabled={busy}
              className="h-[42px] px-4 flex items-center justify-center text-[13px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={run}
              disabled={busy || empty}
              className="flex-1 h-[42px] flex items-center justify-center gap-2 text-[13px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Rendering &amp; Exporting…</span>
                </>
              ) : empty ? (
                'No slides to export'
              ) : (
                `Export ${format.tab}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
