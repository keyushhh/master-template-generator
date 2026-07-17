import { useState } from 'react';
import { ProjectCreationModal } from './ProjectCreationModal';
import { ProjectsEmptyState } from './ProjectsEmptyState';
import { ProjectCard } from './ProjectCard';
import { mockProjects } from './mockProjects';
import { useProjects } from './ProjectsProvider';

export function ProjectsDashboard() {
  const { projects, createProject } = useProjects();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col" aria-labelledby="recent-projects-title">
      <div className="flex flex-col justify-between gap-5 border-b border-border-subtle pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-content-muted">Project dashboard</p>
          <h2 id="recent-projects-title" className="mt-2 font-display text-3xl font-semibold tracking-tight text-content-primary">
            Recent projects
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">
            A shared home for each client engagement and its future presentation work.
          </p>
        </div>
        <button
          className="inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-action-primary px-4 py-2.5 text-sm font-semibold text-content-inverse shadow-[var(--shadow-xs)] transition-opacity hover:opacity-90"
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
        >
          New Project
        </button>
      </div>

      <div className="pt-8">
        {projects.length === 0 ? (
          <ProjectsEmptyState onCreateProject={() => setIsCreateModalOpen(true)} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {projects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </div>
        )}
      </div>
      <ProjectCreationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={createProject}
      />
    </section>
  );
}
