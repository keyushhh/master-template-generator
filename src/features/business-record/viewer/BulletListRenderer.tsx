import type { BulletListNode } from '../parser/ast';

interface BulletListRendererProps {
  node: BulletListNode;
}

export function BulletListRenderer({ node }: BulletListRendererProps) {
  if (node.items.length === 0) return null;

  return (
    <ul className="space-y-2">
      {node.items.map((item, index) => (
        <li key={index} className="flex items-start gap-2.5">
          <span
            className="mt-[0.4rem] size-1.5 shrink-0 rounded-full bg-action-primary"
            aria-hidden="true"
          />
          <span className="text-sm leading-6 text-content-secondary">{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
