const navigationItems = [
  { label: 'Workspace', current: true },
  { label: 'Library', current: false },
];

export function PrimaryNavigation() {
  return (
    <aside className="flex min-h-screen flex-col border-r border-border-subtle bg-surface-panel px-3 py-4" aria-label="Primary navigation">
      <div className="mb-9 flex items-center gap-3 px-2">
        <div className="grid size-8 place-items-center rounded-[var(--radius-md)] bg-action-primary font-display text-sm font-bold text-content-inverse">
          M
        </div>
        <span className="font-display text-sm font-semibold tracking-tight text-content-primary">Master Template</span>
      </div>

      <nav className="space-y-1">
        {navigationItems.map((item) => (
          <button
            className={`flex w-full items-center rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium transition-colors ${
              item.current
                ? 'bg-action-primary-subtle text-action-primary'
                : 'text-content-secondary hover:bg-surface-subtle hover:text-content-primary'
            }`}
            key={item.label}
            type="button"
            aria-current={item.current ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-border-subtle px-2 pt-4">
        <p className="font-mono text-xs text-content-muted">v0.1</p>
      </div>
    </aside>
  );
}
