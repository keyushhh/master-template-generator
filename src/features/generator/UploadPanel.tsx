import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { ImportService } from '../business-record/ImportService';
import type { DocumentNode } from '../business-record/parser/ast';
import type { ValidationResult } from '../business-record/parser/types';

interface UploadPanelProps {
  onDocumentParsed: (ast: DocumentNode | null) => void;
}

export function UploadPanel({ onDocumentParsed }: UploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setFilename(file.name);
    setError(null);
    setIsValidating(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const result: ValidationResult = await ImportService.importRecord(text, file.name);

        if (result.isValid && result.ast) {
          onDocumentParsed(result.ast);
        } else {
          setError(result.errors.length > 0 ? result.errors[0].explanation : 'Invalid document');
          onDocumentParsed(null);
        }
      } catch (err) {
        setError('Error reading file');
        onDocumentParsed(null);
      } finally {
        setIsValidating(false);
      }
    };
    reader.onerror = () => {
      setError('Error reading file');
      setIsValidating(false);
      onDocumentParsed(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const extension = droppedFile.name.split('.').pop()?.toLowerCase();
      
      if (extension === 'md' || extension === 'markdown') {
        processFile(droppedFile);
      } else {
        setError('Invalid file format. Please drop a .md or .markdown file.');
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      processFile(selectedFile);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Upload zone: includes rounded-[var(--radius-sharp)] for consistent, premium appearance */}
      <div 
        className={`upload-zone rounded-[var(--radius-sharp)] ${isDragging ? ' dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".md,.markdown" 
          onChange={handleFileChange} 
        />
        <svg className={`w-5 h-5 mb-3 transition-colors ${isDragging ? 'text-indigo-500' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
        <div className="text-[13px] font-bold text-neutral-900 mb-1.5">
          {isValidating ? 'Parsing Document...' : filename ? filename : 'Upload Document'}
        </div>
        <div className="text-[11px] font-mono tracking-widest uppercase text-neutral-500">
          {filename ? 'Click to replace' : 'Markdown (.md)'}
        </div>
      </div>
      {error && <div className="text-xs text-red-500 mt-1 px-1">{error}</div>}
    </div>
  );
}
