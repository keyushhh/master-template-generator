import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { CloseIcon } from '../ui/icons';
import { MacFolderIcon } from './MacFolderIcon';
import type { FolderColor, FolderMeta } from './deckStore';

const COLOR_OPTIONS: { id: FolderColor; name: string; bg: string }[] = [
  { id: 'orange', name: 'Orange', bg: '#f97316' },
  { id: 'amber', name: 'Amber', bg: '#f59e0b' },
  { id: 'purple', name: 'Purple', bg: '#a855f7' },
  { id: 'blue', name: 'Blue', bg: '#3b82f6' },
  { id: 'emerald', name: 'Emerald', bg: '#10b981' },
  { id: 'rose', name: 'Rose', bg: '#f43f5e' },
  { id: 'indigo', name: 'Indigo', bg: '#6366f1' },
  { id: 'slate', name: 'Slate', bg: '#64748b' },
];

interface FolderModalProps {
  open: boolean;
  onClose: () => void;
  folderToEdit?: FolderMeta | null;
  onSave: (name: string, color: FolderColor) => void;
}

export function FolderModal({ open, onClose, folderToEdit, onSave }: FolderModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<FolderColor>('orange');
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (open) {
      setName(folderToEdit?.name ?? '');
      setColor(folderToEdit?.color ?? 'orange');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, folderToEdit]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    onSave(clean, color);
    onClose();
  };

  return (
    <div
      className="wg-overlay fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label={folderToEdit ? 'Edit Folder' : 'New Folder'}
        className="wg-modal flex flex-col w-full max-w-[440px] overflow-hidden my-auto bg-white rounded-[var(--radius-sharp)] shadow-2xl border border-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-neutral-150">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase text-neutral-400">
              {folderToEdit ? 'Edit Folder' : 'New Folder'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
          >
            <CloseIcon size={15} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col items-center gap-6">
          {/* Live 3D Folder Preview */}
          <div className="pt-16 pb-2">
            <MacFolderIcon color={color} size="lg" />
          </div>

          {/* Name Field */}
          <div className="w-full flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-neutral-700">Folder Name</label>
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. Client Pitches, Filming, Q3 Reviews"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 focus:bg-white focus:border-emerald-500 rounded-[var(--radius-sharp)] text-[14px] text-neutral-900 outline-none transition-all"
            />
          </div>

          {/* Color Selector */}
          <div className="w-full flex flex-col gap-2">
            <label className="text-[12px] font-bold text-neutral-700">Folder Color</label>
            <div className="flex items-center justify-between gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-[var(--radius-sharp)]">
              {COLOR_OPTIONS.map((c) => {
                const active = c.id === color;
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => setColor(c.id)}
                    className={`w-6 h-6 rounded-none transition-all cursor-pointer ${
                      active
                        ? 'ring-2 ring-emerald-500 ring-offset-1 z-10 scale-105'
                        : 'opacity-80 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.bg }}
                  />
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="w-full flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 text-[13px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 h-11 text-[13px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 rounded-[var(--radius-sharp)] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {folderToEdit ? 'Save Changes' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
