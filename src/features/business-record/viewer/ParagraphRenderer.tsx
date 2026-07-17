import type { ParagraphNode } from '../parser/ast';

interface ParagraphRendererProps {
  node: ParagraphNode;
}

export function ParagraphRenderer({ node }: ParagraphRendererProps) {
  return (
    <p className="text-sm leading-7 text-content-secondary">
      {node.text}
    </p>
  );
}
