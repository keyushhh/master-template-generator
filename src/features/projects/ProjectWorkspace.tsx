import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import { ProjectWorkspaceSidebar } from './ProjectWorkspaceSidebar';
import { useProjects } from './ProjectsProvider';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function ProjectNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-canvas p-6">
      <section className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-content-muted">Project workspace</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-content-primary">Project not found</h1>
        <p className="mt-3 text-sm leading-6 text-content-secondary">
          This project may have been removed, or the link is no longer valid.
        </p>
        <Link className="mt-6 inline-flex rounded-[var(--radius-md)] bg-action-primary px-4 py-2.5 text-sm font-semibold text-content-inverse shadow-[var(--shadow-xs)] transition-opacity hover:opacity-90" to="/">
          Back to projects
        </Link>
      </section>
    </main>
  );
}

export function ProjectWorkspace() {
  const { projectId } = useParams();
  const { getProject } = useProjects();
  const project = projectId ? getProject(projectId) : undefined;

  if (!project) return <ProjectNotFound />;

  return (
    <div className="min-h-screen bg-surface-canvas text-content-primary md:flex">
      <ProjectWorkspaceSidebar projectName={project.name} />
      <main className="min-w-0 flex-1 p-6 sm:p-8 lg:p-10">
        <div className="mx-auto max-w-6xl">
          <Link className="font-mono text-xs uppercase tracking-[0.12em] text-content-muted transition-colors hover:text-content-primary md:hidden" to="/">
            ← All projects
          </Link>
          <header className="border-b border-border-subtle pb-8">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-content-muted">{project.client}</p>
                <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-content-primary sm:text-4xl">{project.name}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-content-secondary">{project.description}</p>
              </div>
              <ProjectStatusBadge status={project.status} />
            </div>
            <dl className="mt-8 grid gap-5 border-t border-border-subtle pt-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.1em] text-content-muted">Client</dt>
                <dd className="mt-1.5 text-sm font-medium text-content-primary">{project.client}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.1em] text-content-muted">Deck type</dt>
                <dd className="mt-1.5 text-sm font-medium text-content-primary">{project.deckType}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.1em] text-content-muted">Created</dt>
                <dd className="mt-1.5 text-sm font-medium text-content-primary"><time dateTime={project.createdAt}>{formatDate(project.createdAt)}</time></dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.1em] text-content-muted">Last modified</dt>
                <dd className="mt-1.5 text-sm font-medium text-content-primary"><time dateTime={project.lastModified}>{formatDate(project.lastModified)}</time></dd>
              </div>
            </dl>
          </header>

          <motion.section
            className="mt-8 flex min-h-96 flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border-strong bg-surface-panel p-8 text-center shadow-[var(--shadow-xs)]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            aria-labelledby="business-record-empty-title"
          >
            <div className="grid size-12 place-items-center rounded-[var(--radius-lg)] bg-action-primary-subtle font-display text-xl font-semibold text-action-primary">+</div>
            <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-content-primary" id="business-record-empty-title">
              No business record has been imported.
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-content-secondary">
              Importing a structured business record will give this project the facts and context used by future presentation work.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button className="rounded-[var(--radius-md)] bg-action-primary px-4 py-2.5 text-sm font-semibold text-content-inverse shadow-[var(--shadow-xs)] transition-opacity hover:opacity-90" type="button">
                Import Business Record
              </button>
              <button className="rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-4 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content-primary" type="button">
                Learn about the workflow
              </button>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
