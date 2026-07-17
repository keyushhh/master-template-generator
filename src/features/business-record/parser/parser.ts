import type { Token } from './tokens';
import type {
  DocumentNode,
  MetadataNode,
  SectionNode,
  ParagraphNode,
  BulletListNode,
  BulletListItemNode,
  UnsupportedNode,
} from './ast';

export function parse(tokens: Token[]): DocumentNode {
  const sections: SectionNode[] = [];
  const metadataValues: Record<string, string> = {};
  
  let i = 0;

  // 1. Parse Metadata block if present
  if (tokens.length > 0 && tokens[0].type === 'FRONTMATTER') {
    const frontmatterToken = tokens[0];
    const lines = frontmatterToken.value.split('\n');
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
        if (key) {
          metadataValues[key] = value;
        }
      }
    }
    i = 1; // Move past frontmatter
  }

  const metadata: MetadataNode = {
    type: 'Metadata',
    values: metadataValues,
  };

  let currentSection: SectionNode | null = null;

  // Helper to ensure a section context exists
  const ensureSectionContext = (line: number) => {
    if (!currentSection) {
      currentSection = {
        type: 'Section',
        heading: {
          type: 'Heading',
          level: 1,
          text: '', // Implicit overview heading
        },
        children: [],
      };
      sections.push(currentSection);
    }
  };

  // 2. Parse remaining tokens
  for (; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'EOF') {
      break;
    }

    switch (token.type) {
      case 'HEADING_1':
      case 'HEADING_2': {
        currentSection = {
          type: 'Section',
          heading: {
            type: 'Heading',
            level: token.type === 'HEADING_1' ? 1 : 2,
            text: token.value,
          },
          children: [],
        };
        sections.push(currentSection);
        break;
      }

      case 'PARAGRAPH': {
        ensureSectionContext(token.line);
        if (currentSection) {
          currentSection.children.push({
            type: 'Paragraph',
            text: token.value,
          });
        }
        break;
      }

      case 'BULLET_ITEM': {
        ensureSectionContext(token.line);
        if (currentSection) {
          const items: BulletListItemNode[] = [];
          // Group consecutive bullet items
          while (i < tokens.length && tokens[i].type === 'BULLET_ITEM') {
            items.push({
              type: 'BulletListItem',
              text: tokens[i].value,
            });
            i++;
          }
          // Offset increment from while condition
          i--;
          
          currentSection.children.push({
            type: 'BulletList',
            items,
          });
        }
        break;
      }

      case 'UNSUPPORTED': {
        ensureSectionContext(token.line);
        if (currentSection) {
          currentSection.children.push({
            type: 'Unsupported',
            kind: token.unsupportedKind || 'table',
            rawText: token.value,
            line: token.line,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return {
    type: 'Document',
    metadata,
    sections,
  };
}
