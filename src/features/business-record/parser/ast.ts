export type ASTNode =
  | DocumentNode
  | MetadataNode
  | SectionNode
  | HeadingNode
  | ParagraphNode
  | BulletListNode
  | BulletListItemNode
  | UnsupportedNode;

export interface DocumentNode {
  type: 'Document';
  metadata: MetadataNode;
  sections: SectionNode[];
}

export interface MetadataNode {
  type: 'Metadata';
  values: Record<string, string>;
}

export interface SectionNode {
  type: 'Section';
  heading: HeadingNode;
  children: (ParagraphNode | BulletListNode | UnsupportedNode)[];
}

export interface HeadingNode {
  type: 'Heading';
  level: 1 | 2;
  text: string;
}

export interface ParagraphNode {
  type: 'Paragraph';
  text: string;
}

export interface BulletListNode {
  type: 'BulletList';
  items: BulletListItemNode[];
}

export interface BulletListItemNode {
  type: 'BulletListItem';
  text: string;
}

export interface UnsupportedNode {
  type: 'Unsupported';
  kind: 'table' | 'code-block' | 'blockquote' | 'image' | 'html';
  rawText: string;
  line: number;
}
