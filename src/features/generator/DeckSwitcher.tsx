import { useEffect, useRef, useState } from 'react';
import type { ProjectMeta } from '../deck/deckStore';

interface DeckSwitcherProps {
  projects: ProjectMeta[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Dropdown for managing multiple saved decks: switch, rename inline, delete
 * (two-step), and start a new one. Sits under the brand logo in the sidebar.
 */
export function DeckSwitcher({ projects, activeId, onSwitch, onNew, onRename, onDelete }: DeckSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = projects.find((p) => p.id === activeId) ?? null;

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Reset transient row state whenever the menu closes.
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setArmedDeleteId(null);
    }
  }, [open]);

  const startRename = (p: ProjectMeta) => {
    setEditingId(p.id);
    setDraftName(p.name);
    setArmedDeleteId(null);
  };
  const commitRename = () => {
    if (editingId) onRename(editingId, draftName);
    setEditingId(null);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 h-[36px] px-3 rounded-[var(--radius-sharp)] border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="0" /><line x1="3" y1="9" x2="21" y2="9" /></svg>
          <span className="truncate text-[13px] font-bold text-neutral-800">{active?.name ?? 'Untitled deck'}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 bg-white border border-neutral-200 rounded-[var(--radius-sharp)] shadow-lg overflow-hidden">
          <div className="max-h-[240px] overflow-y-auto py-1">
            {projects.map((p) => {
              const isActive = p.id === activeId;
              if (editingId === p.id) {
                return (
                  <div key={p.id} className="px-2 py-1.5">
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={commitRename}
                      className="w-full h-[30px] px-2 text-[13px] border border-emerald-300 rounded-[var(--radius-sharp)] outline-none focus:border-emerald-500"
                    />
                  </div>
                );
              }
              return (
                <div
                  key={p.id}
                  className={`group flex items-center gap-1 px-2 py-1.5 ${isActive ? 'bg-emerald-50' : 'hover:bg-neutral-50'}`}
                >
                  <button
                    onClick={() => { onSwitch(p.id); setOpen(false); }}
                    className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                  >
                    <span className="w-3.5 shrink-0">
                      {isActive && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--emerald-600)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </span>
                    <span className={`truncate text-[13px] ${isActive ? 'font-bold text-emerald-700' : 'text-neutral-700'}`}>{p.name}</span>
                  </button>
                  <button
                    onClick={() => startRename(p)}
                    title="Rename"
                    aria-label="Rename deck"
                    className="shrink-0 w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-700 rounded-[var(--radius-sharp)] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                  </button>
                  <button
                    onClick={() => (armedDeleteId === p.id ? onDelete(p.id) : setArmedDeleteId(p.id))}
                    title={armedDeleteId === p.id ? 'Click again to delete' : 'Delete'}
                    aria-label="Delete deck"
                    className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-[var(--radius-sharp)] transition-all cursor-pointer ${
                      armedDeleteId === p.id
                        ? 'text-red-600 bg-red-50 opacity-100'
                        : 'text-neutral-400 hover:text-red-600 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => { onNew(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-neutral-150 text-[13px] font-bold text-neutral-800 hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New deck
          </button>
        </div>
      )}
    </div>
  );
}
