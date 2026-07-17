export type ProjectStatus = 'draft' | 'ready' | 'exported';

export interface ProjectSummary {
  id: string;
  name: string;
  client: string;
  deckType: string;
  status: ProjectStatus;
  lastModified: string;
  description: string;
}
