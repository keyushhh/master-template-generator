import { WorkspaceEmptyState } from '../components/WorkspaceEmptyState';
import { PrimaryNavigation } from '../components/PrimaryNavigation';
import { WorkspaceHeader } from '../components/WorkspaceHeader';

export function AppShell() {
  return (
    <div className="min-h-screen bg-surface-canvas text-content-primary">
      <div className="grid min-h-screen grid-cols-[var(--app-sidebar-width)_minmax(0,1fr)]">
        <PrimaryNavigation />
        <div className="flex min-w-0 flex-col">
          <WorkspaceHeader />
          <main className="flex min-h-0 flex-1 p-6 sm:p-8" aria-label="Master Template workspace">
            <WorkspaceEmptyState />
          </main>
        </div>
      </div>
    </div>
  );
}
