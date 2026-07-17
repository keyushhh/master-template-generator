export const deckTypes = [
  'ROI Report',
  'Event Report',
  'Case Study',
  'Pitch Deck',
  'Proposal',
  'Executive Summary',
] as const;

export type DeckType = (typeof deckTypes)[number];

export type ProjectStatus = 'draft' | 'ready' | 'exported';

export interface ProjectDraft {
  name: string;
  client: string;
  deckType: DeckType | '';
  description: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  client: string;
  deckType: DeckType;
  status: ProjectStatus;
  createdAt: string;
  lastModified: string;
  description: string;
}
