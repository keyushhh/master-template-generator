import { motion } from 'framer-motion';
import type { DocumentNode } from '../parser/ast';
import { MetadataPanel } from './MetadataPanel';
import { SectionRenderer } from './SectionRenderer';

interface BusinessRecordViewerProps {
  ast: DocumentNode;
  filename: string;
  onReimport: () => void;
}

export function BusinessRecordViewer({ ast, filename, onReimport }: BusinessRecordViewerProps) {
  const unsupportedCount = ast.sections.reduce(
    (count, section) =>
      count + section.children.filter((child) => child.type === 'Unsupported').length,
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Viewer Header */}
      <div className="flex flex-col gap-4 rounded-[var(--radius-xl)] border border-border-default bg-surface-panel p-5 shadow-[var(--shadow-xs)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-emerald-500/10 text-base text-emerald-500">
            ✓
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content-primary">{filename}</p>
            <p className="font-mono text-xs text-content-muted">
              {ast.sections.length} {ast.sections.length === 1 ? 'section' : 'sections'}
              {unsupportedCount > 0 && (
                <> · <span className="text-amber-500">{unsupportedCount} unsupported {unsupportedCount === 1 ? 'construct' : 'constructs'}</span></>
              )}
            </p>
          </div>
        </div>

        <button
          className="inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-4 py-2 text-sm font-medium text-content-secondary transition-all hover:bg-surface-subtle hover:text-content-primary active:scale-95"
          type="button"
          onClick={onReimport}
        >
          Re-import File
        </button>
      </div>

      {/* Metadata Panel */}
      <MetadataPanel metadata={ast.metadata} />

      {/* Sections */}
      {ast.sections.length > 0 ? (
        <div className="space-y-1">
          {ast.sections.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.04, ease: 'easeOut' }}
              className="rounded-[var(--radius-xl)] border border-border-subtle bg-surface-panel p-6 shadow-[var(--shadow-xs)]"
            >
              <SectionRenderer section={section} index={index} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-32 flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border-strong bg-surface-panel p-6 text-center">
          <p className="text-sm text-content-muted">
            No content sections were found in this document.
          </p>
        </div>
      )}
    </motion.div>
  );
}
