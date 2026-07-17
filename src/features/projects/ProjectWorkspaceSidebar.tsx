import { Link } from 'react-router-dom';

const workspaceSections = ['Overview', 'Business Record', 'Presentations', 'Assets', 'Exports', 'Settings'];

export function ProjectWorkspaceSidebar({ projectName }: { projectName: string }) {
  return (
    <aside className="hidden min-h-screen w-60 shrink-0 flex-col border-r border-border-subtle bg-surface-panel px-3 py-4 md:flex" aria-label="Project navigation">
      <Link className="mb-8 px-2 font-mono text-xs uppercase tracking-[0.12em] text-content-muted transition-colors hover:text-content-primary" to="/">
        ← All projects
      </Link>
      <div className="mb-6 px-2">
        <p className="truncate font-display text-sm font-semibold text-content-primary">{projectName}</p>
        <p className="mt-1 font-mono text-xs text-content-muted">Project workspace</p>
      </div>
      <nav className="space-y-1">
        {workspaceSections.map((section, index) => (
          <button
            className={`w-full rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium transition-colors ${
              index === 0
                ? 'bg-action-primary-subtle text-action-primary'
                : 'text-content-secondary hover:bg-surface-subtle hover:text-content-primary'
            }`}
            key={section}
            type="button"
            aria-current={index === 0 ? 'page' : undefined}
          >
            {section}
          </button>
        ))}
      </nav>
    </aside>
  );
}
