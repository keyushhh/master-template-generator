import { motion } from 'framer-motion';

export function ProjectsEmptyState({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <motion.section
      className="flex min-h-80 flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border-strong bg-surface-panel p-8 text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
    >
      <div className="grid size-11 place-items-center rounded-[var(--radius-lg)] bg-action-primary-subtle font-display text-lg font-semibold text-action-primary">
        +
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold tracking-tight text-content-primary">Create your first project</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-content-secondary">
        Projects will bring together the business record, presentations, assets, and exports for each client engagement.
      </p>
      <button className="mt-5 rounded-[var(--radius-md)] bg-action-primary px-4 py-2.5 text-sm font-semibold text-content-inverse shadow-[var(--shadow-xs)] transition-opacity hover:opacity-90" type="button" onClick={onCreateProject}>
        New Project
      </button>
    </motion.section>
  );
}
