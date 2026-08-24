import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { CONVERSION_PROMPT } from '../business-record/conversionPrompt';
import { ImportService } from '../business-record/ImportService';
import { useFocusTrap } from '../a11y/useFocusTrap';
import type { DocumentNode } from '../business-record/parser/ast';
import type { ValidationResult } from '../business-record/parser/types';
import { buildDeckFromImport } from '../pptx-import/pptxDeckBuilder';
import type { DeckTheme } from '../theme/deckTheme';
import type { Deck } from '../deck/types';
import { MarkdownCodeEditor } from './MarkdownCodeEditor';
import { ArrowForwardIcon, CheckIcon, CloseIcon, CloudUploadIcon, CopyIcon, TrashIcon } from '../ui/icons';

interface SourceMaterialModalProps {
  open: boolean;
  onClose: () => void;
  onDocumentParsed: (ast: DocumentNode | null) => void;
  /** Import a source AND build the deck in one step (so Import & Load = Generate). */
  onImport: (ast: DocumentNode) => void;
  /** Load a deck built from an uploaded .pptx, bypassing the Business Record
   *  path entirely - an imported deck has no AST behind it. */
  onImportDeck: (deck: Deck, name: string, warnings: string[], relit?: boolean) => void;
  /** The template being imported on top of, so the deck keeps its brand. */
  deckTheme: DeckTheme;
  presentationTemplateId?: string;
  /** True when a Business Record is currently loaded - enables "Clear source". */
  hasSource: boolean;
}

type Tab = 'prompt' | 'paste' | 'upload';

const TABS: { id: Tab; label: string }[] = [
  { id: 'prompt', label: 'Conversion Prompt' },
  { id: 'paste', label: 'Paste .md' },
  { id: 'upload', label: 'Upload' },
];

/**
 * Everything the one upload zone takes. There is no format to choose first: a
 * file already says what it is, and asking the user to set a picker to match
 * the file they are about to drop is a question with a knowable answer.
 */
const UPLOAD_ACCEPT = '.md,.markdown,.txt,.pptx,.pdf';

/**
 * Strip a wrapping ```markdown / ``` code fence if pasted text still carries one
 * (the parser requires the document to begin with `---`). Also drops a leading
 * UTF-8 BOM, which `.trim()` does not remove and which Slack downloads and
 * Windows editors commonly leave on saved .md files.
 */
function stripCodeFence(text: string): string {
  let t = text.replace(/^\uFEFF/, '').trim();
  const nl = t.indexOf('\n');
  if (t.startsWith('```') && nl !== -1) {
    t = t.slice(nl + 1);
    if (t.trimEnd().endsWith('```')) t = t.trimEnd().slice(0, -3);
  }
  return t.trim();
}

/**
 * A plain markdown outline (headings, bullets, tables, no YAML frontmatter)
 * is a different shape from a Business Record, not a raw transcript. If the
 * text has at least one heading, synthesize the frontmatter the parser
 * requires and clean up markdown the lexer can't tokenize: stand-alone `---`
 * rules used as visual separators between slides, and tables/blockquotes
 * (both come through as unrenderable "unsupported" blocks otherwise).
 */
function synthesizeBusinessRecord(text: string, filename: string): string {
  const h1 = text.match(/^#\s+(.+)$/m)?.[1].trim();
  const label = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';
  const title = h1 || label;

  const body = text
    .split('\n')
    .filter((line) => line.trim() !== '---')
    .join('\n')
    .replace(/^>\s?/gm, '')
    .replace(/^\|(.+)\|\s*$/gm, (row, cellsRaw: string) => {
      const cells = cellsRaw.split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{1,}:?$/.test(c))) return '';
      return `- ${cells.join(' | ')}`;
    });

  return `---\nversion: 1.0\ntype: business-record\nclient: ${label}\ntitle: ${title}\n---\n\n${body}`;
}

/**
 * One home for getting content into the generator. Three tabs:
 *  - Conversion Prompt: copy the claude.ai prompt that turns a call transcript into a
 *    Business Record, then jump to Paste.
 *  - Paste .md: drop Claude's markdown straight in - no file needed.
 *  - Upload: one zone for every format, routed by the file's own extension.
 */
export function SourceMaterialModal({ open, onClose, onDocumentParsed, onImport, onImportDeck, hasSource, deckTheme, presentationTemplateId }: SourceMaterialModalProps) {
  const [tab, setTab] = useState<Tab>('prompt');
  const [copied, setCopied] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rawTranscriptHint, setRawTranscriptHint] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** What the zone says while it works, set from the file that arrived. */
  const [busyLabel, setBusyLabel] = useState('Reading file…');
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  // Reset transient state each time the modal opens.
  useEffect(() => {
    if (open) {
      setTab('prompt');
      setCopied(false);
      setError(null);
      setRawTranscriptHint(false);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CONVERSION_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      (document.getElementById('sm-prompt-text') as HTMLTextAreaElement | null)?.select();
    }
  };

  /** Shared import path for both paste and file. On success, hand up the AST and close. */
  const importText = async (rawText: string, name: string) => {
    setError(null);
    setRawTranscriptHint(false);
    // Uploaded/pasted content may still carry a wrapping ```markdown fence
    // (how claude.ai's copy button and downloaded .md files render a code
    // block) - strip it before checking for the Business Record frontmatter.
    const stripped = stripCodeFence(rawText);
    // A Business Record always opens with a `---` YAML frontmatter fence. A
    // plain outline (headings but no frontmatter) is a shared team doc that
    // never went through the Conversion Prompt - build it directly instead of
    // making everyone paste it through Claude first. Only text with no
    // headings at all - a real raw call transcript - gets the warning below.
    const text = stripped.startsWith('---') || !/^#{1,2}\s/m.test(stripped)
      ? stripped
      : synthesizeBusinessRecord(stripped, name);
    if (!text.startsWith('---')) {
      setRawTranscriptHint(true);
      return;
    }
    setIsValidating(true);
    try {
      const result: ValidationResult = await ImportService.importRecord(text, name);
      if (result.isValid && result.ast) {
        onImport(result.ast); // load source + build deck in one step
        onClose();
      } else {
        setError(result.errors.length > 0 ? result.errors[0].explanation : 'Invalid document');
      }
    } catch {
      setError('Could not read the content.');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePasteImport = () => {
    if (!pasteText.trim()) {
      setError('Paste the Business Record markdown first.');
      return;
    }
    importText(pasteText, 'Pasted Business Record');
  };

  const processFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'docx' || ext === 'doc') {
      setError('Word documents aren’t supported. Export the transcript as plain text, then use the Conversion Prompt tab to turn it into a Business Record.');
      return;
    }
    if (ext !== 'md' && ext !== 'markdown' && ext !== 'txt') {
      setError('Please choose a .md, .markdown, or .txt file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => importText((e.target?.result as string) ?? '', file.name);
    reader.onerror = () => setError('Error reading file.');
    reader.readAsText(file);
  };

  /** Reads an uploaded .pptx, lifts every slide into the deck model, and hands
   *  the finished deck up. Content is never altered - only fill, line and type
   *  are mapped onto the brand palette. */
  const processPptx = async (file: File) => {
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pptx') {
      setError(file.name.toLowerCase().endsWith('.ppt')
        ? 'Legacy .ppt files are not supported. Save it as .pptx in PowerPoint and try again.'
        : 'Please choose a .pptx file.');
      return;
    }
    setIsValidating(true);
    try {
      const { parsePptx } = await import('../pptx-import/pptxParser');
      const { brandMapFor } = await import('../pptx-import/brandMap');
      const { slides, warnings, relit } = await parsePptx(file, brandMapFor(deckTheme, presentationTemplateId));
      const deck = buildDeckFromImport(slides, { themeId: deckTheme.id, presentationTemplateId });
      onImportDeck(deck, file.name.replace(/\.pptx$/i, ''), warnings, relit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This .pptx could not be read.');
    } finally {
      setIsValidating(false);
    }
  };

  /** Reads an uploaded .pdf the same way, page for page. A PDF carries no
   *  structure, so its text is reconstructed from position rather than read. */
  const processPdf = async (file: File) => {
    setError(null);
    setIsValidating(true);
    try {
      const { parsePdf } = await import('../pdf-import/pdfParser');
      const { brandMapFor } = await import('../pptx-import/brandMap');
      const { slides, warnings, relit } = await parsePdf(
        file,
        brandMapFor(deckTheme, presentationTemplateId),
        // A PDF is read a page at a time on the main thread, so a long one needs
        // to be seen counting up rather than sitting on one unchanging word.
        (page, total) => setBusyLabel(`Reading PDF… page ${page} of ${total}`)
      );
      const deck = buildDeckFromImport(slides, { themeId: deckTheme.id, presentationTemplateId });
      onImportDeck(deck, file.name.replace(/\.pdf$/i, ''), warnings, relit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This PDF could not be read.');
    } finally {
      setIsValidating(false);
    }
  };

  /** One entry point for every upload, routed by the file's own extension so a
   *  dropped file lands in the right reader whatever the picker happens to say. */
  const routeFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pptx') { setBusyLabel('Reading presentation…'); return void processPptx(file); }
    if (ext === 'pdf') { setBusyLabel('Reading PDF…'); return void processPdf(file); }
    if (ext === 'ppt') {
      setError('Legacy .ppt files are not supported. Save it as .pptx in PowerPoint and try again.');
      return;
    }
    if (ext === 'key') {
      setError('Keynote files are not supported. Export it as .pptx or .pdf and try again.');
      return;
    }
    setBusyLabel('Parsing document…');
    processFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) routeFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) routeFile(e.target.files[0]);
    // Clear it, or choosing the same file twice in a row fires no change event.
    e.target.value = '';
  };

  return (
    <div
      className="wg-overlay fixed inset-0 z-[200] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="wg-modal flex flex-col w-full max-w-2xl max-h-[86vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="flex flex-col gap-1">
            <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-400">
              Source Material
            </div>
            <h2 className="text-[17px] font-bold text-neutral-900">Bring in your content</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Segmented tabs */}
        <div className="px-6">
          <div className="flex gap-1 p-1 bg-neutral-100 rounded-[var(--radius-sharp)]">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setError(null); setRawTranscriptHint(false); }}
                className={`flex-1 h-[34px] flex items-center justify-center text-center text-[12.5px] font-bold rounded-[var(--radius-sharp)] transition-colors cursor-pointer ${
                  tab === t.id
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loaded-source status + clear (unloads the current source only) */}
        {hasSource && (
          <div className="px-6 pt-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-green-600">
              <CheckIcon size={13} />
              Source loaded
            </span>
            <button
              onClick={() => { onDocumentParsed(null); setError(null); }}
              className="flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-500 hover:text-red-600 transition-colors cursor-pointer"
            >
              <TrashIcon size={12} />
              Clear loaded source
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Above the panel, not below it. This used to sit under a drop zone
              30vh tall, so a failed upload wrote its reason off the bottom of a
              scrolling modal and the upload read as having done nothing at all.
              The paste tab shows the same text inline against the offending
              markdown, so it is not repeated here. */}
          {error && tab !== 'paste' && (
            <div
              role="alert"
              className="mb-4 p-3 text-[12px] text-red-700 bg-red-50 border border-red-200 leading-relaxed rounded-[var(--radius-sharp)]"
            >
              {error}
            </div>
          )}
          {tab === 'prompt' && (
            <div className="flex flex-col gap-3">
              <ol className="flex flex-col gap-1.5 text-[12.5px] text-neutral-600 leading-relaxed list-decimal pl-4">
                <li>Copy this prompt into a <span className="font-semibold text-neutral-900">new</span> chat at <span className="font-semibold text-neutral-900">claude.ai</span>.</li>
                <li>Paste your raw call transcript at the bottom, where it says <span className="font-mono text-[11px] text-neutral-900">TRANSCRIPT:</span></li>
                <li>Claude replies with a code block - hit its <span className="font-semibold text-neutral-900">Copy</span> button, then come back to the <span className="font-semibold text-neutral-900">Paste .md</span> tab.</li>
              </ol>
              <MarkdownCodeEditor
                value={CONVERSION_PROMPT}
                readOnly
                height="34vh"
                ariaLabel="Conversion prompt"
              />
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleCopy}
                  className={`h-[40px] px-5 flex items-center gap-2 text-[13px] font-bold text-white rounded-[var(--radius-sharp)] transition-colors cursor-pointer ${
                    copied ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-900 hover:bg-neutral-800'
                  }`}
                >
                  {copied ? (
                    <CheckIcon size={15} />
                  ) : (
                    <CopyIcon size={15} />
                  )}
                  {copied ? 'Copied!' : 'Copy Prompt'}
                </button>
                <button
                  onClick={() => { setTab('paste'); setError(null); setRawTranscriptHint(false); }}
                  className="h-[40px] px-4 flex items-center gap-1.5 text-[13px] font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
                >
                  I’ve copied it - Paste result
                  <ArrowForwardIcon size={14} />
                </button>
              </div>
            </div>
          )}

          {tab === 'paste' && (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] text-neutral-600 leading-relaxed">
                Paste the Business Record markdown Claude gave you. A leading <span className="font-mono text-[11px]">```markdown</span> fence is fine - it’s stripped automatically.
              </p>
              <MarkdownCodeEditor
                value={pasteText}
                onChange={setPasteText}
                placeholder={'--- \nversion: 1.0\ntype: business-record\nclient: …'}
                error={error}
                height="34vh"
              />
              <button
                onClick={handlePasteImport}
                disabled={isValidating || !pasteText.trim()}
                className="self-start h-[40px] px-5 text-[13px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isValidating ? 'Generating…' : 'Import & Load'}
              </button>
            </div>
          )}

          {tab === 'upload' && (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] text-neutral-600 leading-relaxed">
                Drop in a Business Record, a plain outline with headings, or a deck you already
                have. A <span className="font-mono text-[11px]">.md</span> or <span className="font-mono text-[11px]">.txt</span> file
                builds a deck on your chosen template. A <span className="font-mono text-[11px]">.pptx</span> or <span className="font-mono text-[11px]">.pdf</span> comes
                in slide for slide, keeping your layout and your words, restyled to this deck’s
                theme.
              </p>
              <div
                className={`upload-zone rounded-[var(--radius-sharp)] ${isDragging ? ' dragging' : ''}`}
                style={{ minHeight: '30vh' }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept={UPLOAD_ACCEPT}
                  onChange={handleFileChange}
                />
                <span className={`mb-3 transition-colors ${isDragging ? 'text-emerald-500' : 'text-neutral-400'}`}><CloudUploadIcon size={26} /></span>
                <div className="text-[13px] font-bold text-neutral-900 mb-1.5">
                  {isValidating ? busyLabel : 'Drop or click to upload'}
                </div>
                <div className="text-[11px] font-mono tracking-widest uppercase text-neutral-500">
                  Markdown (.md), text (.txt), presentation (.pptx) or PDF
                </div>
              </div>
            </div>
          )}

          {rawTranscriptHint && (
            <div className="mt-3 p-3 flex flex-col gap-2 bg-amber-50 border border-amber-200 rounded-[var(--radius-sharp)]">
              <p className="text-[12px] text-amber-800 leading-relaxed">
                This has no headings and no <span className="font-mono text-[11px]">---</span> frontmatter - it reads more like a raw transcript. Convert it first with the Conversion Prompt, then paste the result here.
              </p>
              <button
                onClick={() => { setTab('prompt'); setRawTranscriptHint(false); }}
                className="self-start h-[32px] px-3.5 text-[12px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
              >
                Go to Conversion Prompt
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
