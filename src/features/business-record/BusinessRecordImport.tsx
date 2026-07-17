import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImportService } from './ImportService';
import type { ValidationResult } from './parser/types';

interface MockFile {
  name: string;
  size: number;
  lastModified: string;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export function BusinessRecordImport() {
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [mockFile, setMockFile] = useState<MockFile | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  // Paste Modal States
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const extension = droppedFile.name.split('.').pop()?.toLowerCase();
      
      if (extension === 'md' || extension === 'markdown') {
        setFileObject(droppedFile);
        setMockFile({
          name: droppedFile.name,
          size: droppedFile.size,
          lastModified: new Date(droppedFile.lastModified).toISOString(),
        });
        setValidationResult(null);
      } else {
        alert('Invalid file format. Please drop a .md or .markdown file.');
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFileObject(selectedFile);
      setMockFile({
        name: selectedFile.name,
        size: selectedFile.size,
        lastModified: new Date(selectedFile.lastModified).toISOString(),
      });
      setValidationResult(null);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportClick = () => {
    if (fileObject) {
      setIsValidating(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = (e.target?.result as string) || '';
        const result = await ImportService.importRecord(text, fileObject.name);
        setValidationResult(result);
        setIsValidating(false);
      };
      reader.readAsText(fileObject);
    } else if (pastedText) {
      setIsValidating(true);
      // Run direct validation on pasted content
      ImportService.importRecord(pastedText, 'pasted-record.md').then((result) => {
        setValidationResult(result);
        setIsValidating(false);
      });
    }
  };

  const handlePasteSubmit = () => {
    setIsPasteModalOpen(false);
    setMockFile({
      name: 'pasted-record.md',
      size: new Blob([pastedText]).size,
      lastModified: new Date().toISOString(),
    });
    setFileObject(null);
    setValidationResult(null);
  };

  const handleReplaceFile = () => {
    setFileObject(null);
    setMockFile(null);
    setPastedText('');
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Counting problems
  const errorsCount = validationResult?.errors.filter((e) => e.severity === 'error').length || 0;
  const warningsCount = validationResult?.errors.filter((e) => e.severity === 'warning').length || 0;

  return (
    <div className="mt-8 space-y-8">
      <AnimatePresence mode="wait">
        {!mockFile ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`relative flex min-h-[22rem] flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed p-8 text-center transition-all ${
              isDragging
                ? 'border-action-primary bg-action-primary-subtle/30 shadow-[0_0_0_4px_var(--action-primary-subtle)]'
                : 'border-border-strong bg-surface-panel hover:border-action-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".md,.markdown"
              className="sr-only"
              id="business-record-file-picker"
            />
            
            <div className="grid size-12 place-items-center rounded-[var(--radius-lg)] bg-action-primary-subtle font-display text-xl font-semibold text-action-primary">
              ↓
            </div>

            <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-content-primary">
              Drop your Business Record here
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-content-secondary">
              This document should be generated by Claude using the Master Template schema.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-action-primary px-5 py-2.5 text-sm font-semibold text-content-inverse shadow-[var(--shadow-xs)] transition-all hover:opacity-90 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-primary"
                type="button"
                onClick={handleBrowseClick}
              >
                Browse Files
              </button>
              <button
                className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-5 py-2.5 text-sm font-medium text-content-secondary transition-all hover:bg-surface-subtle hover:text-content-primary active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-primary"
                type="button"
                onClick={() => setIsPasteModalOpen(true)}
              >
                Paste Markdown
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="summary-card"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* File Info Card */}
            <div className="rounded-[var(--radius-xl)] border border-border-default bg-surface-panel p-6 shadow-[var(--shadow-sm)]">
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-action-primary-subtle font-display text-xl font-bold text-action-primary">
                  📄
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="truncate font-display text-lg font-semibold text-content-primary">
                      {mockFile.name}
                    </h3>
                    <span className="inline-flex self-start rounded-[var(--radius-sm)] bg-action-primary-subtle px-2 py-1 text-xs font-semibold text-action-primary">
                      {isValidating ? 'Analyzing...' : validationResult ? (validationResult.isValid ? 'Valid' : 'Issues Found') : 'Ready to Import'}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-content-muted">File Size</dt>
                      <dd className="mt-1 text-sm font-medium text-content-secondary">{formatBytes(mockFile.size)}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-content-muted">Last Modified</dt>
                      <dd className="mt-1 text-sm font-medium text-content-secondary">{formatDate(mockFile.lastModified)}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-content-muted">Source</dt>
                      <dd className="mt-1 text-sm font-medium text-content-secondary">{fileObject ? 'Uploaded file' : 'Pasted Text'}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {!validationResult && !isValidating && (
                <div className="mt-8 flex flex-col justify-end gap-3 border-t border-border-subtle pt-6 sm:flex-row">
                  <button
                    className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-5 py-2.5 text-sm font-medium text-content-secondary transition-all hover:bg-surface-subtle hover:text-content-primary active:scale-95"
                    type="button"
                    onClick={handleReplaceFile}
                  >
                    Replace File
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-action-primary px-5 py-2.5 text-sm font-semibold text-content-inverse shadow-[var(--shadow-xs)] transition-all hover:opacity-90 active:scale-95"
                    type="button"
                    onClick={handleImportClick}
                  >
                    Import Business Record
                  </button>
                </div>
              )}
            </div>

            {/* Loading Analysis State */}
            {isValidating && (
              <div className="flex h-40 flex-col items-center justify-center rounded-[var(--radius-xl)] border border-border-default bg-surface-panel p-6 text-center shadow-[var(--shadow-sm)]">
                <div className="size-8 animate-spin rounded-full border-4 border-action-primary border-t-transparent"></div>
                <p className="mt-4 text-sm font-medium text-content-secondary">Running document analysis & schema check...</p>
              </div>
            )}

            {/* Validation Diagnostic Panel */}
            {validationResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {validationResult.isValid ? (
                  // Success State
                  <div className="rounded-[var(--radius-xl)] border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-[var(--shadow-xs)]">
                    <div className="flex items-start gap-4">
                      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
                        ✓
                      </div>
                      <div className="flex-1">
                        <h4 className="font-display text-lg font-semibold text-emerald-500">
                          Business Record is valid.
                        </h4>
                        <p className="mt-2 text-sm text-content-secondary">
                          The universal envelope validation succeeded. All required metadata values are correctly structured.
                        </p>
                        
                        {validationResult.metadata && (
                          <div className="mt-5 border-t border-emerald-500/10 pt-4">
                            <h5 className="font-mono text-xs uppercase tracking-wider text-content-muted">Parsed Metadata</h5>
                            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              {Object.entries(validationResult.metadata).map(([key, value]) => (
                                <div key={key} className="rounded-[var(--radius-sm)] bg-surface-panel p-3 border border-border-subtle">
                                  <dt className="font-mono text-[10px] uppercase text-content-muted">{key}</dt>
                                  <dd className="mt-1 text-sm font-semibold text-content-primary truncate">{value}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}
                        
                        <div className="mt-6 flex gap-3">
                          <button
                            className="rounded-[var(--radius-md)] bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition-colors"
                            type="button"
                          >
                            Proceed to Presentations
                          </button>
                          <button
                            className="rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-4 py-2 text-sm font-medium text-content-secondary hover:bg-surface-subtle hover:text-content-primary transition-all"
                            type="button"
                            onClick={handleReplaceFile}
                          >
                            Upload Another
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Diagnostics / Problems State
                  <div className="rounded-[var(--radius-xl)] border border-border-default bg-surface-panel shadow-[var(--shadow-md)] overflow-hidden">
                    {/* Header Summary */}
                    <div className="flex items-center justify-between border-b border-border-subtle bg-surface-panel px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-content-secondary">
                          PROBLEMS REPORT — {mockFile.name}
                        </span>
                      </div>
                      <div className="flex gap-3">
                        {errorsCount > 0 && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-500">
                            ✗ {errorsCount} {errorsCount === 1 ? 'Error' : 'Errors'}
                          </span>
                        )}
                        {warningsCount > 0 && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
                            ⚠ {warningsCount} {warningsCount === 1 ? 'Warning' : 'Warnings'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Diagnostic List */}
                    <div className="divide-y divide-border-subtle font-sans">
                      {validationResult.errors.map((err, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-4 p-5 transition-colors ${
                            err.severity === 'error' ? 'hover:bg-red-500/[0.01]' : 'hover:bg-amber-500/[0.01]'
                          }`}
                        >
                          <div
                            className={`mt-0.5 rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                              err.severity === 'error'
                                ? 'bg-red-500/10 text-red-500'
                                : 'bg-amber-500/10 text-amber-500'
                            }`}
                          >
                            {err.severity}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <h5 className="font-display text-sm font-semibold text-content-primary">
                                {err.title}
                              </h5>
                              {err.line !== undefined && (
                                <span className="font-mono text-xs text-content-muted">
                                  on line {err.line}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-content-secondary leading-6">
                              {err.explanation}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col justify-end gap-3 border-t border-border-subtle bg-surface-subtle/50 px-5 py-4 sm:flex-row">
                      <button
                        className="rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-4 py-2 text-sm font-medium text-content-secondary hover:bg-surface-subtle hover:text-content-primary transition-all"
                        type="button"
                        onClick={handleReplaceFile}
                      >
                        Clear Report & Re-upload
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paste Markdown Modal */}
      <AnimatePresence>
        {isPasteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPasteModalOpen(false)}
              className="absolute inset-0 bg-neutral-950/40 backdrop-blur-sm"
            />
            
            {/* Dialog Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative flex h-[32rem] w-full max-w-2xl flex-col rounded-[var(--radius-xl)] border border-border-default bg-surface-panel shadow-[var(--shadow-xl)] overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Paste Business Record"
            >
              <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
                <h3 className="font-display text-lg font-semibold text-content-primary">
                  Paste Business Record
                </h3>
                <button
                  className="rounded-full p-1 text-content-muted hover:bg-surface-subtle hover:text-content-primary transition-colors"
                  onClick={() => setIsPasteModalOpen(false)}
                  type="button"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 p-6">
                <textarea
                  className="h-full w-full resize-none rounded-[var(--radius-md)] border border-border-strong bg-surface-canvas p-4 font-mono text-sm leading-6 text-content-primary placeholder-content-muted focus:border-action-primary focus:outline-none focus:ring-1 focus:ring-action-primary"
                  placeholder={`---\nversion: 1.0\ntype: Pitch Deck\nclient: Acme Corp\ntitle: Corporate Advocacy Report\n---\n\n# Overview\nPaste your markdown body here...`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-border-subtle bg-surface-subtle/50 px-6 py-4">
                <button
                  className="rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-4 py-2 text-sm font-medium text-content-secondary hover:bg-surface-subtle hover:text-content-primary transition-colors"
                  onClick={() => setIsPasteModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-[var(--radius-md)] bg-action-primary px-4 py-2 text-sm font-semibold text-content-inverse shadow-[var(--shadow-xs)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handlePasteSubmit}
                  disabled={!pastedText.trim()}
                  type="button"
                >
                  Load Paste
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="rounded-[var(--radius-xl)] bg-surface-panel border border-border-subtle p-6" aria-labelledby="wf-heading">
        <h3 id="wf-heading" className="font-display text-lg font-semibold tracking-tight text-content-primary">
          What is a Business Record?
        </h3>
        <p className="mt-2 text-sm leading-6 text-content-secondary">
          A Business Record is a structured document that compiles all key insights and factual datasets about your client engagement (e.g., target audiences, financial metrics, case studies, and marketing strategies) in a schema-compliant markdown format.
        </p>
        <ul className="mt-5 space-y-3.5 text-sm text-content-secondary">
          <li className="flex items-start gap-3">
            <span className="mt-1 text-action-primary text-xs">◆</span>
            <span><strong>Single Source of Truth:</strong> Maintains consistent figures and messaging across all downstream slide decks and exports.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 text-action-primary text-xs">◆</span>
            <span><strong>AI-Ready Schema:</strong> Designed to be generated or updated by LLMs (e.g., Claude) using a strict, standardized layout syntax.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 text-action-primary text-xs">◆</span>
            <span><strong>Dynamic Compiler Feed:</strong> Once imported, our compiler automatically maps this record's tables and text fields into responsive presentation components.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
