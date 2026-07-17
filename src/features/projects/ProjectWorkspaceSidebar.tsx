import { Link, NavLink, useParams } from 'react-router-dom';

const workspaceSections = [
  { name: 'Overview', path: 'overview' },
  { name: 'Business Record', path: 'business-record' },
  { name: 'Presentations', path: 'presentations' },
  { name: 'Assets', path: 'assets' },
  { name: 'Exports', path: 'exports' },
  { name: 'Settings', path: 'settings' },
];

export function ProjectWorkspaceSidebar({ projectName }: { projectName: string }) {
  const { projectId } = useParams();

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
        {workspaceSections.map((section) => (
          <NavLink
            key={section.path}
            to={`/projects/${projectId}/${section.path}`}
            className={({ isActive }) =>
              `block w-full rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-action-primary-subtle text-action-primary font-semibold'
                  : 'text-content-secondary hover:bg-surface-subtle hover:text-content-primary'
              }`
            }
          >
            {section.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
