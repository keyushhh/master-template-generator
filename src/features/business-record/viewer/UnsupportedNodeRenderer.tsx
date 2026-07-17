import type { UnsupportedNode } from '../parser/ast';

interface UnsupportedNodeRendererProps {
  node: UnsupportedNode;
}

const KIND_LABELS: Record<UnsupportedNode['kind'], string> = {
  'table': 'Table',
  'code-block': 'Code Block',
  'blockquote': 'Blockquote',
  'image': 'Image',
  'html': 'HTML Block',
};

const KIND_EXPLANATIONS: Record<UnsupportedNode['kind'], string> = {
  'table': 'This document contains a Markdown table that is not yet interpreted.',
  'code-block': 'This document contains a fenced code block that is not yet interpreted.',
  'blockquote': 'This document contains a Markdown blockquote that is not yet interpreted.',
  'image': 'This document contains an image reference that is not yet interpreted.',
  'html': 'This document contains a raw HTML block that is not yet interpreted.',
};

export function UnsupportedNodeRenderer({ node }: UnsupportedNodeRendererProps) {
  const label = KIND_LABELS[node.kind];
  const explanation = KIND_EXPLANATIONS[node.kind];

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-amber-500/20 bg-amber-500/[0.04] p-4"
      role="note"
      aria-label={`Unsupported construct: ${label}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-sm text-amber-500" aria-hidden="true">⚠</span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-sm font-semibold text-amber-600">
              {label} detected
            </p>
            <span className="font-mono text-xs text-content-muted">
              line {node.line}
            </span>
          </div>
          <p className="text-sm text-content-secondary leading-5">
            {explanation}
          </p>
          {node.rawText && (
            <pre className="mt-3 max-h-36 overflow-auto rounded-[var(--radius-md)] border border-amber-500/10 bg-surface-canvas p-3 font-mono text-xs leading-5 text-content-muted">
              {node.rawText.length > 500
                ? node.rawText.slice(0, 500) + '\n…(truncated)'
                : node.rawText}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
