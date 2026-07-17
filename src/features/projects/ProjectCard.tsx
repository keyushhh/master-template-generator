import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import type { ProjectSummary } from './types';

interface ProjectCardProps {
  project: ProjectSummary;
  index: number;
}

function formatLastModified(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
    >
      <Link className="group flex min-h-60 flex-col rounded-[var(--radius-xl)] border border-border-default bg-surface-panel p-6 shadow-[var(--shadow-xs)] transition-colors hover:border-action-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-primary" to={`/projects/${project.id}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs uppercase tracking-[0.1em] text-content-muted">{project.client}</p>
            <h3 className="mt-2 font-display text-xl font-semibold tracking-tight text-content-primary">{project.name}</h3>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>

        <p className="mt-5 text-sm leading-6 text-content-secondary">{project.description}</p>

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-border-subtle pt-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-content-muted">Deck type</p>
            <p className="mt-1 text-sm font-medium text-content-primary">{project.deckType}</p>
          </div>
          <time className="shrink-0 text-right font-mono text-xs text-content-muted" dateTime={project.lastModified}>
            {formatLastModified(project.lastModified)}
          </time>
        </div>
      </Link>
    </motion.div>
  );
}
