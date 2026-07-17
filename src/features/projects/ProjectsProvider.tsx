import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { mockProjects } from './mockProjects';
import type { ProjectDraft, ProjectSummary } from './types';

interface ProjectsContextValue {
  projects: ProjectSummary[];
  createProject: (draft: ProjectDraft) => void;
  getProject: (projectId: string) => ProjectSummary | undefined;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectSummary[]>(() => mockProjects);

  const value = useMemo<ProjectsContextValue>(() => ({
    projects,
    createProject: (draft) => {
      if (!draft.deckType) return;

      const timestamp = new Date().toISOString();
      const project: ProjectSummary = {
        id: crypto.randomUUID(),
        name: draft.name,
        client: draft.client,
        deckType: draft.deckType,
        status: 'draft',
        createdAt: timestamp,
        lastModified: timestamp,
        description: draft.description || 'No description yet.',
      };

      setProjects((current) => [project, ...current]);
    },
    getProject: (projectId) => projects.find((project) => project.id === projectId),
  }), [projects]);

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectsContext);

  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider.');
  }

  return context;
}
