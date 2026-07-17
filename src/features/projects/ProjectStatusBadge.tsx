import type { ProjectStatus } from './types';

const statusStyles: Record<ProjectStatus, string> = {
  draft: 'border-border-default bg-surface-subtle text-content-secondary',
  ready: 'border-action-primary-subtle bg-action-primary-subtle text-action-primary',
  exported: 'border-border-default bg-surface-panel text-content-muted',
};

const statusLabels: Record<ProjectStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  exported: 'Exported',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-xs font-medium uppercase tracking-[0.08em] ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
