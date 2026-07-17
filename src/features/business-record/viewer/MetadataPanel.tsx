import type { MetadataNode } from '../parser/ast';

interface MetadataPanelProps {
  metadata: MetadataNode;
}

const DISPLAY_KEYS = ['client', 'title', 'version', 'type'] as const;

const KEY_LABELS: Record<string, string> = {
  client: 'Client',
  title: 'Title',
  version: 'Version',
  type: 'Type',
};

export function MetadataPanel({ metadata }: MetadataPanelProps) {
  const primaryEntries = DISPLAY_KEYS
    .map((key) => ({ key, label: KEY_LABELS[key], value: metadata.values[key] }))
    .filter((entry) => entry.value != null && entry.value !== '');

  const remainingEntries = Object.entries(metadata.values).filter(
    ([key]) => !DISPLAY_KEYS.includes(key as typeof DISPLAY_KEYS[number])
  );

  if (primaryEntries.length === 0 && remainingEntries.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-border-default bg-surface-panel p-6 shadow-[var(--shadow-xs)]">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
        Document Metadata
      </h2>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {primaryEntries.map(({ key, label, value }) => (
          <div key={key}>
            <dt className="text-xs font-medium uppercase tracking-wide text-content-muted">
              {label}
            </dt>
            <dd className="mt-1.5 font-mono text-sm font-semibold text-content-primary">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {remainingEntries.length > 0 && (
        <div className="mt-5 border-t border-border-subtle pt-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
            Additional Metadata
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {remainingEntries.map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs font-medium uppercase tracking-wide text-content-muted">
                  {key}
                </dt>
                <dd className="mt-1 font-mono text-sm text-content-secondary">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
