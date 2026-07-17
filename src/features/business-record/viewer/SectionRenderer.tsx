import type { SectionNode } from '../parser/ast';
import { ParagraphRenderer } from './ParagraphRenderer';
import { BulletListRenderer } from './BulletListRenderer';
import { UnsupportedNodeRenderer } from './UnsupportedNodeRenderer';

interface SectionRendererProps {
  section: SectionNode;
  index: number;
}

export function SectionRenderer({ section, index }: SectionRendererProps) {
  const { heading, children } = section;

  return (
    <section aria-labelledby={`section-heading-${index}`}>
      {heading.text ? (
        heading.level === 1 ? (
          <h2
            id={`section-heading-${index}`}
            className="font-display text-xl font-semibold tracking-tight text-content-primary"
          >
            {heading.text}
          </h2>
        ) : (
          <h3
            id={`section-heading-${index}`}
            className="font-display text-base font-semibold tracking-tight text-content-primary"
          >
            {heading.text}
          </h3>
        )
      ) : null}

      {children.length > 0 && (
        <div className={`space-y-4 ${heading.text ? 'mt-4' : ''}`}>
          {children.map((child, childIndex) => {
            switch (child.type) {
              case 'Paragraph':
                return <ParagraphRenderer key={childIndex} node={child} />;
              case 'BulletList':
                return <BulletListRenderer key={childIndex} node={child} />;
              case 'Unsupported':
                return <UnsupportedNodeRenderer key={childIndex} node={child} />;
              default:
                return null;
            }
          })}
        </div>
      )}
    </section>
  );
}
