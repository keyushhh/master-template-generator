import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ProjectForm } from './ProjectForm';
import type { ProjectDraft } from './types';

interface ProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: ProjectDraft) => void;
}

export function ProjectCreationModal({ isOpen, onClose, onCreate }: ProjectCreationModalProps) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-content-primary/30 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.section
            className="w-full max-w-lg rounded-[var(--radius-xl)] border border-border-default bg-surface-panel p-6 shadow-[var(--shadow-xl)] sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-6">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-content-muted">New project</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-content-primary" id="create-project-title">
                Start an engagement
              </h2>
              <p className="mt-2 text-sm leading-6 text-content-secondary">
                Add the essentials now. Business records and presentation work can follow when you are ready.
              </p>
            </div>
            <ProjectForm onCancel={onClose} onSubmit={onCreate} />
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
