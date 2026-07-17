import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';

export function ProjectOverview() {
  const { projectId } = useParams();

  return (
    <motion.section
      className="mt-8 flex min-h-[24rem] flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border-strong bg-surface-panel p-8 text-center shadow-[var(--shadow-xs)]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      aria-labelledby="business-record-empty-title"
    >
      <div className="grid size-12 place-items-center rounded-[var(--radius-lg)] bg-action-primary-subtle font-display text-xl font-semibold text-action-primary">
        +
      </div>
      <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-content-primary" id="business-record-empty-title">
        No business record has been imported.
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-content-secondary">
        Importing a structured business record will give this project the facts and context used by future presentation work.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-action-primary px-4 py-2.5 text-sm font-semibold text-content-inverse shadow-[var(--shadow-xs)] transition-opacity hover:opacity-90"
          to={`/projects/${projectId}/business-record`}
        >
          Import Business Record
        </Link>
        <button
          className="rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-4 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content-primary"
          type="button"
        >
          Learn about the workflow
        </button>
      </div>
    </motion.section>
  );
}
