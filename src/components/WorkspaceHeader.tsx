export function WorkspaceHeader() {
  return (
    <header className="flex min-h-16 items-center justify-between border-b border-border-subtle bg-surface-panel px-6 sm:px-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-content-muted">Workspace</p>
        <h1 className="mt-1 font-display text-xl font-semibold tracking-tight text-content-primary">Projects</h1>
      </div>
      <div className="rounded-full border border-border-default px-3 py-1.5 font-mono text-xs text-content-secondary">
        Draft
      </div>
    </header>
  );
}
