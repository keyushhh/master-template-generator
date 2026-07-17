import type { ProjectSummary } from './types';

export const mockProjects: ProjectSummary[] = [
  {
    id: 'autodesk-india-event-report',
    name: 'India Event Report',
    client: 'Autodesk',
    deckType: 'Event Report',
    status: 'ready',
    createdAt: '2026-07-02T09:00:00+05:30',
    lastModified: '2026-07-16T14:30:00+05:30',
    description: 'A performance readout for the India event calendar and advocacy programme.',
  },
  {
    id: 'nexora-growth-roi',
    name: 'Q2 Advocacy ROI',
    client: 'Nexora',
    deckType: 'ROI Report',
    status: 'draft',
    createdAt: '2026-07-06T11:20:00+05:30',
    lastModified: '2026-07-14T10:15:00+05:30',
    description: 'A working view of campaign outcomes, participation, and earned impact.',
  },
  {
    id: 'atlas-data-centres-proposal',
    name: 'Data Centre Growth Proposal',
    client: 'Atlas Infrastructure',
    deckType: 'Proposal',
    status: 'exported',
    createdAt: '2026-06-21T10:00:00+05:30',
    lastModified: '2026-07-09T16:45:00+05:30',
    description: 'A phased recommendation for advocacy-led demand generation.',
  },
];
