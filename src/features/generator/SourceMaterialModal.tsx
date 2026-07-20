import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { CONVERSION_PROMPT } from '../business-record/conversionPrompt';
import { ImportService } from '../business-record/ImportService';
import { SAMPLE_DECKS } from '../business-record/sampleDecks';
import type { DocumentNode } from '../business-record/parser/ast';
import type { ValidationResult } from '../business-record/parser/types';

interface SourceMaterialModalProps {
  open: boolean;
  onClose: () => void;
  onDocumentParsed: (ast: DocumentNode | null) => void;
  /** Import a source AND build the deck in one step (so Import & Load = Generate). */
  onImport: (ast: DocumentNode) => void;
  /** True when a Business Record is currently loaded - enables "Clear source". */
  hasSource: boolean;
}

type Tab = 'samples' | 'prompt' | 'paste' | 'upload';

const TABS: { id: Tab; label: string }[] = [
  { id: 'samples', label: 'Samples' },
  { id: 'prompt', label: 'Conversion Prompt' },
  { id: 'paste', label: 'Paste .md' },
  { id: 'upload', label: 'Upload .md' },
];

/**
 * Strip a wrapping ```markdown / ``` code fence if pasted text still carries one
 * (the parser requires the document to begin with `---`).
 */
function stripCodeFence(text: string): string {
  let t = text.trim();
  const nl = t.indexOf('\n');
  if (t.startsWith('```') && nl !== -1) {
    t = t.slice(nl + 1);
    if (t.trimEnd().endsWith('```')) t = t.trimEnd().slice(0, -3);
  }
  return t.trim();
}

/**
 * One home for getting content into the generator. Three tabs:
 *  - Conversion Prompt: copy the claude.ai prompt that turns a call transcript into a
 *    Business Record, then jump to Paste.
 *  - Paste .md: drop Claude's markdown straight in - no file needed.
 *  - Upload .md: pick or drag a .md file.
 */
export function SourceMaterialModal({ open, onClose, onDocumentParsed, onImport, hasSource }: SourceMaterialModalProps) {
  const [tab, setTab] = useState<Tab>('prompt');
  const [copied, setCopied] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset transient state each time the modal opens.
  useEffect(() => {
    if (open) {
      setTab('samples');
      setCopied(false);
      setError(null);
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
  const importText = async (text: string, name: string) => {
    setError(null);
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
    const cleaned = stripCodeFence(pasteText);
    if (!cleaned) {
      setError('Paste the Business Record markdown first.');
      return;
    }
    importText(cleaned, 'Pasted Business Record');
  };

  const processFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'md' && ext !== 'markdown') {
      setError('Please choose a .md or .markdown file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => importText((e.target?.result as string) ?? '', file.name);
    reader.onerror = () => setError('Error reading file.');
    reader.readAsText(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFile(e.target.files[0]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-2xl max-h-[86vh] bg-white rounded-[var(--radius-sharp)] shadow-2xl overflow-hidden"
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Segmented tabs */}
        <div className="px-6">
          <div className="flex gap-1 p-1 bg-neutral-100 rounded-[var(--radius-sharp)]">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setError(null); }}
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Source loaded
            </span>
            <button
              onClick={() => { onDocumentParsed(null); setError(null); }}
              className="flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-500 hover:text-red-600 transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              Clear loaded source
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'samples' && (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] text-neutral-600 leading-relaxed">
                Start from a ready-made deck instead of a blank page. Loading one builds the deck immediately — then edit anything.
              </p>
              <div className="flex flex-col gap-2.5">
                {SAMPLE_DECKS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => importText(s.markdown, s.name)}
                    disabled={isValidating}
                    className="text-left flex items-start justify-between gap-4 p-4 border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50 rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex flex-col gap-1 min-w-0">
                      <span className="text-[14px] font-bold text-neutral-900">{s.name}</span>
                      <span className="text-[12px] text-neutral-500 leading-relaxed">{s.description}</span>
                    </span>
                    <span className="shrink-0 mt-0.5 text-neutral-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'prompt' && (
            <div className="flex flex-col gap-3">
              <ol className="flex flex-col gap-1.5 text-[12.5px] text-neutral-600 leading-relaxed list-decimal pl-4">
                <li>Copy this prompt into a <span className="font-semibold text-neutral-900">new</span> chat at <span className="font-semibold text-neutral-900">claude.ai</span>.</li>
                <li>Paste your raw call transcript at the bottom, where it says <span className="font-mono text-[11px] text-neutral-900">TRANSCRIPT:</span></li>
                <li>Claude replies with a code block - hit its <span className="font-semibold text-neutral-900">Copy</span> button, then come back to the <span className="font-semibold text-neutral-900">Paste .md</span> tab.</li>
              </ol>
              <textarea
                id="sm-prompt-text"
                readOnly
                value={CONVERSION_PROMPT}
                className="w-full h-[34vh] resize-none font-mono text-[11.5px] leading-relaxed text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-[var(--radius-sharp)] p-4 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleCopy}
                  className={`h-[40px] px-5 flex items-center gap-2 text-[13px] font-bold text-white rounded-[var(--radius-sharp)] transition-colors cursor-pointer ${
                    copied ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-900 hover:bg-neutral-800'
                  }`}
                >
                  {copied ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  )}
                  {copied ? 'Copied!' : 'Copy Prompt'}
                </button>
                <button
                  onClick={() => { setTab('paste'); setError(null); }}
                  className="h-[40px] px-4 flex items-center gap-1.5 text-[13px] font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
                >
                  I’ve copied it - Paste result
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
              </div>
            </div>
          )}

          {tab === 'paste' && (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] text-neutral-600 leading-relaxed">
                Paste the Business Record markdown Claude gave you. A leading <span className="font-mono text-[11px]">```markdown</span> fence is fine - it’s stripped automatically.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'--- \nversion: 1.0\ntype: business-record\nclient: …'}
                className="w-full h-[34vh] resize-none font-mono text-[11.5px] leading-relaxed text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-[var(--radius-sharp)] p-4 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 placeholder:text-neutral-400"
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
                Already have a Business Record <span className="font-mono text-[11px]">.md</span> file? Drop it here or browse.
              </p>
              <div
                className={`upload-zone rounded-[var(--radius-sharp)] ${isDragging ? ' dragging' : ''}`}
                style={{ minHeight: '30vh' }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept=".md,.markdown" onChange={handleFileChange} />
                <svg className={`w-6 h-6 mb-3 transition-colors ${isDragging ? 'text-indigo-500' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                <div className="text-[13px] font-bold text-neutral-900 mb-1.5">
                  {isValidating ? 'Parsing Document…' : 'Drop or click to upload'}
                </div>
                <div className="text-[11px] font-mono tracking-widest uppercase text-neutral-500">Markdown (.md)</div>
              </div>
            </div>
          )}

          {error && <div className="mt-3 text-[12px] text-red-500 leading-relaxed">{error}</div>}
        </div>
      </div>
    </div>
  );
}
