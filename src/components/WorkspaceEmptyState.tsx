import { motion } from 'framer-motion';

export function WorkspaceEmptyState() {
  return (
    <motion.section
      className="flex min-h-[32rem] w-full flex-1 flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border-strong bg-surface-panel p-8 text-center shadow-[var(--shadow-xs)]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      aria-labelledby="workspace-empty-title"
    >
      <div className="grid size-12 place-items-center rounded-[var(--radius-lg)] bg-action-primary-subtle text-action-primary">
        <span className="font-display text-xl font-semibold">+</span>
      </div>
      <h2 id="workspace-empty-title" className="mt-5 font-display text-2xl font-semibold tracking-tight text-content-primary">
        Your workspace is ready
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-content-secondary">
        Start from a structured business document when the generation workflow is available.
      </p>
      <p className="mt-5 font-mono text-xs text-content-muted">No presentation generated yet</p>
    </motion.section>
  );
}
